#!/usr/bin/env node

/**
 * E2EE CLI v2 - 基于 Transport + Protocol 架构
 * 
 * 架构说明：
 * - Transport: 抽象传输层 (MQTT, PeerJS, GUN...)
 * - Protocol: E2EE 协议处理 (握手、加密解密)
 * - Session: 密钥管理和会话状态
 * 
 * 使用方法:
 *   node src/cli.js [options]
 * 
 * 选项:
 *   --transport, -t  传输协议: mqtt|peer|gun (默认: mqtt)
 *   --topic      主题/房间 (默认: psmd/e2ee/chat)
 *   --broker     MQTT broker URL
 *   --peers      GUN peers URL
 */

import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';
import { didManager } from './did/manager.js';
import { sessionManager } from './e2ee/session.js';
import { E2EEProtocol } from './e2ee/protocol.js';
import { MQTTTransport } from './transport/mqtt-transport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    transport: 'mqtt',
    topic: 'psmd/e2ee/chat',
    broker: 'mqtt://broker.emqx.io:1883',
    peers: 'https://gun-manhattan.herokuapp.com/gun',
    peerId: null,
    connectUrl: null  // Peer 连接地址
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--transport':
      case '-t':
        options.transport = args[++i] || 'mqtt';
        break;
      case '--topic':
        options.topic = args[++i] || options.topic;
        break;
      case '--broker':
        options.broker = args[++i] || options.broker;
        break;
      case '--peers':
        options.peers = args[++i] || options.peers;
        break;
      case '--peer-id':
        options.peerId = args[++i] || null;
        break;
      case '--connect':
        options.connectUrl = args[++i] || null;
        break;
      case '--ws-port':
        options.wsPort = parseInt(args[++i]) || 8081;
        break;
      case '--help':
      case '-h':
        showUsage();
        process.exit(0);
    }
  }

  return options;
}

function showUsage() {
  console.log(`
E2EE Chat CLI - 端到端加密聊天

用法: node src/cli.js [options]

选项:
  -t, --transport <type>  传输协议: mqtt|peer|gun (默认: mqtt)
  --topic <name>          主题/房间名称 (默认: psmd/e2ee/chat)
  --broker <url>          MQTT broker URL (默认: mqtt://broker.emqx.io:1883)
  --peers <url>           GUN peers URL (默认: https://gun-manhattan.herokuapp.com/gun)
  --peer-id <id>          PeerJS ID (默认: 自动生成)
  --connect <url>         连接到其他 Peer CLI (ws://host:port)
  --ws-port <port>        WebSocket 服务器端口 (默认: 8081)
  -h, --help              显示帮助

示例:
  node src/cli.js                           # 使用 MQTT
  node src/cli.js -t peer                   # 启动 Peer 服务器
  node src/cli.js -t gun                    # 使用 GUN
  node src/cli.js --topic my-room           # 指定主题
  node src/cli.js -t peer --peer-id myid    # PeerJS 指定 ID
  `);
}

const CLI_OPTIONS = parseArgs();

const CONFIG = {
  brokerUrl: CLI_OPTIONS.broker,
  topic: CLI_OPTIONS.topic,
  peers: CLI_OPTIONS.peers,
  peerId: CLI_OPTIONS.peerId,
  transportType: CLI_OPTIONS.transport,
  dataDir: join(__dirname, '..', '.data')
};

if (!existsSync(CONFIG.dataDir)) {
  mkdirSync(CONFIG.dataDir, { recursive: true });
}

const state = {
  myDid: null,
  myIdentity: null,
  transport: null,
  protocol: null,
  sessions: new Map(),
  currentSessionId: null,
  partnerDid: null,
  partnerPublicKey: null,
  sessionIndex: 0,
  transportType: CONFIG.transportType
};

// 传输层工厂 - 统一接口
async function createTransport(type, options = {}) {
  const transportConfig = {
    roomId: options.roomId || CONFIG.topic,
    peerId: state.myDid || options.peerId,
    serverUrl: options.serverUrl
  };

  switch (type.toLowerCase()) {
    case 'mqtt': {
      const { MQTTTransport } = await import('./transport/mqtt-transport.js');
      return new MQTTTransport({
        ...transportConfig,
        serverUrl: options.broker || CONFIG.brokerUrl
      });
    }

    case 'peer':
    case 'peerjs': {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const { PeerTransport } = require('./transport/peer-transport.cjs');
      return new PeerTransport({
        peerId: transportConfig.peerId,
        connectTarget: options.connectUrl || CONFIG.connectUrl
      });
    }

    case 'gun': {
      const { GunTransport } = await import('./transport/gun-transport.js');
      return new GunTransport({
        ...transportConfig,
        serverUrl: options.peers || CONFIG.peers
      });
    }

    default:
      throw new Error(`未知传输协议: ${type}. 支持: mqtt, peer, gun`);
  }
}

function getTransportName(type) {
  const names = {
    mqtt: 'MQTT',
    peer: 'PeerJS',
    peerjs: 'PeerJS',
    gun: 'GUN'
  };
  return names[type.toLowerCase()] || type;
}

function showWelcome() {
  console.log(`
╔════════════════════════════════════════════════════════╗
║       E2EE Chat - 端到端加密聊天                      ║
╠════════════════════════════════════════════════════════╣
║  传输协议: ${getTransportName(state.transportType).padEnd(42)}║
║  主题/房间: ${CONFIG.topic.padEnd(41)}║
║  支持的 DID: did:key, did:ethr, did:wba              ║
╚════════════════════════════════════════════════════════╝
  `);
}

function showHelp() {
  console.log(`
命令:
  /help                     - 显示帮助
  /create <type>            - 创建身份 (x25519, p256, ethr, wba)
  /import <file>            - 导入身份
  /connect <did>            - 连接伙伴 (DID)
  /peer <peer-id>           - 连接 PeerJS peer
  /pubkey <hex>             - 设置伙伴公钥
  /init                     - 发起 E2EE 会话
  /sessions                 - 列出所有会话
  /switch <id>              - 切换到指定会话
  /send <msg>               - 发送消息
  /transport [type]         - 切换传输协议 (mqtt|peer|gun)
  /quit                     - 退出

快捷键:
  Tab                       - 切换会话 (Cycle through sessions)
  Ctrl+C / Ctrl+D           - 退出

传输协议:
  mqtt                      - MQTT Broker (默认)
  peer                      - PeerJS (WebRTC/WS) https://peerjs.com
  gun                       - GUN 去中心化网络

PeerJS 使用方法:
  1. 两方都运行: node src/cli.js -t peer
  2. 各自记下显示的 PeerJS ID
  3. 一方执行: /peer <对方的ID>
  4. 连接成功后即可发送消息
`);
}

function createIdentity(method) {
  try {
    let didMethod = 'key';
    let domain = null;
    let keyType = 'x25519';

    const parts = method.toLowerCase().split(' ');

    if (parts.length === 1) {
      const first = parts[0];
      if (['x25519', 'p256'].includes(first)) {
        didMethod = 'key';
        keyType = first;
      } else if (['ethr', 'wba'].includes(first)) {
        didMethod = first;
      }
    } else if (parts.length >= 2) {
      didMethod = parts[0];
      if (didMethod === 'wba') {
        domain = parts[1];
        if (parts.length >= 3) {
          keyType = parts[2];
        }
      } else if (didMethod === 'ethr') {
        if (['x25519', 'p256'].includes(parts[1])) {
          keyType = parts[1];
        }
      }
    }

    if (didMethod === 'wba' && !domain) {
      console.log('[错误] did:wba 需要域名');
      return null;
    }

    let identity;
    if (didMethod === 'wba') {
      identity = didManager.generate(didMethod, { domain, keyType });
    } else {
      identity = didManager.generate(didMethod, { keyType });
    }

    state.myDid = identity.did;
    state.myIdentity = identity;

    if (state.protocol) {
      state.protocol.setIdentity(identity.did, identity);
    }
    
    if (state.transport) {
      state.transport.setIdentity(identity.did);
    }

    console.log(`\n✓ 身份创建成功!`);
    console.log(`  DID: ${identity.did}`);
    console.log(`  密钥类型：${identity.keyType}`);

    const exportData = didManager.export(identity.did);
    const safeDid = identity.did.replace(/:/g, '_');
    const savePath = join(CONFIG.dataDir, `identity-${safeDid.substring(0, 20)}.json`);
    writeFileSync(savePath, JSON.stringify(exportData, null, 2));
    console.log(`\n  已保存到：${savePath}`);

    return identity;
  } catch (err) {
    console.error(`[错误] ${err.message}`);
    return null;
  }
}

function importIdentity(filePath) {
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    const identity = didManager.import(data.method, Buffer.from(data.privateKey, 'hex'), {
      keyType: data.keyType,
      did: data.did
    });

    state.myDid = identity.did;
    state.myIdentity = identity;

    if (state.protocol) {
      state.protocol.setIdentity(identity.did, identity);
    }
    
    if (state.transport) {
      state.transport.setIdentity(identity.did);
    }

    console.log(`\n✓ 身份导入成功!`);
    console.log(`  DID: ${identity.did}`);
    console.log(`  密钥类型：${identity.keyType}`);

    return identity;
  } catch (err) {
    console.error(`[错误] ${err.message}`);
    return null;
  }
}

function setPartnerPublicKey(publicKeyHex) {
  try {
    let publicKey = Buffer.from(publicKeyHex, 'hex');
    if (publicKey.length === 33 && (publicKey[0] === 0x02 || publicKey[0] === 0x03)) {
      publicKey = publicKey.slice(1);
    }
    if (publicKey.length !== 32) {
      throw new Error(`公钥长度应为 32 字节，当前: ${publicKey.length}`);
    }
    state.partnerPublicKey = publicKey;
    console.log(`\n[连接] 伙伴公钥已设置 (${publicKey.length} 字节)`);
    return true;
  } catch (err) {
    console.error(`[错误] ${err.message}`);
    return false;
  }
}

async function verifyPartnerDid(partnerDid) {
  console.log(`[DEBUG verifyPartnerDid] 检查: ${partnerDid}`);
  
  if (!partnerDid.startsWith('did:wba:')) {
    console.log(`[DEBUG verifyPartnerDid] 非 wba DID，直接通过`);
    return true;
  }

  const didParts = partnerDid.split(':');
  const methodSpecificId = didParts.slice(2).join(':');
  const firstPart = methodSpecificId.split(':')[0];
  
  let domain = firstPart;
  const pathParts = methodSpecificId.split(':').slice(1);
  const path = pathParts.length > 0 ? pathParts.join('/') : null;
  
  let didJsonUrl = `https://${domain}`;
  if (path) didJsonUrl += `/${path}`;
  else didJsonUrl += '/.well-known';
  didJsonUrl += '/did.json';
  
  console.log(`[DEBUG verifyPartnerDid] 尝试访问: ${didJsonUrl}`);
  
  try {
    const response = await fetch(didJsonUrl);
    console.log(`[DEBUG verifyPartnerDid] HTTP 状态: ${response.status}`);
    if (!response.ok) {
      console.log(`[验证] ❌ 无法访问 ${didJsonUrl}`);
      return false;
    }
    const didJson = await response.json();
    if (didJson.id !== partnerDid) {
      console.log(`[验证] ❌ DID 文档 ID 不匹配`);
      return false;
    }
    console.log(`[验证] ✅ ${didJsonUrl}`);
    return true;
  } catch (err) {
    console.log(`[验证] ❌ ${err.message}`);
    return false;
  }
}

async function initSession() {
  if (!state.partnerDid || !state.partnerPublicKey) {
    console.log('[错误] 请先 /connect 和 /pubkey');
    return;
  }

  if (!state.protocol) {
    console.log('[错误] 协议未初始化');
    return;
  }

  console.log(`\n[E2EE] 初始化会话到 ${state.partnerDid}...`);

  console.log(`[DEBUG initSession] state.myDid = ${state.myDid}`);

  // 验证自己的 DID（如果自己是 did:wba）
  if (state.myDid && state.myDid.startsWith('did:wba:')) {
    console.log(`[DEBUG initSession] 验证自己的 DID: ${state.myDid}`);
    const myVerified = await verifyPartnerDid(state.myDid);
    console.log(`[DEBUG initSession] 验证结果: ${myVerified}`);
    if (!myVerified) {
      console.log('[错误] 您的 did:wba 身份未部署或无效');
      return;
    }
  } else {
    console.log(`[DEBUG initSession] 不需要验证自己的 DID`);
  }

  // 验证对方的 DID
  const verified = await verifyPartnerDid(state.partnerDid);
  if (!verified) {
    console.log('[错误] 对方 DID 验证失败');
    return;
  }

  try {
    const { session, sessionId } = await state.protocol.sendInit(
      state.partnerDid,
      state.partnerPublicKey,
      'x25519'
    );

    state.sessions.set(sessionId, {
      session,
      partnerDid: state.partnerDid,
      topic: CONFIG.topic,
      isPrivate: false
    });
    state.currentSessionId = sessionId;

    console.log(`[E2EE] ✓ 会话已发起: ${sessionId.substring(0, 16)}...`);
    console.log(`[DEBUG] session.isActive: ${session.isActive}`);
  } catch (err) {
    console.error(`[错误] ${err.message}`);
  }
}

async function sendMessage(message) {
  const sessionInfo = state.sessions.get(state.currentSessionId);
  
  if (sessionInfo?.isPublic || !state.currentSessionId || state.currentSessionId === '__public__') {
    await state.transport.broadcast({
      type: 'text',
      content: { text: message, sender_did: state.myDid }
    });
    console.log(`\n📝 [明文] ${message}`);
    return;
  }

  try {
    await state.protocol.sendMessage(state.currentSessionId, message);
    console.log(`\n🔐 [加密] ${message}`);
  } catch (err) {
    console.error(`[错误] ${err.message}`);
  }
}

function listSessions() {
  console.log('\n[会话列表]');
  let idx = 0;
  for (const [id, info] of state.sessions) {
    const marker = id === state.currentSessionId ? '>' : ' ';
    let status = info.isPublic ? '📢' : (info.session?.isActive ? '✓' : '✗');
    let name = info.isPublic ? '公共 (明文)' : (id.substring(0, 16) + '...');
    let target = info.isPublic ? '所有人' : info.partnerDid;
    let seq = info.session ? ` (seq: ${info.session.sendSeq}/${info.session.recvSeq})` : '';
    console.log(`  ${marker} [${status}] #${idx} ${name}${seq}`);
    console.log(`       -> ${target}`);
    idx++;
  }
}

function cycleSession() {
  const ids = Array.from(state.sessions.keys());
  if (ids.length <= 1) return;
  
  const currentIdx = ids.indexOf(state.currentSessionId);
  const nextIdx = (currentIdx + 1) % ids.length;
  const nextId = ids[nextIdx];
  
  const info = state.sessions.get(nextId);
  state.currentSessionId = nextId;
  
  if (info.isPublic) {
    console.log(`\n切换到: 📢 公共会话 (明文)`);
  } else {
    console.log(`\n切换到: 🔐 ${nextId.substring(0, 16)}... -> ${info.partnerDid}`);
  }
}

function switchSession(sessionId) {
  if (state.sessions.has(sessionId)) {
    state.currentSessionId = sessionId;
    const info = state.sessions.get(sessionId);
    console.log(`\n切换到会话: ${sessionId.substring(0, 16)}...`);
    console.log(`伙伴: ${info.partnerDid}`);
    console.log(`状态: ${info.session?.isActive ? '活跃' : '非活跃'}`);
  } else {
    console.log('[错误] 会话不存在');
  }
}

async function switchTransport(newType) {
  const validTypes = ['mqtt', 'peer', 'gun'];
  if (!validTypes.includes(newType.toLowerCase())) {
    console.log(`[错误] 未知传输协议: ${newType}. 支持: ${validTypes.join(', ')}`);
    return false;
  }

  console.log(`\n[传输] 切换到 ${getTransportName(newType)}...`);

  try {
    // 关闭旧传输
    if (state.transport) {
      state.transport.close();
    }

    // 创建新传输
    state.transport = await createTransport(newType);

    // 重新设置身份
    if (state.myDid) {
      state.transport.setIdentity(state.myDid);
    }

    // 重新设置消息处理
    state.transport.on('message', async (data) => {
      await handleIncomingMessage(data);
    });

    // 连接
    await state.transport.connect();
    state.transportType = newType;
    CONFIG.transportType = newType;

    console.log(`[传输] ✓ 已切换到 ${getTransportName(newType)}`);
    return true;
  } catch (err) {
    console.error(`[错误] 切换传输失败: ${err.message}`);
    return false;
  }
}

async function handleIncomingMessage(data) {
  const { type, content, sender_did } = data;

  if (sender_did && sender_did === state.myDid) {
    return;
  }

  const result = await state.protocol.processIncomingMessage({ type, content, sender_did });

  if (!result) {
    if (type === 'text' && content?.text) {
      console.log(`\n[📢 公共] ${sender_did ? sender_did.substring(0, 16) : 'unknown'}: ${content.text}`);
      process.stdout.write('\n> ');
    }
    return;
  }

  if (result.event === 'session_created') {
    const sessionId = result.session?.sessionId || result.session_id;
    state.sessions.set(sessionId, {
      session: result.session,
      partnerDid: sender_did,
      topic: CONFIG.topic,
      isPrivate: false
    });
    state.currentSessionId = sessionId;
    console.log(`\n[E2EE] 会话已建立: ${sessionId.substring(0, 16)}...`);
    console.log(`[E2EE] 对方: ${sender_did}`);
    process.stdout.write('\n> ');
  } else if (result.event === 'message') {
    console.log(`\n[🔐 加密] 收到: ${result.plaintext}`);
    console.log(`    序列号: ${result.seq}`);
    process.stdout.write('\n> ');
  } else if (result.event === 'text') {
    console.log(`\n[📢 公共] ${sender_did ? sender_did.substring(0, 16) : 'unknown'}: ${result.text}`);
    process.stdout.write('\n> ');
  }
}

async function startCLI() {
  showWelcome();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  let inputBuffer = '';
  let tabPressed = false;

  // 使用传输工厂创建传输层
  state.transport = await createTransport(state.transportType);

  state.protocol = new E2EEProtocol({
    sessionManager,
    onSend: async (msg) => {
      await state.transport.send(msg);
    }
  });

  state.sessions.set('__public__', {
    session: null,
    partnerDid: 'all',
    topic: CONFIG.topic,
    isPrivate: false,
    isPublic: true
  });
  state.currentSessionId = '__public__';

  // 使用统一的消息处理函数
  state.transport.on('message', async (data) => {
    await handleIncomingMessage(data);
  });

  process.stdin.on('keypress', (str, key) => {
    if (key.name === 'tab') {
      cycleSession();
      process.stdout.write('\n> ');
    } else if (key.ctrl && key.name === 'c') {
      console.log('\n[系统] 再见!');
      state.transport.close();
      rl.close();
      process.exit(0);
    } else if (key.ctrl && key.name === 'd') {
      console.log('\n[系统] 再见!');
      state.transport.close();
      rl.close();
      process.exit(0);
    }
  });

  try {
    await state.transport.connect();
    console.log(`\n[系统] 已连接到 ${getTransportName(state.transportType)}`);
  } catch (err) {
    console.error(`[错误] ${err.message}`);
  }

  showHelp();

  rl.on('line', async (line) => {
    const input = line.trim();
    
    if (!input) {
      process.stdout.write('> ');
      return;
    }

    if (input.startsWith('/')) {
      const parts = input.split(' ');
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      switch (cmd) {
        case '/help':
          showHelp();
          break;
        case '/create':
          if (args[0]) {
            createIdentity(args.join(' '));
          } else {
            console.log('用法: /create <type>');
          }
          break;
        case '/import':
          if (args[0]) {
            importIdentity(args[0]);
          }
          break;
        case '/connect':
          if (args[0]) {
            state.partnerDid = args[0];
            console.log(`\n[连接] 准备连接到: ${state.partnerDid}`);
          }
          break;
        case '/peer':
          if (args[0]) {
            console.log(`\n[PeerJS] 连接到 peer: ${args[0]}`);
            try {
              if (state.transport && state.transport.connectToPeer) {
                await state.transport.connectToPeer(args[0]);
                console.log(`[PeerJS] ✓ 已发起连接`);
              } else {
                console.log('[错误] 当前传输层不支持 peer 连接');
              }
            } catch (err) {
              console.error(`[PeerJS] 连接失败: ${err.message}`);
            }
          } else {
            // 显示当前 PeerJS ID
            if (state.transport && state.transport.peerId) {
              console.log(`\n[PeerJS] 我的 ID: ${state.transport.peerId}`);
              console.log(`[PeerJS] 将此 ID 告诉对方，让对方执行: /peer ${state.transport.peerId}`);
            } else {
              console.log('用法: /peer <peer-id>');
            }
          }
          break;
        case '/pubkey':
          if (args[0]) {
            setPartnerPublicKey(args[0]);
          }
          break;
        case '/init':
          await initSession();
          break;
        case '/sessions':
          listSessions();
          break;
        case '/switch':
          if (args[0]) {
            switchSession(args[0]);
          }
          break;
        case '/send':
          if (args.length > 0) {
            await sendMessage(args.join(' '));
          }
          break;
        case '/transport':
          if (args[0]) {
            await switchTransport(args[0].toLowerCase());
          } else {
            console.log(`当前传输: ${getTransportName(state.transportType)}`);
            console.log(`可用: mqtt, peer, gun`);
            console.log(`用法: /transport <type>`);
          }
          break;
        case '/quit':
        case '/exit':
          console.log('\n[系统] 再见!');
          state.transport.close();
          rl.close();
          process.exit(0);
          break;
        default:
          console.log(`[错误] 未知命令: ${cmd}`);
      }
    } else {
      await sendMessage(input);
    }

    process.stdout.write('> ');
  });

  process.stdout.write('> ');
}

startCLI().catch(err => {
  console.error('[致命错误]', err);
  process.exit(1);
});
