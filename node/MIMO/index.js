import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline'
import crypto from 'node:crypto'
import { BOOTSTRAP_NODES, STUN_SERVERS, STUN_REFRESH_JITTER, STUN_REFRESH_MIN } from './src/defaults.js'
import { DhtService } from './src/dht.js'
import { deriveRoomKeys } from './src/keys.js'
import { PeerManager } from './src/peer.js'
import { parseStunList, stunDiscover } from './src/stun.js'

const USAGE = `用法: node index.js --room <共享密钥> [选项]

选项:
  --room <密钥>          必需。房间共享密钥(用于发现彼此、加密名单与握手认证)
  --name <名字>          显示名(默认自动分配并持久化)
  --dht-port <端口>      DHT 监听端口(默认随机)
  --comm-port <端口>     通信(打洞)监听端口(默认随机)
  --bootstrap <列表/文件> DHT 引导节点, 逗号分隔 host:port, 或每行一个的文件路径
  --stun <列表>          STUN 服务器, 逗号分隔 stun:host:port
  --my-ip <地址>         手动指定公网地址(跳过 STUN)
  --state <文件>         状态文件路径(默认按 --name 自动区分: state-<名字>.json)
  --verbose              输出详细日志
  --help                 显示帮助

启动后直接输入文字即可向所有在线节点广播; 命令: /peers /info /quit
停止(Ctrl+C)时会打印当前可用的公网 ip:port, 可加入今后的 DHT BOOTSTRAPS
同机多开: 每个窗口必须使用不同的 --name(或 --state), 否则节点ID冲突无法互相发现
提示: Windows 下若中文乱码, 请先执行 chcp 65001 或使用 Windows Terminal`

function parseArgs (argv) {
  const args = {
    room: null,
    name: null,
    dhtPort: 0,
    commPort: 0,
    bootstrap: null,
    stun: null,
    myIp: null,
    state: null,
    verbose: false,
    help: false
  }
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    const next = () => argv[++i]
    switch (key) {
      case '--room': args.room = next(); break
      case '--name': args.name = next(); break
      case '--dht-port': args.dhtPort = Number(next()) || 0; break
      case '--comm-port': args.commPort = Number(next()) || 0; break
      case '--bootstrap': args.bootstrap = next(); break
      case '--stun': args.stun = next(); break
      case '--my-ip': args.myIp = next(); break
      case '--state': args.state = next(); break
      case '--verbose': args.verbose = true; break
      case '--help': case '-h': args.help = true; break
      default:
        if (key.startsWith('--')) throw new Error(`未知选项: ${key}`)
    }
  }
  return args
}

function loadBootstrap (value) {
  if (!value) return BOOTSTRAP_NODES
  if (fs.existsSync(value)) {
    const out = []
    for (const line of fs.readFileSync(value, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const m = /^([^:\s]+):(\d+)$/.exec(trimmed)
      if (m) out.push({ host: m[1], port: Number(m[2]) })
    }
    if (!out.length) throw new Error(`引导节点文件为空: ${value}`)
    return out
  }
  const out = []
  for (const item of value.split(',')) {
    const m = /^([^:\s]+):(\d+)$/.exec(item.trim())
    if (m) out.push({ host: m[1], port: Number(m[2]) })
  }
  if (!out.length) throw new Error('引导节点格式错误, 应为 host:host:port,...')
  return out
}

function loadStun (value) {
  if (!value) return STUN_SERVERS
  const list = parseStunList(value)
  if (!list.length) throw new Error('STUN 服务器格式错误, 应为 stun:host:port,...')
  return list
}

function loadState (file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

function saveState (file, state) {
  try {
    fs.writeFileSync(file, JSON.stringify(state, null, 2))
  } catch {}
}

function takeLock (stateFile) {
  const lockFile = stateFile + '.lock'
  try {
    const existing = JSON.parse(fs.readFileSync(lockFile, 'utf8'))
    if (existing.pid) {
      try {
        process.kill(existing.pid, 0)
        if (existing.pid !== process.pid) return { ok: false, pid: existing.pid, lockFile }
      } catch {}
    }
  } catch {}
  try {
    fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid, at: Date.now() }))
  } catch {}
  return { ok: true, lockFile }
}

function releaseLock (lockFile) {
  if (!lockFile) return
  try {
    const existing = JSON.parse(fs.readFileSync(lockFile, 'utf8'))
    if (existing.pid === process.pid) fs.rmSync(lockFile, { force: true })
  } catch {}
}

function lanAddresses () {
  const out = []
  const ifaces = os.networkInterfaces()
  for (const list of Object.values(ifaces)) {
    for (const item of list || []) {
      if (item.family === 'IPv4' && !item.internal) out.push(item.address)
    }
  }
  return out
}

function log (msg) {
  const t = new Date().toTimeString().slice(0, 8)
  console.log(`[${t}] ${msg}`)
}

async function main () {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(USAGE)
    return
  }
  if (!args.room) {
    console.log(USAGE)
    process.exitCode = 1
    return
  }

  const stateName = args.state || (args.name ? `state-${args.name.replace(/[\\/:*?"<>|]/g, '_')}.json` : 'state.json')
  const stateFile = path.resolve(stateName)
  const lock = takeLock(stateFile)
  if (!lock.ok) {
    console.log(`错误: 状态文件 ${path.basename(stateFile)} 已被本机进程 PID ${lock.pid} 占用。`)
    console.log('同一台机器启动多个节点时, 每个窗口必须使用不同的 --name 或 --state。')
    process.exit(1)
  }
  const lockFile = lock.lockFile
  const state = loadState(stateFile)
  const name = args.name || state.name || `node-${crypto.randomBytes(2).toString('hex')}`
  const nodeId = state.nodeId
    ? Buffer.from(state.nodeId, 'hex')
    : crypto.randomBytes(20)
  if (nodeId.length !== 20) throw new Error('state 文件中的 nodeId 无效')

  saveState(stateFile, { name, nodeId: nodeId.toString('hex') })

  const roomKeys = deriveRoomKeys(args.room)
  const roomFingerprint = crypto.createHash('sha1').update(roomKeys.publicKey).digest('hex').slice(0, 16)
  const bootstrap = loadBootstrap(args.bootstrap)
  const stunServers = loadStun(args.stun)

  let shuttingDown = false

  const peerManager = new PeerManager({
    roomKeys,
    nodeId,
    name,
    commPort: args.commPort,
    verbose: args.verbose,
    log
  })
  peerManager.on('error', (err) => {
    log(`[通信] 错误: ${err.message}`)
  })
  await peerManager.start()
  const commLocal = peerManager.localAddress()

  const dhtService = new DhtService({
    roomKeys,
    nodeId,
    bootstrap,
    dhtPort: args.dhtPort
  })

  dhtService.on('ready', ({ nodes, address }) => {
    log(`[DHT] 已就绪 引导节点=${bootstrap.length} 路由表=${nodes} 监听=${address?.address}:${address?.port}`)
  })
  dhtService.on('warning', (err) => {
    if (!args.verbose) return
    if (/not a number|Missing delimiter|Unexpected transaction id|Out of order response/.test(err.message)) return
    log(`[DHT] 警告: ${err.message}`)
  })
  dhtService.on('error', (err) => {
    log(`[DHT] 错误: ${err.message}`)
  })
  dhtService.on('cycle-error', (err) => {
    if (args.verbose) log(`[DHT] 周期失败: ${err.message}`)
  })
  dhtService.on('announced', ({ seq, hits, size, peers }) => {
    if (args.verbose) log(`[DHT] 已发布地址记录 seq=${seq} 响应节点=${hits} 大小=${size}B 名单内节点=${peers}`)
    else log(`[DHT] 已发布地址记录 响应节点=${hits} 名单内节点=${peers}`)
  })
  const knownPeers = new Set()
  dhtService.on('roster', (roster) => {
    peerManager.setRoster(roster)
    for (const [id, entry] of Object.entries(roster)) {
      if (id === nodeId.toString('hex') || knownPeers.has(id)) continue
      knownPeers.add(id)
      log(`[发现] 名单新节点 ${id.slice(0, 8)} 公网=${entry.ip}:${entry.port} 内网=${(entry.lan || []).join('|') || '-'} NAT=${natText(entry.nat)}`)
    }
  })

  peerManager.on('connect', ({ id, name: peerName, addr, via }) => {
    log(`[+] 已与节点 "${peerName}"(${id.slice(0, 8)}) 建立加密连接 (${addr.host}:${addr.port}, ${via})`)
  })
  peerManager.on('disconnect', ({ id, name: peerName, reason }) => {
    log(`[-] 节点 "${peerName}"(${id.slice(0, 8)}) 断开: ${reason}`)
  })
  peerManager.on('message', ({ name: peerName, text }) => {
    log(`<${peerName}> ${text}`)
  })

  await dhtService.start()

  let stunFailures = 0
  let lastStun = null

  const applyStun = async (label) => {
    if (args.myIp) {
      lastStun = { ip: args.myIp, port: commLocal.port, nat: 'manual' }
      peerManager.setPublicInfo(lastStun)
      dhtService.setSelfEntry({
        ip: args.myIp,
        port: commLocal.port,
        lport: commLocal.port,
        lan: lanAddresses(),
        nat: 'manual'
      })
      return lastStun
    }
    const res = await stunDiscover(peerManager.socket, stunServers)
    if (!res) {
      stunFailures++
      if (stunFailures === 3 && !dhtService.selfEntry) {
        const lan = lanAddresses()
        log(`[STUN] 连续 ${stunFailures} 次失败, 退化为仅发布内网地址(${lan.join(', ') || '无'})`)
        dhtService.setSelfEntry({
          ip: lan[0] || '127.0.0.1',
          port: commLocal.port,
          lport: commLocal.port,
          lan,
          nat: 'unknown'
        })
      }
      return null
    }
    stunFailures = 0
    const changed = !lastStun || lastStun.ip !== res.ip || lastStun.port !== res.port
    lastStun = res
    peerManager.setPublicInfo(res)
    dhtService.setSelfEntry({
      ip: res.ip,
      port: res.port,
      lport: commLocal.port,
      lan: lanAddresses(),
      nat: res.nat
    })
    if (changed) {
      log(`[STUN] ${label}公网地址: ${res.ip}:${res.port} (via ${res.server}) NAT类型: ${natText(res.nat)}`)
      if (res.nat === 'symmetric') {
        log('[STUN] 提示: 检测到对称型 NAT, 若对方也是对称型则无法直接连通')
      }
    }
    return res
  }

  await applyStun('通信')

  const stunLoop = () => {
    if (shuttingDown) return
    applyStun('通信').finally(() => {
      setTimeout(stunLoop, STUN_REFRESH_MIN + Math.floor(Math.random() * STUN_REFRESH_JITTER)).unref?.()
    })
  }
  setTimeout(stunLoop, STUN_REFRESH_MIN + Math.floor(Math.random() * STUN_REFRESH_JITTER)).unref?.()

  log(`节点 "${name}" 启动完成`)
  log(`  房间指纹: ${roomFingerprint} (相同 --room 的节点才能互相发现)`)
  log(`  节点ID: ${nodeId.toString('hex').slice(0, 16)}... (持久化于 ${path.basename(stateFile)})`)
  log(`  通信端口: ${commLocal.port}  DHT端口: ${dhtService.address()?.port}`)
  log(`  DHT引导节点: ${bootstrap.length} 个  STUN服务器: ${stunServers.length} 个`)
  log(`输入文字发送给所有在线节点; /peers 查看连接 /info 查看状态 /quit 退出`)

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false })
  rl.on('line', (line) => {
    const text = line.trim()
    if (!text) return
    if (text === '/quit' || text === '/exit') {
      shutdown(0)
      return
    }
    if (text === '/peers') {
      const list = peerManager.sessionsInfo()
      if (!list.length) log('[会话] 当前无在线节点')
      else for (const s of list) log(`[会话] ${s.name} (${s.id}) ${s.addr} rtt=${s.rtt ?? '?'}ms 存活=${s.uptime}s`)
      return
    }
    if (text === '/info') {
      printInfo()
      return
    }
    const sent = peerManager.sendAll(text)
    if (!sent.length) log('(当前无在线节点, 消息未送达)')
    else log(`[我 -> ${sent.join(', ')}] ${text}`)
  })
  rl.on('SIGINT', () => shutdown(0))
  process.on('SIGINT', () => shutdown(0))
  process.on('SIGTERM', () => shutdown(0))

  const printInfo = () => {
    const comm = peerManager.localAddress()
    log(`[信息] 名称=${name} 房间指纹=${roomFingerprint}`)
    log(`[信息] 通信端口(本地)=${comm?.port} 公网=${lastStun ? `${lastStun.ip}:${lastStun.port}` : '未知'} NAT=${lastStun ? natText(lastStun.nat) : '未知'}`)
    log(`[信息] DHT端口=${dhtService.address()?.port} DHT路由表=${dhtService.nodeCount()} seq=${dhtService.seq}`)
    const roster = dhtService.roster || {}
    for (const [id, e] of Object.entries(roster)) {
      if (id === nodeId.toString('hex')) continue
      log(`[信息] 名单节点 ${id.slice(0, 8)} ${e.ip}:${e.port} lan=${(e.lan || []).join('|') || '-'} NAT=${e.nat || '?'} 更新于${Math.round((Date.now() - e.ts) / 1000)}秒前`)
    }
  }

  const shutdown = async (code) => {
    if (shuttingDown) return
    shuttingDown = true
    try { rl.close() } catch {}

    log('正在停止, 获取最终地址信息...')
    const [dhtStun, commStun] = await Promise.all([
      dhtService.socket ? stunDiscover(dhtService.socket, stunServers, { probes: 3 }) : Promise.resolve(null),
      peerManager.socket ? stunDiscover(peerManager.socket, stunServers, { probes: 3 }) : Promise.resolve(null)
    ])

    console.log('')
    console.log('==================== 停止运行 ====================')
    console.log('当前可用地址(可加入今后的 DHT BOOTSTRAPS 列表):')
    if (dhtStun) {
      console.log(`  { host: '${dhtStun.ip}', port: ${dhtStun.port} },`)
      console.log(`  (本地监听端口=${dhtService.address()?.port} NAT类型=${natText(dhtStun.nat)})`)
    } else {
      const addr = dhtService.address()
      console.log(`  { host: '${addr?.address}', port: ${addr?.port} },   (STUN查询失败, 打印本地监听地址)`)
    }
    console.log('通信(打洞)端点:')
    if (commStun) console.log(`  公网: ${commStun.ip}:${commStun.port} (NAT=${natText(commStun.nat)})`)
    else {
      const addr = peerManager.localAddress()
      console.log(`  本地: ${addr?.address}:${addr?.port} (STUN查询失败)`)
    }
    console.log(`节点ID(已持久化, 下次沿用): ${nodeId.toString('hex')}`)
    console.log('==================================================')

    await peerManager.close()
    await dhtService.stop()
    releaseLock(lockFile)
    process.exit(code)
  }

  process.exitCode = 0
}

function natText (nat) {
  if (nat === 'cone') return '锥型(可打洞)'
  if (nat === 'symmetric') return '对称型(打洞困难)'
  if (nat === 'manual') return '手动指定'
  return '未知'
}

main().catch((err) => {
  console.error('启动失败:', err.message)
  process.exit(1)
})
