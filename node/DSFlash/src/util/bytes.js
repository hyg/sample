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
