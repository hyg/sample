#!/usr/bin/env node
'use strict'

const readline = require('readline')
const path = require('path')
const { P2PNode } = require('../src/app/node')
const { printReport, formatBootstrapArray } = require('../src/app/report')
const { STUN_SERVERS, BOOTSTRAPS } = require('../src/app/config')

const HELP = `
p2pnode —— 无服务器的 P2P 节点（DHT 找地址 + STUN 探映射 + UDP 打洞直连 + 端到端加密）

用法：
  node bin/p2pnode.js [选项]

选项：
  --network <name>        网络名（同一网络名才能互相发现），默认 p2pnet-demo
  --secret <passphrase>   网络口令（强烈建议设置；不设则由网络名派生）
  --port <n>              本地 UDP 端口，默认 6881，0 表示随机
  --data-dir <dir>        身份/DHT ID/报告存放目录，默认 ./data
  --stun <url>            追加 STUN（可多次，形如 stun:host:3478）
  --no-stun               不使用 STUN（纯手动/局域网场景）
  --bootstrap <host:port> 追加 DHT 引导节点（可多次）
  --no-public-bootstrap   不内置公共 DHT 引导节点
  --peer <ip:port>        手动指定对端，跳过 DHT 直接打洞（可多次，联调用）
  --epoch <ms>            主题轮换周期，默认 3600000，0 表示不轮换
  --chaff <ms>            掩护流量平均间隔，默认 6000，0 表示关闭
  --jitter <ms>           发送抖动上限，默认 80，0 表示关闭
  --announce <ms>         公告周期，默认 90000
  --lookup <ms>           发现周期，默认 45000
  --log <level>           silent|error|warn|info|debug，默认 info
  --debug-report <url>    上报到调试面板，如 https://xxx.workers.dev/r/demo
  --exec "<cmd;cmd>"      启动后自动执行若干命令（脚本化/测试用）
  --exit-after <ms>       运行指定毫秒后自动退出（会打印 BOOTSTRAPS）
  -h, --help              显示帮助

交互命令：
  /peers                  已连接节点
  /send <id|all> <text>   发送消息（id 支持前缀）
  /status                 本节点状态（NAT、DHT、主题、候选地址）
  /find                   立即再做一轮公告+发现
  /bootstraps             立即校验并打印当前可用 BOOTSTRAPS
  /sleep <ms>             等待（配合 --exec 做脚本化演示/测试）
  /stun                   重新做一次 STUN 映射探测
  /help                   帮助
  /quit                   退出（退出时打印可用 BOOTSTRAPS）
`

function parseArgs (argv) {
  const out = { extraBootstrap: [], peers: [], stun: null, noStun: false, noPublic: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    switch (a) {
      case '-h': case '--help': out.help = true; break
      case '--network': out.network = next(); break
      case '--secret': out.secret = next(); break
      case '--port': out.listenPort = Number(next()); break
      case '--data-dir': out.dataDir = path.resolve(next()); break
      case '--stun':
        out.stun = out.stun || []
        out.stun.push(next())
        break
      case '--no-stun': out.noStun = true; break
      case '--bootstrap': {
        const v = next() || ''
        const idx = v.lastIndexOf(':')
        if (idx > 0) out.extraBootstrap.push({ host: v.slice(0, idx), port: Number(v.slice(idx + 1)) })
        break
      }
      case '--no-public-bootstrap': out.noPublic = true; break
      case '--peer': {
        const v = next() || ''
        const idx = v.lastIndexOf(':')
        if (idx > 0) out.peers.push({ host: v.slice(0, idx), port: Number(v.slice(idx + 1)) })
        break
      }
      case '--epoch': out.epochMs = Number(next()); break
      case '--chaff': out.chaff = Number(next()); break
      case '--jitter': out.jitter = Number(next()); break
      case '--announce': out.announceInterval = Number(next()); break
      case '--lookup': out.lookupInterval = Number(next()); break
      case '--log': out.logLevel = next(); break
      case '--debug-report': out.debugReportUrl = next(); break
      case '--exec': out.exec = next(); break
      case '--exit-after': out.exitAfter = Number(next()); break
      default:
        if (a.startsWith('--')) process.stderr.write(`未知选项: ${a}\n`)
    }
  }
  return out
}

async function main () {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    process.stdout.write(HELP)
    return
  }

  const cfg = {
    network: args.network || 'p2pnet-demo',
    secret: args.secret || '',
    listenPort: args.listenPort === undefined ? 6881 : args.listenPort,
    dataDir: args.dataDir,
    logLevel: args.logLevel || 'info',
    debugReportUrl: args.debugReportUrl || '',
    extraBootstrap: args.extraBootstrap,
    peers: args.peers
  }
  if (args.epochMs !== undefined) cfg.epochMs = args.epochMs
  if (args.chaff !== undefined) cfg.chaff = args.chaff
  if (args.jitter !== undefined) cfg.jitter = args.jitter
  if (args.announceInterval !== undefined) cfg.announceInterval = args.announceInterval
  if (args.lookupInterval !== undefined) cfg.lookupInterval = args.lookupInterval
  if (args.noStun) cfg.stun = []
  else if (args.stun) cfg.stun = args.stun
  if (args.noPublic) cfg.bootstrap = []

  const node = new P2PNode(cfg)

  node.on('peer', (p) => {
    process.stdout.write(`\n[+] 节点接入 ${p.peerId} @ ${p.host}:${p.port}\n> `)
  })
  node.on('peer:close', (p) => {
    process.stdout.write(`\n[-] 节点断开 ${p.peerId || p.host + ':' + p.port}（${p.reason}）\n> `)
  })
  node.on('message', (m) => {
    const tag = m.peerId ? m.peerId.slice(0, 6) : '??????'
    process.stdout.write(`\n<${tag}> ${m.text}\n> `)
  })

  await node.start()

  process.stdout.write(
    `节点已启动\n  peerId : ${node.peerId}\n  网络   : ${cfg.network}\n` +
    `  UDP    : ${node.listenPort}\n  DHT    : 正在接入（内置 ${(args.noPublic ? [] : BOOTSTRAPS).length} 个公共引导节点）\n` +
    `  STUN   : ${args.noStun ? '已禁用' : (args.stun || STUN_SERVERS.map(s => s.url)).length + ' 个'}\n` +
    `\n输入 /help 查看命令。\n`
  )

  let closing = false
  const shutdown = async (code = 0) => {
    if (closing) return
    closing = true
    const report = await node.stop()
    printReport(report)
    process.exit(code)
  }

  process.on('SIGINT', () => { shutdown(0) })
  process.on('SIGTERM', () => { shutdown(0) })

  let rl = null
  const runCommand = async (line) => {
    const s = String(line || '').trim()
    if (!s) return
    if (!s.startsWith('/')) {
      return process.stdout.write('不是命令。发送消息请用 /send <id|all> <text>\n> ')
    }
    const [cmd, ...rest] = s.split(/\s+/)
    switch (cmd) {
      case '/help':
        process.stdout.write(HELP)
        break
      case '/peers': {
        const list = node.peers()
        if (!list.length) process.stdout.write('（暂无已连接节点，正在通过 DHT 发现…）\n')
        else {
          process.stdout.write('peerId        地址                  时长   收/发\n')
          for (const p of list) {
            process.stdout.write(
              `${p.peerId}  ${(p.host + ':' + p.port).padEnd(21)}  ${String(p.ageSec).padStart(4)}s  ${p.rxMsgs}/${p.txMsgs}\n`
            )
          }
        }
        break
      }
      case '/send': {
        const target = rest.shift()
        const text = rest.join(' ')
        if (!target || !text) {
          process.stdout.write('用法：/send <id|all> <text>\n')
          break
        }
        const n = node.send(target, text)
        process.stdout.write(n ? `已发送给 ${n} 个节点\n` : '没有匹配的节点\n')
        break
      }
      case '/status': {
        const st = node.status()
        process.stdout.write(JSON.stringify({
          peerId: st.peerId,
          listenPort: st.listenPort,
          publicEndpoint: st.nat && st.nat.publicIp ? `${st.nat.publicIp}:${st.nat.publicPort}` : null,
          nat: st.nat && st.nat.behavior,
          candidates: st.nat && st.nat.candidates,
          topic: st.topic.slice(0, 16) + '…',
          dhtNodes: st.dhtNodes,
          sessions: st.sessions,
          knownPeers: st.knownPeers.map(p => `${p.host}:${p.port}`),
          punching: st.punching,
          stats: st.stats
        }, null, 2) + '\n')
        break
      }
      case '/find': {
        process.stdout.write('正在公告并查找其他节点…\n')
        const n = await node.discoverNow()
        process.stdout.write(`当前已连接 ${n} 个节点\n`)
        break
      }
      case '/bootstraps': {
        process.stdout.write('正在校验可用地址（ping）…\n')
        const list = await node.collectBootstraps()
        process.stdout.write('const BOOTSTRAPS = ' + formatBootstrapArray(list) + '\n')
        break
      }
      case '/stun': {
        await node._stun()
        process.stdout.write(JSON.stringify(node.nat, null, 2) + '\n')
        break
      }
      case '/sleep': {
        const ms = Number(rest[0]) || 1000
        await new Promise(r => setTimeout(r, ms))
        break
      }
      case '/quit': case '/exit':
        return shutdown(0)
      default:
        process.stdout.write(`未知命令 ${cmd}，输入 /help\n`)
    }
    process.stdout.write('> ')
  }

  if (args.exec) {
    for (const cmd of args.exec.split(';').map(x => x.trim()).filter(Boolean)) {
      await runCommand(cmd)
      await new Promise(r => setTimeout(r, 300))
    }
  }

  if (args.exitAfter) {
    setTimeout(() => shutdown(0), args.exitAfter)
    // 仍需保持进程存活
    rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' })
    rl.prompt()
    rl.on('line', (line) => runCommand(line).catch(() => {}))
    return
  }

  if (!process.stdin.isTTY) {
    rl = readline.createInterface({ input: process.stdin })
    rl.on('line', (line) => { if (line.trim()) runCommand(line).catch(() => {}) })
    rl.on('close', () => shutdown(0))
    return
  }

  rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' })
  rl.prompt()
  rl.on('line', (line) => runCommand(line).catch((e) => {
    process.stdout.write('命令出错: ' + e.message + '\n> ')
  }))
  rl.on('close', () => shutdown(0))
}

main().catch((e) => {
  process.stderr.write('启动失败: ' + (e && e.stack || e) + '\n')
  process.exit(1)
})
