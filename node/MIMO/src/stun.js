import crypto from 'node:crypto'
import dns from 'node:dns/promises'
import net from 'node:net'
import { STUN_TIMEOUT } from './defaults.js'

const MAGIC = 0x2112a442

export function parseStunUrl (url) {
  const m = /^stun:([^:]+):(\d+)$/.exec(String(url || '').trim())
  if (!m) return null
  return { host: m[1], port: Number(m[2]) }
}

export function parseStunList (value) {
  if (!value) return []
  const items = Array.isArray(value) ? value : String(value).split(',')
  const out = []
  for (const item of items) {
    const raw = typeof item === 'string' ? item : item.urls
    const parsed = parseStunUrl(raw)
    if (parsed) out.push(parsed)
  }
  return out
}

function buildBindingRequest () {
  const txid = crypto.randomBytes(12)
  const msg = Buffer.alloc(20)
  msg.writeUInt16BE(0x0001, 0)
  msg.writeUInt16BE(0, 2)
  msg.writeUInt32BE(MAGIC, 4)
  txid.copy(msg, 8)
  return { msg, txid }
}

function parseBindingResponse (buf, txid) {
  if (buf.length < 20) return null
  if (buf.readUInt16BE(0) !== 0x0101) return null
  if (!buf.subarray(8, 20).equals(txid)) return null
  let off = 20
  let mapped = null
  while (off + 4 <= buf.length) {
    const type = buf.readUInt16BE(off)
    const len = buf.readUInt16BE(off + 2)
    off += 4
    if (off + len > buf.length) break
    if ((type === 0x0004 || type === 0x0020) && len >= 8 && buf[off + 1] === 0x01) {
      let port = buf.readUInt16BE(off + 2)
      const addr = Buffer.from(buf.subarray(off + 4, off + 8))
      if (type === 0x0020) {
        port ^= MAGIC >>> 16
        addr.writeUInt32BE(addr.readUInt32BE(0) ^ MAGIC, 0)
      }
      const ip = `${addr[0]}.${addr[1]}.${addr[2]}.${addr[3]}`
      if (type === 0x0020) return { ip, port }
      mapped = { ip, port }
    }
    off += len + ((4 - (len % 4)) % 4)
  }
  return mapped
}

export function stunLookup (socket, server, timeout = STUN_TIMEOUT) {
  return new Promise((resolve) => {
    const { msg, txid } = buildBindingRequest()
    let done = false
    const finish = (result) => {
      if (done) return
      done = true
      clearTimeout(timer)
      socket.removeListener('message', onMessage)
      resolve(result)
    }
    const onMessage = (buf) => {
      const parsed = parseBindingResponse(buf, txid)
      if (parsed) finish(parsed)
    }
    const timer = setTimeout(() => finish(null), timeout)
    socket.on('message', onMessage)
    socket.send(msg, server.port, server.host, (err) => {
      if (err) finish(null)
    })
  })
}

async function resolveServer (server) {
  if (net.isIP(server.host)) return { host: server.host, port: server.port }
  try {
    const res = await dns.lookup(server.host, { family: 4 })
    return { host: res.address, port: server.port, name: server.host }
  } catch {
    return null
  }
}

function shuffle (arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function stunDiscover (socket, servers, { timeout = STUN_TIMEOUT, probes = 3 } = {}) {
  const list = shuffle(parseStunList(servers))
  const resolved = (await Promise.all(list.map(resolveServer))).filter(Boolean)
  if (!resolved.length) return null

  const results = await Promise.all(
    resolved.slice(0, probes).map(async (server) => {
      const mapped = await stunLookup(socket, server, timeout)
      return mapped ? { ...mapped, server: server.name || server.host } : null
    })
  )
  const ok = results.filter(Boolean)
  if (!ok.length) return null

  const first = ok[0]
  let nat = 'unknown'
  if (ok.length >= 2) {
    nat = ok.every((r) => r.ip === first.ip && r.port === first.port) ? 'cone' : 'symmetric'
  }
  return { ip: first.ip, port: first.port, nat, server: first.server }
}
