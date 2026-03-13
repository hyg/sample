/**
 * MQTT 原始数据包捕获工具
 * 显示接收到的每个消息的完整结构
 */

import mqtt from 'mqtt';

const CONFIG = {
  brokerUrl: 'mqtt://broker.emqx.io:1883',
  topic: 'psmd/e2ee/chat',
  clientId: `sniffer-${Math.random().toString(36).substring(2, 8)}`
};

console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║        MQTT 原始数据包捕获工具                        ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');
console.log(`Broker: ${CONFIG.brokerUrl}`);
console.log(`Topic: ${CONFIG.topic}`);
console.log(`Client ID: ${CONFIG.clientId}`);
console.log('\n按 Ctrl+C 退出\n');

const client = mqtt.connect(CONFIG.brokerUrl, {
  clientId: CONFIG.clientId,
  clean: true,
  reconnectPeriod: 0  // 不自动重连
});

let messageCount = 0;

client.on('connect', () => {
  console.log('✓ 已连接到 MQTT Broker\n');
  
  client.subscribe(CONFIG.topic, (err) => {
    if (err) {
      console.error(`✗ 订阅失败：${err.message}`);
      process.exit(1);
    } else {
      console.log(`✓ 已订阅主题：${CONFIG.topic}`);
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('等待消息... (在另一个终端运行 node src/cli.js 并发送消息)\n');
    }
  });
});

client.on('message', (topic, message) => {
  messageCount++;
  const rawString = message.toString();
  const rawHex = Buffer.from(message).toString('hex');
  
  console.log(`\n╔═══════════════════════════════════════════════════════╗`);
  console.log(`║  消息 #${messageCount.toString().padStart(3, '0')}                                          ║`);
  console.log(`╚═══════════════════════════════════════════════════════╝`);
  console.log(`\n📦 Topic: ${topic}`);
  console.log(`📏 Size: ${message.length} bytes`);
  
  console.log(`\n🔹 原始数据 (Hex):`);
  console.log(`   ${rawHex}`);
  
  console.log(`\n🔹 原始数据 (String):`);
  console.log(`   ${rawString.substring(0, 500)}${rawString.length > 500 ? '...' : ''}`);
  
  // 尝试解析为 JSON
  try {
    const parsed = JSON.parse(rawString);
    
    console.log(`\n🔹 JSON 结构:`);
    console.log(JSON.stringify(parsed, null, 2));
    
    // 详细分析
    console.log(`\n🔍 结构分析:`);
    console.log(`   ├─ jsonrpc: ${parsed.jsonrpc || '❌ 缺失'}`);
    console.log(`   ├─ method: ${parsed.method || '❌ 缺失'}`);
    console.log(`   └─ params:`);
    
    if (parsed.params) {
      const params = parsed.params;
      console.log(`       ├─ type: ${params.type || '❌ 缺失'}`);
      console.log(`       ├─ receiver_did: ${params.receiver_did || '❌ 缺失'}`);
      
      // 检查 params 层级的 sender_did
      if (params.sender_did !== undefined) {
        console.log(`       ├─ sender_did (params 层级): ${params.sender_did}`);
      } else {
        console.log(`       ├─ sender_did (params 层级): ❌ 缺失`);
      }
      
      // 分析 content
      if (params.content !== undefined) {
        console.log(`       └─ content:`);
        
        if (typeof params.content === 'string') {
          console.log(`           └─ (string): "${params.content}"`);
        } else if (typeof params.content === 'object') {
          const content = params.content;
          const contentKeys = Object.keys(content);
          
          console.log(`           ├─ 类型：object`);
          console.log(`           ├─ keys: [${contentKeys.join(', ')}]`);
          
          // 检查 content 内部的 sender_did
          if (content.sender_did !== undefined) {
            console.log(`           ├─ sender_did (content 内部): ${content.sender_did}`);
          } else {
            console.log(`           ├─ sender_did (content 内部): ❌ 缺失`);
          }
          
          // 显示其他字段
          if (content.text !== undefined) {
            console.log(`           ├─ text: "${content.text}"`);
          }
          if (content.session_id !== undefined) {
            console.log(`           ├─ session_id: ${content.session_id}`);
          }
          if (content.seq !== undefined) {
            console.log(`           ├─ seq: ${content.seq}`);
          }
          if (content.original_type !== undefined) {
            console.log(`           ├─ original_type: ${content.original_type}`);
          }
          if (content.ciphertext !== undefined) {
            const ct = content.ciphertext;
            console.log(`           ├─ ciphertext: ${ct.substring(0, 50)}${ct.length > 50 ? '...' : ''}`);
          }
          if (content.encrypted_seed !== undefined) {
            console.log(`           ├─ encrypted_seed: ${content.encrypted_seed.substring(0, 50)}...`);
          }
          if (content.enc !== undefined) {
            console.log(`           ├─ enc: ${content.enc.substring(0, 50)}...`);
          }
        }
      }
    }
    
  } catch (e) {
    console.log(`\n❌ JSON 解析失败：${e.message}`);
  }
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});

client.on('error', (err) => {
  console.error(`\n✗ MQTT 错误：${err.message}`);
});

client.on('close', () => {
  console.log('\n✗ 连接已关闭');
  process.exit(0);
});

client.on('offline', () => {
  console.log('\n⚠ 离线');
});

// 处理退出
process.on('SIGINT', () => {
  console.log(`\n\n共捕获 ${messageCount} 条消息`);
  console.log('正在退出...');
  client.end();
  process.exit(0);
});
