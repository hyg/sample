'use strict'

const crypto = require('crypto')
const P = require('../protocol')
const { edPubFromRaw, xPubFromRaw, rawPub } = require('../util/keys')

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

  const peerId = require('../util/bytes').base32(
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
