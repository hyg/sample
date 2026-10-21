import crypto from 'node:crypto'
import { RECORD_PLAIN_SIZE, RECORD_TTL, ROSTER_MAX_PEERS } from './defaults.js'

const VERSION = 1

export function encodeRecord (aesKey, roster) {
  const json = Buffer.from(JSON.stringify({ v: VERSION, m: roster }), 'utf8')
  const maxJson = RECORD_PLAIN_SIZE - 4
  if (json.length > maxJson) throw new Error(`名单过大: ${json.length} > ${maxJson} 字节`)
  const plain = Buffer.alloc(maxJson + 4)
  plain.writeUInt32BE(json.length, 0)
  json.copy(plain, 4)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv)
  const ct = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct])
}

export function decodeRecord (aesKey, buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 28) throw new Error('记录太短')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ct = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(ct), decipher.final()])
  if (plain.length < 4) throw new Error('记录损坏')
  const len = plain.readUInt32BE(0)
  if (len > plain.length - 4) throw new Error('记录长度非法')
  const parsed = JSON.parse(plain.subarray(4, 4 + len).toString('utf8'))
  if (parsed.v !== VERSION || typeof parsed.m !== 'object' || parsed.m === null) throw new Error('记录版本错误')
  return parsed.m
}

function validEntry (entry) {
  return entry &&
    typeof entry.ip === 'string' &&
    Number.isInteger(entry.port) && entry.port > 0 && entry.port <= 65535 &&
    Number.isFinite(entry.ts)
}

export function mergeRoster (remote, selfIdHex, selfEntry, { now = Date.now(), ttl = RECORD_TTL, max = ROSTER_MAX_PEERS } = {}) {
  const merged = new Map()
  if (remote && typeof remote === 'object') {
    for (const [id, entry] of Object.entries(remote)) {
      if (typeof id !== 'string' || !/^[0-9a-f]{40}$/.test(id)) continue
      if (id === selfIdHex) continue
      if (!validEntry(entry)) continue
      if (now - entry.ts > ttl) continue
      merged.set(id, entry)
    }
  }
  merged.set(selfIdHex, selfEntry)

  let entries = [...merged.entries()]
  if (entries.length > max) {
    entries = entries
      .filter(([id]) => id === selfIdHex)
      .concat(entries.filter(([id]) => id !== selfIdHex).sort((a, b) => b[1].ts - a[1].ts).slice(0, max - 1))
  }
  return Object.fromEntries(entries)
}

export function rosterDiff (prev, next) {
  const changed = []
  for (const [id, entry] of Object.entries(next)) {
    const before = prev?.[id]
    if (!before || before.ip !== entry.ip || before.port !== entry.port) {
      changed.push(id)
    }
  }
  return changed
}
