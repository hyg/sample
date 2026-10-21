import crypto from 'node:crypto'

const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')
const X25519_SPKI_PREFIX = Buffer.from('302a300506032b656e032100', 'hex')

export function deriveRoomKeys (roomSecret) {
  const seed = crypto.createHash('sha256').update('p2p-room/dht-ed25519/v1|' + roomSecret).digest()
  const privateKey = crypto.createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8'
  })
  const spki = crypto.createPublicKey(privateKey).export({ format: 'der', type: 'spki' })
  const publicKey = Buffer.from(spki.subarray(spki.length - 32))

  const master = Buffer.from(roomSecret, 'utf8')
  const aesKey = Buffer.from(crypto.hkdfSync('sha256', master, Buffer.from('record-enc-salt'), Buffer.from('p2p-room/v1'), 32))
  const hmacKey = Buffer.from(crypto.hkdfSync('sha256', master, Buffer.from('handshake-auth-salt'), Buffer.from('p2p-room/v1'), 32))

  const sign = (buf) => crypto.sign(null, buf, privateKey)

  const verifyEd = (sig, buf, k) => {
    try {
      if (!Buffer.isBuffer(sig) || !Buffer.isBuffer(k) || k.length !== 32) return false
      const pub = crypto.createPublicKey({
        key: Buffer.concat([ED25519_SPKI_PREFIX, k]),
        format: 'der',
        type: 'spki'
      })
      return crypto.verify(null, buf, pub, sig)
    } catch {
      return false
    }
  }

  return { publicKey, aesKey, hmacKey, sign, verifyEd }
}

export function dhtTarget (roomPublicKey) {
  return crypto.createHash('sha1').update(roomPublicKey).digest()
}

export function generateX25519 () {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('x25519')
  return { priv: privateKey, pub: publicKey }
}

export function rawPublicKey (keyObject) {
  const der = keyObject.export({ format: 'der', type: 'spki' })
  return Buffer.from(der.subarray(der.length - 32))
}

export function publicKeyFromRaw (raw) {
  return crypto.createPublicKey({
    key: Buffer.concat([X25519_SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki'
  })
}

export function ecdh (privateKeyObject, rawPeerPublicKey) {
  return crypto.diffieHellman({
    privateKey: privateKeyObject,
    publicKey: publicKeyFromRaw(rawPeerPublicKey)
  })
}

export function hkdf32 (ikm, salt, info) {
  return Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, 32))
}

export function hmac16 (key, data) {
  return crypto.createHmac('sha256', key).update(data).digest().subarray(0, 16)
}

export function timingSafeEqual16 (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b) || a.length !== 16 || b.length !== 16) return false
  return crypto.timingSafeEqual(a, b)
}
