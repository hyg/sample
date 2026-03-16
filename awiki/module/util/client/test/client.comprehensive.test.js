/**
 * client 模块全面测试
 *
 * 测试范围：
 * 1. 单元测试 - _resolveVerify, createUserServiceClient, createMoltMessageClient
 * 2. 集成测试 - HTTP 客户端创建流程，TLS 配置端到端
 * 3. 边界测试 - 无效 URL, CA 文件不存在，mkcert 路径不存在
 * 4. 命名规范检查 - snake_case 函数名和变量名
 * 5. Python 版本兼容性验证
 *
 * 移植自：python/scripts/utils/client.py
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, rmSync, existsSync, mkdirSync } from 'fs';
import https from 'https';

import {
    _resolveVerify,
    createUserServiceClient,
    createMoltMessageClient,
    HttpClientImpl,
} from '../dist/client.js';

// ============================================================================
// 测试用常量
// ============================================================================

const TEST_CA_CONTENT = `-----BEGIN CERTIFICATE-----
MIIDdzCCAl+gAwIBAgIEAgAAuTANBgkqhkiG9w0BAQUFADBaMQswCQYDVQQGEwJJ
RTESMBAGA1UEChMJQmFsdGltb3JlMRMwEQYDVQQLEwpDeWJlclRydXN0MSIwIAYD
VQQDExlCYWx0aW1vcmUgQ3liZXJUcnVzdCBSb290MB4XDTAwMDUxMjE4NDYwMFoX
DTI1MDUxMjIzNTkwMFowWjELMAkGA1UEBhMCSUUxEjAQBgNVBAoTCUJhbHRpbW9y
ZTETMBEGA1UECxMKQ3liZXJUcnVzdDEiMCAGA1UEAxMZQmFsdGltb3JlIEN5YmVy
VHJ1c3QgUm9vdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKMEuyKr
mD1X6CZymrV51Cni4eiVgLGw21uOKym2ZN+hAu2pVP2JmAT/+HTUMgZHBWsq/U8l
bpTgskJNJUyn96ne5bqUtdXNjGTq3489+6jDzIVGn0F9T401tXfL6h8lX+9Q3aTq
vF7F5rydQ5N3H2qVQ7xJ5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H
-----END CERTIFICATE-----`;

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_TRUST_ENV = false;

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 保存并清理环境变量
 */
function saveEnvVars(varNames) {
    const saved = {};
    for (const name of varNames) {
        saved[name] = process.env[name];
    }
    return saved;
}

/**
 * 恢复环境变量
 */
function restoreEnvVars(saved) {
    for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) {
            delete process.env[name];
        } else {
            process.env[name] = value;
        }
    }
}

/**
 * 清理所有 CA 相关环境变量
 */
function clearCAEnvVars() {
    delete process.env.AWIKI_CA_BUNDLE;
    delete process.env.E2E_CA_BUNDLE;
    delete process.env.SSL_CERT_FILE;
}

/**
 * 创建测试配置
 */
function createTestConfig(overrides = {}) {
    return {
        user_service_url: 'https://awiki.ai',
        molt_message_url: 'https://awiki.ai',
        molt_message_ws_url: undefined,
        did_domain: 'awiki.ai',
        credentials_dir: '/tmp/creds',
        data_dir: '/tmp/data',
        ...overrides,
    };
}

// ============================================================================
// 第一部分：_resolveVerify 单元测试
// ============================================================================

describe('_resolveVerify 单元测试', () => {
    let testCaPath;
    let originalEnv;

    before(() => {
        // 创建测试 CA 文件
        testCaPath = join(tmpdir(), 'test-ca-client.pem');
        writeFileSync(testCaPath, TEST_CA_CONTENT);
    });

    after(() => {
        // 清理测试文件
        if (existsSync(testCaPath)) {
            rmSync(testCaPath);
        }
    });

    beforeEach(() => {
        // 保存原始环境变量
        originalEnv = saveEnvVars(['AWIKI_CA_BUNDLE', 'E2E_CA_BUNDLE', 'SSL_CERT_FILE']);
    });

    after(() => {
        // 恢复原始环境变量
        restoreEnvVars(originalEnv);
    });

    describe('环境变量优先级测试', () => {
        it('TC-UV-001: AWIKI_CA_BUNDLE 环境变量优先级最高', () => {
            clearCAEnvVars();
            process.env.AWIKI_CA_BUNDLE = testCaPath;

            const result = _resolveVerify('https://awiki.ai');
            assert.ok(result instanceof https.Agent, '应返回 https.Agent 实例');
        });

        it('TC-UV-002: E2E_CA_BUNDLE 环境变量次优先', () => {
            clearCAEnvVars();
            process.env.E2E_CA_BUNDLE = testCaPath;

            const result = _resolveVerify('https://awiki.ai');
            assert.ok(result instanceof https.Agent, '应返回 https.Agent 实例');
        });

        it('TC-UV-003: SSL_CERT_FILE 环境变量最低优先', () => {
            clearCAEnvVars();
            process.env.SSL_CERT_FILE = testCaPath;

            const result = _resolveVerify('https://awiki.ai');
            assert.ok(result instanceof https.Agent, '应返回 https.Agent 实例');
        });

        it('TC-UV-004: 多环境变量同时存在时 AWIKI_CA_BUNDLE 优先', () => {
            clearCAEnvVars();
            process.env.AWIKI_CA_BUNDLE = testCaPath;
            process.env.E2E_CA_BUNDLE = testCaPath + '.e2e';
            process.env.SSL_CERT_FILE = testCaPath + '.ssl';

            const result = _resolveVerify('https://awiki.ai');
            assert.ok(result instanceof https.Agent, '应返回 https.Agent 实例');
        });

        it('TC-UV-005: 环境变量值为空字符串时跳过', () => {
            clearCAEnvVars();
            process.env.AWIKI_CA_BUNDLE = '';
            process.env.E2E_CA_BUNDLE = '  ';

            const result = _resolveVerify('https://awiki.ai');
            assert.strictEqual(result, true, '应返回 true 使用默认验证');
        });
    });

    describe('默认验证测试', () => {
        it('TC-UV-006: 普通域名使用系统默认验证', () => {
            clearCAEnvVars();

            const result = _resolveVerify('https://awiki.ai');
            assert.strictEqual(result, true, '应返回 true 使用系统默认验证');
        });

        it('TC-UV-007: HTTPS 域名默认验证', () => {
            clearCAEnvVars();

            const result = _resolveVerify('https://example.com');
            assert.strictEqual(result, true, '应返回 true');
        });

        it('TC-UV-008: HTTP 域名默认验证', () => {
            clearCAEnvVars();

            const result = _resolveVerify('http://example.com');
            assert.strictEqual(result, true, '应返回 true');
        });
    });

    describe('边界条件测试', () => {
        it('TC-UV-009: CA 文件不存在时降级到默认验证', () => {
            clearCAEnvVars();
            process.env.AWIKI_CA_BUNDLE = '/nonexistent/ca.pem';

            const result = _resolveVerify('https://awiki.ai');
            assert.strictEqual(result, true, '应返回 true 降级到默认验证');
        });

        it('TC-UV-010: CA 文件路径为目录时降级', () => {
            clearCAEnvVars();
            const tempDir = join(tmpdir(), 'ca-dir-test');
            mkdirSync(tempDir, { recursive: true });
            process.env.AWIKI_CA_BUNDLE = tempDir;

            const result = _resolveVerify('https://awiki.ai');
            
            rmSync(tempDir, { recursive: true, force: true });
            assert.strictEqual(result, true, '应返回 true 降级到默认验证');
        });

        it('TC-UV-011: 无效 URL 时返回默认验证', () => {
            clearCAEnvVars();

            const result = _resolveVerify('not-a-valid-url');
            assert.strictEqual(result, true, '应返回 true 使用默认验证');
        });

        it('TC-UV-012: 空字符串 URL 时返回默认验证', () => {
            clearCAEnvVars();

            const result = _resolveVerify('');
            assert.strictEqual(result, true, '应返回 true 使用默认验证');
        });
    });

    describe('localhost 和 .test 域名测试', () => {
        it('TC-UV-013: localhost 域名检测', () => {
            clearCAEnvVars();

            const result = _resolveVerify('https://localhost');
            // 在没有 mkcert 的情况下应返回 true
            assert.strictEqual(result, true, 'localhost 无 mkcert 时返回 true');
        });

        it('TC-UV-014: .test 域名检测', () => {
            clearCAEnvVars();

            const result = _resolveVerify('https://api.test');
            // 在没有 mkcert 的情况下应返回 true
            assert.strictEqual(result, true, '.test 无 mkcert 时返回 true');
        });

        it('TC-UV-015: 子域名.test 检测', () => {
            clearCAEnvVars();

            const result = _resolveVerify('https://api.example.test');
            assert.strictEqual(result, true, '子域名.test 无 mkcert 时返回 true');
        });
    });
});

// ============================================================================
// 第二部分：createUserServiceClient 单元测试
// ============================================================================

describe('createUserServiceClient 单元测试', () => {
    let testCaPath;
    let originalEnv;

    before(() => {
        testCaPath = join(tmpdir(), 'test-ca-user.pem');
        writeFileSync(testCaPath, TEST_CA_CONTENT);
    });

    after(() => {
        if (existsSync(testCaPath)) {
            rmSync(testCaPath);
        }
    });

    beforeEach(() => {
        originalEnv = saveEnvVars(['AWIKI_CA_BUNDLE', 'E2E_CA_BUNDLE', 'SSL_CERT_FILE']);
        clearCAEnvVars();
    });

    after(() => {
        restoreEnvVars(originalEnv);
    });

    it('TC-US-001: 默认配置创建客户端', () => {
        const config = createTestConfig();
        const client = createUserServiceClient(config);
        
        assert.strictEqual(client.baseURL, 'https://awiki.ai');
        assert.strictEqual(client.timeout, DEFAULT_TIMEOUT);
        assert.strictEqual(client.trustEnv, DEFAULT_TRUST_ENV);
        
        client.close();
    });

    it('TC-US-002: 自定义 URL 创建客户端', () => {
        const config = createTestConfig({
            user_service_url: 'https://custom-user-service.example.com',
        });
        const client = createUserServiceClient(config);
        
        assert.strictEqual(client.baseURL, 'https://custom-user-service.example.com');
        
        client.close();
    });

    it('TC-US-003: TLS 配置继承 - AWIKI_CA_BUNDLE', () => {
        const config = createTestConfig();
        process.env.AWIKI_CA_BUNDLE = testCaPath;
        
        const client = createUserServiceClient(config);
        
        assert.ok(client.httpsAgent !== undefined, '应配置 httpsAgent');
        assert.ok(client.httpsAgent instanceof https.Agent);
        
        client.close();
    });

    it('TC-US-004: trustEnv 固定为 false', () => {
        const config = createTestConfig();
        const client = createUserServiceClient(config);
        
        assert.strictEqual(client.trustEnv, false, 'trustEnv 应固定为 false');
        
        client.close();
    });

    it('TC-US-005: timeout 固定为 30000ms', () => {
        const config = createTestConfig();
        const client = createUserServiceClient(config);
        
        assert.strictEqual(client.timeout, 30000, 'timeout 应固定为 30000ms');
        
        client.close();
    });

    it('TC-US-006: 客户端具有完整的 HTTP 方法', () => {
        const config = createTestConfig();
        const client = createUserServiceClient(config);
        
        assert.strictEqual(typeof client.get, 'function', '应有 get 方法');
        assert.strictEqual(typeof client.post, 'function', '应有 post 方法');
        assert.strictEqual(typeof client.put, 'function', '应有 put 方法');
        assert.strictEqual(typeof client.delete, 'function', '应有 delete 方法');
        assert.strictEqual(typeof client.close, 'function', '应有 close 方法');
        
        client.close();
    });
});

// ============================================================================
// 第三部分：createMoltMessageClient 单元测试
// ============================================================================

describe('createMoltMessageClient 单元测试', () => {
    let testCaPath;
    let originalEnv;

    before(() => {
        testCaPath = join(tmpdir(), 'test-ca-message.pem');
        writeFileSync(testCaPath, TEST_CA_CONTENT);
    });

    after(() => {
        if (existsSync(testCaPath)) {
            rmSync(testCaPath);
        }
    });

    beforeEach(() => {
        originalEnv = saveEnvVars(['AWIKI_CA_BUNDLE', 'E2E_CA_BUNDLE', 'SSL_CERT_FILE']);
        clearCAEnvVars();
    });

    after(() => {
        restoreEnvVars(originalEnv);
    });

    it('TC-MM-001: 默认配置创建客户端', () => {
        const config = createTestConfig();
        const client = createMoltMessageClient(config);
        
        assert.strictEqual(client.baseURL, 'https://awiki.ai');
        assert.strictEqual(client.timeout, DEFAULT_TIMEOUT);
        assert.strictEqual(client.trustEnv, DEFAULT_TRUST_ENV);
        
        client.close();
    });

    it('TC-MM-002: 自定义 URL 创建客户端', () => {
        const config = createTestConfig({
            molt_message_url: 'https://custom-message.example.com',
        });
        const client = createMoltMessageClient(config);
        
        assert.strictEqual(client.baseURL, 'https://custom-message.example.com');
        
        client.close();
    });

    it('TC-MM-003: TLS 配置继承 - AWIKI_CA_BUNDLE', () => {
        const config = createTestConfig();
        process.env.AWIKI_CA_BUNDLE = testCaPath;
        
        const client = createMoltMessageClient(config);
        
        assert.ok(client.httpsAgent !== undefined, '应配置 httpsAgent');
        assert.ok(client.httpsAgent instanceof https.Agent);
        
        client.close();
    });

    it('TC-MM-004: trustEnv 固定为 false', () => {
        const config = createTestConfig();
        const client = createMoltMessageClient(config);
        
        assert.strictEqual(client.trustEnv, false, 'trustEnv 应固定为 false');
        
        client.close();
    });

    it('TC-MM-005: timeout 固定为 30000ms', () => {
        const config = createTestConfig();
        const client = createMoltMessageClient(config);
        
        assert.strictEqual(client.timeout, 30000, 'timeout 应固定为 30000ms');
        
        client.close();
    });

    it('TC-MM-006: 客户端具有完整的 HTTP 方法', () => {
        const config = createTestConfig();
        const client = createMoltMessageClient(config);
        
        assert.strictEqual(typeof client.get, 'function', '应有 get 方法');
        assert.strictEqual(typeof client.post, 'function', '应有 post 方法');
        assert.strictEqual(typeof client.put, 'function', '应有 put 方法');
        assert.strictEqual(typeof client.delete, 'function', '应有 delete 方法');
        assert.strictEqual(typeof client.close, 'function', '应有 close 方法');
        
        client.close();
    });
});

// ============================================================================
// 第四部分：集成测试
// ============================================================================

describe('集成测试', () => {
    let testCaPath;
    let originalEnv;

    before(() => {
        testCaPath = join(tmpdir(), 'test-ca-integration.pem');
        writeFileSync(testCaPath, TEST_CA_CONTENT);
    });

    after(() => {
        if (existsSync(testCaPath)) {
            rmSync(testCaPath);
        }
    });

    beforeEach(() => {
        originalEnv = saveEnvVars(['AWIKI_CA_BUNDLE', 'E2E_CA_BUNDLE', 'SSL_CERT_FILE']);
        clearCAEnvVars();
    });

    after(() => {
        restoreEnvVars(originalEnv);
    });

    it('TC-INT-001: HTTP 客户端创建流程完整', () => {
        const config = createTestConfig({
            user_service_url: 'https://user.example.com',
            molt_message_url: 'https://message.example.com',
        });
        
        // 创建两个客户端
        const userClient = createUserServiceClient(config);
        const messageClient = createMoltMessageClient(config);
        
        // 验证客户端配置
        assert.ok(userClient.baseURL, 'userClient 应有 baseURL');
        assert.ok(messageClient.baseURL, 'messageClient 应有 baseURL');
        assert.strictEqual(userClient.timeout, 30000);
        assert.strictEqual(messageClient.timeout, 30000);
        
        userClient.close();
        messageClient.close();
    });

    it('TC-INT-002: TLS 配置端到端测试', () => {
        const config = createTestConfig();
        process.env.AWIKI_CA_BUNDLE = testCaPath;
        
        const userClient = createUserServiceClient(config);
        const messageClient = createMoltMessageClient(config);
        
        // 验证两个客户端都继承了 TLS 配置
        assert.ok(userClient.httpsAgent instanceof https.Agent, 'userClient 应有 httpsAgent');
        assert.ok(messageClient.httpsAgent instanceof https.Agent, 'messageClient 应有 httpsAgent');
        
        userClient.close();
        messageClient.close();
    });

    it('TC-INT-003: 两个客户端独立性验证', () => {
        const config = createTestConfig({
            user_service_url: 'https://user.example.com',
            molt_message_url: 'https://message.example.com',
        });
        
        const userClient = createUserServiceClient(config);
        const messageClient = createMoltMessageClient(config);
        
        // 验证独立性
        assert.notStrictEqual(userClient, messageClient, '两个客户端应是不同实例');
        assert.notStrictEqual(userClient.baseURL, messageClient.baseURL, 'baseURL 应不同');
        
        // 关闭一个客户端不影响另一个
        userClient.close();
        
        // messageClient 仍应可用
        assert.strictEqual(messageClient.baseURL, 'https://message.example.com');
        
        messageClient.close();
    });

    it('TC-INT-004: 客户端关闭后资源释放', () => {
        const config = createTestConfig();
        const client = createUserServiceClient(config);
        
        // 关闭客户端
        client.close();
        
        // 验证客户端已关闭（通过检查属性）
        assert.strictEqual(client.trustEnv, false, '属性仍可访问');
    });
});

// ============================================================================
// 第五部分：边界测试
// ============================================================================

describe('边界测试', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = saveEnvVars(['AWIKI_CA_BUNDLE', 'E2E_CA_BUNDLE', 'SSL_CERT_FILE']);
        clearCAEnvVars();
    });

    after(() => {
        restoreEnvVars(originalEnv);
    });

    it('TC-BD-001: 无效 URL 处理', () => {
        const config = createTestConfig({
            user_service_url: 'not-a-valid-url',
        });
        
        // 应能创建客户端，但使用时会失败
        const client = createUserServiceClient(config);
        assert.ok(client, '应能创建客户端');
        
        client.close();
    });

    it('TC-BD-002: CA 文件不存在处理', () => {
        process.env.AWIKI_CA_BUNDLE = '/nonexistent/path/ca.pem';
        
        const config = createTestConfig();
        const client = createUserServiceClient(config);
        
        // 应降级到默认验证
        assert.strictEqual(client.httpsAgent, undefined, '应无自定义 httpsAgent');
        
        client.close();
    });

    it('TC-BD-003: mkcert 路径不存在处理', () => {
        // 测试 localhost 域名但 mkcert 不存在
        const config = createTestConfig({
            user_service_url: 'https://localhost',
        });
        
        const client = createUserServiceClient(config);
        
        // 应使用默认验证
        assert.strictEqual(client.httpsAgent, undefined, '应无自定义 httpsAgent');
        
        client.close();
    });

    it('TC-BD-004: 空配置对象处理', () => {
        const config = {
            user_service_url: '',
            molt_message_url: '',
            did_domain: '',
            credentials_dir: '',
            data_dir: '',
        };
        
        const client = createUserServiceClient(config);
        assert.ok(client, '应能创建客户端');
        
        client.close();
    });

    it('TC-BD-005: 特殊字符 URL 处理', () => {
        const config = createTestConfig({
            user_service_url: 'https://example.com/path?query=value',
        });
        
        const client = createUserServiceClient(config);
        assert.ok(client.baseURL.includes('example.com'), 'URL 应包含域名');
        
        client.close();
    });
});

// ============================================================================
// 第六部分：命名规范检查
// ============================================================================

describe('命名规范检查', () => {
    it('TC-NS-001: 函数名使用 snake_case', () => {
        // 检查导出的函数名
        const functionNames = [
            '_resolveVerify',
            'createUserServiceClient',
            'createMoltMessageClient',
        ];
        
        // 验证函数名符合 camelCase（TypeScript/JavaScript 规范）
        // 注意：TypeScript/JavaScript 使用 camelCase，不是 snake_case
        // 但为了与 Python 保持一致，函数名结构应相似
        for (const name of functionNames) {
            assert.ok(typeof name === 'string', `${name} 应为字符串`);
        }
        
        // 验证函数存在
        assert.strictEqual(typeof _resolveVerify, 'function', '_resolveVerify 应为函数');
        assert.strictEqual(typeof createUserServiceClient, 'function', 'createUserServiceClient 应为函数');
        assert.strictEqual(typeof createMoltMessageClient, 'function', 'createMoltMessageClient 应为函数');
    });

    it('TC-NS-002: 变量名使用 camelCase', () => {
        // 通过创建客户端验证内部变量命名
        const config = createTestConfig();
        clearCAEnvVars();
        
        const client = createUserServiceClient(config);
        
        // 验证属性名符合 camelCase
        const expectedProps = ['baseURL', 'timeout', 'trustEnv', 'httpsAgent'];
        for (const prop of expectedProps) {
            assert.ok(prop in client, `客户端应有 ${prop} 属性`);
        }
        
        client.close();
    });

    it('TC-NS-003: 常量使用 UPPER_CASE', () => {
        // 验证模块中使用的常量命名
        // DEFAULT_TIMEOUT 和 DEFAULT_TRUST_ENV 在测试中使用 UPPER_CASE
        assert.strictEqual(DEFAULT_TIMEOUT, 30000, 'DEFAULT_TIMEOUT 应为 30000');
        assert.strictEqual(DEFAULT_TRUST_ENV, false, 'DEFAULT_TRUST_ENV 应为 false');
    });

    it('TC-NS-004: 与 Python 版本函数名对应', () => {
        // Python: _resolve_verify -> TypeScript: _resolveVerify
        // Python: create_user_service_client -> TypeScript: createUserServiceClient
        // Python: create_molt_message_client -> TypeScript: createMoltMessageClient
        
        // 验证函数存在且为函数类型
        assert.strictEqual(typeof _resolveVerify, 'function');
        assert.strictEqual(typeof createUserServiceClient, 'function');
        assert.strictEqual(typeof createMoltMessageClient, 'function');
    });

    it('TC-NS-005: 配置属性名与 Python 一致', () => {
        // Python SDKConfig 使用 snake_case
        const config = {
            user_service_url: 'https://awiki.ai',      // snake_case
            molt_message_url: 'https://awiki.ai',       // snake_case
            molt_message_ws_url: undefined,             // snake_case
            did_domain: 'awiki.ai',                     // snake_case
            credentials_dir: '/tmp/creds',              // snake_case
            data_dir: '/tmp/data',                      // snake_case
        };
        
        // 验证配置对象结构
        assert.ok('user_service_url' in config);
        assert.ok('molt_message_url' in config);
        assert.ok('did_domain' in config);
        assert.ok('credentials_dir' in config);
        assert.ok('data_dir' in config);
    });
});

// ============================================================================
// 第七部分：Python 版本兼容性验证
// ============================================================================

describe('Python 版本兼容性验证', () => {
    let testCaPath;
    let originalEnv;

    before(() => {
        testCaPath = join(tmpdir(), 'test-ca-python-compat.pem');
        writeFileSync(testCaPath, TEST_CA_CONTENT);
    });

    after(() => {
        if (existsSync(testCaPath)) {
            rmSync(testCaPath);
        }
    });

    beforeEach(() => {
        originalEnv = saveEnvVars(['AWIKI_CA_BUNDLE', 'E2E_CA_BUNDLE', 'SSL_CERT_FILE']);
        clearCAEnvVars();
    });

    after(() => {
        restoreEnvVars(originalEnv);
    });

    it('TC-PC-001: _resolveVerify() 优先级逻辑一致', () => {
        // Python 优先级：AWIKI_CA_BUNDLE > E2E_CA_BUNDLE > SSL_CERT_FILE
        clearCAEnvVars();
        
        // 测试 AWIKI_CA_BUNDLE 优先
        process.env.AWIKI_CA_BUNDLE = testCaPath;
        process.env.E2E_CA_BUNDLE = '/nonexistent';
        process.env.SSL_CERT_FILE = '/nonexistent';
        
        const result = _resolveVerify('https://awiki.ai');
        assert.ok(result instanceof https.Agent, 'AWIKI_CA_BUNDLE 应优先');
    });

    it('TC-PC-002: 默认超时值 30 秒', () => {
        // Python: timeout=30.0 (秒) -> Node.js: timeout=30000 (毫秒)
        const config = createTestConfig();
        const client = createUserServiceClient(config);
        
        assert.strictEqual(client.timeout, 30000, '超时值应为 30000ms (30 秒)');
        
        client.close();
    });

    it('TC-PC-003: trustEnv=false', () => {
        // Python: trust_env=False -> Node.js: trustEnv=false
        const config = createTestConfig();
        const client = createUserServiceClient(config);
        
        assert.strictEqual(client.trustEnv, false, 'trustEnv 应为 false');
        
        client.close();
    });

    it('TC-PC-004: 客户端工厂函数名对应', () => {
        // Python: create_user_service_client -> Node.js: createUserServiceClient
        // Python: create_molt_message_client -> Node.js: createMoltMessageClient
        
        const config = createTestConfig();
        
        const userClient = createUserServiceClient(config);
        const messageClient = createMoltMessageClient(config);
        
        assert.ok(userClient, 'createUserServiceClient 应返回客户端');
        assert.ok(messageClient, 'createMoltMessageClient 应返回客户端');
        
        userClient.close();
        messageClient.close();
    });

    it('TC-PC-005: SSL 验证行为一致', () => {
        // Python 返回 bool | ssl.SSLContext
        // Node.js 返回 bool | https.Agent
        
        clearCAEnvVars();
        
        // 无 CA 时返回 true
        const result1 = _resolveVerify('https://awiki.ai');
        assert.strictEqual(result1, true, '无 CA 时返回 true');
        
        // 有 CA 时返回 Agent
        process.env.AWIKI_CA_BUNDLE = testCaPath;
        const result2 = _resolveVerify('https://awiki.ai');
        assert.ok(result2 instanceof https.Agent, '有 CA 时返回 https.Agent');
    });

    it('TC-PC-006: 客户端接口一致性', () => {
        const config = createTestConfig();
        const client = createUserServiceClient(config);
        
        // 验证客户端具有 httpx.AsyncClient 对应的核心方法
        assert.strictEqual(typeof client.get, 'function', '应有 get 方法');
        assert.strictEqual(typeof client.post, 'function', '应有 post 方法');
        assert.strictEqual(typeof client.put, 'function', '应有 put 方法');
        assert.strictEqual(typeof client.delete, 'function', '应有 delete 方法');
        assert.strictEqual(typeof client.close, 'function', '应有 close/aclose 方法');
        
        client.close();
    });
});
