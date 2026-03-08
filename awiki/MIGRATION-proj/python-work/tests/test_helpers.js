#!/usr/bin/env node

/**
 * Node.js 测试辅助脚本
 * 
 * 用于快速执行常见测试任务
 */

import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 测试日志文件
const TEST_LOG_DIR = join(__dirname, '..', 'outputs');
const TEST_LOG_FILE = join(TEST_LOG_DIR, `test_log_${new Date().toISOString().slice(0,10)}.md`);

/**
 * 记录测试结果
 */
function logTest(testId, testName, result, details = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = `
## ${testId}: ${testName}

**时间**: ${timestamp}
**结果**: ${result ? '✅ 通过' : '❌ 失败'}

**详情**:
\`\`\`json
${JSON.stringify(details, null, 2)}
\`\`\`

---
`;

    appendFileSync(TEST_LOG_FILE, logEntry, 'utf-8');
    console.log(`[${testId}] ${testName}: ${result ? '✅ 通过' : '❌ 失败'}`);
}

/**
 * 验证 DID 格式
 */
function validateDidFormat(did) {
    const pattern = /^did:wba:([^:]+):([^:]+):k1_([A-Za-z0-9_-]{43})$/;
    const match = did.match(pattern);
    
    if (!match) {
        return { valid: false, error: 'DID 格式不正确' };
    }
    
    const [, domain, path, fingerprint] = match;
    
    // 验证 fingerprint 长度（应该是 43 字符的 base64url）
    if (fingerprint.length !== 43) {
        return { valid: false, error: `Fingerprint 长度错误：${fingerprint.length} (应为 43)` };
    }
    
    return { 
        valid: true, 
        domain, 
        path, 
        fingerprint,
        uniqueId: `k1_${fingerprint}`
    };
}

/**
 * 验证 DID 文档结构
 */
function validateDidDocument(doc) {
    const errors = [];
    
    // 检查必需字段
    if (!doc.id) errors.push('缺少 id 字段');
    if (!doc['@context']) errors.push('缺少 @context 字段');
    if (!doc.verificationMethod) errors.push('缺少 verificationMethod 字段');
    if (!doc.authentication) errors.push('缺少 authentication 字段');
    if (!doc.proof) errors.push('缺少 proof 字段');
    
    // 检查 verificationMethod
    if (doc.verificationMethod) {
        for (const vm of doc.verificationMethod) {
            if (!vm.id) errors.push(`verificationMethod 缺少 id: ${JSON.stringify(vm)}`);
            if (!vm.type) errors.push(`verificationMethod 缺少 type: ${JSON.stringify(vm)}`);
            if (!vm.controller) errors.push(`verificationMethod 缺少 controller: ${JSON.stringify(vm)}`);
            
            // 检查是否有 key-1, key-2, key-3
            if (vm.id.endsWith('#key-1')) {
                if (!vm.publicKeyJwk) errors.push('key-1 缺少 publicKeyJwk');
            }
            if (vm.id.endsWith('#key-2')) {
                if (!vm.publicKeyJwk) errors.push('key-2 缺少 publicKeyJwk');
            }
            if (vm.id.endsWith('#key-3')) {
                if (!vm.publicKeyMultibase) errors.push('key-3 缺少 publicKeyMultibase');
            }
        }
    }
    
    // 检查 E2EE 密钥
    const hasKey2 = doc.verificationMethod?.some(vm => vm.id.endsWith('#key-2'));
    const hasKey3 = doc.verificationMethod?.some(vm => vm.id.endsWith('#key-3'));
    if (!hasKey2) errors.push('缺少 key-2 (E2EE 签名密钥)');
    if (!hasKey3) errors.push('缺少 key-3 (E2EE 协商密钥)');
    
    // 检查 keyAgreement
    if (!doc.keyAgreement) errors.push('缺少 keyAgreement 字段');
    
    // 检查 proof
    if (doc.proof) {
        if (!doc.proof.type) errors.push('proof 缺少 type');
        if (!doc.proof.proofValue) errors.push('proof 缺少 proofValue');
        if (!doc.proof.verificationMethod) errors.push('proof 缺少 verificationMethod');
        if (!doc.proof.proofPurpose) errors.push('proof 缺少 proofPurpose');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * 验证凭证文件结构
 */
function validateCredential(cred) {
    const errors = [];
    
    const requiredFields = [
        'did',
        'did_document',
        'private_key_pem',
        'public_key_pem',
        'user_id',
        'jwt_token',
        'e2ee_signing_private_pem',
        'e2ee_signing_public_pem',
        'e2ee_agreement_private_pem',
        'e2ee_agreement_public_pem'
    ];
    
    for (const field of requiredFields) {
        if (!(field in cred)) {
            errors.push(`缺少字段：${field}`);
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * 比较两个对象的差异
 */
function compareObjects(obj1, obj2, path = '') {
    const diffs = [];
    
    if (typeof obj1 !== typeof obj2) {
        diffs.push(`${path}: 类型不同 (${typeof obj1} vs ${typeof obj2})`);
        return diffs;
    }
    
    if (typeof obj1 === 'object' && obj1 !== null && obj2 !== null) {
        const keys1 = Object.keys(obj1).sort();
        const keys2 = Object.keys(obj2).sort();
        
        // 检查字段差异
        const allKeys = new Set([...keys1, ...keys2]);
        for (const key of allKeys) {
            const newPath = path ? `${path}.${key}` : key;
            if (!(key in obj1)) {
                diffs.push(`${newPath}: 仅在 obj2 中存在`);
            } else if (!(key in obj2)) {
                diffs.push(`${newPath}: 仅在 obj1 中存在`);
            } else {
                diffs.push(...compareObjects(obj1[key], obj2[key], newPath));
            }
        }
    } else if (obj1 !== obj2) {
        diffs.push(`${path}: 值不同 (${JSON.stringify(obj1)} vs ${JSON.stringify(obj2)})`);
    }
    
    return diffs;
}

/**
 * 生成测试报告
 */
function generateTestReport(tests) {
    const report = {
        timestamp: new Date().toISOString(),
        total: tests.length,
        passed: tests.filter(t => t.result).length,
        failed: tests.filter(t => !t.result).length,
        tests
    };
    
    report.passRate = (report.passed / report.total * 100).toFixed(2) + '%';
    
    return report;
}

// 导出函数
export {
    logTest,
    validateDidFormat,
    validateDidDocument,
    validateCredential,
    compareObjects,
    generateTestReport,
    TEST_LOG_FILE
};

// CLI 模式
if (process.argv[1]?.includes('test_helpers.js')) {
    console.log('Node.js 测试辅助工具');
    console.log('');
    console.log('可用命令:');
    console.log('  node test_helpers.js validate-did <did>');
    console.log('  node test_helpers.js validate-cred <credential_file>');
    console.log('');
    
    const command = process.argv[2];
    
    if (command === 'validate-did' && process.argv[3]) {
        const result = validateDidFormat(process.argv[3]);
        console.log('DID 验证结果:', result);
    }
    
    if (command === 'validate-cred' && process.argv[3]) {
        const cred = JSON.parse(readFileSync(process.argv[3], 'utf-8'));
        const result = validateCredential(cred);
        console.log('凭证验证结果:', result);
    }
}
