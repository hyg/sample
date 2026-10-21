#!/usr/bin/env node
'use strict'

const __modules = {}
const __cache = {}
function __define (name, fn) { __modules[name] = fn }
function __require (name) {
  if (__cache[name]) return __cache[name].exports
  if (!__modules[name]) throw new Error('module not found: ' + name)
  const m = { exports: {} }
  __cache[name] = m
  __modules[name](m, m.exports, __require)
  return m.exports
}
__define('src/protocol', function (module, exports, __require) {
'use strict'

/**
 * 协议常量。所有对端、DHT、STUN 共用的魔术字与长度定义集中于此。
 */
module.exports = {
  VERSION: 1,

  // UDP 报文分类魔术字
  MAGIC: Buffer.from('P2PN'), // 打洞探测包（16 字节固定）
  HS_MAGIC: Buffer.from('P2PH'), // 握手包（192 字节固定）

  HS_LEN: 192,
  PUNCH_LEN: 16,

  // 加密帧分桶长度：所有密文帧长度只能是这几个值之一，隐藏真实长度
  BUCKETS: [64, 256, 1024, 4096],

  // 12 字节明文头（tag4 + counter8）+ 16 字节 GCM tag
  FRAME_OVERHEAD: 28,

  // 内层明文头：type(1) appType(1) chunkIndex(2) chunkCount(2) payloadLen(2) msgId(4)
  INNER_HDR: 12,

  // 单分片最大负载，保证 INNER_HDR + MAX_CHUNK + FRAME_OVERHEAD <= 1024
  MAX_CHUNK: 960,

  // 单条应用消息最大长度
  MAX_MESSAGE: 4 * 1024 * 1024,

  T: {
    DATA: 0x10,
    ACK: 0x11,
    CHAFF: 0x12
  },

  APP: {
    CHAT: 0x01,
    PING: 0x02,
    PONG: 0x03,
    BYE: 0x04
  },

  // DHT 主题（rendezvous point）前缀，最终 infoHash = sha1(prefix + network + epoch)
  TOPIC_PREFIX: 'p2pnet/v1/topic/'
}

});

__define('src/util/bencode', function (module, exports, __require) {
'use strict'

/**
 * 最小 bencode 实现（BEP-3）。
 * 解码时所有字符串返回 Buffer（DHT 协议里 info_hash / token / id 都是二进制）。
 */

function encode (value) {
  const out = []
  enc(value, out)
  return Buffer.concat(out)
}

function enc (v, out) {
  if (Buffer.isBuffer(v)) {
    out.push(Buffer.from(v.length + ':'))
    out.push(v)
    return
  }
  if (typeof v === 'string') {
    const b = Buffer.from(v, 'utf8')
    out.push(Buffer.from(b.length + ':'))
    out.push(b)
    return
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || !Number.isInteger(v)) throw new Error('bencode: only integer numbers supported')
    out.push(Buffer.from('i' + v + 'e'))
    return
  }
  if (typeof v === 'boolean') {
    out.push(Buffer.from('i' + (v ? 1 : 0) + 'e'))
    return
  }
  if (Array.isArray(v)) {
    out.push(Buffer.from('l'))
    for (const x of v) enc(x, out)
    out.push(Buffer.from('e'))
    return
  }
  if (v && typeof v === 'object') {
    out.push(Buffer.from('d'))
    const keys = Object.keys(v)
      .filter(k => v[k] !== undefined && v[k] !== null)
      .map(k => [Buffer.from(k, 'utf8'), v[k]])
      .sort((a, b) => Buffer.compare(a[0], b[0]))
    for (const [k, val] of keys) {
      out.push(Buffer.from(k.length + ':'))
      out.push(k)
      enc(val, out)
    }
    out.push(Buffer.from('e'))
    return
  }
  throw new Error('bencode: unsupported type ' + typeof v)
}

function decode (buf) {
  const s = { buf, i: 0 }
  const v = dec(s)
  if (s.i !== buf.length) throw new Error('bencode: trailing data')
  return v
}

function dec (s) {
  if (s.i >= s.buf.length) throw new Error('bencode: unexpected end')
  const c = s.buf[s.i]

  if (c === 0x69) { // 'i'
    const end = s.buf.indexOf(0x65, s.i)
    if (end < 0) throw new Error('bencode: bad int')
    const n = Number(s.buf.toString('ascii', s.i + 1, end))
    if (!Number.isFinite(n)) throw new Error('bencode: bad int')
    s.i = end + 1
    return n
  }

  if (c === 0x6c) { // 'l'
    s.i++
    const arr = []
    while (s.i < s.buf.length && s.buf[s.i] !== 0x65) arr.push(dec(s))
    if (s.i >= s.buf.length) throw new Error('bencode: unterminated list')
    s.i++
    return arr
  }

  if (c === 0x64) { // 'd'
    s.i++
    const obj = {}
    while (s.i < s.buf.length && s.buf[s.i] !== 0x65) {
      const k = dec(s)
      if (!Buffer.isBuffer(k)) throw new Error('bencode: key must be string')
      obj[k.toString('utf8')] = dec(s)
    }
    if (s.i >= s.buf.length) throw new Error('bencode: unterminated dict')
    s.i++
    return obj
  }

  if (c >= 0x30 && c <= 0x39) { // 字符串
    const colon = s.buf.indexOf(0x3a, s.i)
    if (colon < 0) throw new Error('bencode: bad string length')
    const len = Number(s.buf.toString('ascii', s.i, colon))
    if (!Number.isFinite(len) || len < 0) throw new Error('bencode: bad string length')
    const start = colon + 1
    if (start + len > s.buf.length) throw new Error('bencode: string overflow')
    const out = s.buf.subarray(start, start + len)
    s.i = start + len
    return out
  }

  throw new Error('bencode: unexpected byte 0x' + c.toString(16))
}

module.exports = { encode, decode }

});

__define('src/util/bytes', function (module, exports, __require) {
'use strict'

const crypto = require('crypto')

const B32 = 'abcdefghijklmnopqrstuvwxyz234567'

/** RFC4648 base32（小写、无填充），用于生成人类可读的短 ID */
function base32 (buf, len) {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of buf) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
      if (len && out.length >= len) return out.slice(0, len)
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return len ? out.slice(0, len) : out
}

function randomId () {
  return crypto.randomBytes(20)
}

function sha1 (buf) {
  return crypto.createHash('sha1').update(buf).digest()
}

function sha256 (buf) {
  return crypto.createHash('sha256').update(buf).digest()
}

function ipToBuf (ip) {
  const parts = String(ip).split('.')
  if (parts.length !== 4) throw new Error('not ipv4: ' + ip)
  const b = Buffer.alloc(4)
  for (let i = 0; i < 4; i++) {
    const n = Number(parts[i])
    if (!Number.isInteger(n) || n < 0 || n > 255) throw new Error('not ipv4: ' + ip)
    b[i] = n
  }
  return b
}

function bufToIp (buf) {
  return `${buf[0]}.${buf[1]}.${buf[2]}.${buf[3]}`
}

function isIPv4 (s) {
  if (typeof s !== 'string') return false
  const p = s.split('.')
  if (p.length !== 4) return false
  return p.every(x => /^\d{1,3}$/.test(x) && Number(x) >= 0 && Number(x) <= 255)
}

/** 6 字节紧凑节点地址（BEP-5 values 格式） */
function encodeCompactPeer (ip, port) {
  const b = Buffer.alloc(6)
  ipToBuf(ip).copy(b, 0)
  b.writeUInt16BE(port, 4)
  return b
}

function decodeCompactPeer (buf) {
  return { host: bufToIp(buf.subarray(0, 4)), port: buf.readUInt16BE(4) }
}

/** 26 字节紧凑节点信息 */
function encodeCompactNode (id, ip, port) {
  const b = Buffer.alloc(26)
  id.copy(b, 0)
  ipToBuf(ip).copy(b, 20)
  b.writeUInt16BE(port, 24)
  return b
}

function decodeCompactNodes (buf) {
  const out = []
  for (let i = 0; i + 26 <= buf.length; i += 26) {
    out.push({
      id: Buffer.from(buf.subarray(i, i + 20)),
      host: bufToIp(buf.subarray(i + 20, i + 24)),
      port: buf.readUInt16BE(i + 24)
    })
  }
  return out
}

/** 按到 target 的 XOR 距离比较两个 node id（升序） */
function distanceCmp (target, a, b) {
  for (let i = 0; i < 20; i++) {
    const x = target[i] ^ a[i]
    const y = target[i] ^ b[i]
    if (x !== y) return x - y
  }
  return 0
}

/** xor 距离的前导零比特数 → k-bucket 索引 */
function bucketIndex (a, b) {
  for (let i = 0; i < 20; i++) {
    const x = a[i] ^ b[i]
    if (x !== 0) {
      let n = 0
      while (n < 8 && !(x & (0x80 >> n))) n++
      return Math.min(159, i * 8 + n)
    }
  }
  return 159
}

function addrKey (host, port) {
  return host + ':' + port
}

module.exports = {
  base32,
  randomId,
  sha1,
  sha256,
  ipToBuf,
  bufToIp,
  isIPv4,
  encodeCompactPeer,
  decodeCompactPeer,
  encodeCompactNode,
  decodeCompactNodes,
  distanceCmp,
  bucketIndex,
  addrKey
}

});

__define('src/util/keys', function (module, exports, __require) {
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { base32, sha256 } = __require('src/util/bytes')

const ED_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')
const X_SPKI_PREFIX = Buffer.from('302a300506032b656e032100', 'hex')

/** 32 字节裸 Ed25519 公钥 → KeyObject */
function edPubFromRaw (raw) {
  return crypto.createPublicKey({
    key: Buffer.concat([ED_SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki'
  })
}

/** 32 字节裸 X25519 公钥 → KeyObject */
function xPubFromRaw (raw) {
  return crypto.createPublicKey({
    key: Buffer.concat([X_SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki'
  })
}

function rawPub (keyObject) {
  return Buffer.from(keyObject.export({ type: 'spki', format: 'der' }).subarray(-32))
}

/**
 * 加载/生成本节点长期身份（Ed25519）。
 * peerId = base32(sha256(rawPub)) 前 12 位，用于人眼识别与 /send 目标。
 */
function loadIdentity (dataDir) {
  fs.mkdirSync(dataDir, { recursive: true })
  const file = path.join(dataDir, 'identity.json')

  let privateKey
  if (fs.existsSync(file)) {
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'))
      privateKey = crypto.createPrivateKey({
        key: Buffer.from(j.privateKey, 'base64'),
        format: 'der',
        type: 'pkcs8'
      })
    } catch (e) {
      privateKey = null
    }
  }

  if (!privateKey) {
    const kp = crypto.generateKeyPairSync('ed25519')
    privateKey = kp.privateKey
    const der = privateKey.export({ type: 'pkcs8', format: 'der' })
    fs.writeFileSync(file, JSON.stringify({ privateKey: der.toString('base64') }, null, 2), { mode: 0o600 })
  }

  const publicKey = crypto.createPublicKey(privateKey)
  const peerId = base32(sha256(rawPub(publicKey)), 12)
  return { privateKey, publicKey, peerId }
}

/** 加载/生成 DHT 节点 ID（160 bit，随机一次后固定） */
function loadNodeId (dataDir) {
  fs.mkdirSync(dataDir, { recursive: true })
  const file = path.join(dataDir, 'node-id')
  if (fs.existsSync(file)) {
    try {
      const b = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'hex')
      if (b.length === 20) return b
    } catch (e) { /* ignore */ }
  }
  const id = crypto.randomBytes(20)
  fs.writeFileSync(file, id.toString('hex'), { mode: 0o600 })
  return id
}

module.exports = {
  edPubFromRaw,
  xPubFromRaw,
  rawPub,
  loadIdentity,
  loadNodeId
}

});

__define('src/util/log', function (module, exports, __require) {
'use strict'

const LEVELS = { silent: -1, error: 0, warn: 1, info: 2, debug: 3 }

/**
 * 日志统一走 stderr，stdout 留给交互与最终报告。
 * 默认 info 级别只输出元信息（不含消息正文），避免本地落盘泄露内容。
 */
function createLogger (level = 'info') {
  const cur = LEVELS[level] === undefined ? LEVELS.info : LEVELS[level]
  const ts = () => new Date().toISOString().slice(11, 19)
  const mk = (name, lv) => (...args) => {
    if (lv > cur) return
    process.stderr.write(`[${ts()}] ${name} ${args.join(' ')}\n`)
  }
  return {
    level,
    error: mk('ERROR', LEVELS.error),
    warn: mk('WARN ', LEVELS.warn),
    info: mk('INFO ', LEVELS.info),
    debug: mk('DEBUG', LEVELS.debug)
  }
}

module.exports = { createLogger, LEVELS }

});

__define('src/dht/dht', function (module, exports, __require) {
'use strict'

const crypto = require('crypto')
const { EventEmitter } = require('events')
const bencode = __require('src/util/bencode')
const RoutingTable = __require('src/dht/routing')
const {
  encodeCompactNode,
  decodeCompactNodes,
  encodeCompactPeer,
  distanceCmp
} = __require('src/util/bytes')

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

});

__define('src/dht/routing', function (module, exports, __require) {
'use strict'

const { bucketIndex, distanceCmp } = __require('src/util/bytes')

const STALE_MS = 15 * 60 * 1000

/**
 * 简化 Kademlia 路由表：160 个 k-bucket，每桶最多 K 个节点。
 * 只保留「最近有响应」的节点；久未响应的槽位可被新节点替换。
 */
class RoutingTable {
  constructor (id, k = 8) {
    this.id = id
    this.k = k
    this.buckets = new Map() // index -> [entry]
    this.byHex = new Map() // idHex -> entry
  }

  get size () {
    return this.byHex.size
  }

  add (node) {
    if (!node || !Buffer.isBuffer(node.id) || node.id.length !== 20) return null
    if (node.id.equals(this.id)) return null
    const hex = node.id.toString('hex')
    const now = Date.now()

    const existing = this.byHex.get(hex)
    if (existing) {
      existing.host = node.host
      existing.port = node.port
      existing.lastSeen = now
      existing.fails = 0
      return existing
    }

    const idx = bucketIndex(this.id, node.id)
    let arr = this.buckets.get(idx)
    if (!arr) {
      arr = []
      this.buckets.set(idx, arr)
    }

    if (arr.length >= this.k) {
      // 挑最久没响应的；若它还"新鲜"就拒绝新节点（Kademlia 的稳定性优先策略）
      arr.sort((a, b) => a.lastSeen - b.lastSeen)
      const victim = arr[0]
      if (now - victim.lastSeen < STALE_MS) return null
      arr.shift()
      this.byHex.delete(victim.id.toString('hex'))
    }

    const entry = { id: node.id, host: node.host, port: node.port, lastSeen: now, fails: 0 }
    arr.push(entry)
    this.byHex.set(hex, entry)
    return entry
  }

  get (hex) {
    return this.byHex.get(hex) || null
  }

  all () {
    return [...this.byHex.values()]
  }

  closest (target, n) {
    const arr = [...this.byHex.values()]
    arr.sort((a, b) => distanceCmp(target, a.id, b.id))
    return arr.slice(0, n)
  }

}

module.exports = RoutingTable

});

__define('src/net/nat', function (module, exports, __require) {
'use strict'

/**
 * NAT 行为判定 + 候选端口生成。
 *
 * 判定依据：用同一 socket 向多个不同 STUN 服务器探测。
 *   - 全部返回同一个 ip:port  → endpoint-independent mapping（锥形 NAT，打洞成功率高）
 *   - 端口随目标变化          → address/port-dependent mapping（对称型，需要端口预测）
 *
 * 无论哪种，都把「本地端口 + 各次观测到的映射端口 + 预测端口」一起作为候选公布，
 * 由对端挨个尝试，最坏情况退化但不至于完全不通。
 */
function analyze (discoveries, localPort, opts = {}) {
  const ok = (discoveries || []).filter(d => d.ok && d.host && d.port)
  const maxCandidates = opts.maxCandidates || 5

  if (!ok.length) {
    return {
      behavior: 'unknown',
      publicIp: null,
      publicPort: null,
      servers: (discoveries || []).length,
      responsive: 0,
      mappings: [],
      candidates: [localPort]
    }
  }

  const ips = new Set(ok.map(d => d.host))
  const ports = new Set(ok.map(d => d.port))

  let behavior
  if (ok.length >= 2) {
    behavior = ports.size === 1 ? 'endpoint-independent' : 'address-dependent'
  } else {
    behavior = 'unknown'
  }

  const candidates = []
  const push = (p) => {
    if (p > 0 && p < 65536 && !candidates.includes(p) && candidates.length < maxCandidates) candidates.push(p)
  }

  // 映射端口优先（最可能通），其次本地端口（端口保持型 NAT 场景）
  const sortedPorts = [...ports].sort((a, b) => a - b)
  for (const p of sortedPorts) push(p)

  if (sortedPorts.length >= 2) {
    // 对称型：依据观测到的端口步长做线性预测
    const deltas = []
    for (let i = 1; i < sortedPorts.length; i++) {
      const d = sortedPorts[i] - sortedPorts[i - 1]
      if (d > 0 && d < 128) deltas.push(d)
    }
    const delta = deltas.length ? deltas[Math.floor(deltas.length / 2)] : 1
    const last = sortedPorts[sortedPorts.length - 1]
    for (let i = 1; i <= 3; i++) push(last + delta * i)
  }

  push(localPort)

  return {
    behavior,
    publicIp: sortedIpsFirst(ok),
    publicPort: ok[0].port,
    servers: (discoveries || []).length,
    responsive: ok.length,
    mappings: ok.map(d => ({ server: d.server, host: d.host, port: d.port, rtt: d.rtt })),
    candidates
  }
}

function sortedIpsFirst (ok) {
  // 取出现次数最多的 ip
  const count = new Map()
  for (const d of ok) count.set(d.host, (count.get(d.host) || 0) + 1)
  let best = null
  let bestN = -1
  for (const [ip, n] of count) {
    if (n > bestN) { best = ip; bestN = n }
  }
  return best
}

module.exports = { analyze }

});

__define('src/net/punch', function (module, exports, __require) {
'use strict'

const crypto = require('crypto')
const P = __require('src/protocol')

function makePunch () {
  const b = Buffer.alloc(P.PUNCH_LEN)
  P.MAGIC.copy(b, 0)
  b[4] = P.VERSION
  b[5] = 0
  crypto.randomFillSync(b, 6)
  return b
}

/**
 * 打洞器：对每个候选地址持续发送 16 字节探测包。
 *
 * 双方同时向对方候选地址发包是最关键的一步：只要任意一侧的 NAT
 * 是"锥形"（endpoint-independent mapping），第一个出向包就会在 NAT 上
 * 打出洞，对端随后到达的包即可穿过。反过来若两侧都是端口受限的对称
 * NAT，则无法在不借助中继的前提下直连——这里不引入中继，直接报失败。
 */
class Puncher {
  constructor (socket, opts = {}) {
    this.socket = socket
    this.interval = opts.interval || 400
    this.maxTargets = opts.maxTargets || 96
    this.holdMs = opts.holdMs || 120000
    this.targets = new Map() // key -> {host, port, since, n}
    this.sent = 0
    this.timer = setInterval(() => this.tick(), this.interval)
    if (this.timer.unref) this.timer.unref()
  }

  add (host, port) {
    const key = host + ':' + port
    if (this.targets.has(key)) return
    if (this.targets.size >= this.maxTargets) return
    this.targets.set(key, { host, port, since: Date.now(), n: 0 })
  }

  remove (host, port) {
    this.targets.delete(host + ':' + port)
  }

  has (host, port) {
    return this.targets.has(host + ':' + port)
  }

  tick () {
    const now = Date.now()
    for (const [key, t] of this.targets) {
      if (now - t.since > this.holdMs) {
        this.targets.delete(key)
        continue
      }
      // 前 30 秒高频，之后降频做低成本探测（同时维持 NAT 映射）
      const stride = now - t.since < 30000 ? 1 : 8
      if (t.n++ % stride === 0) {
        this.socket.send(makePunch(), t.host, t.port)
        this.sent++
      }
    }
  }

  stop () {
    clearInterval(this.timer)
    this.targets.clear()
  }

  list () {
    return [...this.targets.values()].map(t => `${t.host}:${t.port}`)
  }
}

module.exports = { Puncher, makePunch }

});

__define('src/net/secure', function (module, exports, __require) {
'use strict'

const crypto = require('crypto')
const P = __require('src/protocol')
const { edPubFromRaw, xPubFromRaw, rawPub } = __require('src/util/keys')

const HS_LABEL = Buffer.from('p2pnet/v1')
const INFO = Buffer.from('p2pnet/v1 session')

/**
 * 握手包（固定 192 字节，长度不泄露任何信息）：
 *   [0..3]   'P2PH'
 *   [4]      version
 *   [5]      flags
 *   [6..7]   reserved
 *   [8..39]  临时 X25519 公钥（每会话生成，提供前向保密）
 *   [40..71] 长期 Ed25519 身份公钥（稳定 peerId）
 *   [72..87] 16 字节随机 nonce
 *   [88..151] Ed25519 签名(body)
 *   [152..183] HMAC-SHA256(netKey, body||sig) —— 证明"我知道网络口令"，但不泄露口令
 *   [184..191] 随机填充
 *
 * 双重校验的意义：
 *   - HMAC 挡住网络外部的扫描者与伪造者；
 *   - 签名把关的是身份，避免中间人替换临时公钥（HMAC 谁都算得出来，
 *     但签名只有持有 staticPub 对应私钥的人算得出）。
 */
function buildHandshake (identity, netKey, eph, nonce) {
  const ephPub = rawPub(eph.publicKey)
  const staticPub = rawPub(identity.publicKey)
  const body = Buffer.concat([HS_LABEL, Buffer.from([P.VERSION]), ephPub, staticPub, nonce])
  const sig = crypto.sign(null, body, identity.privateKey)
  const tag = crypto.createHmac('sha256', netKey).update(body).update(sig).digest()

  const buf = Buffer.alloc(P.HS_LEN)
  P.HS_MAGIC.copy(buf, 0)
  buf[4] = P.VERSION
  buf[5] = 0
  ephPub.copy(buf, 8)
  staticPub.copy(buf, 40)
  nonce.copy(buf, 72)
  sig.copy(buf, 88)
  tag.copy(buf, 152)
  crypto.randomFillSync(buf, 184, P.HS_LEN - 184)
  return buf
}

function parseHandshake (buf, netKey) {
  if (buf.length !== P.HS_LEN) return null
  if (!buf.subarray(0, 4).equals(P.HS_MAGIC)) return null
  if (buf[4] !== P.VERSION) return null

  const ephPub = Buffer.from(buf.subarray(8, 40))
  const staticPub = Buffer.from(buf.subarray(40, 72))
  const nonce = Buffer.from(buf.subarray(72, 88))
  const sig = Buffer.from(buf.subarray(88, 152))
  const tag = Buffer.from(buf.subarray(152, 184))

  const body = Buffer.concat([HS_LABEL, Buffer.from([P.VERSION]), ephPub, staticPub, nonce])
  const expect = crypto.createHmac('sha256', netKey).update(body).update(sig).digest()
  if (!crypto.timingSafeEqual(expect, tag)) return null

  let ok = false
  try {
    ok = crypto.verify(null, body, edPubFromRaw(staticPub), sig)
  } catch (e) {
    ok = false
  }
  if (!ok) return null

  const peerId = __require('src/util/bytes').base32(
    crypto.createHash('sha256').update(staticPub).digest(), 12
  )

  return { ephPub, ephPubKey: xPubFromRaw(ephPub), staticPub, nonce, peerId }
}

/**
 * 会话密钥派生。两端各自算一遍，必须得到一致结果：
 * 以 staticPub 字典序确定 low/high，方向键固定为 low→high / high→low。
 */
function deriveSessionKeys (shared, mine, theirs) {
  const mineLow = Buffer.compare(mine.pub, theirs.pub) < 0
  const low = mineLow ? mine : theirs
  const high = mineLow ? theirs : mine

  const salt = crypto.createHash('sha256')
    .update(Buffer.concat([low.nonce, high.nonce, low.pub, high.pub]))
    .digest()

  const okm = Buffer.from(crypto.hkdfSync('sha256', shared, salt, INFO, 72))
  const a2b = { key: okm.subarray(0, 32), tag: okm.subarray(32, 36) }
  const b2a = { key: okm.subarray(36, 68), tag: okm.subarray(68, 72) }

  return mineLow ? { send: a2b, recv: b2a } : { send: b2a, recv: a2b }
}

function bucketSize (need) {
  for (const b of P.BUCKETS) if (b >= need) return b
  return P.BUCKETS[P.BUCKETS.length - 1]
}

/**
 * 加密信道：所有帧长度都是固定桶长之一（64/256/1024/4096）。
 * 帧结构：tag(4) | counter(8) | ciphertext | gcmTag(16)
 *   - tag 用于在不知道对端地址的情况下快速定位会话密钥；
 *   - counter 单调递增，配合每方向独立密钥保证 nonce 绝不重用，同时提供重放保护。
 */
class SecureChannel {
  constructor (send, recv) {
    this.sendKey = send.key
    this.sendTag = send.tag
    this.recvKey = recv.key
    this.recvTag = recv.tag
    this.ctr = 0
    this.lastCtr = 0
  }

  encrypt (inner) {
    const need = inner.length + P.FRAME_OVERHEAD
    const bucket = bucketSize(need)
    const cap = bucket - P.FRAME_OVERHEAD
    if (inner.length > cap) throw new Error('frame too large')

    const plain = Buffer.alloc(cap)
    inner.copy(plain, 0)
    if (cap > inner.length) crypto.randomFillSync(plain, inner.length, cap - inner.length)

    const ctr = ++this.ctr
    const hdr = Buffer.alloc(12)
    this.sendTag.copy(hdr, 0)
    hdr.writeBigUInt64BE(BigInt(ctr), 4)
    const iv = Buffer.alloc(12)
    iv.writeBigUInt64BE(BigInt(ctr), 4)

    const c = crypto.createCipheriv('aes-256-gcm', this.sendKey, iv)
    c.setAAD(hdr)
    const ct = Buffer.concat([c.update(plain), c.final()])
    return Buffer.concat([hdr, ct, c.getAuthTag()])
  }

  decrypt (frame) {
    if (frame.length < P.FRAME_OVERHEAD) return null
    const hdr = frame.subarray(0, 12)
    if (!hdr.subarray(0, 4).equals(this.recvTag)) return null
    const ctr = hdr.readBigUInt64BE(4)
    if (ctr <= this.lastCtr) return null // 重放/乱序丢弃，交由上层重传

    const iv = Buffer.alloc(12)
    iv.writeBigUInt64BE(ctr, 4)
    const d = crypto.createDecipheriv('aes-256-gcm', this.recvKey, iv)
    d.setAAD(hdr)
    d.setAuthTag(frame.subarray(frame.length - 16))
    let out
    try {
      out = Buffer.concat([d.update(frame.subarray(12, frame.length - 16)), d.final()])
    } catch (e) {
      return null
    }
    this.lastCtr = ctr
    return out
  }
}

module.exports = { buildHandshake, parseHandshake, deriveSessionKeys, SecureChannel, bucketSize }

});

__define('src/net/session', function (module, exports, __require) {
'use strict'

const crypto = require('crypto')
const { EventEmitter } = require('events')
const P = __require('src/protocol')
const { buildHandshake, parseHandshake, deriveSessionKeys, SecureChannel } = __require('src/net/secure')
const { rawPub } = __require('src/util/keys')

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

});

__define('src/net/stun', function (module, exports, __require) {
'use strict'

const crypto = require('crypto')

const MAGIC_COOKIE = 0x2112a442

/**
 * 用同一个 UDP socket 发 STUN Binding Request。
 * 必须复用数据面 socket：这样拿到的映射端口就是真正用来打洞/收数据的端口。
 */
function stunRequest (socket, server, timeout = 1500) {
  return new Promise((resolve, reject) => {
    const tx = crypto.randomBytes(12)
    const req = Buffer.alloc(20)
    req.writeUInt16BE(0x0001, 0) // Binding Request
    req.writeUInt16BE(0, 2) // length
    req.writeUInt32BE(MAGIC_COOKIE, 4)
    tx.copy(req, 8)

    const onStun = (msg) => {
      if (msg.length < 20) return
      if (!msg.subarray(8, 20).equals(tx)) return
      cleanup()
      try {
        resolve(parseResponse(msg))
      } catch (e) {
        reject(e)
      }
    }
    const cleanup = () => {
      clearTimeout(timer)
      socket.removeListener('stun', onStun)
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('stun timeout'))
    }, timeout)
    timer.unref && timer.unref()

    socket.on('stun', onStun)
    socket.send(req, server.host, server.port)
  })
}

function parseResponse (msg) {
  let i = 20
  let mapped = null
  let xorMapped = null
  while (i + 4 <= msg.length) {
    const type = msg.readUInt16BE(i)
    const len = msg.readUInt16BE(i + 2)
    const val = msg.subarray(i + 4, i + 4 + len)
    if (val.length < len) break

    if (type === 0x0020 && len >= 8) { // XOR-MAPPED-ADDRESS
      const family = val[1]
      if (family === 0x01) {
        const port = val.readUInt16BE(2) ^ (MAGIC_COOKIE >>> 16)
        const ip = [
          val[4] ^ 0x21, val[5] ^ 0x12, val[6] ^ 0xa4, val[7] ^ 0x42
        ].join('.')
        xorMapped = { host: ip, port }
      }
    } else if (type === 0x0001 && len >= 8) { // MAPPED-ADDRESS（老服务器）
      const family = val[1]
      if (family === 0x01) {
        mapped = {
          host: `${val[4]}.${val[5]}.${val[6]}.${val[7]}`,
          port: val.readUInt16BE(2)
        }
      }
    }
    i += 4 + len
    i += (4 - (len % 4)) % 4 // 4 字节对齐
  }
  const r = xorMapped || mapped
  if (!r) throw new Error('stun: no mapped address')
  return r
}

/** 并发向多个 STUN 服务器探测，全部超时也不报错（降级为 unknown） */
async function discover (socket, servers, timeout = 1500) {
  const list = (servers || []).filter(s => s && s.host && s.port)
  const results = await Promise.all(list.map(async (s) => {
    const tag = `${s.host}:${s.port}`
    const t0 = Date.now()
    try {
      const r = await stunRequest(socket, s, timeout)
      return { server: tag, host: r.host, port: r.port, rtt: Date.now() - t0, ok: true }
    } catch (e) {
      return { server: tag, ok: false, error: e.message }
    }
  }))
  return results
}

function parseServer (url) {
  // 支持 'stun:host:port' / 'host:port' / {host, port}
  if (typeof url === 'object' && url.host) return { host: url.host, port: Number(url.port) || 3478 }
  const s = String(url).replace(/^stuns?:/, '')
  const idx = s.lastIndexOf(':')
  if (idx < 0) return { host: s, port: 3478 }
  return { host: s.slice(0, idx), port: Number(s.slice(idx + 1)) || 3478 }
}

module.exports = { discover, stunRequest, parseServer }

});

__define('src/net/udp', function (module, exports, __require) {
'use strict'

const dgram = require('dgram')
const { EventEmitter } = require('events')
const P = __require('src/protocol')
const { MAGIC, HS_MAGIC } = P
const bencode = __require('src/util/bencode')

/**
 * 单一 UDP 端口承载全部流量：
 *   - DHT（KRPC，bencode 字典，首字节 'd'）
 *   - STUN（响应带 magic cookie 0x2112A442）
 *   - 打洞探测（'P2PN'，16 字节）
 *   - 握手（'P2PH'，192 字节）
 *   - 加密数据帧（其余）
 *
 * 为什么必须共用一个 socket：NAT 映射是绑定到 (内部 ip:port) 的。
 * 公布出去的端口必须是真正收发数据的那个端口，否则打洞必失败。
 */
class UDPSocket extends EventEmitter {
  constructor (opts = {}) {
    super()
    this.sock = dgram.createSocket({
      type: 'udp4',
      recvBufferSize: 1 << 20,
      sendBufferSize: 1 << 20
    })
    this.port = 0
    this.sock.on('message', (buf, rinfo) => this._dispatch(buf, rinfo))
    this.sock.on('error', (err) => this.emit('error', err))
  }

  bind (port = 0, host = '0.0.0.0') {
    return new Promise((resolve, reject) => {
      const onErr = (err) => { this.sock.removeListener('listening', onOk); reject(err) }
      const onOk = () => {
        this.sock.removeListener('error', onErr)
        this.port = this.sock.address().port
        resolve(this.port)
      }
      this.sock.once('error', onErr)
      this.sock.once('listening', onOk)
      this.sock.bind(port, host)
    })
  }

  send (buf, host, port) {
    try {
      this.sock.send(buf, 0, buf.length, port, host, () => {})
    } catch (e) { /* 目标不可达时静默丢弃，UDP 语义如此 */ }
  }

  close () {
    try { this.sock.close() } catch (e) { /* ignore */ }
  }

  _dispatch (buf, rinfo) {
    // 1) STUN
    if (buf.length >= 20 && buf.readUInt32BE(4) === 0x2112a442) {
      return this.emit('stun', buf, rinfo)
    }
    // 2) 打洞
    if (buf.length === 16 && buf.subarray(0, 4).equals(MAGIC)) {
      return this.emit('punch', buf, rinfo)
    }
    // 3) 握手
    if (buf.length === 192 && buf.subarray(0, 4).equals(HS_MAGIC)) {
      return this.emit('handshake', buf, rinfo)
    }
    // 4) KRPC
    if (buf.length >= 3 && buf[0] === 0x64) { // 'd'
      let msg = null
      try { msg = bencode.decode(buf) } catch (e) { msg = null }
      if (msg && typeof msg === 'object' && !Buffer.isBuffer(msg) && Array.isArray(msg) === false &&
          msg.y && msg.t) {
        return this.emit('krpc', msg, rinfo)
      }
      // 以 'd' 开头但解析不了：公共 DHT 里实现不规范的报文，归为噪音
      return this.emit('junk', buf, rinfo)
    }
    // 5) 加密帧：我们的帧长度只可能是这四种（定长分桶），其它一律不是我们的流量
    if (P.BUCKETS.indexOf(buf.length) >= 0) return this.emit('frame', buf, rinfo)
    // 6) 噪音：DHT 畸形报文、扫描包、别人的协议
    this.emit('junk', buf, rinfo)
  }
}

module.exports = { UDPSocket }

});

__define('src/app/config', function (module, exports, __require) {
'use strict'

const os = require('os')
const path = require('path')

// 中国大陆可用、且多家可互换的 STUN（仅用于"开洞前"探测映射，不承载通信）
const STUN_SERVERS = [
  { url: 'stun:fwa.lifesizecloud.com:3478' },
  { url: 'stun:stun.isp.net.au:3478' },
  { url: 'stun:stun.freeswitch.org:3478' },
  { url: 'stun:stun.voip.blackberry.com:3478' }
]

// 公共 BitTorrent DHT 引导节点（任选其一即可接入 DHT 网络，多写只为容错）
const BOOTSTRAPS = [
  { host: '34.197.35.250', port: 6880 },
  { host: '72.46.58.63', port: 51413 },
  { host: '46.53.251.68', port: 16970 },
  { host: '191.95.16.229', port: 55998 },
  { host: '79.173.94.111', port: 1438 },
  { host: '45.233.86.50', port: 61995 },
  { host: '178.162.174.28', port: 28013 },
  { host: '178.162.174.240', port: 28006 },
  { host: '72.21.17.101', port: 22643 },
  { host: '31.181.42.46', port: 22566 },
  { host: '67.213.106.46', port: 61956 },
  { host: '201.131.172.249', port: 53567 },
  { host: '185.203.152.184', port: 2003 },
  { host: '68.146.23.207', port: 42107 },
  { host: '51.195.222.183', port: 8653 },
  { host: '85.17.170.48', port: 28005 },
  { host: '87.98.162.88', port: 6881 },
  { host: '185.145.245.121', port: 8656 },
  { host: '52.201.45.189', port: 6880 }
]

function defaults () {
  return {
    network: 'p2pnet-demo', // 网络名（决定 DHT rendezvous 主题）
    secret: '', // 网络口令；为空则由 network 派生（不安全，仅测试）
    listenPort: 6881,
    dataDir: path.join(process.cwd(), 'data'),
    stun: STUN_SERVERS.slice(),
    bootstrap: BOOTSTRAPS.slice(),
    extraBootstrap: [],
    peers: [], // 手动指定的对端 {host, port}，跳过 DHT 直接打洞

    epochMs: 60 * 60 * 1000, // 主题轮换周期，0 表示不轮换
    announceInterval: 60 * 1000,
    lookupInterval: 20 * 1000,
    stunTimeout: 1500,

    chaff: 6000, // 掩护流量平均间隔（ms），0 关闭
    jitter: 80, // 真实帧发送抖动上限（ms），0 关闭
    rto: 500,
    idleTimeout: 60 * 1000,
    maxSessions: 256,

    logLevel: 'info',
    debugReportUrl: '',
    dhtOnly: false // 只做 DHT 地址簿（不公告、不打洞），用于自建 rendezvous 节点 // 调试面板地址（如 https://xxx.workers.dev/r/demo）
  }
}

function normalize (cfg = {}) {
  const d = defaults()
  const out = Object.assign({}, d, cfg)
  out.network = String(out.network || d.network).trim()
  out.secret = String(out.secret || '')
  out.listenPort = Number(out.listenPort) || 0
  out.dataDir = cfg.dataDir || d.dataDir
  out.epochMs = Number(out.epochMs) >= 0 ? Number(out.epochMs) : d.epochMs
  out.stun = (out.stun || []).map(s => (typeof s === 'string' ? s : s.url || s))
  out.bootstrap = (out.bootstrap || []).slice()
  out.extraBootstrap = (out.extraBootstrap || []).slice()
  return out
}

function localAddresses () {
  const out = []
  const ifs = os.networkInterfaces()
  for (const name of Object.keys(ifs)) {
    for (const i of ifs[name] || []) {
      if (i.family === 'IPv4') out.push(i.address)
    }
  }
  return out
}

module.exports = { defaults, normalize, STUN_SERVERS, BOOTSTRAPS, localAddresses }

});

__define('src/app/node', function (module, exports, __require) {
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { EventEmitter } = require('events')

const P = __require('src/protocol')
const { UDPSocket } = __require('src/net/udp')
const DHT = __require('src/dht/dht')
const { Puncher } = __require('src/net/punch')
const Session = __require('src/net/session')
const { discover, parseServer } = __require('src/net/stun')
const { analyze } = __require('src/net/nat')
const { loadIdentity, loadNodeId } = __require('src/util/keys')
const { createLogger } = __require('src/util/log')
const { sha1 } = __require('src/util/bytes')
const { normalize, localAddresses } = __require('src/app/config')

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
    this.packets = { krpc: 0, punch: 0, handshake: 0, frame: 0, junk: 0, stun: 0 }
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
    if (this.cfg.dhtOnly) {
      this.log.info('DHT-only 模式：只做地址簿，不公告、不打洞、不建会话')
      this.dht.bootstrap().then(n => this.log.info(`DHT: 路由表 ${n} 个节点`)).catch(() => {})
      this._timers.forEach(t => (t.unref && t.unref()))
      return this
    }
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
    // 收包类型统计：区分"DHT 网络噪音"和"真正的对端流量"
    for (const t of ['krpc', 'punch', 'handshake', 'frame', 'junk', 'stun']) {
      this.socket.on(t, () => { this.packets[t]++ })
    }

    this.socket.on('punch', (buf, rinfo) => {
      if (this.cfg.dhtOnly) return
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
      if (this.cfg.dhtOnly) return
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
      packets: Object.assign({}, this.packets),
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

});

__define('src/app/report', function (module, exports, __require) {
'use strict'

/**
 * 退出报告：把"此刻真的还能应答"的地址按可直接粘贴的 BOOTSTRAPS 格式输出。
 */

function formatBootstrapArray (list) {
  if (!list.length) return '[]'
  const lines = list.map((b, i) => {
    const tail = i === list.length - 1 ? '' : ','
    const pad = ' '.repeat(Math.max(0, 15 - b.host.length))
    return `  { host: '${b.host}',${pad}port: ${b.port} }${tail}`
  })
  return '[\n' + lines.join('\n') + '\n]'
}

function printReport (report, opts = {}) {
  const out = opts.write || ((s) => process.stdout.write(s + '\n'))
  const list = report.bootstraps || []

  out('')
  out('══════════════════════════════════════════════════════════════')
  out(' 本轮运行结束：当前可用的 DHT BOOTSTRAPS（已逐个 ping 验证）')
  out('══════════════════════════════════════════════════════════════')

  if (!list.length) {
    out('  （本次没有探测到可应答的地址）')
    out('  提示：若处于离线环境，可在下次启动时用 --bootstrap host:port 指定已知节点。')
  } else {
    out(`  共 ${list.length} 个可用节点，按 RTT 排序：`)
    out('')
    out('const BOOTSTRAPS = ' + formatBootstrapArray(list))
    out('')
    for (const b of list.slice(0, 20)) {
      out(`  ${b.host}:${b.port}  rtt=${b.rttMs}ms  (${b.source})`)
    }
    if (list.length > 20) out(`  … 其余 ${list.length - 20} 个略`)
  }

  out('')
  out('── 本节点信息 ──────────────────────────────────────────────')
  out(`  peerId    : ${report.peerId}`)
  out(`  UDP 端口  : ${report.listenPort}`)
  if (report.publicEndpoint) {
    out(`  公网映射  : ${report.publicEndpoint.host}:${report.publicEndpoint.port}`)
  }
  if (report.nat) {
    out(`  NAT 类型  : ${report.nat.behavior}`)
    out(`  候选端口  : ${(report.nat.candidates || []).join(', ')}`)
  }
  out(`  在线时长  : ${report.uptimeSec}s`)
  out(`  报告已存  : ${report.dataDir ? report.dataDir + '/bootstraps-latest.json' : 'data/bootstraps-latest.json'}（下次启动会自动加载）`)
  out('══════════════════════════════════════════════════════════════')
  out('')
}

module.exports = { printReport, formatBootstrapArray }

});

__define('bin/p2pnode', function (module, exports, __require) {
'use strict'

const readline = require('readline')
const path = require('path')
const { P2PNode } = __require('src/app/node')
const { printReport, formatBootstrapArray } = __require('src/app/report')
const { STUN_SERVERS, BOOTSTRAPS } = __require('src/app/config')

const HELP = `
p2pnode —— 无服务器的 P2P 节点（DHT 找地址 + STUN 探映射 + UDP 打洞直连 + 端到端加密）

用法：
  node bin/p2pnode.js [选项]

选项：
  --network <name>        网络名（同一网络名才能互相发现），默认 p2pnet-demo
  --secret <passphrase>   网络口令（强烈建议设置；不设则由网络名派生）
  --port <n>              本地 UDP 端口，默认 6881，0 表示随机
  --data-dir <dir>        身份/DHT ID/报告存放目录，默认 ./data
  --stun <url>            追加 STUN（可多次，形如 stun:host:3478）
  --no-stun               不使用 STUN（纯手动/局域网场景）
  --bootstrap <host:port> 追加 DHT 引导节点（可多次）
  --no-public-bootstrap   不内置公共 DHT 引导节点
  --peer <ip:port>        手动指定对端，跳过 DHT 直接打洞（可多次，联调用）
  --dht-only              只做 DHT 地址簿：不公告自己、不打洞、不建会话
  --epoch <ms>            主题轮换周期，默认 3600000，0 表示不轮换
  --chaff <ms>            掩护流量平均间隔，默认 6000，0 表示关闭
  --jitter <ms>           发送抖动上限，默认 80，0 表示关闭
  --announce <ms>         公告周期，默认 90000
  --lookup <ms>           发现周期，默认 45000
  --log <level>           silent|error|warn|info|debug，默认 info
  --debug-report <url>    上报到调试面板，如 https://xxx.workers.dev/r/demo
  --exec "<cmd;cmd>"      启动后自动执行若干命令（脚本化/测试用）
  --exit-after <ms>       运行指定毫秒后自动退出（会打印 BOOTSTRAPS）
  -h, --help              显示帮助

交互命令：
  /peers                  已连接节点
  /send <id|all> <text>   发送消息（id 支持前缀）
  /status                 本节点状态（NAT、DHT、主题、候选地址）
  /find                   立即再做一轮公告+发现
  /bootstraps             立即校验并打印当前可用 BOOTSTRAPS
  /sleep <ms>             等待（配合 --exec 做脚本化演示/测试）
  /stun                   重新做一次 STUN 映射探测
  /help                   帮助
  /quit                   退出（退出时打印可用 BOOTSTRAPS）
`

function parseArgs (argv) {
  const out = { extraBootstrap: [], peers: [], stun: null, noStun: false, noPublic: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    switch (a) {
      case '-h': case '--help': out.help = true; break
      case '--network': out.network = next(); break
      case '--secret': out.secret = next(); break
      case '--port': out.listenPort = Number(next()); break
      case '--data-dir': out.dataDir = path.resolve(next()); break
      case '--stun':
        out.stun = out.stun || []
        out.stun.push(next())
        break
      case '--no-stun': out.noStun = true; break
      case '--bootstrap': {
        const v = next() || ''
        const idx = v.lastIndexOf(':')
        if (idx > 0) out.extraBootstrap.push({ host: v.slice(0, idx), port: Number(v.slice(idx + 1)) })
        break
      }
      case '--no-public-bootstrap': out.noPublic = true; break
      case '--peer': {
        const v = next() || ''
        const idx = v.lastIndexOf(':')
        if (idx > 0) out.peers.push({ host: v.slice(0, idx), port: Number(v.slice(idx + 1)) })
        break
      }
      case '--epoch': out.epochMs = Number(next()); break
      case '--chaff': out.chaff = Number(next()); break
      case '--jitter': out.jitter = Number(next()); break
      case '--announce': out.announceInterval = Number(next()); break
      case '--lookup': out.lookupInterval = Number(next()); break
      case '--log': out.logLevel = next(); break
      case '--debug-report': out.debugReportUrl = next(); break
      case '--dht-only': out.dhtOnly = true; break
      case '--exec': out.exec = next(); break
      case '--exit-after': out.exitAfter = Number(next()); break
      default:
        if (a.startsWith('--')) process.stderr.write(`未知选项: ${a}\n`)
    }
  }
  return out
}

async function main () {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    process.stdout.write(HELP)
    return
  }

  const cfg = {
    network: args.network || 'p2pnet-demo',
    secret: args.secret || '',
    listenPort: args.listenPort === undefined ? 6881 : args.listenPort,
    dataDir: args.dataDir,
    logLevel: args.logLevel || 'info',
    debugReportUrl: args.debugReportUrl || '',
    dhtOnly: !!args.dhtOnly,
    extraBootstrap: args.extraBootstrap,
    peers: args.peers
  }
  if (args.epochMs !== undefined) cfg.epochMs = args.epochMs
  if (args.chaff !== undefined) cfg.chaff = args.chaff
  if (args.jitter !== undefined) cfg.jitter = args.jitter
  if (args.announceInterval !== undefined) cfg.announceInterval = args.announceInterval
  if (args.lookupInterval !== undefined) cfg.lookupInterval = args.lookupInterval
  if (args.noStun) cfg.stun = []
  else if (args.stun) cfg.stun = args.stun
  if (args.noPublic) cfg.bootstrap = []

  const node = new P2PNode(cfg)

  node.on('peer', (p) => {
    process.stdout.write(`\n[+] 节点接入 ${p.peerId} @ ${p.host}:${p.port}\n> `)
  })
  node.on('peer:close', (p) => {
    process.stdout.write(`\n[-] 节点断开 ${p.peerId || p.host + ':' + p.port}（${p.reason}）\n> `)
  })
  node.on('message', (m) => {
    const tag = m.peerId ? m.peerId.slice(0, 6) : '??????'
    process.stdout.write(`\n<${tag}> ${m.text}\n> `)
  })

  await node.start()

  process.stdout.write(
    `节点已启动\n  peerId : ${node.peerId}\n  网络   : ${cfg.network}\n` +
    `  UDP    : ${node.listenPort}\n  DHT    : 正在接入（内置 ${(args.noPublic ? [] : BOOTSTRAPS).length} 个公共引导节点）\n` +
    `  STUN   : ${args.noStun ? '已禁用' : (args.stun || STUN_SERVERS.map(s => s.url)).length + ' 个'}\n` +
    `\n输入 /help 查看命令。\n`
  )

  let closing = false
  const shutdown = async (code = 0) => {
    if (closing) return
    closing = true
    const report = await node.stop()
    printReport(report)
    process.exit(code)
  }

  process.on('SIGINT', () => { shutdown(0) })
  process.on('SIGTERM', () => { shutdown(0) })

  let rl = null
  const runCommand = async (line) => {
    const s = String(line || '').trim()
    if (!s) return
    if (!s.startsWith('/')) {
      return process.stdout.write('不是命令。发送消息请用 /send <id|all> <text>\n> ')
    }
    const [cmd, ...rest] = s.split(/\s+/)
    switch (cmd) {
      case '/help':
        process.stdout.write(HELP)
        break
      case '/peers': {
        const list = node.peers()
        if (!list.length) process.stdout.write('（暂无已连接节点，正在通过 DHT 发现…）\n')
        else {
          process.stdout.write('peerId        地址                  时长   收/发\n')
          for (const p of list) {
            process.stdout.write(
              `${p.peerId}  ${(p.host + ':' + p.port).padEnd(21)}  ${String(p.ageSec).padStart(4)}s  ${p.rxMsgs}/${p.txMsgs}\n`
            )
          }
        }
        break
      }
      case '/send': {
        const target = rest.shift()
        const text = rest.join(' ')
        if (!target || !text) {
          process.stdout.write('用法：/send <id|all> <text>\n')
          break
        }
        const n = node.send(target, text)
        process.stdout.write(n ? `已发送给 ${n} 个节点\n` : '没有匹配的节点\n')
        break
      }
      case '/status': {
        const st = node.status()
        process.stdout.write(JSON.stringify({
          peerId: st.peerId,
          listenPort: st.listenPort,
          publicEndpoint: st.nat && st.nat.publicIp ? `${st.nat.publicIp}:${st.nat.publicPort}` : null,
          nat: st.nat && st.nat.behavior,
          candidates: st.nat && st.nat.candidates,
          topic: st.topic.slice(0, 16) + '…',
          dhtNodes: st.dhtNodes,
          sessions: st.sessions,
          knownPeers: st.knownPeers.map(p => `${p.host}:${p.port}`),
          punching: st.punching,
          stats: st.stats
        }, null, 2) + '\n')
        break
      }
      case '/find': {
        process.stdout.write('正在公告并查找其他节点…\n')
        const n = await node.discoverNow()
        process.stdout.write(`当前已连接 ${n} 个节点\n`)
        break
      }
      case '/bootstraps': {
        process.stdout.write('正在校验可用地址（ping）…\n')
        const list = await node.collectBootstraps()
        process.stdout.write('const BOOTSTRAPS = ' + formatBootstrapArray(list) + '\n')
        break
      }
      case '/stun': {
        await node._stun()
        process.stdout.write(JSON.stringify(node.nat, null, 2) + '\n')
        break
      }
      case '/sleep': {
        const ms = Number(rest[0]) || 1000
        await new Promise(r => setTimeout(r, ms))
        break
      }
      case '/quit': case '/exit':
        return shutdown(0)
      default:
        process.stdout.write(`未知命令 ${cmd}，输入 /help\n`)
    }
    process.stdout.write('> ')
  }

  if (args.exec) {
    for (const cmd of args.exec.split(';').map(x => x.trim()).filter(Boolean)) {
      await runCommand(cmd)
      await new Promise(r => setTimeout(r, 300))
    }
  }

  if (args.exitAfter) {
    setTimeout(() => shutdown(0), args.exitAfter)
    // 仍需保持进程存活
    rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' })
    rl.prompt()
    rl.on('line', (line) => runCommand(line).catch(() => {}))
    return
  }

  if (!process.stdin.isTTY) {
    rl = readline.createInterface({ input: process.stdin })
    rl.on('line', (line) => { if (line.trim()) runCommand(line).catch(() => {}) })
    rl.on('close', () => shutdown(0))
    return
  }

  rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' })
  rl.prompt()
  rl.on('line', (line) => runCommand(line).catch((e) => {
    process.stdout.write('命令出错: ' + e.message + '\n> ')
  }))
  rl.on('close', () => shutdown(0))
}

main().catch((e) => {
  process.stderr.write('启动失败: ' + (e && e.stack || e) + '\n')
  process.exit(1)
})

});

__require('bin/p2pnode')
