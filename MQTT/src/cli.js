#!/usr/bin/env node

/**
 * E2EE MQTT CLI 聊天工具
 * 
 * 支持角色:
 * - trustee: 受托者，等待连接
 * - delegator: 委托者，主动连接
 * 
 * 支持的 DID 方法：did:key, did:ethr
 */

import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { didManager } from './did/manager.js';
import { sessionManager } from './e2ee/session.js';
import { MQTTE2EEClient } from './core/mqtt-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 配置
const CONFIG = {
  brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883',
  topic: process.env.MQTT_TOPIC || 'psmd/e2ee/chat',
  dataDir: join(__dirname, '..', '.data')
};

// 确保数据目录存在
if (!existsSync(CONFIG.dataDir)) {
  mkdirSync(CONFIG.dataDir, { recursive: true });
}

// CLI 状态
const state = {
  role: null,
  myDid: null,
  myIdentity: null,
  client: null,
  currentSession: null,
  partnerDid: null,
  partnerPublicKey: null
};

/**
 * 显示欢迎信息
 */
function showWelcome() {
  console.log(`
╔════════════════════════════════════════════════════════╗
║       E2EE MQTT Chat - 端到端加密聊天工具              ║
╠════════════════════════════════════════════════════════╣
║  支持的 DID 方法：did:key, did:ethr                     ║
║  加密套件：HPKE (RFC 9180)                              ║
║  MQTT Broker: ${CONFIG.brokerUrl.padEnd(30)}║
╚════════════════════════════════════════════════════════╝
  `);
}

/**
 * 显示帮助
 */
function showHelp() {
  console.log(`
========================================
 MQTT E2EE Chat - 命令帮助
========================================

基本命令:
  /help                     - 显示此帮助信息
  /show                     - 显示当前身份信息
  /export                   - 导出身份到文件
  /import <file>            - 从文件导入身份
  /connect <partner-did>    - 连接到伙伴
  /pubkey <hex>             - 设置伙伴公钥 (X25519 格式)
  /init                     - 初始化 E2EE 会话
  /send <message>           - 发送消息 (明文或加密)
  /session                  - 显示会话状态
  /quit                     - 退出程序

========================================
 身份创建命令 (/create)
========================================

基本格式: /create <类型> [密钥类型]

支持的 DID 方法:
  /create x25519            - 创建 did:key 身份 (X25519 密钥)
  /create p256              - 创建 did:key 身份 (P-256 密钥)
  /create ethr              - 创建 did:ethr 身份 (X25519 密钥)
  /create wba               - 创建 did:wba 身份 (X25519 密钥)

指定密钥类型:
  /create ethr x25519       - 创建 did:ethr 身份 (X25519 密钥)
  /create wba p256          - 创建 did:wba 身份 (P-256 密钥)

========================================
 使用示例
========================================

1. 创建身份:
   /create x25519           # 创建 X25519 密钥的 did:key 身份
   /create ethr             # 创建以太坊 DID 身份
   /create wba              # 创建 WBA 跨链 DID 身份

2. 连接到伙伴:
   /connect did:key:z6Mk... # 连接到 did:key 伙伴
   /pubkey 03c8ef41...      # 设置伙伴公钥 (32字节X25519或33字节P-256)

3. 初始化会话并发送消息:
   /init                    # 初始化 E2EE 会话
   /send Hello!             # 发送加密消息

========================================
 注意事项
========================================

• 公钥格式: 支持 32 字节 X25519 公钥或 33 字节 P-256 压缩公钥
• DID 方法: did:key, did:ethr, did:wba 均支持跨方法通信
• 加密模式: 默认使用 HPKE Base 模式加密
  `);
}

/**
 * 创建新身份
 */
function createIdentity(method) {
  try {
    // 解析 DID 方法、域名和密钥类型
    let didMethod = 'key';
    let domain = null;  // did:wba 需要域名
    let keyType = 'x25519';

    // 支持的格式:
    // /create x25519                    - did:key
    // /create ethr                      - did:ethr (主网)
    // /create wba example.com           - did:wba:example.com
    // /create wba example.com p256      - did:wba:example.com (P-256 密钥)
    const parts = method.toLowerCase().split(' ');

    if (parts.length === 1) {
      // 简单格式：/create x25519 或 /create ethr 或 /create wba
      const first = parts[0];
      if (['x25519', 'p256'].includes(first)) {
        didMethod = 'key';
        keyType = first;
      } else if (['ethr', 'wba'].includes(first)) {
        didMethod = first;
      } else {
        console.log(`\n[错误] 未知的密钥类型：${first}`);
        console.log('支持的密钥类型：x25519, p256');
        return null;
      }
    } else if (parts.length >= 2) {
      // 复杂格式：/create ethr x25519 或 /create wba example.com [p256]
      didMethod = parts[0];
      
      if (didMethod === 'wba') {
        // did:wba 需要域名
        domain = parts[1];
        if (parts.length >= 3) {
          keyType = parts[2];
        }
      } else if (didMethod === 'ethr') {
        // did:ethr 可以有密钥类型
        if (['x25519', 'p256'].includes(parts[1])) {
          keyType = parts[1];
        }
      } else {
        console.log(`\n[错误] 未知的方法：${didMethod}`);
        console.log('支持的方法：key, ethr, wba');
        return null;
      }
    }

    // 验证密钥类型
    if (!['x25519', 'p256'].includes(keyType)) {
      console.log(`\n[错误] 不支持的密钥类型：${keyType}`);
      console.log('支持的密钥类型：x25519, p256');
      return null;
    }

    // 验证 did:wba 的域名
    if (didMethod === 'wba' && !domain) {
      console.log(`\n[错误] 创建 did:wba 需要指定域名`);
      console.log(`用法：/create wba example.com [x25519|p256]`);
      console.log(`示例：/create wba example.com x25519`);
      return null;
    }

    // 生成身份
    let identity;
    if (didMethod === 'wba') {
      // did:wba 需要域名参数
      identity = didManager.generate(didMethod, { domain, keyType });
    } else {
      identity = didManager.generate(didMethod, { keyType });
    }

    state.myDid = identity.did;
    state.myIdentity = identity;

    // 设置到 MQTT 客户端
    if (state.client) {
      state.client.setIdentity(identity.did, identity);
    }

    console.log(`\n✓ 身份创建成功!`);
    console.log(`  DID: ${identity.did}`);
    console.log(`  密钥类型：${identity.keyType}`);

    // 导出身份
    const exportData = didManager.export(identity.did);
    console.log(`\n  请保存以下信息:`);
    console.log(`  ────────────────────────────────────────`);
    console.log(`  ${JSON.stringify(exportData, null, 2)}`);
    console.log(`  ────────────────────────────────────────`);

    // 保存到文件 (替换冒号为下划线，Windows 文件名不能包含冒号)
    const safeDid = identity.did.replace(/:/g, '_');
    const savePath = join(CONFIG.dataDir, `identity-${safeDid.substring(0, 20)}.json`);
    writeFileSync(savePath, JSON.stringify(exportData, null, 2));
    console.log(`\n  身份已保存到：${savePath}`);

    // 如果是 did:wba，生成 did.json 文件
    if (didMethod === 'wba') {
      const didJsonPath = join(CONFIG.dataDir, `did-${safeDid.substring(0, 20)}.json`);
      const didJson = {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/jws-2020/v1',
          'https://w3id.org/security/suites/x25519-2019/v1'
        ],
        id: identity.did,
        verificationMethod: [{
          id: `${identity.did}#key-1`,
          type: 'X25519KeyAgreementKey2019',
          controller: identity.did,
          publicKeyMultibase: 'z' + identity.publicKey.toString('hex')
        }],
        authentication: [`${identity.did}#key-1`],
        assertionMethod: [`${identity.did}#key-1`],
        keyAgreement: [`${identity.did}#key-1`]
      };
      writeFileSync(didJsonPath, JSON.stringify(didJson, null, 2));
      console.log(`\n  did.json 已生成：${didJsonPath}`);
      console.log(`  💡 提示：将此文件部署到 https://${identity.domain}/.well-known/did.json`);
    }

    return identity;
  } catch (err) {
    console.error(`[错误] 创建身份失败：${err.message}`);
    return null;
  }
}

/**
 * 导入身份
 */
function importIdentity(filePath) {
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));

    const identity = didManager.import(data.method, Buffer.from(data.privateKey, 'hex'), {
      keyType: data.keyType
    });

    state.myDid = identity.did;
    state.myIdentity = identity;

    // 设置到 MQTT 客户端
    if (state.client) {
      state.client.setIdentity(identity.did, identity);
    }

    console.log(`\n✓ 身份导入成功!`);
    console.log(`  DID: ${identity.did}`);
    console.log(`  密钥类型：${identity.keyType}`);

    return identity;
  } catch (err) {
    console.error(`[错误] 导入身份失败：${err.message}`);
    return null;
  }
}

/**
 * 显示身份
 */
function showIdentity() {
  if (!state.myIdentity) {
    console.log('\n[身份] 当前没有身份');
    return;
  }
  
  // 获取原始公钥（X25519 是 32 字节）
  const rawPublicKey = state.myIdentity.publicKey;
  
  console.log(`\n[身份] 当前身份:`);
  console.log(`  DID: ${state.myIdentity.did}`);
  console.log(`  密钥类型：${state.myIdentity.keyType}`);
  console.log(`  公钥 (Hex): ${rawPublicKey.toString('hex')}`);
  console.log(`  公钥长度：${rawPublicKey.length} 字节`);
  console.log(`\n💡 提示：将公钥 (Hex) 分享给伙伴，用于建立加密连接`);
}

/**
 * 连接到伙伴
 */
function connectToPartner(partnerDid) {
  if (!state.myIdentity) {
    console.log('\n[错误] 请先创建或导入身份 (/identity new key)');
    return false;
  }
  
  state.partnerDid = partnerDid;
  console.log(`\n[连接] 准备连接到：${partnerDid}`);
  
  const parts = partnerDid.split(':');
  const method = parts[1];
  
  if (method === 'key') {
    console.log('[连接] 检测到 did:key 方法，请使用 /pubkey <hex> 设置公钥');
  }
  
  return true;
}

/**
 * 设置伙伴公钥
 */
function setPartnerPublicKey(publicKeyHex) {
  try {
    let publicKey = Buffer.from(publicKeyHex, 'hex');
    
    // 验证公钥长度
    if (publicKey.length === 33) {
      // 可能是压缩的 P-256 公钥 (0x02 或 0x03 开头)
      const prefix = publicKey[0];
      if (prefix === 0x02 || prefix === 0x03) {
        console.log(`\n[警告] 检测到 P-256 压缩公钥 (33字节)，自动去掉前缀`);
        publicKey = publicKey.slice(1);
      }
    }
    
    if (publicKey.length !== 32) {
      throw new Error(`公钥长度应为 32 字节 (X25519)，当前长度: ${publicKey.length}`);
    }
    
    state.partnerPublicKey = publicKey;
    console.log(`\n[连接] 伙伴公钥已设置 (长度: ${publicKey.length} 字节)`);
    return true;
  } catch (err) {
    console.error(`[错误] 无效的公钥格式：${err.message}`);
    return false;
  }
}

/**
 * 初始化 E2EE 会话
 */
async function initE2EESession() {
  if (!state.client || !state.partnerDid || !state.partnerPublicKey) {
    console.log('\n[错误] 请先连接伙伴并设置公钥');
    return null;
  }
  
  try {
    console.log(`\n[E2EE] 初始化会话...`);
    
    const session = await state.client.sendE2EEInit(
      state.partnerDid,
      state.partnerPublicKey,
      'x25519'
    );
    
    state.currentSession = session;
    console.log(`[E2EE] ✓ 会话已初始化：${session.sessionId}`);
    
    return session;
  } catch (err) {
    console.error(`[错误] E2EE 初始化失败：${err.message}`);
    return null;
  }
}

/**
 * 发送消息
 */
async function sendMessage(message) {
  if (!state.client) {
    console.log('\n[错误] 未连接到 MQTT Broker');
    return;
  }

  // 如果有 E2EE 会话，发送加密消息；否则发送明文
  if (state.currentSession && state.currentSession.isActive) {
    try {
      await state.client.sendE2EEMsg(state.currentSession.sessionId, message);
      console.log(`\n🔐 [加密发送] ${message}`);
    } catch (err) {
      console.error(`[错误] 加密发送失败：${err.message}`);
    }
  } else {
    // 发送明文消息
    try {
      await state.client.sendPlainText(message, state.partnerDid || 'all');
      console.log(`\n📝 [明文发送] ${message}`);
    } catch (err) {
      console.error(`[错误] 明文发送失败：${err.message}`);
    }
  }
}

/**
 * 显示会话状态
 */
function showSession() {
  console.log('\n[会话状态]');
  console.log(`  我的 DID: ${state.myDid || '未设置'}`);
  console.log(`  伙伴 DID: ${state.partnerDid || '未设置'}`);
  console.log(`  会话 ID: ${state.currentSession?.sessionId || '未初始化'}`);
  console.log(`  会话活跃：${state.currentSession?.isActive ? '是' : '否'}`);
  console.log(`  发送序列：${state.currentSession?.sendSeq || 0}`);
  console.log(`  接收序列：${state.currentSession?.recvSeq || 0}`);
  console.log(`\n💡 提示：使用 /init 初始化 E2EE 会话，然后发送加密消息`);
}

/**
 * 启动 CLI
 */
async function startCLI() {
  showWelcome();
  showHelp();
  
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // 创建 MQTT 客户端
  state.client = new MQTTE2EEClient({
    brokerUrl: CONFIG.brokerUrl,
    topic: CONFIG.topic,
    role: 'delegator'
  });
  
  // 注册消息处理器
  state.client.on('e2ee_message', (data) => {
    console.log(`\n[接收] ${data.plaintext}`);
    console.log(`[E2EE] 序列号：${data.seq}`);
    process.stdout.write('\n> ');
  });

  state.client.on('e2ee_session', (data) => {
    console.log(`\n[E2EE] 会话已建立：${data.session_id}`);
    console.log(`[E2EE] 对方 DID: ${data.sender_did}`);
    // 设置当前会话（用于发送加密消息）
    const session = sessionManager.getPrivateSession(data.session_id);
    if (session) {
      state.currentSession = session;
      console.log(`[E2EE] ✓ 会话已激活，可以发送加密消息`);
      console.log(`[DEBUG] session.sendChainKey: ${session.sendChainKey ? 'set' : 'null'}`);
      console.log(`[DEBUG] session.recvChainKey: ${session.recvChainKey ? 'set' : 'null'}`);
      console.log(`[DEBUG] session.isActive: ${session.isActive}`);
      console.log(`[DEBUG] session.sendSeq: ${session.sendSeq}`);
      console.log(`[DEBUG] session.recvSeq: ${session.recvSeq}`);
    } else {
      console.log(`[E2EE] ✗ 会话未找到：${data.session_id}`);
    }
    process.stdout.write('\n> ');
  });

  state.client.on('message', (data) => {
    // 处理明文消息
    if (data.content && data.content.text) {
      console.log(`\n[接收] ${data.content.text}`);
    } else {
      console.log(`\n[消息] ${JSON.stringify(data.content)}`);
    }
    process.stdout.write('\n> ');
  });
  
  // 连接到 MQTT Broker
  try {
    await state.client.connect();
    console.log('\n[系统] 已连接到 MQTT Broker');
  } catch (err) {
    console.error(`[错误] 连接失败：${err.message}`);
  }
  
  // 命令处理
  rl.on('line', async (line) => {
    const input = line.trim();
    
    if (!input) {
      process.stdout.write('> ');
      return;
    }
    
    if (input.startsWith('/')) {
      const parts = input.split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);
      
      switch (command) {
        case '/help':
          showHelp();
          break;

        case '/create':
          if (args.length > 0) {
            createIdentity(args.join(' '));
          } else {
            console.log('\n用法：/create <method> [domain] [keyType]');
            console.log('示例：/create wba example.com x25519');
          }
          break;

        case '/show':
          showIdentity();
          break;

        case '/export':
          if (state.myDid) {
            const exportData = didManager.export(state.myDid);
            console.log('\n' + JSON.stringify(exportData, null, 2));
          } else {
            console.log('\n[错误] 没有可导出的身份');
          }
          break;

        case '/import':
          if (args[0]) {
            importIdentity(args[0]);
          } else {
            console.log('\n用法：/import <file>');
          }
          break;

        case '/init':
          await initE2EESession();
          break;

        case '/connect':
          if (args[0]) {
            connectToPartner(args[0]);
          } else {
            console.log('\n用法：/connect <partner-did>');
          }
          break;
        
        case '/pubkey':
          if (args[0]) {
            setPartnerPublicKey(args[0]);
          } else {
            console.log('\n用法：/pubkey <hex-public-key>');
          }
          break;
        
        case '/send':
          if (args.length > 0) {
            await sendMessage(args.join(' '));
          } else {
            console.log('\n用法：/send <message>');
          }
          break;
        
        case '/session':
          showSession();
          break;
        
        case '/quit':
        case '/exit':
          console.log('\n[系统] 正在退出...');
          await state.client.disconnect();
          rl.close();
          process.exit(0);
          break;
        
        default:
          console.log(`\n[错误] 未知命令：${command}`);
          console.log('输入 /help 查看可用命令');
      }
    } else {
      await sendMessage(input);
    }
    
    process.stdout.write('> ');
  });
  
  rl.on('close', async () => {
    console.log('\n[系统] 再见!');
    await state.client.disconnect();
    process.exit(0);
  });
  
  process.stdout.write('> ');
}

// 启动
startCLI().catch(err => {
  console.error('[致命错误]', err);
  process.exit(1);
});
