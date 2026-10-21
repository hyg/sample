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
