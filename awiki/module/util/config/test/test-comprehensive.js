/**
 * config 模块全面测试
 * 
 * 测试范围:
 * 1. SDKConfig 类 - 构造函数、默认值、不可变性
 * 2. 工具函数 - _default_credentials_dir, _default_data_dir
 * 3. 环境变量优先级测试
 * 4. 配置文件加载测试
 * 5. 边界测试 - 空配置、部分配置、无效配置
 * 6. 命名规范检查 - snake_case 验证
 * 7. Python 版本兼容性对比
 */

import {
  SDKConfig,
  SKILL_NAME,
  SKILL_DIR,
  _default_credentials_dir,
  _default_data_dir,
} from '../dist/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// 测试工具函数
// ============================================================================

let passed = 0;
let failed = 0;
const testResults = [];

function assert(condition, message, category = 'general') {
  if (condition) {
    console.log(`✓ ${message}`);
    passed++;
    testResults.push({ status: 'PASS', message, category });
  } else {
    console.error(`✗ ${message}`);
    failed++;
    testResults.push({ status: 'FAIL', message, category });
  }
}

function assertEqual(actual, expected, message, category = 'general') {
  if (actual === expected) {
    console.log(`✓ ${message}`);
    passed++;
    testResults.push({ status: 'PASS', message, category, actual, expected });
  } else {
    console.error(`✗ ${message}`);
    console.error(`  Expected: ${expected}`);
    console.error(`  Actual: ${actual}`);
    failed++;
    testResults.push({ status: 'FAIL', message, category, actual, expected });
  }
}

function assertStartsWith(actual, expected, message, category = 'general') {
  if (String(actual).startsWith(String(expected))) {
    console.log(`✓ ${message}`);
    passed++;
    testResults.push({ status: 'PASS', message, category });
  } else {
    console.error(`✗ ${message}`);
    console.error(`  Expected to start with: ${expected}`);
    console.error(`  Actual: ${actual}`);
    failed++;
    testResults.push({ status: 'FAIL', message, category });
  }
}

function assertEndsWith(actual, expected, message, category = 'general') {
  if (String(actual).endsWith(String(expected))) {
    console.log(`✓ ${message}`);
    passed++;
    testResults.push({ status: 'PASS', message, category });
  } else {
    console.error(`✗ ${message}`);
    console.error(`  Expected to end with: ${expected}`);
    console.error(`  Actual: ${actual}`);
    failed++;
    testResults.push({ status: 'FAIL', message, category });
  }
}

// 保存和恢复环境变量
function saveEnvVars(keys) {
  const saved = {};
  for (const key of keys) {
    saved[key] = process.env[key];
  }
  return saved;
}

function restoreEnvVars(saved) {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function clearEnvVars(keys) {
  for (const key of keys) {
    delete process.env[key];
  }
}

// ============================================================================
// 测试执行
// ============================================================================

console.log('=== config 模块全面测试 ===\n');

// 保存所有相关环境变量
const envKeys = [
  'E2E_USER_SERVICE_URL',
  'E2E_MOLT_MESSAGE_URL',
  'E2E_MOLT_MESSAGE_WS_URL',
  'E2E_DID_DOMAIN',
  'AWIKI_DATA_DIR',
  'AWIKI_WORKSPACE',
];
const originalEnv = saveEnvVars(envKeys);

// ============================================================================
// 第一部分：SDKConfig 类测试
// ============================================================================

console.log('=== 第一部分：SDKConfig 类测试 ===\n');

// TC001: 构造函数 - 默认值验证
console.log('TC001: 构造函数 - 默认值验证');
clearEnvVars(envKeys);
const config1 = new SDKConfig();
assertEqual(config1.user_service_url, 'https://awiki.ai', 'user_service_url 默认值', 'SDKConfig');
assertEqual(config1.molt_message_url, 'https://awiki.ai', 'molt_message_url 默认值', 'SDKConfig');
assertEqual(config1.molt_message_ws_url, null, 'molt_message_ws_url 默认值', 'SDKConfig');
assertEqual(config1.did_domain, 'awiki.ai', 'did_domain 默认值', 'SDKConfig');
console.log();

// TC002: 构造函数 - 属性不可变性 (frozen)
console.log('TC002: 构造函数 - 属性不可变性 (frozen)');
let frozenError = false;
try {
  config1.user_service_url = 'http://hacked.com';
} catch (e) {
  frozenError = true;
}
assert(frozenError, '配置对象不可修改 (frozen)', 'SDKConfig');

let frozenError2 = false;
try {
  config1.data_dir = '/hacked';
} catch (e) {
  frozenError2 = true;
}
assert(frozenError2, 'data_dir 属性不可修改', 'SDKConfig');
console.log();

// TC003: 构造函数 - 自定义参数
console.log('TC003: 构造函数 - 自定义参数');
clearEnvVars(envKeys);
const customConfig = new SDKConfig({
  user_service_url: 'https://custom.api.com',
  molt_message_url: 'https://custom.message.com',
  molt_message_ws_url: 'wss://custom.ws.com',
  did_domain: 'custom.ai',
  credentials_dir: '/custom/creds',
  data_dir: '/custom/data',
});
assertEqual(customConfig.user_service_url, 'https://custom.api.com', '自定义 user_service_url', 'SDKConfig');
assertEqual(customConfig.molt_message_url, 'https://custom.message.com', '自定义 molt_message_url', 'SDKConfig');
assertEqual(customConfig.molt_message_ws_url, 'wss://custom.ws.com', '自定义 molt_message_ws_url', 'SDKConfig');
assertEqual(customConfig.did_domain, 'custom.ai', '自定义 did_domain', 'SDKConfig');
assertEqual(customConfig.credentials_dir, '/custom/creds', '自定义 credentials_dir', 'SDKConfig');
assertEqual(customConfig.data_dir, '/custom/data', '自定义 data_dir', 'SDKConfig');
console.log();

// TC004: 构造函数 - 部分参数
console.log('TC004: 构造函数 - 部分参数');
clearEnvVars(envKeys);
const partialConfig = new SDKConfig({
  user_service_url: 'https://partial.com',
});
assertEqual(partialConfig.user_service_url, 'https://partial.com', '部分参数 - user_service_url', 'SDKConfig');
assertEqual(partialConfig.molt_message_url, 'https://awiki.ai', '部分参数 - molt_message_url 默认值', 'SDKConfig');
assertEqual(partialConfig.did_domain, 'awiki.ai', '部分参数 - did_domain 默认值', 'SDKConfig');
console.log();

// ============================================================================
// 第二部分：工具函数测试
// ============================================================================

console.log('=== 第二部分：工具函数测试 ===\n');

// TC005: _default_credentials_dir - 默认路径格式
console.log('TC005: _default_credentials_dir - 默认路径格式');
clearEnvVars(envKeys);
const credsDir = _default_credentials_dir();
assertEndsWith(credsDir, path.join('.openclaw', 'credentials', SKILL_NAME), '凭证目录路径格式', 'utils');
assert(credsDir.includes(os.homedir()), '凭证目录包含用户主目录', 'utils');
console.log(`  路径：${credsDir}\n`);

// TC006: _default_data_dir - AWIKI_DATA_DIR 优先级最高
console.log('TC006: _default_data_dir - AWIKI_DATA_DIR 优先级最高');
clearEnvVars(envKeys);
process.env.AWIKI_DATA_DIR = '/custom/data/path';
process.env.AWIKI_WORKSPACE = '/should/be/ignored';
const dataDir1 = _default_data_dir();
assertEqual(dataDir1, '/custom/data/path', 'AWIKI_DATA_DIR 优先级最高', 'utils');
console.log();

// TC007: _default_data_dir - AWIKI_WORKSPACE 次优先级
console.log('TC007: _default_data_dir - AWIKI_WORKSPACE 次优先级');
clearEnvVars(envKeys);
process.env.AWIKI_WORKSPACE = '/my/workspace';
const dataDir2 = _default_data_dir();
assertEqual(dataDir2, path.join('/my/workspace', 'data', SKILL_NAME), 'AWIKI_WORKSPACE 次优先级', 'utils');
console.log(`  路径：${dataDir2}\n`);

// TC008: _default_data_dir - 默认路径回退
console.log('TC008: _default_data_dir - 默认路径回退');
clearEnvVars(envKeys);
const dataDir3 = _default_data_dir();
assertEndsWith(dataDir3, path.join('.openclaw', 'workspace', 'data', SKILL_NAME), '默认路径回退', 'utils');
assert(dataDir3.includes(os.homedir()), '默认数据目录包含用户主目录', 'utils');
console.log(`  路径：${dataDir3}\n`);

// ============================================================================
// 第三部分：环境变量优先级测试
// ============================================================================

console.log('=== 第三部分：环境变量优先级测试 ===\n');

// TC009: 环境变量覆盖 - E2E_USER_SERVICE_URL
console.log('TC009: 环境变量覆盖 - E2E_USER_SERVICE_URL');
clearEnvVars(envKeys);
process.env.E2E_USER_SERVICE_URL = 'https://env.user.service.com';
const configEnv1 = new SDKConfig();
assertEqual(configEnv1.user_service_url, 'https://env.user.service.com', 'E2E_USER_SERVICE_URL 生效', 'env');
console.log();

// TC010: 环境变量覆盖 - E2E_MOLT_MESSAGE_URL
console.log('TC010: 环境变量覆盖 - E2E_MOLT_MESSAGE_URL');
clearEnvVars(envKeys);
process.env.E2E_MOLT_MESSAGE_URL = 'https://env.molt.message.com';
const configEnv2 = new SDKConfig();
assertEqual(configEnv2.molt_message_url, 'https://env.molt.message.com', 'E2E_MOLT_MESSAGE_URL 生效', 'env');
console.log();

// TC011: 环境变量覆盖 - E2E_MOLT_MESSAGE_WS_URL
console.log('TC011: 环境变量覆盖 - E2E_MOLT_MESSAGE_WS_URL');
clearEnvVars(envKeys);
process.env.E2E_MOLT_MESSAGE_WS_URL = 'wss://env.ws.com';
const configEnv3 = new SDKConfig();
assertEqual(configEnv3.molt_message_ws_url, 'wss://env.ws.com', 'E2E_MOLT_MESSAGE_WS_URL 生效', 'env');
console.log();

// TC012: 环境变量覆盖 - E2E_DID_DOMAIN
console.log('TC012: 环境变量覆盖 - E2E_DID_DOMAIN');
clearEnvVars(envKeys);
process.env.E2E_DID_DOMAIN = 'env.domain.com';
const configEnv4 = new SDKConfig();
assertEqual(configEnv4.did_domain, 'env.domain.com', 'E2E_DID_DOMAIN 生效', 'env');
console.log();

// TC013: 所有环境变量同时设置
console.log('TC013: 所有环境变量同时设置');
clearEnvVars(envKeys);
process.env.E2E_USER_SERVICE_URL = 'https://all.env.user.com';
process.env.E2E_MOLT_MESSAGE_URL = 'https://all.env.molt.com';
process.env.E2E_MOLT_MESSAGE_WS_URL = 'wss://all.env.ws.com';
process.env.E2E_DID_DOMAIN = 'all.env.domain.com';
const configEnv5 = new SDKConfig();
assertEqual(configEnv5.user_service_url, 'https://all.env.user.com', '所有环境变量 - user_service_url', 'env');
assertEqual(configEnv5.molt_message_url, 'https://all.env.molt.com', '所有环境变量 - molt_message_url', 'env');
assertEqual(configEnv5.molt_message_ws_url, 'wss://all.env.ws.com', '所有环境变量 - molt_message_ws_url', 'env');
assertEqual(configEnv5.did_domain, 'all.env.domain.com', '所有环境变量 - did_domain', 'env');
console.log();

// ============================================================================
// 第四部分：配置文件加载测试
// ============================================================================

console.log('=== 第四部分：配置文件加载测试 ===\n');

// 准备测试环境
const testBaseDir = path.join(os.tmpdir(), `awiki-config-test-${Date.now()}`);
const testSettingsDir = path.join(testBaseDir, 'config');
const testSettingsPath = path.join(testSettingsDir, 'settings.json');

fs.mkdirSync(testSettingsDir, { recursive: true });

const testConfig = {
  user_service_url: 'https://file.example.com',
  molt_message_url: 'https://message.file.example.com',
  molt_message_ws_url: 'wss://ws.file.example.com',
  did_domain: 'file.example.com',
};
fs.writeFileSync(testSettingsPath, JSON.stringify(testConfig, null, 2));

// TC014: SDKConfig.load() - 从 settings.json 加载
console.log('TC014: SDKConfig.load() - 从 settings.json 加载');
clearEnvVars(envKeys);
process.env.AWIKI_DATA_DIR = testBaseDir;
const configLoad1 = SDKConfig.load();
assertEqual(configLoad1.user_service_url, 'https://file.example.com', 'load() - user_service_url 来自文件', 'load');
assertEqual(configLoad1.molt_message_url, 'https://message.file.example.com', 'load() - molt_message_url 来自文件', 'load');
assertEqual(configLoad1.molt_message_ws_url, 'wss://ws.file.example.com', 'load() - molt_message_ws_url 来自文件', 'load');
assertEqual(configLoad1.did_domain, 'file.example.com', 'load() - did_domain 来自文件', 'load');
console.log();

// TC015: SDKConfig.load() - 环境变量覆盖 settings.json
console.log('TC015: SDKConfig.load() - 环境变量覆盖 settings.json');
process.env.E2E_USER_SERVICE_URL = 'https://env.override.com';
process.env.E2E_DID_DOMAIN = 'env.override.com';
const configLoad2 = SDKConfig.load();
assertEqual(configLoad2.user_service_url, 'https://env.override.com', 'load() - 环境变量覆盖 user_service_url', 'load');
assertEqual(configLoad2.molt_message_url, 'https://message.file.example.com', 'load() - molt_message_url 来自文件', 'load');
assertEqual(configLoad2.did_domain, 'env.override.com', 'load() - 环境变量覆盖 did_domain', 'load');
console.log();

// TC016: SDKConfig.load() - settings.json 不存在时使用默认值
console.log('TC016: SDKConfig.load() - settings.json 不存在时使用默认值');
const emptyTestDir = path.join(os.tmpdir(), `awiki-config-empty-${Date.now()}`);
fs.mkdirSync(emptyTestDir, { recursive: true });
clearEnvVars(envKeys);
process.env.AWIKI_DATA_DIR = emptyTestDir;
const configLoad3 = SDKConfig.load();
assertEqual(configLoad3.user_service_url, 'https://awiki.ai', 'load() - user_service_url 默认值', 'load');
assertEqual(configLoad3.molt_message_url, 'https://awiki.ai', 'load() - molt_message_url 默认值', 'load');
assertEqual(configLoad3.molt_message_ws_url, null, 'load() - molt_message_ws_url 默认值 null', 'load');
assertEqual(configLoad3.did_domain, 'awiki.ai', 'load() - did_domain 默认值', 'load');
fs.rmSync(emptyTestDir, { recursive: true, force: true });
console.log();

// TC017: SDKConfig.load() - 优先级验证 (环境变量 > settings.json > 默认值)
console.log('TC017: SDKConfig.load() - 优先级验证');
clearEnvVars(envKeys);
process.env.AWIKI_DATA_DIR = testBaseDir;
process.env.E2E_USER_SERVICE_URL = 'https://priority.env.com';
// molt_message_url 不设置环境变量，应该从文件读取
// did_domain 不设置环境变量，应该从文件读取
const configLoad4 = SDKConfig.load();
assertEqual(configLoad4.user_service_url, 'https://priority.env.com', '优先级 - 环境变量优先', 'load');
assertEqual(configLoad4.molt_message_url, 'https://message.file.example.com', '优先级 - 文件次之', 'load');
assertEqual(configLoad4.did_domain, 'file.example.com', '优先级 - 文件次之', 'load');
console.log();

// 清理测试文件
fs.rmSync(testBaseDir, { recursive: true, force: true });

// ============================================================================
// 第五部分：边界测试
// ============================================================================

console.log('=== 第五部分：边界测试 ===\n');

// TC018: 空配置对象
console.log('TC018: 空配置对象');
clearEnvVars(envKeys);
const emptyConfig = new SDKConfig({});
assertEqual(emptyConfig.user_service_url, 'https://awiki.ai', '空配置 - user_service_url 默认值', 'boundary');
assertEqual(emptyConfig.did_domain, 'awiki.ai', '空配置 - did_domain 默认值', 'boundary');
console.log();

// TC019: 部分配置 - 只设置一个字段
console.log('TC019: 部分配置 - 只设置一个字段');
clearEnvVars(envKeys);
const singleFieldConfig = new SDKConfig({ did_domain: 'single.com' });
assertEqual(singleFieldConfig.did_domain, 'single.com', '部分配置 - did_domain', 'boundary');
assertEqual(singleFieldConfig.user_service_url, 'https://awiki.ai', '部分配置 - user_service_url 默认值', 'boundary');
console.log();

// TC020: 空字符串值处理
console.log('TC020: 空字符串值处理');
clearEnvVars(envKeys);
const emptyStringConfig = new SDKConfig({ user_service_url: '' });
assertEqual(emptyStringConfig.user_service_url, '', '空字符串值被接受', 'boundary');
console.log();

// TC021: null 值处理 (molt_message_ws_url)
console.log('TC021: null 值处理 (molt_message_ws_url)');
clearEnvVars(envKeys);
const nullConfig = new SDKConfig({ molt_message_ws_url: null });
assertEqual(nullConfig.molt_message_ws_url, null, 'null 值被接受', 'boundary');
console.log();

// TC022: 特殊字符 URL
console.log('TC022: 特殊字符 URL');
clearEnvVars(envKeys);
const specialCharConfig = new SDKConfig({
  user_service_url: 'https://api.example.com:8080/v1/user-service?token=abc',
});
assertEqual(
  specialCharConfig.user_service_url,
  'https://api.example.com:8080/v1/user-service?token=abc',
  '特殊字符 URL 被正确保存',
  'boundary'
);
console.log();

// TC023: 长路径处理
console.log('TC023: 长路径处理');
clearEnvVars(envKeys);
const longPath = path.join(os.homedir(), 'very', 'long', 'path', 'to', 'credentials', 'directory');
const longPathConfig = new SDKConfig({ credentials_dir: longPath });
assertEqual(longPathConfig.credentials_dir, longPath, '长路径被正确保存', 'boundary');
console.log();

// ============================================================================
// 第六部分：命名规范检查
// ============================================================================

console.log('=== 第六部分：命名规范检查 ===\n');

// TC024: 检查所有属性名使用 snake_case
console.log('TC024: 检查所有属性名使用 snake_case');
const configProps = Object.keys(new SDKConfig());
const snakeCaseRegex = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
let allSnakeCase = true;
const nonSnakeCaseProps = [];

for (const prop of configProps) {
  if (!snakeCaseRegex.test(prop)) {
    allSnakeCase = false;
    nonSnakeCaseProps.push(prop);
  }
}

assert(allSnakeCase, `所有属性名使用 snake_case: ${configProps.join(', ')}`, 'naming');
if (!allSnakeCase) {
  console.error(`  非 snake_case 属性：${nonSnakeCaseProps.join(', ')}`);
}
console.log();

// TC025: 检查没有 camelCase 命名
console.log('TC025: 检查没有 camelCase 命名');
const camelCaseRegex = /[a-z][A-Z]/;
let noCamelCase = true;
const camelCaseProps = [];

for (const prop of configProps) {
  if (camelCaseRegex.test(prop)) {
    noCamelCase = false;
    camelCaseProps.push(prop);
  }
}

assert(noCamelCase, `没有使用 camelCase 命名`, 'naming');
if (!noCamelCase) {
  console.error(`  camelCase 属性：${camelCaseProps.join(', ')}`);
}
console.log();

// TC026: 检查方法名使用 snake_case
console.log('TC026: 检查方法名使用 snake_case');
const methods = ['load'];
let allMethodsSnakeCase = true;
const nonSnakeCaseMethods = [];

for (const method of methods) {
  if (!snakeCaseRegex.test(method)) {
    allMethodsSnakeCase = false;
    nonSnakeCaseMethods.push(method);
  }
}

assert(allMethodsSnakeCase, `所有方法名使用 snake_case: ${methods.join(', ')}`, 'naming');
console.log();

// TC027: 检查常量使用 UPPER_CASE
console.log('TC027: 检查常量使用 UPPER_CASE');
const upperCaseRegex = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;
const constants = ['SKILL_NAME', 'SKILL_DIR'];
let allConstantsUpperCase = true;
const nonUpperCaseConstants = [];

for (const constant of constants) {
  if (!upperCaseRegex.test(constant)) {
    allConstantsUpperCase = false;
    nonUpperCaseConstants.push(constant);
  }
}

assert(allConstantsUpperCase, `所有常量使用 UPPER_CASE: ${constants.join(', ')}`, 'naming');
console.log();

// TC028: 检查工具函数名使用 snake_case (私有函数以下划线开头)
console.log('TC028: 检查工具函数名使用 snake_case');
const utilFunctions = ['_default_credentials_dir', '_default_data_dir'];
let allUtilFunctionsSnakeCase = true;
const nonSnakeCaseFunctions = [];

// 私有函数以下划线开头，检查剩余部分
const privateFuncRegex = /^_[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
for (const func of utilFunctions) {
  if (!privateFuncRegex.test(func)) {
    allUtilFunctionsSnakeCase = false;
    nonSnakeCaseFunctions.push(func);
  }
}

assert(allUtilFunctionsSnakeCase, `所有工具函数名使用 snake_case: ${utilFunctions.join(', ')}`, 'naming');
console.log();

// ============================================================================
// 第七部分：Python 版本兼容性对比
// ============================================================================

console.log('=== 第七部分：Python 版本兼容性对比 ===\n');

// Python 版本的默认值:
// user_service_url: "https://awiki.ai"
// molt_message_url: "https://awiki.ai"
// molt_message_ws_url: None (from env only)
// did_domain: "awiki.ai"
// credentials_dir: ~/.openclaw/credentials/awiki-agent-id-message
// data_dir: 三级优先级 (AWIKI_DATA_DIR > AWIKI_WORKSPACE/data/... > ~/.openclaw/workspace/data/...)

// TC029: 默认值对比 - user_service_url
console.log('TC029: 默认值对比 - user_service_url');
clearEnvVars(envKeys);
const pyCompat1 = new SDKConfig();
assertEqual(pyCompat1.user_service_url, 'https://awiki.ai', '与 Python 版本一致 - user_service_url', 'py-compat');
console.log();

// TC030: 默认值对比 - molt_message_url
console.log('TC030: 默认值对比 - molt_message_url');
clearEnvVars(envKeys);
const pyCompat2 = new SDKConfig();
assertEqual(pyCompat2.molt_message_url, 'https://awiki.ai', '与 Python 版本一致 - molt_message_url', 'py-compat');
console.log();

// TC031: 默认值对比 - molt_message_ws_url
console.log('TC031: 默认值对比 - molt_message_ws_url');
clearEnvVars(envKeys);
const pyCompat3 = new SDKConfig();
assertEqual(pyCompat3.molt_message_ws_url, null, '与 Python 版本一致 - molt_message_ws_url (null)', 'py-compat');
console.log();

// TC032: 默认值对比 - did_domain
console.log('TC032: 默认值对比 - did_domain');
clearEnvVars(envKeys);
const pyCompat4 = new SDKConfig();
assertEqual(pyCompat4.did_domain, 'awiki.ai', '与 Python 版本一致 - did_domain', 'py-compat');
console.log();

// TC033: 凭证目录路径对比
console.log('TC033: 凭证目录路径对比');
clearEnvVars(envKeys);
const pyCompatCreds = _default_credentials_dir();
const expectedCredsPath = path.join(os.homedir(), '.openclaw', 'credentials', 'awiki-agent-id-message');
assertEqual(pyCompatCreds, expectedCredsPath, '与 Python 版本一致 - credentials_dir', 'py-compat');
console.log();

// TC034: 数据目录优先级对比 - AWIKI_DATA_DIR
console.log('TC034: 数据目录优先级对比 - AWIKI_DATA_DIR');
clearEnvVars(envKeys);
process.env.AWIKI_DATA_DIR = '/test/data/dir';
const pyCompatData1 = _default_data_dir();
assertEqual(pyCompatData1, '/test/data/dir', '与 Python 版本一致 - AWIKI_DATA_DIR 优先级', 'py-compat');
console.log();

// TC035: 数据目录优先级对比 - AWIKI_WORKSPACE
console.log('TC035: 数据目录优先级对比 - AWIKI_WORKSPACE');
clearEnvVars(envKeys);
process.env.AWIKI_WORKSPACE = '/test/workspace';
const pyCompatData2 = _default_data_dir();
const expectedWorkspacePath = path.join('/test/workspace', 'data', 'awiki-agent-id-message');
assertEqual(pyCompatData2, expectedWorkspacePath, '与 Python 版本一致 - AWIKI_WORKSPACE 优先级', 'py-compat');
console.log();

// TC036: 数据目录优先级对比 - 默认回退
console.log('TC036: 数据目录优先级对比 - 默认回退');
clearEnvVars(envKeys);
const pyCompatData3 = _default_data_dir();
const expectedDefaultPath = path.join(os.homedir(), '.openclaw', 'workspace', 'data', 'awiki-agent-id-message');
assertEqual(pyCompatData3, expectedDefaultPath, '与 Python 版本一致 - 默认回退', 'py-compat');
console.log();

// TC037: 环境变量优先级对比
console.log('TC037: 环境变量优先级对比');
clearEnvVars(envKeys);
process.env.E2E_USER_SERVICE_URL = 'https://env.priority.com';
process.env.E2E_DID_DOMAIN = 'env.priority.com';
const pyCompatEnv = new SDKConfig();
assertEqual(pyCompatEnv.user_service_url, 'https://env.priority.com', '与 Python 版本一致 - 环境变量优先级', 'py-compat');
assertEqual(pyCompatEnv.did_domain, 'env.priority.com', '与 Python 版本一致 - 环境变量优先级', 'py-compat');
console.log();

// TC038: load() 方法行为对比
console.log('TC038: load() 方法行为对比');
const testLoadDir = path.join(os.tmpdir(), `awiki-py-compat-${Date.now()}`);
const testLoadConfigDir = path.join(testLoadDir, 'config');
const testLoadSettingsPath = path.join(testLoadConfigDir, 'settings.json');

fs.mkdirSync(testLoadConfigDir, { recursive: true });
fs.writeFileSync(
  testLoadSettingsPath,
  JSON.stringify({
    user_service_url: 'https://load.test.com',
    did_domain: 'load.test.com',
  }, null, 2)
);

clearEnvVars(envKeys);
process.env.AWIKI_DATA_DIR = testLoadDir;
const pyCompatLoad = SDKConfig.load();
assertEqual(pyCompatLoad.user_service_url, 'https://load.test.com', '与 Python 版本一致 - load() 从文件加载', 'py-compat');
assertEqual(pyCompatLoad.did_domain, 'load.test.com', '与 Python 版本一致 - load() 从文件加载', 'py-compat');

fs.rmSync(testLoadDir, { recursive: true, force: true });
console.log();

// ============================================================================
// 恢复环境变量
// ============================================================================

restoreEnvVars(originalEnv);

// ============================================================================
// 测试总结
// ============================================================================

console.log('=== 测试总结 ===');
console.log(`通过：${passed}`);
console.log(`失败：${failed}`);
console.log(`总计：${passed + failed}`);

if (failed > 0) {
  console.log('\n失败的测试:');
  testResults
    .filter((r) => r.status === 'FAIL')
    .forEach((r) => console.error(`  - ${r.message}`));
  process.exit(1);
}
