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
