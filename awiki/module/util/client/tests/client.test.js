/**
 * client 模块单元测试
 * 
 * 测试用例基于：doc/util/client/distill.json
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, rmSync, existsSync } from 'fs';
import https from 'https';

import {
    _resolveVerify,
    createUserServiceClient,
    createMoltMessageClient,
} from '../dist/client.js';

// 测试用 CA 证书内容 (自签名)
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
5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H
5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H
5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H5H
-----END CERTIFICATE-----`;

describe('_resolveVerify', () => {
    let testCaPath;
    let originalEnv;

    before(() => {
        // 保存原始环境变量
        originalEnv = {
            AWIKI_CA_BUNDLE: process.env.AWIKI_CA_BUNDLE,
            E2E_CA_BUNDLE: process.env.E2E_CA_BUNDLE,
            SSL_CERT_FILE: process.env.SSL_CERT_FILE,
        };
        
        // 创建测试 CA 文件
        testCaPath = join(tmpdir(), 'test-ca.pem');
        writeFileSync(testCaPath, TEST_CA_CONTENT);
    });

    after(() => {
        // 清理测试文件
        if (existsSync(testCaPath)) {
            rmSync(testCaPath);
        }
        
        // 恢复原始环境变量
        if (originalEnv.AWIKI_CA_BUNDLE !== undefined) {
            process.env.AWIKI_CA_BUNDLE = originalEnv.AWIKI_CA_BUNDLE;
        } else {
            delete process.env.AWIKI_CA_BUNDLE;
        }
        if (originalEnv.E2E_CA_BUNDLE !== undefined) {
            process.env.E2E_CA_BUNDLE = originalEnv.E2E_CA_BUNDLE;
        } else {
            delete process.env.E2E_CA_BUNDLE;
        }
        if (originalEnv.SSL_CERT_FILE !== undefined) {
            process.env.SSL_CERT_FILE = originalEnv.SSL_CERT_FILE;
        } else {
            delete process.env.SSL_CERT_FILE;
        }
    });

    it('TC-001: AWIKI_CA_BUNDLE 环境变量优先', () => {
        // 清理其他环境变量
        delete process.env.E2E_CA_BUNDLE;
        delete process.env.SSL_CERT_FILE;
        process.env.AWIKI_CA_BUNDLE = testCaPath;

        const result = _resolveVerify('https://awiki.ai');
        assert.ok(result instanceof https.Agent, '应返回 https.Agent 实例');
    });

    it('TC-002: E2E_CA_BUNDLE 环境变量次优先', () => {
        delete process.env.AWIKI_CA_BUNDLE;
        delete process.env.SSL_CERT_FILE;
        process.env.E2E_CA_BUNDLE = testCaPath;

        const result = _resolveVerify('https://awiki.ai');
        assert.ok(result instanceof https.Agent, '应返回 https.Agent 实例');
    });

    it('TC-003: SSL_CERT_FILE 环境变量最低优先', () => {
        delete process.env.AWIKI_CA_BUNDLE;
        delete process.env.E2E_CA_BUNDLE;
        process.env.SSL_CERT_FILE = testCaPath;

        const result = _resolveVerify('https://awiki.ai');
        assert.ok(result instanceof https.Agent, '应返回 https.Agent 实例');
    });

    it('TC-006: 普通域名使用系统默认验证', () => {
        delete process.env.AWIKI_CA_BUNDLE;
        delete process.env.E2E_CA_BUNDLE;
        delete process.env.SSL_CERT_FILE;

        const result = _resolveVerify('https://awiki.ai');
        assert.strictEqual(result, true, '应返回 true 使用系统默认验证');
    });

    it('TC-007: CA 文件不存在时降级', () => {
        delete process.env.AWIKI_CA_BUNDLE;
        delete process.env.E2E_CA_BUNDLE;
        delete process.env.SSL_CERT_FILE;
        process.env.AWIKI_CA_BUNDLE = '/nonexistent/ca.pem';

        const result = _resolveVerify('https://awiki.ai');
        assert.strictEqual(result, true, '应返回 true 降级到默认验证');
    });

    it('TC-015: 环境变量优先级顺序验证', () => {
        // 同时设置三个环境变量
        process.env.AWIKI_CA_BUNDLE = testCaPath;
        process.env.E2E_CA_BUNDLE = testCaPath + '.e2e';
        process.env.SSL_CERT_FILE = testCaPath + '.ssl';

        const result = _resolveVerify('https://awiki.ai');
        assert.ok(result instanceof https.Agent, '应返回 https.Agent 实例');
        // AWIKI_CA_BUNDLE 优先级最高，应使用它
    });
});

describe('createUserServiceClient', () => {
    let testCaPath;

    before(() => {
        testCaPath = join(tmpdir(), 'test-ca.pem');
        if (!existsSync(testCaPath)) {
            writeFileSync(testCaPath, TEST_CA_CONTENT);
        }
    });

    it('TC-008: 默认配置创建', () => {
        const config = {
            user_service_url: 'https://awiki.ai',
            molt_message_url: 'https://awiki.ai',
            molt_message_ws_url: undefined,
            did_domain: 'awiki.ai',
            credentials_dir: '/tmp/creds',
            data_dir: '/tmp/data',
        };

        // 清理环境变量
        delete process.env.AWIKI_CA_BUNDLE;
        delete process.env.E2E_CA_BUNDLE;
        delete process.env.SSL_CERT_FILE;

        const client = createUserServiceClient(config);
        assert.strictEqual(client.baseURL, 'https://awiki.ai');
        assert.strictEqual(client.timeout, 30000);
        assert.strictEqual(client.trustEnv, false);
        client.close();
    });

    it('TC-009: 自定义 URL 创建', () => {
        const config = {
            user_service_url: 'https://custom-user-service.example.com',
            molt_message_url: 'https://awiki.ai',
            molt_message_ws_url: undefined,
            did_domain: 'awiki.ai',
            credentials_dir: '/tmp/creds',
            data_dir: '/tmp/data',
        };

        // 清理环境变量
        delete process.env.AWIKI_CA_BUNDLE;
        delete process.env.E2E_CA_BUNDLE;
        delete process.env.SSL_CERT_FILE;

        const client = createUserServiceClient(config);
        assert.strictEqual(client.baseURL, 'https://custom-user-service.example.com');
        client.close();
    });

    it('TC-010: TLS 验证配置继承', () => {
        const config = {
            user_service_url: 'https://awiki.ai',
            molt_message_url: 'https://awiki.ai',
            molt_message_ws_url: undefined,
            did_domain: 'awiki.ai',
            credentials_dir: '/tmp/creds',
            data_dir: '/tmp/data',
        };

        // 设置 CA 环境变量
        delete process.env.E2E_CA_BUNDLE;
        delete process.env.SSL_CERT_FILE;
        process.env.AWIKI_CA_BUNDLE = testCaPath;

        const client = createUserServiceClient(config);
        assert.ok(client.httpsAgent !== undefined, '应配置 httpsAgent');
        client.close();
    });
});

describe('createMoltMessageClient', () => {
    let testCaPath;

    before(() => {
        testCaPath = join(tmpdir(), 'test-ca.pem');
        if (!existsSync(testCaPath)) {
            writeFileSync(testCaPath, TEST_CA_CONTENT);
        }
    });

    it('TC-011: 默认配置创建', () => {
        const config = {
            user_service_url: 'https://awiki.ai',
            molt_message_url: 'https://awiki.ai',
            molt_message_ws_url: undefined,
            did_domain: 'awiki.ai',
            credentials_dir: '/tmp/creds',
            data_dir: '/tmp/data',
        };

        // 清理环境变量
        delete process.env.AWIKI_CA_BUNDLE;
        delete process.env.E2E_CA_BUNDLE;
        delete process.env.SSL_CERT_FILE;

        const client = createMoltMessageClient(config);
        assert.strictEqual(client.baseURL, 'https://awiki.ai');
        assert.strictEqual(client.timeout, 30000);
        assert.strictEqual(client.trustEnv, false);
        client.close();
    });

    it('TC-012: 自定义 URL 创建', () => {
        const config = {
            user_service_url: 'https://awiki.ai',
            molt_message_url: 'https://custom-message.example.com',
            molt_message_ws_url: undefined,
            did_domain: 'awiki.ai',
            credentials_dir: '/tmp/creds',
            data_dir: '/tmp/data',
        };

        // 清理环境变量
        delete process.env.AWIKI_CA_BUNDLE;
        delete process.env.E2E_CA_BUNDLE;
        delete process.env.SSL_CERT_FILE;

        const client = createMoltMessageClient(config);
        assert.strictEqual(client.baseURL, 'https://custom-message.example.com');
        client.close();
    });

    it('TC-013: TLS 验证配置继承', () => {
        const config = {
            user_service_url: 'https://awiki.ai',
            molt_message_url: 'https://awiki.ai',
            molt_message_ws_url: undefined,
            did_domain: 'awiki.ai',
            credentials_dir: '/tmp/creds',
            data_dir: '/tmp/data',
        };

        // 设置 CA 环境变量
        delete process.env.E2E_CA_BUNDLE;
        delete process.env.SSL_CERT_FILE;
        process.env.AWIKI_CA_BUNDLE = testCaPath;

        const client = createMoltMessageClient(config);
        assert.ok(client.httpsAgent !== undefined, '应配置 httpsAgent');
        client.close();
    });
});

describe('客户端独立性', () => {
    it('TC-014: user-service 和 molt-message 配置隔离', () => {
        const config = {
            user_service_url: 'https://user.example.com',
            molt_message_url: 'https://message.example.com',
            molt_message_ws_url: undefined,
            did_domain: 'awiki.ai',
            credentials_dir: '/tmp/creds',
            data_dir: '/tmp/data',
        };

        // 清理环境变量
        delete process.env.AWIKI_CA_BUNDLE;
        delete process.env.E2E_CA_BUNDLE;
        delete process.env.SSL_CERT_FILE;

        const userClient = createUserServiceClient(config);
        const messageClient = createMoltMessageClient(config);

        assert.strictEqual(userClient.baseURL, 'https://user.example.com');
        assert.strictEqual(messageClient.baseURL, 'https://message.example.com');
        assert.notStrictEqual(userClient, messageClient, '两个客户端应独立');

        userClient.close();
        messageClient.close();
    });
});
