#!/usr/bin/env node

/**
 * 修复 SDK 中的命名问题
 * 
 * 将 camelCase 改为 snake_case 以匹配 module 项目的导出
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sdkPath = join(__dirname, 'sdk.js');

// 读取文件
let content = readFileSync(sdkPath, 'utf-8');

// 替换映射
const replacements = {
  // auth 模块
  'createAuthenticatedIdentity': 'create_authenticated_identity',
  'registerDid': 'register_did',
  'getJwtViaWba': 'get_jwt_via_wba',
  
  // identity 模块
  'createIdentity': 'create_identity',
  'loadPrivateKey': 'load_private_key',
  
  // handle 模块
  'registerHandle': 'register_handle',
  'recoverHandle': 'recover_handle',
  'resolveHandle': 'resolve_handle',
  'sendOtp': 'send_otp',
  'lookupHandle': 'lookup_handle',
  
  // resolve 模块
  'resolveToDid': 'resolve_to_did',
  
  // logging_config 模块
  'configureLogging': 'configure_logging',
  'getLogDir': 'get_log_dir',
  
  // e2ee 模块方法
  'ensure_active_session': 'ensureActiveSession',  // 这个应该保持，因为 e2ee.ts 内部使用 snake_case
  'encrypt_message': 'encryptMessage',
  'decrypt_message': 'decryptMessage',
  
  // SDK 类的方法调用
  'this\\.clients\\.user': 'this.clients.user',
  'this\\.clients\\.message': 'this.clients.message',
};

// 执行替换
for (const [oldName, newName] of Object.entries(replacements)) {
  const regex = new RegExp(oldName, 'g');
  content = content.replace(regex, newName);
}

// 写回文件
writeFileSync(sdkPath, content, 'utf-8');

console.log('✅ 命名修复完成！');
console.log('已修复以下命名：');
Object.keys(replacements).forEach(name => {
  console.log(`  ${name} -> ${replacements[name]}`);
});
