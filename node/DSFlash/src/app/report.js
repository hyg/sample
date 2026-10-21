'use strict'

/**
 * 退出报告：把"此刻真的还能应答"的地址按可直接粘贴的 BOOTSTRAPS 格式输出。
 */

function formatBootstrapArray (list) {
  if (!list.length) return '[]'
  const lines = list.map((b, i) => {
    const tail = i === list.length - 1 ? '' : ','
    const pad = ' '.repeat(Math.max(0, 15 - b.host.length))
    return `  { host: '${b.host}',${pad}port: ${b.port} }${tail}`
  })
  return '[\n' + lines.join('\n') + '\n]'
}

function printReport (report, opts = {}) {
  const out = opts.write || ((s) => process.stdout.write(s + '\n'))
  const list = report.bootstraps || []

  out('')
  out('══════════════════════════════════════════════════════════════')
  out(' 本轮运行结束：当前可用的 DHT BOOTSTRAPS（已逐个 ping 验证）')
  out('══════════════════════════════════════════════════════════════')

  if (!list.length) {
    out('  （本次没有探测到可应答的地址）')
    out('  提示：若处于离线环境，可在下次启动时用 --bootstrap host:port 指定已知节点。')
  } else {
    out(`  共 ${list.length} 个可用节点，按 RTT 排序：`)
    out('')
    out('const BOOTSTRAPS = ' + formatBootstrapArray(list))
    out('')
    for (const b of list.slice(0, 20)) {
      out(`  ${b.host}:${b.port}  rtt=${b.rttMs}ms  (${b.source})`)
    }
    if (list.length > 20) out(`  … 其余 ${list.length - 20} 个略`)
  }

  out('')
  out('── 本节点信息 ──────────────────────────────────────────────')
  out(`  peerId    : ${report.peerId}`)
  out(`  UDP 端口  : ${report.listenPort}`)
  if (report.publicEndpoint) {
    out(`  公网映射  : ${report.publicEndpoint.host}:${report.publicEndpoint.port}`)
  }
  if (report.nat) {
    out(`  NAT 类型  : ${report.nat.behavior}`)
    out(`  候选端口  : ${(report.nat.candidates || []).join(', ')}`)
  }
  out(`  在线时长  : ${report.uptimeSec}s`)
  out(`  报告已存  : ${report.dataDir ? report.dataDir + '/bootstraps-latest.json' : 'data/bootstraps-latest.json'}（下次启动会自动加载）`)
  out('══════════════════════════════════════════════════════════════')
  out('')
}

module.exports = { printReport, formatBootstrapArray }
