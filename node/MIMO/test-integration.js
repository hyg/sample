import { spawn } from 'node:child_process'

const kids = []

function start (name, dhtPort, commPort) {
  const child = spawn(process.execPath, [
    'index.js', '--room', 'PSMD-verify-9527', '--name', name,
    '--dht-port', String(dhtPort), '--comm-port', String(commPort)
  ], { stdio: ['pipe', 'pipe', 'pipe'] })
  const out = { name, buf: '', child, connected: false, gotMsg: null, nodeId: null, exit: undefined }
  child.stdout.on('data', (d) => {
    const s = d.toString()
    out.buf += s
    process.stdout.write(`[${name}] ${s}`)
    const id = s.match(/节点ID: ([0-9a-f]{16})/)
    if (id) out.nodeId = id[1]
    if (s.includes('已与节点')) out.connected = true
    const m = s.match(/<(\S+?)> (.*)/)
    if (m) out.gotMsg = m[0]
  })
  child.stderr.on('data', (d) => process.stdout.write(`[${name}!] ${d}`))
  child.on('exit', (code) => { out.exit = code })
  kids.push(out)
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const waitFor = async (fn, timeoutMs, label) => {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    if (fn()) return true
    await sleep(1000)
  }
  console.log(`TIMEOUT: ${label}`)
  return false
}

const A = start('部署者', 17891, 17892)
const B = start('建模者', 17881, 17882)

await sleep(1500)
console.log('=== 节点ID检查 ===')
console.log('部署者 nodeId:', A.nodeId)
console.log('建模者 nodeId:', B.nodeId)
console.log('ID不同:', A.nodeId && B.nodeId && A.nodeId !== B.nodeId)

const both = await waitFor(() => A.connected && B.connected, 120000, '双方建立连接')
console.log('=== 连接建立:', both, '===')

if (both) {
  A.child.stdin.write('你好,我是部署者\n')
  await sleep(2000)
  B.child.stdin.write('收到,我是建模者\n')
  await waitFor(() => A.gotMsg && B.gotMsg, 15000, '消息互达')
}

A.child.stdin.write('/quit\n')
B.child.stdin.write('/quit\n')
await waitFor(() => kids.every((k) => k.exit !== undefined), 15000, '进程退出')
for (const k of kids) if (k.exit === undefined) k.child.kill()

const ok = both && A.gotMsg && B.gotMsg && A.nodeId !== B.nodeId
console.log('=== 测试结果:', ok ? 'PASS' : 'FAIL', '===')
process.exit(ok ? 0 : 1)
