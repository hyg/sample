#!/usr/bin/env node
/**
 * 测试调试/正常模式切换
 */

import { createSDKConfig, getMode } from './nodejs-client/scripts/utils/config.js';

console.log('=== 模式切换测试 ===\n');

// 测试当前模式
console.log('当前模式:', getMode());

// 测试配置
const config = createSDKConfig();
console.log('\n配置信息:');
console.log('  模式:', config.mode);
console.log('  凭据目录:', config.credentials_dir);
console.log('  数据目录:', config.data_dir);

// 测试命令行参数模式
console.log('\n命令行参数模式测试:');
console.log('  使用 --debug 或 -d 切换到调试模式');
console.log('  使用 --normal 或 -n 切换到正常模式');

// 测试环境变量模式
console.log('\n环境变量模式测试:');
console.log('  设置 NODE_AWIKI_MODE=debug 切换到调试模式');
console.log('  设置 NODE_AWIKI_MODE=normal 切换到正常模式');
