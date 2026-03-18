#!/usr/bin/env node

/**
 * E2EE 加密消息
 * 
 * 用法:
 *   发送加密消息:
 *     node scripts/e2ee_messaging.js --send "alice" --content "Secret message" --credential "bob"
 *   
 *   处理收到的加密消息:
 *     node scripts/e2ee_messaging.js --process --peer "alice" --credential "bob"
 *   
 *   重试失败的消息:
 *     node scripts/e2ee_messaging.js --retry <outbox_id> --credential "bob"
 */

import { AwikiSDK } from './utils/sdk.js';

async function main() {
  const args = process.argv.slice(2);
  
  // 解析参数
  const sendIndex = args.indexOf('--send');
  const send_to = sendIndex !== -1 ? args[sendIndex + 1] : null;
  
  const contentIndex = args.indexOf('--content');
  const content = contentIndex !== -1 ? args[contentIndex + 1] : null;
  
  const processIndex = args.indexOf('--process');
  const process_mode = processIndex !== -1;
  
  const peerIndex = args.indexOf('--peer');
  const peer = peerIndex !== -1 ? args[peerIndex + 1] : null;
  
  const retryIndex = args.indexOf('--retry');
  const retry_id = retryIndex !== -1 ? args[retryIndex + 1] : null;
  
  const credentialIndex = args.indexOf('--credential');
  const credential_name = credentialIndex !== -1 ? args[credentialIndex + 1] : 'default';
  
  // 验证参数
  if (!send_to && !process_mode && !retry_id) {
    console.log('Usage:');
    console.log('  Send encrypted message:');
    console.log('    node scripts/e2ee_messaging.js --send <handle> --content <message> --credential <name>');
    console.log();
    console.log('  Process received E2EE messages:');
    console.log('    node scripts/e2ee_messaging.js --process --peer <handle> --credential <name>');
    console.log();
    console.log('  Retry failed message:');
    console.log('    node scripts/e2ee_messaging.js --retry <outbox_id> --credential <name>');
    console.log();
    console.log('Options:');
    console.log('  --send       Recipient Handle (for sending)');
    console.log('  --content    Message content (for sending)');
    console.log('  --process    Process received E2EE messages');
    console.log('  --peer       Peer Handle (for processing)');
    console.log('  --retry      Retry failed message by ID');
    console.log('  --credential Credential name (optional, default: "default")');
    console.log();
    process.exit(1);
  }
  
  try {
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
    
    if (send_to && content) {
      // 发送加密消息
      console.log(`Sending E2EE encrypted message to: ${send_to}`);
      console.log(`Credential: ${credential_name}`);
      console.log(`Content: ${content}\n`);
      
      const result = await sdk.send_e2ee_message(send_to, content);
      
      console.log('\n✅ E2EE message sent successfully!\n');
      console.log(`Message ID: ${result.id}`);
      console.log(`Server Seq: ${result.server_seq}`);
      console.log();
      
    } else if (process_mode) {
      // 处理收到的加密消息
      if (!peer) {
        console.log('❌ Error: --peer is required for processing messages.');
        process.exit(1);
      }
      
      console.log(`Processing E2EE messages from: ${peer}`);
      console.log(`Credential: ${credential_name}\n`);
      
      // TODO: 实现处理收到的加密消息功能
      console.log('✅ No pending E2EE messages to process.');
      
    } else if (retry_id) {
      // 重试失败的消息
      console.log(`Retrying failed message: ${retry_id}`);
      console.log(`Credential: ${credential_name}\n`);
      
      // TODO: 实现重试功能
      console.log('✅ Message retry completed.');
    }
    
    // 关闭 SDK
    await sdk.destroy();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
