'use strict'

const crypto = require('crypto')
const { EventEmitter } = require('events')
const bencode = require('../util/bencode')
const RoutingTable = require('./routing')
const {
  encodeCompactNode,
  decodeCompactNodes,
  encodeCompactPeer,
  distanceCmp
} = require('../util/bytes')

const K = 8
const ALPHA = 3
const PEER_TTL = 30 * 60 * 1000

function str (b) {
  return Buffer.isBuffer(b) ? b.toString('utf8') : String(b)
}

/**
 * 极简 Kademlia DHT（BEP-5 兼容）。
 *
 * 只暴露三件事：
 *   - getPeers(infoHash)  → 该主题下所有已公告的 {host, port}
 *   - announce(infoHash, ports) → 把「我这个公网 ip:某一端口」登记到主题下
 *   - ping / lookup        → 维护路由表、支撑退出时的 BOOTSTRAPS 校验
 *
 * 关键隐私点：announce_peer 只登记 IP:port（BEP-5 的语义就是"我在这个地址"），
 * 不携带任何昵称、公钥、内容片段。DHT 节点能知道的仅此而已。
 */
class DHT extends EventEmitter {
  constructor (opts) {
    super()
    this.socket = opts.socket
    this.id = opts.id
    this.log = opts.logger || { debug () {}, info () {}, warn () {} }
    this.lookupTimeout = opts.lookupTimeout || 15000
    this.bootstrapNodes = (opts.bootstrap || []).slice()

    this.routing = new RoutingTable(this.id, K)
    this.tx = new Map()
    this.txSeq = 0

    this.peerStore = new Map() // infoHashHex -> Map(addrKey -> {host, port, expires})

    // token 密钥轮换：DHT 标准做法，防止任意人向我们写垃圾数据
    this.secrets = [crypto.randomBytes(8)]
    this._timers = []
    this._timers.push(setInterval(() => {
      this.secrets.unshift(crypto.randomBytes(8))
      if (this.secrets.length > 3) this.secrets.pop()
    }, 10 * 60 * 1000))
    this._timers.push(setInterval(() => this._clean(), 60 * 1000))
    this._timers.forEach(t => t.unref && t.unref())

    this.socket.on('krpc', (msg, rinfo) => this._onMessage(msg, rinfo))
  }

  /* ------------------------------------------------------------------ */
  /* 对外 API                                                            */
  /* ------------------------------------------------------------------ */

  async bootstrap () {
    const nodes = this.bootstrapNodes.filter(n => n && n.host && n.port)
    if (!nodes.length) {
      this.log.debug('DHT: 未配置 bootstrap 节点（仅作为被连接方/局域网直连）')
      return 0
    }
    await Promise.all(nodes.map(n =>
      this._query(n.host, n.port, 'find_node', { target: this.id }, 2500)
        .then(r => { if (r.nodes) this._addNodes(r.nodes) })
        .catch(() => null)
    ))
    await this.lookup(this.id, Math.min(this.lookupTimeout, 8000))
    this.log.info(`DHT: 路由表 ${this.routing.size} 个节点（bootstrap 尝试 ${nodes.length} 个）`)
    return this.routing.size
  }

  async lookup (target, timeout) {
    await this._iterativeLookup(target, 'find_node', null, timeout)
  }

  /**
   * 标准 Kademlia 迭代查询：不断向"当前已知离 target 最近的 K 个节点"逼近，
   * 直到最近 K 个都问过为止。
   *
   * 这一步的正确性直接决定 rendezvous 能否成功：两个节点必须收敛到
   * 同一批最近节点，A 的公告才可能被 B 查到。早期版本按路由表顺序批量问，
   * 结果两个节点问的是不同子集，互相发现不了。
   */
  async _iterativeLookup (target, method, infoHash, timeout) {
    const limit = timeout || this.lookupTimeout
    const cands = new Map()
    const addCand = (n) => {
      if (!n || !n.id || n.id.length !== 20) return
      if (n.id.equals(this.id)) return
      const hex = n.id.toString('hex')
      if (cands.has(hex)) return
      cands.set(hex, { id: n.id, host: n.host, port: n.port, queried: false, responded: false, token: null })
    }
    for (const n of this.routing.closest(target, 32)) addCand(n)

    const peers = new Map()
    const start = Date.now()
    const byDist = (a, b) => distanceCmp(target, a.id, b.id)

    while (Date.now() - start < limit) {
      const sorted = [...cands.values()].sort(byDist)
      const batch = sorted.slice(0, K).filter(c => !c.queried).slice(0, ALPHA)
      if (!batch.length) break
      batch.forEach(c => { c.queried = true })

      await Promise.all(batch.map(async (c) => {
        const args = method === 'get_peers' ? { info_hash: infoHash } : { target }
        try {
          const r = await this._query(c.host, c.port, method, args, 1500)
          c.responded = true
          if (r.nodes) for (const n of decodeCompactNodes(r.nodes)) addCand(n)
          if (Array.isArray(r.values)) {
            for (const v of r.values) {
              if (Buffer.isBuffer(v) && v.length === 6) {
                const key = v.toString('hex')
                if (!peers.has(key)) {
                  peers.set(key, {
                    host: `${v[0]}.${v[1]}.${v[2]}.${v[3]}`,
                    port: v.readUInt16BE(4)
                  })
                }
              }
            }
          }
          if (Buffer.isBuffer(r.token)) c.token = r.token
        } catch (e) {
          c.failed = true
        }
      }))
    }

    return { peers, sorted: [...cands.values()].sort(byDist) }
  }

  /** 迭代式 get_peers：返回该主题下的地址集合 + 可用于 announce 的 token */
  async getPeers (infoHash, timeout) {
    if (!this.routing.size) await this.bootstrap()
    const { peers, sorted } = await this._iterativeLookup(infoHash, 'get_peers', infoHash, timeout)

    // 合并本地 peer store：里面是别人公告给"我们"的地址。
    // 小规模网络（同主题最近的 K 个节点就是对端本身）时，远端只会把查询者
    // 自己的记录返回给它，若只看远端结果会全部被自连过滤掉，双方永远发现不了对方。
    const local = this.peerStore.get(infoHash.toString('hex'))
    if (local) {
      const now = Date.now()
      for (const [k, v] of local) {
        if (v.expires < now) continue
        const key = `${v.host}:${v.port}`
        const hex = encodeCompactPeer(v.host, v.port).toString('hex')
        if (!peers.has(hex) && !peers.has(key)) peers.set(hex, { host: v.host, port: v.port })
      }
    }

    const tokens = []
    for (const c of sorted) {
      if (!c.responded || !c.token) continue
      tokens.push({ host: c.host, port: c.port, token: c.token })
      if (tokens.length >= 16) break
    }
    return { peers: [...peers.values()], tokens }
  }

  /**
   * 公布"我在这个端口"。
   * 可传多个端口（对应不同候选映射），每个端口一次 announce_peer。
   * 只登记地址，不携带任何身份或内容。
   */
  async announce (infoHash, ports) {
    const list = (Array.isArray(ports) ? ports : [ports]).filter(p => p > 0 && p < 65536)
    if (!list.length) return 0

    const { tokens } = await this.getPeers(infoHash)
    if (!tokens.length) {
      this.log.debug('DHT: 没有拿到任何 token，本次 announce 跳过（可能网络不可达）')
      return 0
    }

    // 公告给"离主题最近的、且确实应答了的"那批节点；数量多一些可提高被查到的概率
    let sent = 0
    for (const t of tokens.slice(0, 16)) {
      for (const p of list) {
        this._query(t.host, t.port, 'announce_peer', {
          info_hash: infoHash,
          port: p,
          token: t.token,
          implied_port: 0
        }, 2000).then(() => { sent++ }).catch(() => {})
      }
    }
    return tokens.length
  }

  /** 对某个地址做一次 DHT ping，用于验证"它现在还能当 bootstrap" */
  ping (host, port, timeout = 1500) {
    return this._query(host, port, 'ping', {}, timeout)
  }

  stop () {
    this._timers.forEach(t => clearInterval(t))
    this._timers = []
    for (const [, p] of this.tx) {
      clearTimeout(p.timer)
      p.reject(new Error('dht stopped'))
    }
    this.tx.clear()
  }

  /* ------------------------------------------------------------------ */
  /* 收包处理                                                            */
  /* ------------------------------------------------------------------ */

  _onMessage (msg, rinfo) {
    const y = str(msg.y)
    try {
      if (y === 'q') return this._onQuery(msg, rinfo)
      if (y === 'r') return this._onResponse(msg, rinfo)
      if (y === 'e') return this._onError(msg, rinfo)
    } catch (e) {
      this.log.debug('DHT: 处理报文异常', e.message)
    }
  }

  _onQuery (msg, rinfo) {
    const q = str(msg.q)
    const a = msg.a || {}
    if (Buffer.isBuffer(a.id) && a.id.length === 20) {
      this.routing.add({ id: a.id, host: rinfo.address, port: rinfo.port })
    }

    const reply = (r) => this._send(rinfo, { y: 'r', t: msg.t, r: Object.assign({ id: this.id }, r) })
    const fail = (code, text) => this._send(rinfo, { y: 'e', t: msg.t, e: [code, text] })

    if (q === 'ping') return reply({})

    if (q === 'find_node') {
      const target = Buffer.isBuffer(a.target) && a.target.length === 20 ? a.target : this.id
      return reply({ nodes: this._compactNodes(this.routing.closest(target, K)) })
    }

    if (q === 'get_peers') {
      const ih = a.info_hash
      if (!Buffer.isBuffer(ih) || ih.length !== 20) return fail(203, 'bad info_hash')
      const values = this._values(ih)
      const r = { token: this._token(rinfo.address) }
      if (values.length) r.values = values
      else r.nodes = this._compactNodes(this.routing.closest(ih, K))
      return reply(r)
    }

    if (q === 'announce_peer') {
      const ih = a.info_hash
      if (!Buffer.isBuffer(ih) || ih.length !== 20) return fail(203, 'bad info_hash')
      if (!Buffer.isBuffer(a.token) || !this._checkToken(rinfo.address, a.token)) {
        return fail(203, 'bad token')
      }
      const implied = Number(a.implied_port) ? 1 : 0
      const port = implied ? rinfo.port : Number(a.port)
      if (!Number.isInteger(port) || port < 1 || port > 65535) return fail(203, 'bad port')
      this._storePeer(ih, rinfo.address, port)
      return reply({})
    }

    return fail(204, 'method unknown')
  }

  _onResponse (msg, rinfo) {
    const key = Buffer.isBuffer(msg.t) ? msg.t.toString('hex') : String(msg.t)
    const p = this.tx.get(key)
    const r = msg.r || {}
    if (Buffer.isBuffer(r.id) && r.id.length === 20) {
      this.routing.add({ id: r.id, host: rinfo.address, port: rinfo.port })
    }
    if (!p) return
    clearTimeout(p.timer)
    this.tx.delete(key)
    p.resolve(r)
  }

  _onError (msg, rinfo) {
    const key = Buffer.isBuffer(msg.t) ? msg.t.toString('hex') : String(msg.t)
    const p = this.tx.get(key)
    if (!p) return
    clearTimeout(p.timer)
    this.tx.delete(key)
    p.reject(new Error('krpc error ' + JSON.stringify(msg.e)))
  }

  /* ------------------------------------------------------------------ */
  /* 底层                                                                */
  /* ------------------------------------------------------------------ */

  _query (host, port, method, args, timeout = 1500) {
    return new Promise((resolve, reject) => {
      const t = Buffer.alloc(4)
      t.writeUInt32BE((++this.txSeq) >>> 0, 0)
      const key = t.toString('hex')
      const timer = setTimeout(() => {
        this.tx.delete(key)
        reject(new Error(`krpc timeout ${method} ${host}:${port}`))
      }, timeout)
      timer.unref && timer.unref()
      this.tx.set(key, { resolve, reject, timer })
      this._send({ host, port }, { y: 'q', t, q: method, a: Object.assign({ id: this.id }, args) })
    })
  }

  _send (rinfo, msg) {
    let buf
    try { buf = bencode.encode(msg) } catch (e) { return }
    this.socket.send(buf, rinfo.host || rinfo.address, rinfo.port)
  }

  _addNodes (compactBuf) {
    if (!Buffer.isBuffer(compactBuf)) return
    for (const n of decodeCompactNodes(compactBuf)) {
      if (!n.id.equals(this.id)) this.routing.add(n)
    }
  }

  _compactNodes (nodes) {
    const parts = []
    for (const n of nodes) {
      try { parts.push(encodeCompactNode(n.id, n.host, n.port)) } catch (e) { /* skip */ }
    }
    return Buffer.concat(parts)
  }

  _token (ip) {
    return crypto.createHmac('sha1', this.secrets[0]).update(String(ip)).digest()
  }

  _checkToken (ip, token) {
    for (const s of this.secrets) {
      const expect = crypto.createHmac('sha1', s).update(String(ip)).digest()
      if (expect.length === token.length && crypto.timingSafeEqual(expect, token)) return true
    }
    return false
  }

  _storePeer (ih, host, port, fallbackHost) {
    const hex = ih.toString('hex')
    let m = this.peerStore.get(hex)
    if (!m) {
      m = new Map()
      this.peerStore.set(hex, m)
    }
    const h = host || fallbackHost
    if (!h) return
    m.set(`${h}:${port}`, { host: h, port, expires: Date.now() + PEER_TTL })
  }

  _values (ih) {
    const m = this.peerStore.get(ih.toString('hex'))
    if (!m) return []
    const now = Date.now()
    const out = []
    for (const [k, v] of m) {
      if (v.expires < now) { m.delete(k); continue }
      try { out.push(encodeCompactPeer(v.host, v.port)) } catch (e) { /* skip */ }
      if (out.length >= 32) break
    }
    return out
  }

  _clean () {
    const now = Date.now()
    for (const [hex, m] of this.peerStore) {
      for (const [k, v] of m) if (v.expires < now) m.delete(k)
      if (!m.size) this.peerStore.delete(hex)
    }
  }
}

module.exports = DHT
