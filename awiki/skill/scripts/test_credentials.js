#!/usr/bin/env node

/**
 * 测试凭证存储功能
 */

import { list_identities, load_identity } from '../src/credential_store.js';

async function test() {
  console.log('='.repeat(60));
  console.log('凭证存储功能测试');
  console.log('='.repeat(60));
  console.log();
  
  // 测试 1: 列出所有身份
  console.log('测试 1: 列出所有身份');
  console.log('-'.repeat(40));
  try {
    const identities = list_identities();
    console.log(`✅ 找到 ${identities.length} 个身份:\n`);
    
    identities.forEach((id, i) => {
      console.log(`  ${i + 1}. ${id.credential_name} (${id.name || 'Unnamed'})`);
      console.log(`     DID: ${id.did}`);
      console.log(`     Handle: ${id.handle || 'none'}`);
      console.log();
    });
  } catch (error) {
    console.log(`❌ 失败：${error.message}`);
  }
  console.log();
  
  // 测试 2: 加载身份
  console.log('测试 2: 加载身份 (test_user_a)');
  console.log('-'.repeat(40));
  try {
    const identity = await load_identity('test_user_a');
    if (identity) {
      console.log('✅ 身份加载成功:');
      console.log(`  DID: ${identity.did}`);
      console.log(`  Unique ID: ${identity.unique_id}`);
      console.log(`  User ID: ${identity.user_id}`);
      console.log(`  JWT: ${identity.jwt_token ? '存在' : '不存在'}`);
      console.log(`  E2EE 密钥：${identity.e2ee_signing_private_pem ? '存在' : '不存在'}`);
    } else {
      console.log('⚠️ 身份不存在');
    }
  } catch (error) {
    console.log(`❌ 失败：${error.message}`);
  }
  console.log();
  
  // 测试 3: 加载另一个身份
  console.log('测试 3: 加载身份 (test_user_b)');
  console.log('-'.repeat(40));
  try {
    const identity = await load_identity('test_user_b');
    if (identity) {
      console.log('✅ 身份加载成功:');
      console.log(`  DID: ${identity.did}`);
      console.log(`  Unique ID: ${identity.unique_id}`);
      console.log(`  User ID: ${identity.user_id}`);
      console.log(`  JWT: ${identity.jwt_token ? '存在' : '不存在'}`);
    } else {
      console.log('⚠️ 身份不存在');
    }
  } catch (error) {
    console.log(`❌ 失败：${error.message}`);
  }
  console.log();
  
  console.log('='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
}

test().catch(console.error);
