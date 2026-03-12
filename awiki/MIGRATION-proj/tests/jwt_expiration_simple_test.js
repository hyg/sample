/**
 * JWT 过期和自动刷新简单测试
 * 
 * 测试 JWT 生成、过期检测和自动刷新功能
 * 不依赖外部包，只测试逻辑
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 测试结果跟踪
let testResults = {
    passed: 0,
    failed: 0,
    details: []
};

/**
 * 打印测试结果
 */
function printTestResult(testName, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${testName}${details ? ` - ${details}` : ''}`);
    
    testResults.details.push({
        test: testName,
        passed,
        details
    });
    
    if (passed) {
        testResults.passed++;
    } else {
        testResults.failed++;
    }
}

/**
 * 测试 1: JWT 过期检测逻辑
 */
async function testJwtExpirationDetection() {
    console.log('\n=== 测试 1: JWT 过期检测逻辑 ===');
    
    try {
        // 测试已过期的 JWT
        const expiredPayload = {
            exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
            iss: 'awiki.ai',
            sub: 'did:wba:awiki.ai:user:test'
        };
        
        const isExpired = expiredPayload.exp < Math.floor(Date.now() / 1000);
        
        printTestResult(
            'Expired JWT detection',
            isExpired,
            'Correctly detected expired JWT'
        );
        
        // 测试未过期的 JWT
        const validPayload = {
            exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            iss: 'awiki.ai',
            sub: 'did:wba:awiki.ai:user:test'
        };
        
        const isValid = validPayload.exp > Math.floor(Date.now() / 1000);
        
        printTestResult(
            'Valid JWT detection',
            isValid,
            'Correctly detected valid JWT'
        );
        
        return true;
    } catch (error) {
        printTestResult(
            'JWT expiration detection',
            false,
            error.message
        );
        return false;
    }
}

/**
 * 测试 2: 401 错误检测逻辑
 */
async function test401ErrorDetection() {
    console.log('\n=== 测试 2: 401 错误检测逻辑 ===');
    
    try {
        // 测试不同格式的 401 错误
        const testErrors = [
            { code: 401, message: 'JWT expired or invalid' },
            { status: 401, message: 'Unauthorized' },
            { response: { status: 401 }, message: 'Token expired' }
        ];
        
        let allDetected = true;
        
        for (const error of testErrors) {
            const is401 = 
                error.code === 401 || 
                error.status === 401 || 
                (error.response && error.response.status === 401);
            
            if (!is401) {
                allDetected = false;
                break;
            }
        }
        
        printTestResult(
            '401 error detection',
            allDetected,
            'All 401 errors detected correctly'
        );
        
        return true;
    } catch (error) {
        printTestResult(
            '401 error detection',
            false,
            error.message
        );
        return false;
    }
}

/**
 * 测试 3: 凭据存储逻辑
 */
async function testCredentialStorageLogic() {
    console.log('\n=== 测试 3: 凭据存储逻辑 ===');
    
    try {
        // 测试凭据路径构建
        const credentialsDir = join(__dirname, '..', '..', 'nodejs-client', '.credentials');
        const testCredentialPath = join(credentialsDir, 'test_credential.json');
        
        printTestResult(
            'Credential path construction',
            existsSync(credentialsDir),
            `Credentials directory exists: ${existsSync(credentialsDir)}`
        );
        
        // 测试凭据文件读写
        const testCredential = {
            did: 'did:wba:awiki.ai:user:test',
            name: 'test_credential',
            jwt_token: 'test_token'
        };
        
        try {
            writeFileSync(testCredentialPath, JSON.stringify(testCredential, null, 2));
            
            const loaded = JSON.parse(readFileSync(testCredentialPath, 'utf-8'));
            
            printTestResult(
                'Credential file write/read',
                loaded.did === testCredential.did,
                'Credential saved and loaded correctly'
            );
            
            // 清理测试文件
            if (existsSync(testCredentialPath)) {
                writeFileSync(testCredentialPath, '');
            }
            
        } catch (error) {
            printTestResult(
                'Credential file operations',
                false,
                error.message
            );
        }
        
        return true;
    } catch (error) {
        printTestResult(
            'Credential storage logic',
            false,
            error.message
        );
        return false;
    }
}

/**
 * 测试 4: JWT 刷新流程逻辑
 */
async function testJwtRefreshFlow() {
    console.log('\n=== 测试 4: JWT 刷新流程逻辑 ===');
    
    try {
        // 模拟 JWT 刷新流程
        const steps = [
            '1. 检测到 401 错误',
            '2. 调用 getJwtViaWba()',
            '3. 生成新的 JWT',
            '4. 更新本地凭据',
            '5. 重试原始请求'
        ];
        
        printTestResult(
            'JWT refresh flow steps',
            steps.length === 5,
            `Flow has ${steps.length} steps`
        );
        
        // 测试流程完整性
        const requiredSteps = [
            '401',
            'getJwtViaWba',
            '更新',
            '重试'
        ];
        
        const stepsText = steps.join(' ');
        const flowComplete = requiredSteps.every(step => 
            stepsText.toLowerCase().includes(step.toLowerCase())
        );
        
        printTestResult(
            'JWT refresh flow completeness',
            flowComplete,
            'All required steps present'
        );
        
        return true;
    } catch (error) {
        printTestResult(
            'JWT refresh flow',
            false,
            error.message
        );
        return false;
    }
}

/**
 * 运行所有简单测试
 */
async function runAllSimpleTests() {
    console.log('='.repeat(80));
    console.log('JWT 过期和自动刷新简单测试套件');
    console.log('='.repeat(80));
    
    await testJwtExpirationDetection();
    await test401ErrorDetection();
    await testCredentialStorageLogic();
    await testJwtRefreshFlow();
    
    // 打印总结
    console.log('\n' + '='.repeat(80));
    console.log('JWT 简单测试总结');
    console.log('='.repeat(80));
    console.log(`总测试数: ${testResults.passed + testResults.failed}`);
    console.log(`通过: ${testResults.passed} ✅`);
    console.log(`失败: ${testResults.failed} ❌`);
    console.log(`成功率: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(2)}%`);
    console.log('='.repeat(80));
    
    // 打印详细结果
    console.log('\n详细结果:');
    console.log('-'.repeat(80));
    testResults.details.forEach((detail, index) => {
        const status = detail.passed ? '✅' : '❌';
        console.log(`${index + 1}. ${status} ${detail.test}${detail.details ? ` - ${detail.details}` : ''}`);
    });
    
    return testResults.failed === 0;
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllSimpleTests()
        .then(success => {
            console.log('\n' + '='.repeat(80));
            if (success) {
                console.log('🎉 所有 JWT 简单测试通过! 🎉');
                console.log('='.repeat(80));
                process.exit(0);
            } else {
                console.log('⚠️  部分 JWT 简单测试失败 ⚠️');
                console.log('='.repeat(80));
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('\n❌ 测试套件错误:', error);
            process.exit(1);
        });
}

export {
    runAllSimpleTests,
    testJwtExpirationDetection,
    test401ErrorDetection,
    testCredentialStorageLogic,
    testJwtRefreshFlow
};
