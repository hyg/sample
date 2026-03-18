#!/usr/bin/env node

/**
 * 查看收件箱
 * 
 * 用法:
 *   node scripts/check_inbox.js --credential "alice"
 *   node scripts/check_inbox.js --history "bob" --credential "alice"
 *   node scripts/check_inbox.js --limit 20 --credential "alice"
 */

import { AwikiSDK } from './utils/sdk.js';

async function main() {
  const args = process.argv.slice(2);
  
  // 解析参数
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : 10;
  
  const historyIndex = args.indexOf('--history');
  const history = historyIndex !== -1 ? args[historyIndex + 1] : null;
  
  const credentialIndex = args.indexOf('--credential');
  const credential_name = credentialIndex !== -1 ? args[credentialIndex + 1] : 'default';
  
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
    
    // 查看收件箱
    if (history) {
      console.log(`Checking chat history with: ${history}`);
    } else {
      console.log('Checking inbox...');
    }
    console.log(`Credential: ${credential_name}`);
    console.log(`Limit: ${limit}\n`);
    
    const messages = await sdk.check_inbox({ limit, history });
    
    if (messages.length === 0) {
      console.log('📭 Inbox is empty.\n');
    } else {
      console.log(`📬 Inbox (${messages.length} message(s)):\n`);
      
      for (const msg of messages) {
        const date = new Date(msg.sent_at).toLocaleString();
        const sender = msg.sender_handle || msg.sender_did.substring(0, 20) + '...';
        
        console.log(`[${date}] ${sender}:`);
        console.log(`  ${msg.content}`);
        console.log(`  Type: ${msg.type || 'text'}`);
        console.log(`  ID: ${msg.id}`);
        console.log();
      }
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
