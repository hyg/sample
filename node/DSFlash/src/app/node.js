'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { EventEmitter } = require('events')

const P = require('../protocol')
const { UDPSocket } = require('../net/udp')
const DHT = require('../dht/dht')
const { Puncher } = require('../net/punch')
const Session = require('../net/session')
const { discover, parseServer } = require('../net/stun')
const { analyze } = require('../net/nat')
const { loadIdentity, loadNodeId } = require('../util/keys')
const { createLogger } = require('../util/log')
const { sha1 } = require('../util/bytes')
const { normalize, localAddresses } = require('./config')

/**
 * 一个 P2P 节点 = 一个 UDP 端口 + 一套 DHT + 若干加密会话。
 *
 * 职责边界：
 *   - 不依赖任何自建服务端；DHT 与 STUN 都是公共基础设施，仅参与"找地址"。
 *   - 一旦找到地址，消息只在两端之间点对点流动。
 */
class P2PNode extends EventEmitter {
  constructor (cfg = {}) {
    super()
    this.cfg = normalize(cfg)
    this.log = createLogger(this.cfg.logLevel)

    this.sessions = new Map() // addrKey -> Session
    this.byPeer = new Map() // peerId -> Session
    this.knownPeers = new Map() // addrKey -> {host, port, from}
    this.nat = null
    this.stunResults = []
    this.selfHosts = new Set() // 自身出口 IP（由自连检测学到，多出口 CGNAT 下很有用）
    this.observed = new Map() // 收到过 UDP 包的源地址 -> 次数（调试对账用）
    this._loggedSrc = new Set() // 已打印过"收到包"的来源，避免刷屏
    this.announced = [] // 本次公告出去的地址（调试对账用）
    this._punchHits = new Map()

    this.peerId = null
    this.listenPort = 0
    this.startedAt = 0
    this._timers = []
    this._stopping = false
    this._stats = { announces: 0, lookups: 0, handshakes: 0, dropped: 0 }
  }

  /* ------------------------------------------------------------------ */
  /* 启动                                                                */
  /* ------------------------------------------------------------------ */

  async start () {
    if (this.socket) throw new Error('already started')
    this.startedAt = Date.now()

    this.identity = loadIdentity(this.cfg.dataDir)
    this.peerId = this.identity.peerId
    // 网络口令 → 会话密钥派生用的 PSK；用 scrypt 让弱口令也没那么好猜
    this.netKey = crypto.scryptSync(
      `${this.cfg.network}\u0000${this.cfg.secret || this.cfg.network}`,
      'p2pnet/v1/psk', 32
    )

    this.socket = new UDPSocket()
    this.listenPort = await this.socket.bind(this.cfg.listenPort)
    this.socket.on('error', (err) => this.log.warn('UDP socket 错误:', err.message))

    this.dht = new DHT({
      socket: this.socket,
      id: loadNodeId(this.cfg.dataDir),
      bootstrap: this._bootstrapList(),
      logger: this.log
    })

    this.puncher = new Puncher(this.socket, {
      interval: 400,
      holdMs: Math.max(60000, this.cfg.lookupInterval * 2)
    })

    this._wire()

    // --peer: 跳过 DHT，直接对角色的地址打洞（联调时可控）
    for (const hp of this.cfg.peers || []) {
      this.puncher.add(hp.host, hp.port)
      this.knownPeers.set(hp.host + ':' + hp.port, { host: hp.host, port: hp.port, from: 'manual' })
      this.log.info(`手动指定对端: ${hp.host}:${hp.port}`)
    }

    this.log.info(`节点启动 peerId=${this.peerId} udp=${this.listenPort} 网络=${this.cfg.network}`)

    // 先完成一次 DHT + STUN，再进入周期任务（不阻塞 start 返回）
    this._bootstrapTask = this._initialDiscovery()

    this._timers.push(setInterval(() => {
      this._announce().catch(() => {})
    }, this.cfg.announceInterval))

    this._timers.push(setInterval(() => {
      this._lookup().catch(() => {})
    }, this.cfg.lookupInterval))

    // 启动后的"发现冲刺"：首分钟多跑几次，让对端尽快浮现，
    // 之后交给上面的周期任务维持
    for (const ms of [2000, 5000, 10000, 20000, 40000]) {
      const t = setTimeout(() => {
        this._announce().catch(() => {})
        this._lookup().catch(() => {})
      }, ms)
      if (t.unref) t.unref()
      this._timers.push(t)
    }

    if (this.cfg.debugReportUrl) {
      this.log.info(`调试上报已启用 → ${this.cfg.debugReportUrl}`)
      const t = setInterval(() => { this._reportDebug() }, 5000)
      if (t.unref) t.unref()
      this._timers.push(t)
      setTimeout(() => { this._reportDebug() }, 3000)
    }

    this._timers.forEach(t => (t.unref && t.unref()))

    return this
  }

  _observe (rinfo, kind) {
    const k = rinfo.address + ':' + rinfo.port
    this.observed.set(k, (this.observed.get(k) || 0) + 1)
    if (!this._loggedSrc.has(k)) {
      this._loggedSrc.add(k)
      this.log.debug(`收到${kind || 'UDP'}包 ← ${k}`)
    }
  }

  _wire () {
    this.socket.on('punch', (buf, rinfo) => {
      this._observe(rinfo, '打洞')
      const key = rinfo.address + ':' + rinfo.port
      const known = this.puncher.has(rinfo.address, rinfo.port)
      if (!known) {
        this.puncher.add(rinfo.address, rinfo.port)
        this.knownPeers.set(key, { host: rinfo.address, port: rinfo.port, from: 'punch' })
      }

      // 开始握手的判定：
      //  - 该地址本来就在我们的打洞目标表里 → 对端确实想连我们；
      //  - 否则累计收到同一地址 2 次探测再说（防止随机扫描轻易拉起 192 字节的 HELLO）。
      // 这个"第二次才握手"的规则还有一个关键作用：两侧都是对称 NAT 时，
      // 双方看到的都是对方"随目标变化"的端口，必须靠对观测到的源地址回包才能互相穿越，
      // 若无条件只在"已知目标"上握手，就会陷入互踢却永远不握手的死锁。
      const hits = (this._punchHits.get(key) || 0) + 1
      this._punchHits.set(key, hits)
      if (hits > 64) this._punchHits.delete(key)

      if (known || hits >= 2) this._ensureSession(rinfo, true)
      this.emit('punch', { host: rinfo.address, port: rinfo.port })
    })

    this.socket.on('handshake', (buf, rinfo) => {
      this._observe(rinfo, '握手')
      const s = this._ensureSession(rinfo, true)
      if (s) s.onHandshake(buf)
    })

    this.socket.on('frame', (buf, rinfo) => {
      this._observe(rinfo, '数据')
      const s = this.sessions.get(rinfo.address + ':' + rinfo.port)
      if (s) s.onFrame(buf)
    })
  }

  /* ------------------------------------------------------------------ */
  /* 发现：DHT + STUN                                                    */
  /* ------------------------------------------------------------------ */

  async _initialDiscovery () {
    try {
      // STUN 与 DHT 接入互不依赖，并行做
      const [, nodes] = await Promise.all([
        this._stun().catch(e => { this.log.warn('STUN 探测失败:', e.message) }),
        this.dht.bootstrap().catch(e => { this.log.warn('DHT 接入失败:', e.message); return 0 })
      ])
      const configured = this.cfg.bootstrap.concat(this.cfg.extraBootstrap).length
      if (!nodes && configured) {
        this.log.warn(`DHT 未接入任何节点（配置了 ${configured} 个引导节点但都无响应，检查 UDP 出网）`)
      }
      await this._announce()
      await this._lookup()
    } catch (e) {
      this.log.warn('初始发现失败:', e.message)
    }
  }

  async _stun () {
    const servers = (this.cfg.stun || []).map(s => {
      try { return parseServer(s) } catch (e) { return null }
    }).filter(Boolean)

    if (!servers.length) {
      this.nat = {
        behavior: 'unknown',
        publicIp: null,
        publicPort: null,
        servers: 0,
        responsive: 0,
        mappings: [],
        candidates: [this.listenPort]
      }
      return this.nat
    }

    this.stunResults = await discover(this.socket, servers, this.cfg.stunTimeout)
    this.nat = analyze(this.stunResults, this.listenPort, { maxCandidates: 5 })

    const okCount = this.nat.responsive
    if (okCount === 0) {
      this.log.warn(`STUN: ${servers.length} 个服务器均无响应，退化为仅公布本地端口`)
    } else {
      this.log.info(
        `STUN: ${okCount}/${servers.length} 响应，映射 ${this.nat.publicIp}:${this.nat.publicPort} ` +
        `NAT=${this.nat.behavior} 候选端口=${this.nat.candidates.join(',')}`
      )
    }
    return this.nat
  }

  _topic (offset = 0) {
    const epoch = this.cfg.epochMs > 0
      ? Math.floor(Date.now() / this.cfg.epochMs) + offset
      : 0
    return sha1(Buffer.from(P.TOPIC_PREFIX + this.cfg.network + '|' + epoch))
  }

  async _announce () {
    if (!this.nat) return
    const topic = this._topic(0)
    const ports = this.nat.candidates.slice(0, 3)
    await this.dht.announce(topic, ports, this.nat.publicIp)
    this._stats.announces++
    const ip = this.nat.publicIp || '127.0.0.1'
    this.announced = ports.map(p => `${ip}:${p}`)
    this.log.debug(`DHT: 已公布 ${this.nat.publicIp || '?'}:${ports.join(',')}（主题 ${topic.toString('hex').slice(0, 8)}…）`)
    this.emit('announce', { topic, ports })
  }

  async _lookup () {
    const topics = [this._topic(0)]
    if (this.cfg.epochMs > 0) topics.push(this._topic(-1)) // 兼容刚跨过轮换边界的对端

    const seen = new Set()
    for (const topic of topics) {
      let res
      try {
        res = await this.dht.getPeers(topic)
      } catch (e) {
        continue
      }
      for (const p of res.peers) {
        const key = p.host + ':' + p.port
        if (seen.has(key)) continue
        seen.add(key)
        if (this._isSelf(p)) continue
        if (!this.knownPeers.has(key)) {
          this.log.info(`DHT: 发现节点 ${key}`)
        }
        this.knownPeers.set(key, { host: p.host, port: p.port, from: 'dht' })
        this.puncher.add(p.host, p.port)
        this.emit('candidate', p)
      }
      // 顺便刷新路由表
      this.dht.lookup(topic).catch(() => {})
    }
    this._stats.lookups++
  }

  _isSelf (p) {
    // 多出口 CGNAT 下，DHT 里会看到"自己"带着别的出口 IP，靠端口集合识别
    if (this.selfHosts.has(p.host) && this.nat && this.nat.candidates.includes(p.port)) return true
    if (p.port === this.listenPort) {
      if (p.host === '127.0.0.1' || p.host === '0.0.0.0') return true
      if (this.nat && p.host === this.nat.publicIp) return true
      if (localAddresses().includes(p.host)) return true
    }
    if (this.nat && this.nat.publicIp === p.host &&
        this.nat.candidates.includes(p.port)) return true
    return false
  }

  /* ------------------------------------------------------------------ */
  /* 会话                                                                */
  /* ------------------------------------------------------------------ */

  _ensureSession (rinfo, create) {
    const key = rinfo.address + ':' + rinfo.port
    const existing = this.sessions.get(key)
    if (existing && existing.state !== 'closed') return existing
    if (!create) return null

    if (this.sessions.size >= this.cfg.maxSessions) {
      this._stats.dropped++
      this.log.warn(`会话数达到上限 ${this.cfg.maxSessions}，忽略 ${key}`)
      return null
    }

    const s = new Session({
      socket: this.socket,
      remote: { host: rinfo.address, port: rinfo.port },
      identity: this.identity,
      netKey: this.netKey,
      cfg: {
        chaff: this.cfg.chaff,
        jitter: this.cfg.jitter,
        rto: this.cfg.rto,
        idleTimeout: this.cfg.idleTimeout
      },
      logger: this.log
    })

    this.sessions.set(key, s)

    s.on('open', (peer) => {
      this._stats.handshakes++
      const other = this.byPeer.get(peer.peerId)
      if (other && other !== s && other.state === 'open') {
        // 同一身份已有一条更早的可用会话，保留旧的
        s.close('duplicate')
        return
      }
      this.byPeer.set(peer.peerId, s)
      this.puncher.remove(rinfo.address, rinfo.port)
      this.knownPeers.set(key, { host: rinfo.address, port: rinfo.port, from: 'session', peerId: peer.peerId })
      this.log.info(`已连接 peer=${peer.peerId} @ ${key}`)
      this.emit('peer', { peerId: peer.peerId, host: rinfo.address, port: rinfo.port })
    })

    s.on('message', (m) => {
      this.emit('message', {
        peerId: s.peer ? s.peer.peerId : null,
        host: rinfo.address,
        port: rinfo.port,
        appType: m.appType,
        payload: m.payload,
        text: m.payload.toString('utf8')
      })
    })

    s.on('close', (reason) => {
      if (this.sessions.get(key) === s) this.sessions.delete(key)
      if (s.peer && this.byPeer.get(s.peer.peerId) === s) this.byPeer.delete(s.peer.peerId)
      if (reason === 'self-connect') {
        // 打洞打到了自己：记下这个出口 IP，后续直接过滤
        this.selfHosts.add(rinfo.address)
        this.knownPeers.delete(key)
        this.puncher.remove(rinfo.address, rinfo.port)
        this.log.debug(`检测到自身出口地址 ${rinfo.address}，已加入自连过滤`)
      } else if (reason !== 'shutdown') {
        this.log.debug(`会话 ${key} 关闭: ${reason}`)
      }
      this.emit('peer:close', { peerId: s.peer ? s.peer.peerId : null, host: rinfo.address, port: rinfo.port, reason })
    })

    s.start()
    return s
  }

  /* ------------------------------------------------------------------ */
  /* 应用层发送                                                          */
  /* ------------------------------------------------------------------ */

  /** 发给某个 peerId（支持前缀匹配），返回实际命中的会话数 */
  send (target, text) {
    const payload = Buffer.from(String(text), 'utf8')
    if (target === 'all' || target === '*') return this.broadcast(text)

    let hit = 0
    if (this.byPeer.has(target)) {
      if (this.byPeer.get(target).send(P.APP.CHAT, payload)) hit++
      return hit
    }
    for (const [id, s] of this.byPeer) {
      if (id.startsWith(target)) {
        if (s.send(P.APP.CHAT, payload)) hit++
      }
    }
    return hit
  }

  /** 组装给调试面板用的对账数据 */
  debugPayload () {
    const discovered = []
    for (const p of this.knownPeers.values()) {
      if (p.from === 'dht') discovered.push(`${p.host}:${p.port}`)
    }
    return {
      peerId: this.peerId,
      label: require('os').hostname().slice(0, 32),
      listenPort: this.listenPort,
      nat: this.nat
        ? {
            behavior: this.nat.behavior,
            publicIp: this.nat.publicIp,
            publicPort: this.nat.publicPort,
            candidates: this.nat.candidates,
            responsive: this.nat.responsive,
            servers: this.nat.servers
          }
        : null,
      announced: this.announced,
      discovered,
      observed: [...this.observed.entries()]
        .map(([addr, hits]) => ({ addr, hits }))
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 64),
      peers: this.peers().map(p => ({ peerId: p.peerId, remote: `${p.host}:${p.port}` })),
      ts: Date.now()
    }
  }

  async _reportDebug () {
    const base = this.cfg.debugReportUrl
    if (!base) return
    const url = /\/report$/.test(base) ? base : base.replace(/\/+$/, '') + '/report'
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(this.debugPayload()),
        signal: AbortSignal.timeout(4000)
      })
    } catch (e) {
      this.log.debug('调试上报失败:', e.message)
    }
  }

  /** 立即做一轮"公告 + 发现"，用于 /find 或发送失败时的补救 */
  async discoverNow () {
    await this._announce().catch(() => {})
    await this._lookup().catch(() => {})
    return this.peers().length
  }

  broadcast (text) {
    const payload = Buffer.from(String(text), 'utf8')
    let n = 0
    for (const s of this.byPeer.values()) {
      if (s.send(P.APP.CHAT, payload)) n++
    }
    return n
  }

  peers () {
    const out = []
    for (const s of this.byPeer.values()) {
      const st = s.stats()
      out.push({
        peerId: st.peerId,
        host: s.remote.host,
        port: s.remote.port,
        state: st.state,
        ageSec: Math.round(st.ageMs / 1000),
        rxMsgs: st.rxMsgs,
        txMsgs: st.txMsgs,
        rxBytes: st.rxBytes,
        txBytes: st.txBytes
      })
    }
    return out
  }

  status () {
    return {
      peerId: this.peerId,
      listenPort: this.listenPort,
      network: this.cfg.network,
      topic: this._topic(0).toString('hex'),
      nat: this.nat,
      selfHosts: [...this.selfHosts],
      stunResults: this.stunResults,
      dhtNodes: this.dht ? this.dht.routing.size : 0,
      knownPeers: [...this.knownPeers.values()],
      punching: this.puncher ? this.puncher.list() : [],
      sessions: this.sessions.size,
      peers: this.peers(),
      stats: Object.assign({}, this._stats),
      uptimeSec: Math.round((Date.now() - this.startedAt) / 1000)
    }
  }

  /* ------------------------------------------------------------------ */
  /* 停止 + 产出可复用的 BOOTSTRAPS                                       */
  /* ------------------------------------------------------------------ */

  async stop () {
    if (this._stopping) return this._report
    this._stopping = true

    this.log.info('正在停止：先校验当前可用地址（可直接作为下次的 DHT BOOTSTRAPS）…')
    const bootstraps = await this.collectBootstraps()

    for (const s of this.sessions.values()) {
      try {
        s.send(P.APP.BYE, Buffer.alloc(0))
        s.close('shutdown')
      } catch (e) { /* ignore */ }
    }
    this.sessions.clear()
    this.byPeer.clear()

    this._timers.forEach(t => clearInterval(t))
    this._timers = []
    if (this.puncher) this.puncher.stop()
    if (this.dht) this.dht.stop()
    if (this.socket) this.socket.close()

    this._report = {
      peerId: this.peerId,
      network: this.cfg.network,
      dataDir: this.cfg.dataDir,
      listenPort: this.listenPort,
      publicEndpoint: this.nat && this.nat.publicIp
        ? { host: this.nat.publicIp, port: this.nat.publicPort }
        : null,
      nat: this.nat,
      bootstraps,
      generatedAt: new Date().toISOString(),
      uptimeSec: Math.round((Date.now() - this.startedAt) / 1000)
    }

    this._saveBootstraps(bootstraps)
    this.emit('stop', this._report)
    return this._report
  }

  /**
   * 逐个 ping 候选地址，只有"现在真的应答"的才输出。
   * 这一步很关键：DHT 路由表里往往有大量早已下线的节点，
   * 直接把整表丢给用户当 BOOTSTRAPS 是没有意义的。
   */
  async collectBootstraps () {
    if (!this.dht) return []
    const cands = new Map()

    for (const n of this.dht.routing.all()) {
      cands.set(`${n.host}:${n.port}`, { host: n.host, port: n.port, source: 'dht-routing' })
    }
    for (const p of this.knownPeers.values()) {
      const key = `${p.host}:${p.port}`
      if (!cands.has(key)) cands.set(key, { host: p.host, port: p.port, source: p.from || 'peer' })
    }
    for (const s of this.sessions.values()) {
      const key = `${s.remote.host}:${s.remote.port}`
      if (!cands.has(key)) cands.set(key, { host: s.remote.host, port: s.remote.port, source: 'session' })
    }
    for (const b of this.cfg.bootstrap.concat(this.cfg.extraBootstrap)) {
      if (!b || !b.host || !b.port) continue
      const key = `${b.host}:${b.port}`
      if (!cands.has(key)) cands.set(key, { host: b.host, port: b.port, source: 'configured' })
    }

    const list = [...cands.values()]
    const results = await Promise.all(list.map(async (c) => {
      const t0 = Date.now()
      try {
        await this.dht.ping(c.host, c.port, 2000)
        return Object.assign({}, c, { alive: true, rttMs: Date.now() - t0 })
      } catch (e) {
        return Object.assign({}, c, { alive: false })
      }
    }))

    return results
      .filter(r => r.alive)
      .sort((a, b) => a.rttMs - b.rttMs)
      .map(r => ({ host: r.host, port: r.port, rttMs: r.rttMs, source: r.source }))
  }

  _saveBootstraps (list) {
    try {
      fs.mkdirSync(this.cfg.dataDir, { recursive: true })
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const payload = {
        generatedAt: new Date().toISOString(),
        network: this.cfg.network,
        self: { peerId: this.peerId, udpPort: this.listenPort },
        bootstraps: list.map(x => ({ host: x.host, port: x.port }))
      }
      fs.writeFileSync(
        path.join(this.cfg.dataDir, `bootstraps-${ts}.json`),
        JSON.stringify(payload, null, 2)
      )
      fs.writeFileSync(
        path.join(this.cfg.dataDir, 'bootstraps-latest.json'),
        JSON.stringify(payload, null, 2)
      )
    } catch (e) {
      this.log.warn('写入 bootstraps 文件失败:', e.message)
    }
  }

  _bootstrapList () {
    const out = []
    const push = (h, p) => {
      if (!h || !p) return
      if (out.some(x => x.host === h && x.port === p)) return
      out.push({ host: h, port: p })
    }
    for (const b of this.cfg.bootstrap) push(b.host, b.port)
    for (const b of this.cfg.extraBootstrap) push(b.host, b.port)

    // 上次运行结束时保存下来的活节点，优先复用（局域网场景尤为重要）
    try {
      const f = path.join(this.cfg.dataDir, 'bootstraps-latest.json')
      if (fs.existsSync(f)) {
        const j = JSON.parse(fs.readFileSync(f, 'utf8'))
        for (const b of j.bootstraps || []) push(b.host, b.port)
      }
    } catch (e) { /* ignore */ }

    return out
  }
}

module.exports = { P2PNode }
