'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { base32, sha256 } = require('./bytes')

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
