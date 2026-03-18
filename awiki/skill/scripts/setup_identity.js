#!/usr/bin/env node

/**
 * 创建 DID 身份
 * 
 * 用法:
 *   node scripts/setup_identity.js --name "YourName"
 *   node scripts/setup_identity.js --name "YourName" --credential "myid"
 */

import { AwikiSDK, create_sdk } from './utils/sdk.js';

async function main() {
  const args = process.argv.slice(2);
  
  // 解析参数
  const nameIndex = args.indexOf('--name');
  const name = nameIndex !== -1 ? args[nameIndex + 1] : null;
  
  const credentialIndex = args.indexOf('--credential');
  const credential_name = credentialIndex !== -1 ? args[credentialIndex + 1] : 'default';
  
  if (!name) {
    console.log('Usage: node scripts/setup_identity.js --name "YourName" [--credential <name>]');
    console.log();
    console.log('Options:');
    console.log('  --name        Your display name (required)');
    console.log('  --credential  Credential name (optional, default: "default")');
    console.log();
    console.log('Example:');
    console.log('  node scripts/setup_identity.js --name "Alice"');
    console.log('  node scripts/setup_identity.js --name "Bob" --credential "bob"');
    process.exit(1);
  }
  
  try {
    console.log(`Creating identity for: ${name}`);
    console.log(`Credential name: ${credential_name}`);
    console.log();
    
    // 创建 SDK 实例
    const sdk = new AwikiSDK(credential_name);
    await sdk.init();
    
    // 创建身份
    console.log('Generating DID document...');
    const identity = await sdk.create_identity({ name });
    
    console.log('\n✅ Identity created successfully!\n');
    console.log(`DID: ${identity.did}`);
    console.log(`Unique ID: ${identity.unique_id}`);
    console.log(`User ID: ${identity.user_id}`);
    console.log();
    console.log('Credentials saved to: ~/.openclaw/credentials/awiki-agent-id-message/');
    console.log();
    console.log('Next steps:');
    console.log('  1. Register a Handle (recommended):');
    console.log(`     node scripts/register_handle.js --handle <desired_handle> --phone <your_phone> --credential ${credential_name}`);
    console.log();
    console.log('  2. Send a message:');
    console.log('     node scripts/send_message.js --to "handle" --content "Hello!"');
    console.log();
    
    // 关闭 SDK
    await sdk.destroy();
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating identity:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
