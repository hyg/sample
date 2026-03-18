#!/usr/bin/env node

/**
 * 注册 Handle
 * 
 * 用法:
 *   步骤 1: 发送 OTP
 *     node scripts/register_handle.js --handle alice --phone +8613800138000 --credential alice
 *   
 *   步骤 2: 输入 OTP 完成注册
 *     node scripts/register_handle.js --handle alice --otp-code 123456 --credential alice
 */

import { AwikiSDK } from './utils/sdk.js';

async function main() {
  const args = process.argv.slice(2);
  
  // 解析参数
  const handleIndex = args.indexOf('--handle');
  const handle = handleIndex !== -1 ? args[handleIndex + 1] : null;
  
  const phoneIndex = args.indexOf('--phone');
  const phone = phoneIndex !== -1 ? args[phoneIndex + 1] : null;
  
  const otpCodeIndex = args.indexOf('--otp-code');
  const otp_code = otpCodeIndex !== -1 ? args[otpCodeIndex + 1] : null;
  
  const credentialIndex = args.indexOf('--credential');
  const credential_name = credentialIndex !== -1 ? args[credentialIndex + 1] : 'default';
  
  // 验证参数
  if (!handle) {
    console.log('Usage:');
    console.log('  Step 1: Send OTP');
    console.log('    node scripts/register_handle.js --handle <handle> --phone <phone> --credential <name>');
    console.log();
    console.log('  Step 2: Complete registration with OTP');
    console.log('    node scripts/register_handle.js --handle <handle> --otp-code <code> --credential <name>');
    console.log();
    console.log('Options:');
    console.log('  --handle      Desired Handle name (required)');
    console.log('  --phone       Phone number in international format (e.g., +8613800138000)');
    console.log('  --otp-code    OTP code received via SMS');
    console.log('  --credential  Credential name (optional, default: "default")');
    console.log();
    console.log('Examples:');
    console.log('  node scripts/register_handle.js --handle alice --phone +8613800138000 --credential alice');
    console.log('  node scripts/register_handle.js --handle alice --otp-code 123456 --credential alice');
    process.exit(1);
  }
  
  try {
    // 创建 SDK 实例
    const sdk = new AwikiSDK(credential_name);
    await sdk.init();
    
    // 检查是否已有身份
    if (!sdk.identity) {
      console.log('❌ No identity found.');
      console.log('Please create an identity first:');
      console.log(`  node scripts/setup_identity.js --name "YourName" --credential ${credential_name}`);
      process.exit(1);
    }
    
    if (phone) {
      // 步骤 1: 发送 OTP
      console.log(`Registering Handle: @${handle}`);
      console.log(`Credential: ${credential_name}`);
      console.log(`Sending OTP to: ${phone}\n`);
      
      await sdk.send_otp(phone);
      
      console.log('✅ OTP sent successfully!');
      console.log();
      console.log('Next step:');
      console.log(`  node scripts/register_handle.js --handle ${handle} --otp-code <code> --credential ${credential_name}`);
      console.log();
    } else if (otp_code) {
      // 步骤 2: 完成注册
      console.log(`Completing Handle registration: @${handle}`);
      console.log(`Credential: ${credential_name}`);
      console.log(`Using OTP: ${otp_code}\n`);
      
      const identity = await sdk.register_handle(handle, '', otp_code);
      
      console.log('\n✅ Handle registered successfully!\n');
      console.log(`Handle: @${handle}`);
      console.log(`DID: ${identity.did}`);
      console.log(`Unique ID: ${identity.unique_id}`);
      console.log();
      console.log('Next steps:');
      console.log('  1. Send a message:');
      console.log(`     node scripts/send_message.js --to "@${handle}" --content "Hello!" --credential ${credential_name}`);
      console.log();
      console.log('  2. Check your inbox:');
      console.log(`     node scripts/check_inbox.js --credential ${credential_name}`);
      console.log();
    } else {
      console.log('Error: Either --phone or --otp-code must be provided.');
      console.log();
      console.log('Usage:');
      console.log('  Step 1: Send OTP');
      console.log('    node scripts/register_handle.js --handle alice --phone +8613800138000 --credential alice');
      console.log();
      console.log('  Step 2: Complete registration');
      console.log('    node scripts/register_handle.js --handle alice --otp-code 123456 --credential alice');
      process.exit(1);
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
