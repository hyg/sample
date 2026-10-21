'use strict'

const { bucketIndex, distanceCmp } = require('../util/bytes')

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
