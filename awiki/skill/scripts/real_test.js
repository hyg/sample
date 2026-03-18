#!/usr/bin/env node

/**
 * 真实环境集成测试
 * 使用现有身份测试完整业务流程
 */

import { AwikiSDK } from './utils/sdk.js';
import { SDKConfig } from '@awiki/config';
import * as fs from 'fs';
import * as path from 'path';

async function runTests() {
  console.log('='.repeat(60));
  console.log('真实环境集成测试');
  console.log('='.repeat(60));
  console.log();

  // 加载配置
  const config = SDKConfig.load();
  console.log('配置:');
  console.log(`  DID Domain: ${config.did_domain}`);
  console.log(`  User Service: ${config.user_service_url}`);
  console.log(`  Message Service: ${config.molt_message_url}`);
  console.log();

  // 列出所有身份
  const credDir = path.join(process.env.USERPROFILE || process.env.HOME, '.openclaw/credentials/awiki-agent-id-message');
  const index = JSON.parse(fs.readFileSync(path.join(credDir, 'index.json'), 'utf-8'));
  
  console.log('可用身份:');
  const identities = Object.values(index.credentials);
  identities.forEach((id, i) => {
    console.log(`  ${i + 1}. ${id.credential_name} (${id.name || 'Unnamed'}) - ${id.handle ? '@' + id.handle : '无 Handle'}`);
  });
  console.log();

  // 选择两个测试身份
  const aliceCred = identities.find(id => id.credential_name === 'test_user_a');
  const bobCred = identities.find(id => id.credential_name === 'test_user_b');

  if (!aliceCred || !bobCred) {
    console.log('❌ 找不到测试身份 test_user_a 或 test_user_b');
    console.log('请使用已有的身份进行测试');
    return;
  }

  console.log('测试身份:');
  console.log(`  Alice: ${aliceCred.name} (${aliceCred.did})`);
  console.log(`  Bob: ${bobCred.name} (${bobCred.did})`);
  console.log();

  // 测试 1: Alice 发送消息给 Bob
  console.log('测试 1: Alice 发送消息给 Bob');
  console.log('-'.repeat(40));
  try {
    const aliceSdk = new AwikiSDK('test_user_a');
    await aliceSdk.init();
    
    console.log('✅ Alice SDK 初始化成功');
    
    // 发送消息
    const result = await aliceSdk.send_message(bobCred.did, '你好，Bob！这是测试消息。');
    console.log(`✅ 消息发送成功: ${result.id}`);
    
    await aliceSdk.destroy();
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
  }
  console.log();

  // 测试 2: Bob 查看收件箱
  console.log('测试 2: Bob 查看收件箱');
  console.log('-'.repeat(40));
  try {
    const bobSdk = new AwikiSDK('test_user_b');
    await bobSdk.init();
    
    console.log('✅ Bob SDK 初始化成功');
    
    const messages = await bobSdk.check_inbox({ limit: 5 });
    console.log(`✅ 收件箱消息数: ${messages.length}`);
    
    messages.forEach((msg, i) => {
      console.log(`  ${i + 1}. [${msg.sent_at}] ${msg.sender_did.substring(0, 20)}...: ${msg.content?.substring(0, 50) || '[加密消息]'}`);
    });
    
    await bobSdk.destroy();
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
  }
  console.log();

  // 测试 3: Bob 回复消息
  console.log('测试 3: Bob 回复消息给 Alice');
  console.log('-'.repeat(40));
  try {
    const bobSdk = new AwikiSDK('test_user_b');
    await bobSdk.init();
    
    const result = await bobSdk.send_message(aliceCred.did, '你好，Alice！收到你的消息了。');
    console.log(`✅ 回复消息成功: ${result.id}`);
    
    await bobSdk.destroy();
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
  }
  console.log();

  // 测试 4: Alice 发送加密消息
  console.log('测试 4: Alice 发送 E2EE 加密消息');
  console.log('-'.repeat(40));
  try {
    const aliceSdk = new AwikiSDK('test_user_a');
    await aliceSdk.init();
    
    const result = await aliceSdk.send_e2ee_message(bobCred.did, '这是一条加密测试消息！');
    console.log(`✅ 加密消息发送成功: ${result.id}`);
    
    await aliceSdk.destroy();
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
  }
  console.log();

  // 测试 5: 搜索用户
  console.log('测试 5: 搜索 nodejs 相关用户');
  console.log('-'.repeat(40));
  try {
    const searchSdk = new AwikiSDK('test_user_a');
    await searchSdk.init();
    
    const users = await searchSdk.search_users('nodejs');
    console.log(`✅ 搜索结果: ${users.length} 个用户`);
    
    users.slice(0, 5).forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.handle ? '@' + user.handle : '无 Handle'} - ${user.name || '未命名'}`);
    });
    
    await searchSdk.destroy();
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
  }
  console.log();

  // 测试 6: 群组操作
  console.log('测试 6: 尝试加入群组 (入群码：813270)');
  console.log('-'.repeat(40));
  try {
    const groupSdk = new AwikiSDK('test_user_a');
    await groupSdk.init();
    
    const result = await groupSdk.join_group('813270');
    console.log(`✅ 加入群组成功: ${result.group_id} - ${result.name}`);
    
    await groupSdk.destroy();
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
  }
  console.log();

  console.log('='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
}

runTests().catch(console.error);
