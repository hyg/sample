'use strict'

const crypto = require('crypto')
const P = require('../protocol')

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
