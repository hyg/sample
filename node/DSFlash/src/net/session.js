'use strict'

const crypto = require('crypto')
const { EventEmitter } = require('events')
const P = require('../protocol')
const { buildHandshake, parseHandshake, deriveSessionKeys, SecureChannel } = require('./secure')
const { rawPub } = require('../util/keys')

/**
 * 一条到某个 UDP 端点的会话。
 *
 * 生命周期：handshaking → open → closed
 * 握手是"双向同时"的：双方各自发送 HELLO，收到对方的 HELLO 即完成。
 * 这样做的好处是无需区分发起方/响应方，任何一边的探测包打通都会自然收敛。
 *
 * 打开之后承担三件事：
 *   1. 可靠传输（分片 + 累积确认 + 重传）
 *   2. 保活（PING/PONG），顺带维持 NAT 映射
 *   3. 掩护流量（chaff），把"什么时候真的发了消息"藏起来
 */
class Session extends EventEmitter {
  constructor (opts) {
    super()
    this.socket = opts.socket
    this.remote = opts.remote
    this.identity = opts.identity
    this.netKey = opts.netKey
    this.cfg = opts.cfg || {}
    this.log = opts.logger || { debug () {}, info () {}, warn () {} }

    this.state = 'handshaking'
    this.eph = crypto.generateKeyPairSync('x25519')
    this.nonce = crypto.randomBytes(16)
    this.hsBuf = null
    this.hsAttempts = 0
    this.lastHs = 0

    this.channel = null
    this.peer = null

    this.msgSeq = 0
    this.outbox = new Map() // msgId -> entry
    this.inbox = new Map() // msgId -> assembly
    this.done = []
    this.doneSet = new Set()

    this.rxBytes = 0
    this.txBytes = 0
    this.rxMsgs = 0
    this.txMsgs = 0

    this.createdAt = Date.now()
    this.lastRecv = Date.now()
    this.lastSend = Date.now()
    this.lastChaff = Date.now()
    this.jitterUntil = 0

    this.timer = setInterval(() => this._tick(), 200)
    if (this.timer.unref) this.timer.unref()
  }

  get key () {
    return this.remote.host + ':' + this.remote.port
  }

  start () {
    this._sendHandshake()
  }

  /* ---------------------------- 握手 ---------------------------- */

  _sendHandshake () {
    if (!this.hsBuf) {
      this.hsBuf = buildHandshake(this.identity, this.netKey, this.eph, this.nonce)
    }
    this.socket.send(this.hsBuf, this.remote.host, this.remote.port)
    this.lastHs = Date.now()
    this.hsAttempts++
  }

  onHandshake (buf) {
    if (this.state === 'closed') return

    if (this.state === 'open') {
      // 对端还没完成握手（我们的 HELLO 丢了），补发一次，限流
      if (Date.now() - this.lastHs > 500) this._sendHandshake()
      return
    }

    const hs = parseHandshake(buf, this.netKey)
    if (!hs) {
      this.log.debug(`会话 ${this.key}: 握手校验失败（口令不符或伪造）`)
      return
    }
    if (hs.peerId === this.identity.peerId) {
      return this.close('self-connect')
    }
    if (this.peer && this.peer.peerId !== hs.peerId) {
      return // 同一地址出现不同身份，丢弃（防止地址被复用后的串话）
    }

    this.peer = { peerId: hs.peerId, staticPub: hs.staticPub }

    const shared = crypto.diffieHellman({
      privateKey: this.eph.privateKey,
      publicKey: hs.ephPubKey
    })
    const keys = deriveSessionKeys(
      shared,
      { pub: rawPub(this.eph.publicKey), nonce: this.nonce },
      { pub: hs.ephPub, nonce: hs.nonce }
    )
    this.channel = new SecureChannel(keys.send, keys.recv)
    this.state = 'open'
    this.log.debug(`会话 ${this.key}: 握手完成 peer=${hs.peerId}`)
    this.emit('open', this.peer)
  }

  /* ---------------------------- 发送 ---------------------------- */

  send (appType, payload) {
    if (this.state !== 'open') return false
    if (payload.length > P.MAX_MESSAGE) throw new Error('message too large')

    const msgId = (++this.msgSeq) >>> 0
    const chunkCount = Math.max(1, Math.ceil(payload.length / P.MAX_CHUNK))
    const entry = {
      appType,
      inners: [],
      sentAt: [],
      rto: [],
      attempts: [],
      acked: new Set()
    }

    for (let i = 0; i < chunkCount; i++) {
      const start = i * P.MAX_CHUNK
      const part = payload.subarray(start, Math.min(payload.length, start + P.MAX_CHUNK))
      const inner = Buffer.alloc(P.INNER_HDR + part.length)
      inner[0] = P.T.DATA
      inner[1] = appType
      inner.writeUInt16BE(i, 2)
      inner.writeUInt16BE(chunkCount, 4)
      inner.writeUInt16BE(part.length, 6)
      inner.writeUInt32BE(msgId, 8)
      part.copy(inner, P.INNER_HDR)
      entry.inners.push(inner)
      entry.sentAt.push(0)
      entry.rto.push(this.cfg.rto || 500)
      entry.attempts.push(0)
    }

    this.outbox.set(msgId, entry)
    for (let i = 0; i < entry.inners.length; i++) this._transmit(msgId, entry, i)
    this.txMsgs++
    return true
  }

  _transmit (msgId, entry, idx) {
    let frame
    try {
      frame = this.channel.encrypt(entry.inners[idx])
    } catch (e) {
      return
    }
    // 发送抖动：把真实消息的发出时刻模糊化，避免"打字节奏"被旁路分析
    if (this.cfg.jitter > 0) {
      const delay = Math.floor(Math.random() * this.cfg.jitter)
      const t = setTimeout(() => {
        this.socket.send(frame, this.remote.host, this.remote.port)
      }, delay)
      if (t.unref) t.unref()
    } else {
      this.socket.send(frame, this.remote.host, this.remote.port)
    }
    entry.sentAt[idx] = Date.now()
    entry.attempts[idx]++
    this.txBytes += frame.length
    this.lastSend = Date.now()
  }

  _sendInner (inner) {
    if (this.state !== 'open') return
    let frame
    try {
      frame = this.channel.encrypt(inner)
    } catch (e) {
      return
    }
    this.socket.send(frame, this.remote.host, this.remote.port)
    this.txBytes += frame.length
    this.lastSend = Date.now()
  }

  _sendAck (msgId, idx) {
    const inner = Buffer.alloc(P.INNER_HDR)
    inner[0] = P.T.ACK
    inner[1] = 0
    inner.writeUInt16BE(idx, 2)
    inner.writeUInt16BE(0, 4)
    inner.writeUInt16BE(0, 6)
    inner.writeUInt32BE(msgId, 8)
    this._sendInner(inner)
  }

  _sendChaff () {
    const bucket = P.BUCKETS[Math.floor(Math.random() * P.BUCKETS.length)]
    const inner = Buffer.alloc(P.INNER_HDR)
    inner[0] = P.T.CHAFF
    crypto.randomFillSync(inner, 1, P.INNER_HDR - 1)
    // 用随机内部内容填充到目标桶长
    const target = bucket - P.FRAME_OVERHEAD
    let buf = inner
    if (target > inner.length) {
      buf = Buffer.alloc(target)
      inner.copy(buf, 0)
      crypto.randomFillSync(buf, inner.length)
    }
    this._sendInner(buf)
    this.lastChaff = Date.now()
  }

  /* ---------------------------- 接收 ---------------------------- */

  onFrame (frame) {
    if (this.state !== 'open') return
    const plain = this.channel.decrypt(frame)
    if (!plain) return
    this.lastRecv = Date.now()
    this.rxBytes += frame.length

    const type = plain[0]
    if (type === P.T.CHAFF) return

    if (type === P.T.ACK) {
      const msgId = plain.readUInt32BE(8)
      const idx = plain.readUInt16BE(2)
      const entry = this.outbox.get(msgId)
      if (entry) {
        entry.acked.add(idx)
        if (entry.acked.size >= entry.inners.length) {
          this.outbox.delete(msgId)
          this.emit('sent', msgId)
        }
      }
      return
    }

    if (type === P.T.DATA) {
      const appType = plain[1]
      const idx = plain.readUInt16BE(2)
      const count = plain.readUInt16BE(4)
      const len = plain.readUInt16BE(6)
      const msgId = plain.readUInt32BE(8)
      if (len > plain.length - P.INNER_HDR) return
      const payload = Buffer.from(plain.subarray(P.INNER_HDR, P.INNER_HDR + len))

      this._sendAck(msgId, idx) // 逐片确认

      if (this.doneSet.has(msgId)) return
      if (count === 1) {
        this._remember(msgId)
        this._deliver(appType, payload)
        return
      }

      let asm = this.inbox.get(msgId)
      if (!asm) {
        asm = { count, parts: new Array(count), got: 0, appType, ts: Date.now() }
        this.inbox.set(msgId, asm)
      }
      if (asm.parts[idx] === undefined) {
        asm.parts[idx] = payload
        asm.got++
      }
      if (asm.got === asm.count) {
        this.inbox.delete(msgId)
        this._remember(msgId)
        this._deliver(asm.appType, Buffer.concat(asm.parts))
      }
    }
  }

  _remember (msgId) {
    this.doneSet.add(msgId)
    this.done.push(msgId)
    if (this.done.length > 1024) {
      const old = this.done.shift()
      this.doneSet.delete(old)
    }
  }

  _deliver (appType, payload) {
    this.rxMsgs++
    if (appType === P.APP.PING) {
      this.send(P.APP.PONG, Buffer.alloc(0))
      return
    }
    if (appType === P.APP.PONG) return
    if (appType === P.APP.BYE) {
      this.emit('bye')
      return this.close('bye')
    }
    this.emit('message', { appType, payload })
  }

  /* ---------------------------- 定时器 ---------------------------- */

  _tick () {
    const now = Date.now()

    if (this.state === 'handshaking') {
      if (now - this.lastHs > 400) {
        if (this.hsAttempts > 40) return this.close('handshake-timeout')
        this._sendHandshake()
      }
      return
    }
    if (this.state !== 'open') return

    // 重传
    for (const [msgId, entry] of this.outbox) {
      for (let i = 0; i < entry.inners.length; i++) {
        if (entry.acked.has(i)) continue
        if (now - entry.sentAt[i] < entry.rto[i]) continue
        if (entry.attempts[i] >= 10) {
          this.outbox.delete(msgId)
          this.emit('send:fail', msgId)
          break
        }
        entry.rto[i] = Math.min(8000, entry.rto[i] * 1.7)
        this._transmit(msgId, entry, i)
      }
    }

    // 清理半截重组
    for (const [msgId, asm] of this.inbox) {
      if (now - asm.ts > 60000) this.inbox.delete(msgId)
    }

    if (this.cfg.idleTimeout && now - this.lastRecv > this.cfg.idleTimeout) {
      return this.close('idle-timeout')
    }

    if (now - this.lastSend > 12000) this.send(P.APP.PING, Buffer.alloc(0))

    if (this.cfg.chaff > 0) {
      const gap = this.cfg.chaff * (0.5 + Math.random())
      if (now - this.lastChaff > gap) this._sendChaff()
    }
  }

  close (reason = 'closed') {
    if (this.state === 'closed') return
    this.state = 'closed'
    clearInterval(this.timer)
    this.outbox.clear()
    this.inbox.clear()
    this.emit('close', reason)
  }

  stats () {
    return {
      state: this.state,
      peerId: this.peer ? this.peer.peerId : null,
      remote: `${this.remote.host}:${this.remote.port}`,
      ageMs: Date.now() - this.createdAt,
      rxBytes: this.rxBytes,
      txBytes: this.txBytes,
      rxMsgs: this.rxMsgs,
      txMsgs: this.txMsgs
    }
  }
}

module.exports = Session
