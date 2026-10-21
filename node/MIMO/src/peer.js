import dgram from 'node:dgram'
import { EventEmitter } from 'node:events'
import crypto from 'node:crypto'
import {
  KEEPALIVE_INTERVAL,
  MAX_MESSAGE_CHUNK,
  PUNCH_FAST_INTERVAL,
  PUNCH_FAST_TRIES,
  PUNCH_MAX_LIFETIME,
  PUNCH_SLOW_INTERVAL,
  RECORD_TTL,
  SESSION_TIMEOUT,
  TIMEOUT_CHECK_INTERVAL
} from './defaults.js'
import { ecdh, generateX25519, hkdf32, hmac16, rawPublicKey, timingSafeEqual16 } from './keys.js'

const MAGIC = Buffer.from('P2PN')
const VERSION = 1
const T_INIT = 1
const T_RESP = 2
const T_DATA = 3
const HEADER_LEN = 6
const NAME_MAX = 15
const RESP_MIN_INTERVAL = 500

function truncateName (name) {
  const buf = Buffer.from(String(name || 'node'), 'utf8').subarray(0, NAME_MAX)
  return buf.toString('utf8')
}

function encodeHandshake (type, nodeId, name, ephPub, nonce, hmacKey) {
  const nameBuf = Buffer.from(name, 'utf8')
  const head = Buffer.alloc(HEADER_LEN)
  MAGIC.copy(head, 0)
  head[4] = VERSION
  head[5] = type
  const body = Buffer.concat([nodeId, Buffer.from([nameBuf.length]), nameBuf, ephPub, nonce])
  const mac = hmac16(hmacKey, Buffer.concat([head, body]))
  return Buffer.concat([head, body, mac])
}

function decodeHandshake (buf, hmacKey, expectedType) {
  if (buf.length < HEADER_LEN + 20 + 1 + 32 + 12 + 16) return null
  if (!buf.subarray(0, 4).equals(MAGIC)) return null
  if (buf[4] !== VERSION || buf[5] !== expectedType) return null
  const head = buf.subarray(0, HEADER_LEN)
  const nodeId = Buffer.from(buf.subarray(6, 26))
  const nameLen = buf[26]
  if (nameLen > NAME_MAX) return null
  const nameEnd = 27 + nameLen
  if (buf.length < nameEnd + 32 + 12 + 16) return null
  const name = buf.subarray(27, nameEnd).toString('utf8')
  const ephPub = Buffer.from(buf.subarray(nameEnd, nameEnd + 32))
  const nonce = Buffer.from(buf.subarray(nameEnd + 32, nameEnd + 44))
  const mac = buf.subarray(nameEnd + 44, nameEnd + 60)
  const expected = hmac16(hmacKey, Buffer.concat([head, buf.subarray(6, nameEnd + 44)]))
  if (!timingSafeEqual16(mac, expected)) return null
  return { nodeId, name: truncateName(name), ephPub, nonce }
}

function encodeData (counter, plaintext, key) {
  const head = Buffer.alloc(HEADER_LEN)
  MAGIC.copy(head, 0)
  head[4] = VERSION
  head[5] = T_DATA
  const ctrBuf = Buffer.alloc(8)
  ctrBuf.writeBigUInt64BE(counter)
  const nonce = Buffer.alloc(12)
  ctrBuf.copy(nonce, 4)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(Buffer.concat([head, ctrBuf]))
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return Buffer.concat([head, ctrBuf, ct, cipher.getAuthTag()])
}

function tryDecryptData (buf, key) {
  if (buf.length < HEADER_LEN + 8 + 16) return null
  const head = buf.subarray(0, HEADER_LEN)
  if (!head.subarray(0, 4).equals(MAGIC) || head[4] !== VERSION || head[5] !== T_DATA) return null
  const ctrBuf = buf.subarray(HEADER_LEN, HEADER_LEN + 8)
  const counter = ctrBuf.readBigUInt64BE(0)
  const body = buf.subarray(HEADER_LEN + 8)
  if (body.length < 16) return null
  const ct = body.subarray(0, body.length - 16)
  const tag = body.subarray(body.length - 16)
  const nonce = Buffer.alloc(12)
  ctrBuf.copy(nonce, 4)
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce)
    decipher.setAAD(Buffer.concat([head, ctrBuf]))
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(ct), decipher.final()])
    return { counter, plain }
  } catch {
    return null
  }
}

function deriveSessionKeys (shared, initNonce, respNonce) {
  const salt = Buffer.concat([initNonce, respNonce])
  return {
    kA2B: hkdf32(shared, salt, Buffer.from('p2p-session/a2b/v1')),
    kB2A: hkdf32(shared, salt, Buffer.from('p2p-session/b2a/v1'))
  }
}

export class PeerManager extends EventEmitter {
  constructor ({ roomKeys, nodeId, name, commPort = 0, verbose = false, log = console.log }) {
    super()
    this.roomKeys = roomKeys
    this.nodeId = nodeId
    this.selfIdHex = nodeId.toString('hex')
    this.name = truncateName(name)
    this.commPort = commPort
    this.verbose = verbose
    this.log = log
    this.sessions = new Map()
    this.punches = new Map()
    this.initiations = new Map()
    this.pendingInits = new Map()
    this.lastRespAt = new Map()
    this.lastInitLogAt = new Map()
    this.peerInboundAt = new Map()
    this.reassembly = new Map()
    this.publicInfo = null
    this.running = false
  }

  async start () {
    this.socket = dgram.createSocket('udp4')
    this.socket.on('message', (buf, rinfo) => this.onMessage(buf, rinfo))
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        this.socket.removeListener('error', onError)
        this.socket.removeListener('listening', onListening)
      }
      const onError = (err) => {
        cleanup()
        reject(new Error(`通信端口 ${this.commPort || '随机'} 监听失败: ${err.code || err.message}`))
      }
      const onListening = () => {
        cleanup()
        resolve()
      }
      this.socket.once('error', onError)
      this.socket.once('listening', onListening)
      this.socket.bind(this.commPort)
    })
    this.socket.on('error', (err) => this.emit('error', err))
    this.running = true
    this.keepaliveTimer = setInterval(() => this.keepaliveTick(), KEEPALIVE_INTERVAL)
    this.timeoutTimer = setInterval(() => this.timeoutTick(), TIMEOUT_CHECK_INTERVAL)
  }

  localAddress () {
    try {
      return this.socket.address()
    } catch {
      return null
    }
  }

  setPublicInfo (info) {
    this.publicInfo = info
  }

  updateRoster (roster) {
    if (!this.running) return
    const ts = tsNow()
    for (const [id, entry] of Object.entries(roster || {})) {
      if (id === this.selfIdHex) continue
      if (!entry || ts - entry.ts > RECORD_TTL) continue
      if (this.sessions.has(id)) continue
      this.ensurePunch(id, entry)
    }
  }

  ensurePunch (id, entry) {
    let state = this.punches.get(id)
    if (state) {
      state.entry = entry
      return
    }
    const addrs = []
    if (entry.ip && entry.port) addrs.push({ host: entry.ip, port: entry.port, via: '公网' })
    for (const lan of entry.lan || []) {
      if (typeof lan === 'string' && lan !== entry.ip) addrs.push({ host: lan, port: entry.lport || entry.port, via: '内网' })
    }
    if (!addrs.length) return
    const { priv, pub } = generateX25519()
    state = {
      id,
      entry,
      addrs,
      addrIdx: 0,
      tries: 0,
      startedAt: tsNow(),
      timer: null,
      eph: { priv, pub: rawPublicKey(pub), nonce: crypto.randomBytes(12) }
    }
    this.initiations.set(id, { priv, pub: state.eph.pub, nonce: state.eph.nonce, name: this.name })
    this.punches.set(id, state)
    this.log(`[打洞] 开始连接节点 ${id.slice(0, 8)} 候选=${addrs.map((a) => `${a.via}:${a.host}:${a.port}`).join(' ')} NAT=${entry.nat || '未知'}`)
    state.timer = setTimeout(() => this.punchTick(state), 0)
  }

  punchTick (state) {
    if (!this.running || !this.punches.has(state.id) || this.sessions.has(state.id)) {
      this.stopPunch(state.id)
      return
    }
    const ts = tsNow()
    if (ts - state.startedAt > PUNCH_MAX_LIFETIME || ts - state.entry.ts > RECORD_TTL + 60000) {
      const inbound = this.peerInboundAt.get(state.id)
      const why = inbound
        ? '双方数据可互通但握手未完成'
        : '对方的数据包始终未能进入本机(通常是防火墙或云服务器安全组拦截了对方入站)'
      this.log(`[打洞] 与 ${state.id.slice(0, 8)} 连接超时(已试 ${state.tries} 次) — ${why}`)
      if (!inbound) this.log('[打洞]   提示: Windows 已自动请求授权放行; 云服务器需在控制台安全组放行 UDP 端口')
      this.stopPunch(state.id)
      return
    }
    const addr = state.addrs[state.addrIdx % state.addrs.length]
    state.addrIdx++
    state.tries++
    const packet = encodeHandshake(T_INIT, this.nodeId, this.name, state.eph.pub, state.eph.nonce, this.roomKeys.hmacKey)
    this.socket.send(packet, addr.port, addr.host)
    if (this.verbose) this.debug(`[打洞] 发送 INIT -> ${addr.host}:${addr.port} (${addr.via}) 第${state.tries}次`)
    const interval = state.tries < PUNCH_FAST_TRIES ? PUNCH_FAST_INTERVAL : PUNCH_SLOW_INTERVAL
    state.timer = setTimeout(() => this.punchTick(state), interval + Math.floor(Math.random() * 300))
  }

  stopPunch (id) {
    const state = this.punches.get(id)
    if (!state) return
    clearTimeout(state.timer)
    this.punches.delete(id)
    this.initiations.delete(id)
  }

  onMessage (buf, rinfo) {
    if (!this.running || rinfo.port === 0 || buf.length < HEADER_LEN) return
    const type = buf[5]
    if (type === T_INIT) this.onInit(buf, rinfo)
    else if (type === T_RESP) this.onResp(buf, rinfo)
    else if (type === T_DATA) this.onData(buf, rinfo)
  }

  onInit (buf, rinfo) {
    const msg = decodeHandshake(buf, this.roomKeys.hmacKey, T_INIT)
    if (!msg) return
    if (msg.nodeId.equals(this.nodeId)) return
    const idHex = msg.nodeId.toString('hex')
    this.peerInboundAt.set(idHex, tsNow())
    const lastResp = this.lastRespAt.get(idHex) || 0
    if (tsNow() - lastResp < RESP_MIN_INTERVAL && !this.sessions.has(idHex)) return

    const { priv, pub } = generateX25519()
    const nonce = crypto.randomBytes(12)
    const packet = encodeHandshake(T_RESP, this.nodeId, this.name, rawPublicKey(pub), nonce, this.roomKeys.hmacKey)
    this.socket.send(packet, rinfo.port, rinfo.address)
    this.lastRespAt.set(idHex, tsNow())

    const shared = ecdh(priv, msg.ephPub)
    const keys = deriveSessionKeys(shared, msg.nonce, nonce)
    this.pendingInits.set(idHex, {
      recvKey: keys.kA2B,
      sendKey: keys.kB2A,
      name: msg.name,
      lastRecvCtr: -1n,
      lastRecvAt: tsNow(),
      lastSendAt: 0
    })
    if (!this.sessions.has(idHex)) {
      const last = this.lastInitLogAt.get(idHex) || 0
      if (tsNow() - last > 5000) {
        this.lastInitLogAt.set(idHex, tsNow())
        this.log(`[打洞] 收到 ${idHex.slice(0, 8)}(${msg.name}) 的 INIT 来自 ${rinfo.address}:${rinfo.port} 已回复 RESP`)
      }
    }
  }

  onResp (buf, rinfo) {
    const msg = decodeHandshake(buf, this.roomKeys.hmacKey, T_RESP)
    if (!msg) return
    if (msg.nodeId.equals(this.nodeId)) return
    const idHex = msg.nodeId.toString('hex')
    const init = this.initiations.get(idHex)
    if (!init) {
      const existing = this.sessions.get(idHex)
      if (existing) {
        existing.lastRecvAt = tsNow()
        existing.addr = { host: rinfo.address, port: rinfo.port }
      }
      return
    }
    const shared = ecdh(init.priv, msg.ephPub)
    const keys = deriveSessionKeys(shared, init.nonce, msg.nonce)
    this.establishSession(idHex, {
      sendKey: keys.kA2B,
      recvKey: keys.kB2A,
      addr: { host: rinfo.address, port: rinfo.port },
      name: msg.name || init.name,
      via: '打洞成功'
    })
    this.stopPunch(idHex)
    this.sendControl(idHex, { t: 'ping', ts: tsNow() })
  }

  onData (buf, rinfo) {
    const candidates = []
    for (const [id, session] of this.sessions) {
      candidates.push({ id, recvKey: session.recvKey, session, pending: null })
    }
    for (const [id, pending] of this.pendingInits) {
      candidates.push({ id, recvKey: pending.recvKey, session: this.sessions.get(id) || null, pending })
    }
    for (const cand of candidates) {
      const dec = tryDecryptData(buf, cand.recvKey)
      if (!dec) continue
      let session = cand.session
      if (session && cand.recvKey === session.recvKey) {
        if (dec.counter <= session.lastRecvCtr) continue
      } else if (cand.pending) {
        if (dec.counter <= cand.pending.lastRecvCtr) continue
        if (session) {
          session.sendKey = cand.pending.sendKey
          session.recvKey = cand.pending.recvKey
          session.sendCtr = 0n
          session.lastRecvCtr = -1n
          this.pendingInits.delete(cand.id)
          this.stopPunch(cand.id)
          this.debug(`[会话] ${session.name} 密钥已更新(对端重新握手)`)
        }
      } else {
        continue
      }
      if (!session) {
        const pending = cand.pending
        session = {
          idHex: cand.id,
          name: pending.name,
          sendKey: pending.sendKey,
          recvKey: pending.recvKey,
          sendCtr: 0n,
          lastRecvCtr: -1n,
          addr: { host: rinfo.address, port: rinfo.port },
          lastRecvAt: tsNow(),
          lastSendAt: 0,
          rtt: null,
          establishedAt: tsNow()
        }
        this.sessions.set(cand.id, session)
        this.pendingInits.delete(cand.id)
        this.stopPunch(cand.id)
        this.emit('connect', { id: cand.id, name: session.name, addr: session.addr, via: '对方发起' })
      } else if (session.addr.host !== rinfo.address || session.addr.port !== rinfo.port) {
        this.debug(`[会话] ${session.name} 路径变更 -> ${rinfo.address}:${rinfo.port}`)
        session.addr = { host: rinfo.address, port: rinfo.port }
      }
      session.lastRecvCtr = dec.counter
      session.lastRecvAt = tsNow()
      this.handlePayload(session, dec.plain)
      return
    }
  }

  establishSession (idHex, { sendKey, recvKey, addr, name, via }) {
    const existing = this.sessions.get(idHex)
    if (existing) {
      existing.addr = addr
      existing.lastRecvAt = tsNow()
      return
    }
    const session = {
      idHex,
      name: truncateName(name || idHex.slice(0, 8)),
      sendKey,
      recvKey,
      sendCtr: 0n,
      lastRecvCtr: -1n,
      addr,
      lastRecvAt: tsNow(),
      lastSendAt: 0,
      rtt: null,
      establishedAt: tsNow()
    }
    this.sessions.set(idHex, session)
    this.emit('connect', { id: idHex, name: session.name, addr, via })
  }

  handlePayload (session, plain) {
    let msg
    try {
      msg = JSON.parse(plain.toString('utf8'))
    } catch {
      return
    }
    if (!msg || typeof msg.t !== 'string') return
    if (msg.t === 'ping') {
      this.sendControl(session.idHex, { t: 'pong', ts: msg.ts, now: tsNow() })
      return
    }
    if (msg.t === 'pong') {
      if (Number.isFinite(msg.ts)) session.rtt = tsNow() - msg.ts
      return
    }
    if (msg.t === 'msg') {
      this.collectChunk(session, msg)
      return
    }
  }

  collectChunk (session, msg) {
    const total = Number(msg.n) || 1
    const index = Number(msg.i) || 0
    const text = typeof msg.m === 'string' ? msg.m : ''
    if (total === 1) {
      this.emit('message', { id: session.idHex, name: session.name, text })
      return
    }
    let entry = this.reassembly.get(session.idHex)
    if (!entry || entry.total !== total || entry.expires < tsNow()) {
      if (entry) clearTimeout(entry.timer)
      entry = { total, parts: new Map(), expires: tsNow() + 8000, timer: null }
      entry.timer = setTimeout(() => this.reassembly.delete(session.idHex), 8000)
      this.reassembly.set(session.idHex, entry)
    }
    entry.parts.set(index, text)
    if (entry.parts.size === total) {
      clearTimeout(entry.timer)
      this.reassembly.delete(session.idHex)
      let out = ''
      for (let i = 0; i < total; i++) out += entry.parts.get(i) || ''
      this.emit('message', { id: session.idHex, name: session.name, text: out })
    }
  }

  sendToSession (session, obj) {
    const plaintext = Buffer.from(JSON.stringify(obj), 'utf8')
    session.sendCtr += 1n
    const packet = encodeData(session.sendCtr, plaintext, session.sendKey)
    this.socket.send(packet, session.addr.port, session.addr.host)
    session.lastSendAt = tsNow()
  }

  sendControl (idHex, obj) {
    const session = this.sessions.get(idHex)
    if (session) this.sendToSession(session, obj)
  }

  sendAll (text) {
    const str = String(text)
    const sent = []
    for (const session of this.sessions.values()) {
      const chunks = chunkText(str)
      chunks.forEach((part, i) => {
        this.sendToSession(session, { t: 'msg', i, n: chunks.length, m: part })
      })
      sent.push(session.name)
    }
    return sent
  }

  keepaliveTick () {
    for (const session of this.sessions.values()) {
      if (tsNow() - session.lastSendAt >= KEEPALIVE_INTERVAL) {
        this.sendControl(session.idHex, { t: 'ping', ts: tsNow() })
      }
    }
  }

  timeoutTick () {
    const ts = tsNow()
    for (const [id, session] of [...this.sessions]) {
      if (ts - session.lastRecvAt > SESSION_TIMEOUT) {
        this.sessions.delete(id)
        this.pendingInits.delete(id)
        this.initiations.delete(id)
        this.emit('disconnect', { id, name: session.name, reason: '超时' })
        const rosterEntry = this.lastRoster?.[id]
        if (rosterEntry) this.ensurePunch(id, rosterEntry)
      }
    }
  }

  setRoster (roster) {
    this.lastRoster = roster
    this.updateRoster(roster)
  }

  sessionsInfo () {
    return [...this.sessions.values()].map((s) => ({
      name: s.name,
      id: s.idHex.slice(0, 8),
      addr: `${s.addr.host}:${s.addr.port}`,
      rtt: s.rtt,
      uptime: Math.round((tsNow() - s.establishedAt) / 1000)
    }))
  }

  debug (line) {
    if (this.verbose) this.log(line)
  }

  async close () {
    this.running = false
    clearInterval(this.keepaliveTimer)
    clearInterval(this.timeoutTimer)
    for (const state of this.punches.values()) clearTimeout(state.timer)
    for (const entry of this.reassembly.values()) clearTimeout(entry.timer)
    this.punches.clear()
    await new Promise((resolve) => {
      if (!this.socket) return resolve()
      try {
        this.socket.close(resolve)
        setTimeout(resolve, 1000).unref?.()
      } catch {
        resolve()
      }
    })
  }
}

function tsNow () {
  return Date.now()
}

function chunkText (text) {
  const chars = [...text]
  const chunks = []
  let cur = []
  let size = 0
  for (const ch of chars) {
    const b = Buffer.byteLength(ch)
    if (size + b > MAX_MESSAGE_CHUNK && cur.length) {
      chunks.push(cur.join(''))
      cur = []
      size = 0
    }
    cur.push(ch)
    size += b
  }
  if (cur.length) chunks.push(cur.join(''))
  return chunks.length ? chunks : ['']
}
