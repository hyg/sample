#!/usr/bin/env node

/**
 * 测试 SDK 基本功能
 */

import { create_sdk } from './utils/sdk.js';

async function test() {
  console.log('Testing SDK basic functionality...\n');
  
  try {
    // 创建 SDK
    console.log('1. Creating SDK...');
    const sdk = await create_sdk();
    console.log('   ✅ SDK created\n');
    
    // 检查状态
    console.log('2. Checking status...');
    const status = await sdk.check_status();
    console.log('   ✅ Status checked\n');
    
    console.log('Status:');
    console.log(`  DID Domain: ${status.config.did_domain}`);
    console.log(`  User Service: ${status.config.user_service_url}`);
    console.log(`  Message Service: ${status.config.molt_message_url}`);
    console.log(`  Identity: ${status.identity ? status.identity.did : 'none'}`);
    console.log();
    
    // 关闭 SDK
    console.log('3. Closing SDK...');
    await sdk.destroy();
    console.log('   ✅ SDK closed\n');
    
    console.log('✅ All tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();
