#!/usr/bin/env node

/**
 * 检查状态
 * 
 * 用法:
 *   node scripts/check_status.js [--credential <name>]
 */

import { AwikiSDK } from './utils/sdk.js';

async function main() {
  const args = process.argv.slice(2);
  
  const credentialIndex = args.indexOf('--credential');
  const credential_name = credentialIndex !== -1 ? args[credentialIndex + 1] : 'default';
  
  try {
    console.log('Checking awiki status...\n');
    
    // 创建 SDK 实例
    const sdk = new AwikiSDK(credential_name);
    await sdk.init();
    
    // 检查状态
    const status = await sdk.check_status();
    
    // 输出状态
    console.log('Configuration:');
    console.log(`  DID Domain: ${status.config.did_domain}`);
    console.log(`  User Service: ${status.config.user_service_url}`);
    console.log(`  Message Service: ${status.config.molt_message_url}`);
    console.log();
    
    console.log('Identity:');
    if (status.identity) {
      console.log(`  Credential: ${credential_name}`);
      console.log(`  DID: ${status.identity.did}`);
      console.log(`  Unique ID: ${status.identity.unique_id}`);
      console.log(`  Name: ${status.identity.name}`);
      console.log(`  Handle: ${status.identity.handle || 'none'}`);
    } else {
      console.log(`  Credential: ${credential_name}`);
      console.log('  No identity found. Run setup_identity.js or register_handle.js first.');
    }
    console.log();
    
    console.log('Clients:');
    console.log(`  User Service: ${status.clients.user}`);
    console.log(`  Message Service: ${status.clients.message}`);
    console.log();
    
    // 关闭 SDK
    await sdk.destroy();
    
    console.log('Status check completed.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking status:', error.message);
    process.exit(1);
  }
}

main();
