#!/usr/bin/env node

/**
 * 群组管理
 * 
 * 用法:
 *   创建群组:
 *     node scripts/manage_group.js --create --name "Meetup" --description "..." --credential alice
 *   
 *   加入群组:
 *     node scripts/manage_group.js --join --join-code 314159 --credential bob
 *   
 *   发送群消息:
 *     node scripts/manage_group.js --post-message --group-id GID --content "Hello" --credential alice
 *   
 *   列出群组:
 *     node scripts/manage_group.js --list --credential alice
 */

import { AwikiSDK } from './utils/sdk.js';

async function main() {
  const args = process.argv.slice(2);
  
  // 解析参数
  const createMode = args.includes('--create');
  const joinMode = args.includes('--join');
  const postMode = args.includes('--post-message');
  const listMode = args.includes('--list');
  
  const nameIndex = args.indexOf('--name');
  const name = nameIndex !== -1 ? args[nameIndex + 1] : null;
  
  const descriptionIndex = args.indexOf('--description');
  const description = descriptionIndex !== -1 ? args[descriptionIndex + 1] : null;
  
  const joinCodeIndex = args.indexOf('--join-code');
  const join_code = joinCodeIndex !== -1 ? args[joinCodeIndex + 1] : null;
  
  const groupIdIndex = args.indexOf('--group-id');
  const group_id = groupIdIndex !== -1 ? args[groupIdIndex + 1] : null;
  
  const contentIndex = args.indexOf('--content');
  const content = contentIndex !== -1 ? args[contentIndex + 1] : null;
  
  const credentialIndex = args.indexOf('--credential');
  const credential_name = credentialIndex !== -1 ? args[credentialIndex + 1] : 'default';
  
  // 验证参数
  if (!createMode && !joinMode && !postMode && !listMode) {
    console.log('Usage:');
    console.log('  Create group:');
    console.log('    node scripts/manage_group.js --create --name "Meetup" --description "..." --credential <name>');
    console.log();
    console.log('  Join group:');
    console.log('    node scripts/manage_group.js --join --join-code 314159 --credential <name>');
    console.log();
    console.log('  Post message:');
    console.log('    node scripts/manage_group.js --post-message --group-id GID --content "Hello" --credential <name>');
    console.log();
    console.log('  List groups:');
    console.log('    node scripts/manage_group.js --list --credential <name>');
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
    
    if (createMode) {
      // 创建群组
      if (!name) {
        console.log('❌ Error: --name is required for creating a group.');
        process.exit(1);
      }
      
      console.log(`Creating group: ${name}`);
      if (description) {
        console.log(`Description: ${description}`);
      }
      console.log(`Credential: ${credential_name}`);
      console.log();
      
      const result = await sdk.create_group({ name, description });
      
      console.log('\n✅ Group created successfully!\n');
      console.log(`Group ID: ${result.group_id}`);
      console.log(`Group Name: ${result.name}`);
      console.log(`Join Code: ${result.join_code}`);
      console.log();
      
    } else if (joinMode) {
      // 加入群组
      if (!join_code) {
        console.log('❌ Error: --join-code is required.');
        process.exit(1);
      }
      
      console.log(`Joining group with code: ${join_code}`);
      console.log(`Credential: ${credential_name}`);
      console.log();
      
      const result = await sdk.join_group(join_code);
      
      console.log('\n✅ Joined group successfully!\n');
      console.log(`Group ID: ${result.group_id}`);
      console.log(`Group Name: ${result.name}`);
      console.log();
      
    } else if (postMode) {
      // 发送群消息
      if (!group_id || !content) {
        console.log('❌ Error: --group-id and --content are required.');
        process.exit(1);
      }
      
      console.log(`Posting message to group: ${group_id}`);
      console.log(`Content: ${content}`);
      console.log(`Credential: ${credential_name}`);
      console.log();
      
      const result = await sdk.post_group_message(group_id, content);
      
      console.log('\n✅ Message posted successfully!\n');
      console.log(`Message ID: ${result.id}`);
      console.log();
      
    } else if (listMode) {
      // 列出群组
      console.log('Listing your groups...\n');
      
      // TODO: 实现列出群组功能
      console.log('No groups found.');
      console.log();
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
