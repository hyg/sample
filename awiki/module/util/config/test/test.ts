/**
 * config 模块测试
 */

import { 
  SDKConfig, 
  SKILL_NAME, 
  SKILL_DIR,
  _defaultCredentialsDir,
  _defaultDataDir 
} from '../dist/index.js';
import * as path from 'path';
import * as os from 'os';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✓ ${message}`);
    passed++;
  } else {
    console.error(`✗ ${message}`);
    failed++;
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual === expected) {
    console.log(`✓ ${message}`);
    passed++;
  } else {
    console.error(`✗ ${message}`);
    console.error(`  Expected: ${expected}`);
    console.error(`  Actual: ${actual}`);
    failed++;
  }
}

console.log('=== config 模块测试 ===\n');

// TC001: 凭证目录解析 - 默认路径
console.log('TC001: 凭证目录解析 - 默认路径');
const credsDir = _defaultCredentialsDir();
assert(
  credsDir.endsWith(path.join('.openclaw', 'credentials', SKILL_NAME)),
  '凭证目录路径格式正确'
);
console.log(`  路径：${credsDir}\n`);

// TC002: 数据目录解析 - AWIKI_DATA_DIR 优先级最高
console.log('TC002: 数据目录解析 - AWIKI_DATA_DIR 优先级最高');
const originalDataDir = process.env.AWIKI_DATA_DIR;
const originalWorkspace = process.env.AWIKI_WORKSPACE;
process.env.AWIKI_DATA_DIR = '/custom/data/path';
process.env.AWIKI_WORKSPACE = '/should/be/ignored';
const dataDir1 = _defaultDataDir();
assertEqual(dataDir1, '/custom/data/path', 'AWIKI_DATA_DIR 优先级最高');
// 恢复环境
if (originalDataDir) process.env.AWIKI_DATA_DIR = originalDataDir;
else delete process.env.AWIKI_DATA_DIR;
if (originalWorkspace) process.env.AWIKI_WORKSPACE = originalWorkspace;
else delete process.env.AWIKI_WORKSPACE;
console.log();

// TC003: 数据目录解析 - AWIKI_WORKSPACE 次优先级
console.log('TC003: 数据目录解析 - AWIKI_WORKSPACE 次优先级');
delete process.env.AWIKI_DATA_DIR;
process.env.AWIKI_WORKSPACE = '/my/workspace';
const dataDir2 = _defaultDataDir();
assert(
  dataDir2 === path.join('/my/workspace', 'data', SKILL_NAME),
  'AWIKI_WORKSPACE 次优先级正确'
);
console.log(`  路径：${dataDir2}\n`);
// 恢复环境
if (originalWorkspace) process.env.AWIKI_WORKSPACE = originalWorkspace;
else delete process.env.AWIKI_WORKSPACE;

// TC004: 数据目录解析 - 默认路径回退
console.log('TC004: 数据目录解析 - 默认路径回退');
delete process.env.AWIKI_DATA_DIR;
delete process.env.AWIKI_WORKSPACE;
const dataDir3 = _defaultDataDir();
assert(
  dataDir3.endsWith(path.join('.openclaw', 'workspace', 'data', SKILL_NAME)),
  '默认路径回退正确'
);
console.log(`  路径：${dataDir3}\n`);

// TC005: SDK 配置 - 默认值
console.log('TC005: SDK 配置 - 默认值');
delete process.env.E2E_USER_SERVICE_URL;
delete process.env.E2E_MOLT_MESSAGE_URL;
delete process.env.E2E_MOLT_MESSAGE_WS_URL;
delete process.env.E2E_DID_DOMAIN;
const config1 = new SDKConfig();
assertEqual(config1.user_service_url, 'https://awiki.ai', 'user_service_url 默认值');
assertEqual(config1.molt_message_url, 'https://awiki.ai', 'molt_message_url 默认值');
assertEqual(config1.molt_message_ws_url, null, 'molt_message_ws_url 默认值');
assertEqual(config1.did_domain, 'awiki.ai', 'did_domain 默认值');
console.log();

// TC006: SDK 配置 - 不可变性
console.log('TC006: SDK 配置 - 不可变性');
let frozenError = false;
try {
  (config1 as any).user_service_url = 'http://hacked.com';
} catch (e) {
  frozenError = true;
}
assert(frozenError, '配置对象不可修改 (frozen)');
console.log();

// TC007: SDK 配置 - 自定义值
console.log('TC007: SDK 配置 - 自定义值');
const config2 = new SDKConfig({
  user_service_url: 'https://custom.api.com',
  did_domain: 'custom.ai',
});
assertEqual(config2.user_service_url, 'https://custom.api.com', '自定义 user_service_url');
assertEqual(config2.did_domain, 'custom.ai', '自定义 did_domain');
console.log();

// TC008: SDK 配置 - 环境变量覆盖
console.log('TC008: SDK 配置 - 环境变量覆盖');
process.env.E2E_USER_SERVICE_URL = 'https://env.example.com';
process.env.E2E_DID_DOMAIN = 'env.domain.com';
const config3 = new SDKConfig();
assertEqual(config3.user_service_url, 'https://env.example.com', '环境变量覆盖 user_service_url');
assertEqual(config3.did_domain, 'env.domain.com', '环境变量覆盖 did_domain');
// 恢复环境
delete process.env.E2E_USER_SERVICE_URL;
delete process.env.E2E_DID_DOMAIN;
console.log();

// TC009: 常量导出
console.log('TC009: 常量导出');
assertEqual(SKILL_NAME, 'awiki-agent-id-message', 'SKILL_NAME 常量');
// SKILL_DIR 是 config.ts 向上两级 (module/util/config -> module/util)
assert(SKILL_DIR.endsWith(path.join('module', 'util')), 'SKILL_DIR 常量 (向上两级)');
console.log();

// 总结
console.log('=== 测试总结 ===');
console.log(`通过：${passed}`);
console.log(`失败：${failed}`);

if (failed > 0) {
  process.exit(1);
}
