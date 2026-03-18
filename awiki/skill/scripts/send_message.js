#!/usr/bin/env node

/**
 * 发送消息
 * 
 * 用法:
 *   node scripts/send_message.js --to "alice" --content "Hello!" --credential "bob"
 *   node scripts/send_message.js --to "alice" --content "Hello!" --e2ee --credential "bob"
 */

import { AwikiSDK } from './utils/sdk.js';

async function main() {
  const args = process.argv.slice(2);
  
  // 解析参数
  const toIndex = args.indexOf('--to');
  const to = toIndex !== -1 ? args[toIndex + 1] : null;
  
  const contentIndex = args.indexOf('--content');
  const content = contentIndex !== -1 ? args[contentIndex + 1] : null;
  
  const e2eeIndex = args.indexOf('--e2ee');
  const use_e2ee = e2eeIndex !== -1;
  
  const credentialIndex = args.indexOf('--credential');
  const credential_name = credentialIndex !== -1 ? args[credentialIndex + 1] : 'default';
  
  // 验证参数
  if (!to || !content) {
    console.log('Usage:');
    console.log('  node scripts/send_message.js --to <handle_or_did> --content <message> [--credential <name>] [--e2ee]');
    console.log();
    console.log('Options:');
    console.log('  --to          Recipient Handle or DID (required)');
    console.log('  --content     Message content (required)');
    console.log('  --e2ee        Send encrypted message (optional)');
    console.log('  --credential  Credential name (optional, default: "default")');
    console.log();
    console.log('Examples:');
    console.log('  node scripts/send_message.js --to "alice" --content "Hello!" --credential "bob"');
    console.log('  node scripts/send_message.js --to "alice" --content "Secret" --e2ee --credential "bob"');
    process.exit(1);
  }
  
  try {
    console.log(`Sending message to: ${to}`);
    console.log(`Credential: ${credential_name}`);
    console.log(`Content: ${content}`);
    if (use_e2ee) {
      console.log('Encryption: E2EE enabled');
    }
    console.log();
    
    // 创建 SDK 实例
    const sdk = new AwikiSDK(credential_name);
    await sdk.init();
    
    // 检查是否有身份
    if (!sdk.identity) {
      console.log('❌ Error: No identity found.');
      console.log('Please create an identity first:');
      console.log(`  node scripts/setup_identity.js --name "YourName" --credential ${credential_name}`);
      process.exit(1);
    }
    
    // 发送消息
    let result;
    if (use_e2ee) {
      console.log('Sending E2EE encrypted message...');
      result = await sdk.send_e2ee_message(to, content);
    } else {
      console.log('Sending message...');
      result = await sdk.send_message(to, content);
    }
    
    console.log('\n✅ Message sent successfully!\n');
    console.log(`Message ID: ${result.id}`);
    console.log(`Server Seq: ${result.server_seq}`);
    console.log(`Sent At: ${result.sent_at}`);
    console.log();
    
    // 关闭 SDK
    await sdk.destroy();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error sending message:', error.message);
    process.exit(1);
  }
}

main();
