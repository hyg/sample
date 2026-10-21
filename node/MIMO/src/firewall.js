import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'

const RULE_NAME = 'p2p-node-udp'

function run (cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: 30000 }, (err, stdout) => {
      resolve({ ok: !err, out: (stdout || '').toString() })
    })
  })
}

async function ruleExists () {
  const ps = "if (Get-NetFirewallRule -DisplayName 'p2p-node-udp' -ErrorAction SilentlyContinue) { 'YES' } else { 'NO' }"
  const { out } = await run('powershell.exe', ['-NoProfile', '-Command', ps])
  return out.includes('YES')
}

async function elevate (exe) {
  const inner = `netsh advfirewall firewall delete rule name=all program="${exe}" & netsh advfirewall firewall add rule name=${RULE_NAME} dir=in action=allow protocol=UDP program="${exe}"`
  const ps = `Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c','${inner.replace(/'/g, "''")}') -Verb RunAs -Wait -WindowStyle Hidden`
  const { ok } = await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps])
  return ok
}

export async function ensureFirewall ({ log, optoutFile, exe = process.execPath }) {
  if (process.platform === 'linux') return checkLinux(log)
  if (process.platform !== 'win32') return
  try {
    if (await ruleExists()) return
  } catch {
    return
  }
  if (fs.existsSync(optoutFile)) {
    log('[防火墙] 未放行入站 — 若无法被对方连接, 请删除 state-firewall-optout 文件后重启, 或右键"以管理员身份运行"一次')
    return
  }
  log('[防火墙] 首次运行需要系统授权: 即将弹出授权窗口, 请点"是"允许 (仅此一次)')
  try {
    await elevate(exe)
  } catch {}
  try {
    if (await ruleExists()) {
      log('[防火墙] 已自动完成放行')
      try { fs.rmSync(optoutFile, { force: true }) } catch {}
      return
    }
  } catch {}
  try { fs.writeFileSync(optoutFile, 'declined ' + new Date().toISOString()) } catch {}
  log('[防火墙] 未授权放行 — 程序继续运行; 若对方连不上本机, 请右键"以管理员身份运行"本程序一次')
}

async function checkLinux (log) {
  try {
    const ufw = await run('ufw', ['status'])
    if (ufw.ok && /Status:\s*active/i.test(ufw.out)) {
      log('[防火墙] 检测到 ufw 已启用 — 若无法被对方连接, 请放行 UDP 通信端口 (云服务器还需在控制台安全组放行)')
      return
    }
  } catch {}
  try {
    const fw = await run('firewall-cmd', ['--state'])
    if (fw.ok && /running/i.test(fw.out)) {
      log('[防火墙] 检测到 firewalld 已启用 — 若无法被对方连接, 请放行 UDP 通信端口 (云服务器还需在控制台安全组放行)')
    }
  } catch {}
}
