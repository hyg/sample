/**
 * config 模块基础测试
 */

import { SDKConfig, _defaultCredentialsDir, _defaultDataDir, SKILL_NAME, SKILL_DIR } from './dist/index.js';
import * as path from 'path';

console.log('=== config 模块测试 ===\n');

// 测试 1: SKILL_NAME 常量
console.log('测试 1: SKILL_NAME 常量');
console.log(`  SKILL_NAME = "${SKILL_NAME}"`);
console.log(`  预期："awiki-agent-id-message"`);
console.log(`  结果：${SKILL_NAME === 'awiki-agent-id-message' ? '✓ 通过' : '✗ 失败'}\n`);

// 测试 2: SKILL_DIR 路径
console.log('测试 2: SKILL_DIR 路径');
console.log(`  SKILL_DIR = "${SKILL_DIR}"`);
console.log(`  应包含："module\\util\\config"\n`);

// 测试 3: _defaultCredentialsDir
console.log('测试 3: _defaultCredentialsDir()');
const credsDir = _defaultCredentialsDir();
console.log(`  返回：${credsDir}`);
console.log(`  包含 skill name: ${credsDir.includes(SKILL_NAME) ? '✓ 通过' : '✗ 失败'}\n`);

// 测试 4: _defaultDataDir (默认)
console.log('测试 4: _defaultDataDir() - 默认路径');
const dataDir = _defaultDataDir();
console.log(`  返回：${dataDir}`);
console.log(`  包含 skill name: ${dataDir.includes(SKILL_NAME) ? '✓ 通过' : '✗ 失败'}\n`);

// 测试 5: SDKConfig 默认值
console.log('测试 5: SDKConfig 默认值');
const defaultConfig = new SDKConfig();
console.log(`  userServiceUrl: ${defaultConfig.userServiceUrl}`);
console.log(`  moltMessageUrl: ${defaultConfig.moltMessageUrl}`);
console.log(`  moltMessageWsUrl: ${defaultConfig.moltMessageWsUrl}`);
console.log(`  didDomain: ${defaultConfig.didDomain}`);
console.log(`  默认值检查:`);
console.log(`    userServiceUrl === "https://awiki.ai": ${defaultConfig.userServiceUrl === 'https://awiki.ai' ? '✓' : '✗'}`);
console.log(`    moltMessageUrl === "https://awiki.ai": ${defaultConfig.moltMessageUrl === 'https://awiki.ai' ? '✓' : '✗'}`);
console.log(`    moltMessageWsUrl === null: ${defaultConfig.moltMessageWsUrl === null ? '✓' : '✗'}`);
console.log(`    didDomain === "awiki.ai": ${defaultConfig.didDomain === 'awiki.ai' ? '✓' : '✗'}\n`);

// 测试 6: SDKConfig 不可变性
console.log('测试 6: SDKConfig 不可变性 (frozen)');
try {
  // @ts-ignore - 故意测试修改冻结对象
  defaultConfig.didDomain = 'hacked.com';
  console.log('  结果：✗ 失败 (应该抛出错误)\n');
} catch (e) {
  console.log('  结果：✓ 通过 (无法修改冻结对象)\n');
}

// 测试 7: SDKConfig 自定义值
console.log('测试 7: SDKConfig 自定义值');
const customConfig = new SDKConfig({
  userServiceUrl: 'https://custom.example.com',
  didDomain: 'custom.ai',
});
console.log(`  userServiceUrl: ${customConfig.userServiceUrl}`);
console.log(`  didDomain: ${customConfig.didDomain}`);
console.log(`  自定义值检查:`);
console.log(`    userServiceUrl 正确：${customConfig.userServiceUrl === 'https://custom.example.com' ? '✓' : '✗'}`);
console.log(`    didDomain 正确：${customConfig.didDomain === 'custom.ai' ? '✓' : '✗'}\n`);

// 测试 8: SDKConfig.load() 方法
console.log('测试 8: SDKConfig.load() 静态方法');
try {
  const loadedConfig = SDKConfig.load();
  console.log(`  加载成功：✓ 通过`);
  console.log(`  dataDir: ${loadedConfig.dataDir}`);
  console.log(`  credentialsDir: ${loadedConfig.credentialsDir}\n`);
} catch (e) {
  console.log(`  加载失败：✗ 失败`);
  console.log(`  错误：${e}\n`);
}

console.log('=== 测试完成 ===');
