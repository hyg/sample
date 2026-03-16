/**
 * config 模块测试 - settings.json 加载 (隔离环境版本)
 *
 * 注意：此测试使用临时目录隔离环境，避免与全局配置冲突
 */

import { SDKConfig, _default_credentials_dir, _default_data_dir } from '../dist/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    passed++;
  } else {
    console.error(`✗ ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
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

console.log('=== config 模块测试 - settings.json 加载 (隔离环境) ===\n');

// 准备测试环境 - 使用完全隔离的临时目录
const testBaseDir = path.join(os.tmpdir(), `awiki-config-test-${Date.now()}`);
const testSettingsDir = path.join(testBaseDir, 'config');
const testSettingsPath = path.join(testSettingsDir, 'settings.json');

// 创建测试目录
fs.mkdirSync(testSettingsDir, { recursive: true });

// 创建测试配置文件
const testConfig = {
  user_service_url: 'https://file.example.com',
  molt_message_url: 'https://message.file.example.com',
  molt_message_ws_url: 'wss://ws.file.example.com',
  did_domain: 'file.example.com'
};
fs.writeFileSync(testSettingsPath, JSON.stringify(testConfig, null, 2));

// 保存原始环境变量
const originalDataDir = process.env.AWIKI_DATA_DIR;
const originalWorkspace = process.env.AWIKI_WORKSPACE;
const originalUserServiceUrl = process.env.E2E_USER_SERVICE_URL;
const originalMoltMessageUrl = process.env.E2E_MOLT_MESSAGE_URL;
const originalMoltMessageWsUrl = process.env.E2E_MOLT_MESSAGE_WS_URL;
const originalDidDomain = process.env.E2E_DID_DOMAIN;

try {
  // 清理环境变量
  delete process.env.E2E_USER_SERVICE_URL;
  delete process.env.E2E_MOLT_MESSAGE_URL;
  delete process.env.E2E_MOLT_MESSAGE_WS_URL;
  delete process.env.E2E_DID_DOMAIN;

  // TC010: 从 settings.json 加载配置
  console.log('TC010: 从 settings.json 加载配置');
  process.env.AWIKI_DATA_DIR = testBaseDir;
  const config1 = SDKConfig.load();
  assertEqual(config1.user_service_url, 'https://file.example.com', 'user_service_url 来自文件');
  assertEqual(config1.molt_message_url, 'https://message.file.example.com', 'molt_message_url 来自文件');
  assertEqual(config1.molt_message_ws_url, 'wss://ws.file.example.com', 'molt_message_ws_url 来自文件');
  assertEqual(config1.did_domain, 'file.example.com', 'did_domain 来自文件');
  console.log();

  // TC011: 环境变量覆盖 settings.json
  console.log('TC011: 环境变量覆盖 settings.json');
  process.env.E2E_USER_SERVICE_URL = 'https://env.example.com';
  process.env.E2E_DID_DOMAIN = 'env.example.com';
  const config2 = SDKConfig.load();
  assertEqual(config2.user_service_url, 'https://env.example.com', '环境变量覆盖 user_service_url');
  assertEqual(config2.molt_message_url, 'https://message.file.example.com', 'molt_message_url 来自文件');
  assertEqual(config2.did_domain, 'env.example.com', '环境变量覆盖 did_domain');
  console.log();

  // TC012: settings.json 不存在时使用默认值
  console.log('TC012: settings.json 不存在时使用默认值');
  // 使用隔离的临时目录作为 data dir
  const emptyTestDir = path.join(os.tmpdir(), `awiki-config-empty-${Date.now()}`);
  fs.mkdirSync(emptyTestDir, { recursive: true });
  process.env.AWIKI_DATA_DIR = emptyTestDir;
  delete process.env.E2E_USER_SERVICE_URL;
  delete process.env.E2E_MOLT_MESSAGE_URL;
  delete process.env.E2E_MOLT_MESSAGE_WS_URL;
  delete process.env.E2E_DID_DOMAIN;

  const config3 = SDKConfig.load();
  assertEqual(config3.user_service_url, 'https://awiki.ai', 'user_service_url 使用默认值');
  assertEqual(config3.molt_message_url, 'https://awiki.ai', 'molt_message_url 使用默认值');
  assertEqual(config3.molt_message_ws_url, null, 'molt_message_ws_url 使用默认值 null');
  assertEqual(config3.did_domain, 'awiki.ai', 'did_domain 使用默认值');

  // 清理空测试目录
  fs.rmSync(emptyTestDir, { recursive: true, force: true });
  console.log();

  // TC013: 优先级完整验证 - 环境变量 > settings.json > 默认值
  console.log('TC013: 优先级完整验证');
  // 重新创建 settings.json
  fs.writeFileSync(testSettingsPath, JSON.stringify(testConfig, null, 2));
  process.env.AWIKI_DATA_DIR = testBaseDir;
  process.env.E2E_USER_SERVICE_URL = 'https://env.com';
  // molt_message_url 不设置环境变量，应该从文件读取
  // did_domain 不设置环境变量，应该从文件读取

  const config4 = SDKConfig.load();
  assertEqual(config4.user_service_url, 'https://env.com', 'user_service_url 来自环境变量');
  assertEqual(config4.molt_message_url, 'https://message.file.example.com', 'molt_message_url 来自文件');
  assertEqual(config4.did_domain, 'file.example.com', 'did_domain 来自文件');
  console.log();

} finally {
  // 恢复环境变量
  if (originalDataDir) process.env.AWIKI_DATA_DIR = originalDataDir;
  else delete process.env.AWIKI_DATA_DIR;
  if (originalWorkspace) process.env.AWIKI_WORKSPACE = originalWorkspace;
  else delete process.env.AWIKI_WORKSPACE;
  if (originalUserServiceUrl) process.env.E2E_USER_SERVICE_URL = originalUserServiceUrl;
  else delete process.env.E2E_USER_SERVICE_URL;
  if (originalMoltMessageUrl) process.env.E2E_MOLT_MESSAGE_URL = originalMoltMessageUrl;
  else delete process.env.E2E_MOLT_MESSAGE_URL;
  if (originalMoltMessageWsUrl) process.env.E2E_MOLT_MESSAGE_WS_URL = originalMoltMessageWsUrl;
  else delete process.env.E2E_MOLT_MESSAGE_WS_URL;
  if (originalDidDomain) process.env.E2E_DID_DOMAIN = originalDidDomain;
  else delete process.env.E2E_DID_DOMAIN;

  // 清理测试文件
  fs.rmSync(testBaseDir, { recursive: true, force: true });
}

// 总结
console.log('=== 测试总结 ===');
console.log(`通过：${passed}`);
console.log(`失败：${failed}`);

if (failed > 0) {
  process.exit(1);
}
