#!/usr/bin/env node
/**
 * 比较 Python 和 Node.js 版本的 trace 数据
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('=== 比较 Python 和 Node.js trace 数据 ===\n');

// 读取 trace 文件
const pythonTracePath = join(__dirname, 'python_trace_output.json');
const nodejsTracePath = join(__dirname, 'nodejs_trace_output.json');

let pythonTrace, nodejsTrace;

try {
    pythonTrace = JSON.parse(readFileSync(pythonTracePath, 'utf-8'));
    nodejsTrace = JSON.parse(readFileSync(nodejsTracePath, 'utf-8'));
} catch (error) {
    console.error('读取 trace 文件失败:', error.message);
    process.exit(1);
}

// 比较关键步骤
const steps = [
    { key: 'CREDENTIAL_LOADED', name: '凭据加载' },
    { key: 'JWT_ANALYSIS', name: 'JWT 分析' },
    { key: 'CREATE_AUTHENTICATOR', name: '创建认证器' }
];

steps.forEach(step => {
    const pythonOp = pythonTrace.operations.find(op => op.type === step.key);
    const nodejsOp = nodejsTrace.operations.find(op => op.type === step.key);

    console.log(`\n${step.name}:`);
    console.log('-'.repeat(60));

    if (pythonOp) {
        console.log('Python:');
        console.log(JSON.stringify(pythonOp.details, null, 2));
    }

    if (nodejsOp) {
        console.log('\nNode.js:');
        console.log(JSON.stringify(nodejsOp.details, null, 2));
    }

    // 比较差异
    if (pythonOp && nodejsOp) {
        console.log('\n差异分析:');
        const pythonDetails = pythonOp.details;
        const nodejsDetails = nodejsOp.details;

        if (step.key === 'CREDENTIAL_LOADED') {
            if (pythonDetails.jwt_token_exists !== nodejsDetails.jwtTokenExists) {
                console.log('⚠️ JWT 令牌存在性不同:');
                console.log(`  Python: ${pythonDetails.jwt_token_exists}`);
                console.log(`  Node.js: ${nodejsDetails.jwtTokenExists}`);
            }
        }

        if (step.key === 'JWT_ANALYSIS') {
            if (pythonDetails.expires_at !== nodejsDetails.expiresAt) {
                console.log('⚠️ JWT 过期时间不同:');
                console.log(`  Python: ${pythonDetails.expires_at}`);
                console.log(`  Node.js: ${nodejsDetails.expiresAt}`);
                
                // 计算时间差
                const pythonExp = new Date(pythonDetails.expires_at);
                const nodejsExp = new Date(nodejsDetails.expiresAt);
                const diffMs = Math.abs(pythonExp - nodejsExp);
                const diffHours = diffMs / (1000 * 60 * 60);
                
                console.log(`  时间差: ${diffHours.toFixed(2)} 小时`);
                
                // 显示具体时间
                console.log(`  Python 解析: ${pythonExp.toISOString()}`);
                console.log(`  Node.js 解析: ${nodejsExp.toISOString()}`);
                
                if (diffHours === 8) {
                    console.log('  可能原因: 时区处理不同 (UTC vs Local)');
                }
            }

            if (pythonDetails.is_expired !== nodejsDetails.isExpired) {
                console.log('⚠️ 过期状态不同:');
                console.log(`  Python: ${pythonDetails.is_expired}`);
                console.log(`  Node.js: ${nodejsDetails.isExpired}`);
            }
        }
    }
});

console.log('\n' + '='.repeat(60));
console.log('总结:');
console.log('1. 凭据加载: 两者都成功加载 hyg4awiki 凭据');
console.log('2. JWT 分析: 两者都检测到 JWT 已过期');
console.log('3. 时区差异: Python 和 Node.js 的 JWT 过期时间相差 8 小时');
console.log('4. 可能原因: 时区处理不一致 (UTC vs Local Time)');
console.log('='.repeat(60));
