/**
 * RPC 模块测试
 *
 * 测试用例基于 doc/util/rpc/distill.json
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { JsonRpcError } from '../dist/index.js';

/**
 * 模拟 HTTP 客户端
 */
class MockClient {
    constructor(baseURL = 'https://awiki.ai') {
        this.baseURL = baseURL;
        this.timeout = 30000;
        this.trustEnv = false;
        this.requestCount = 0;
        this.responses = [];
    }

    setResponse(response) {
        this.responses.push(response);
    }

    async post(endpoint, data, options = {}) {
        this.requestCount++;
        this.lastRequest = { endpoint, data, headers: options.headers };
        
        if (this.responses.length > 0) {
            return this.responses.shift();
        }
        
        return { result: {} };
    }

    close() {}
}

/**
 * 模拟认证器
 */
class MockAuthenticator {
    constructor(initialStatus = 'valid') {
        this.initialStatus = initialStatus;
        this.getHeaderCallCount = 0;
        this.clearTokenCallCount = 0;
        this.updateTokenCallCount = 0;
        this.forceNewCallCount = 0;
        this.tokens = new Map();
    }

    getAuthHeader(serverUrl, forceNew = false) {
        this.getHeaderCallCount++;
        if (forceNew) {
            this.forceNewCallCount++;
        }
        return {
            Authorization: 'DIDWBA test_token',
        };
    }

    clearToken(serverUrl) {
        this.clearTokenCallCount++;
        this.tokens.delete(serverUrl);
    }

    updateToken(serverUrl, headers) {
        this.updateTokenCallCount++;
        const authHeader = headers.Authorization || headers.authorization || '';
        const match = authHeader.match(/DIDWBA\s+(.+)/);
        if (match) {
            const token = match[1];
            this.tokens.set(serverUrl, token);
            return token;
        }
        return null;
    }
}

// ============================================
// JsonRpcError 测试
// ============================================

test('TC001 - JsonRpcError - 基本构造', () => {
    const error = new JsonRpcError(-32600, 'Invalid Request', null);
    assert.strictEqual(error.code, -32600);
    assert.strictEqual(error.message, 'JSON-RPC error -32600: Invalid Request');
    assert.strictEqual(error.data, null);
    assert.strictEqual(error.toString(), 'JsonRpcError: JSON-RPC error -32600: Invalid Request');
});

test('TC002 - JsonRpcError - 带 data 字段', () => {
    const error = new JsonRpcError(-32602, 'Invalid params', { field: 'missing' });
    assert.strictEqual(error.code, -32602);
    assert.strictEqual(error.message, 'JSON-RPC error -32602: Invalid params');
    assert.deepStrictEqual(error.data, { field: 'missing' });
});

// ============================================
// rpcCall 测试
// ============================================

test('TC003 - rpcCall - 成功场景', async () => {
    const { rpcCall } = await import('../dist/index.js');
    const client = new MockClient();
    client.setResponse({
        jsonrpc: '2.0',
        result: { success: true, txHash: '0x123' },
        id: 1,
    });

    const result = await rpcCall(
        client,
        '/did-auth/rpc',
        'register',
        { did: 'did:wba:test' },
        1
    );

    assert.deepStrictEqual(result, { success: true, txHash: '0x123' });
    assert.strictEqual(client.requestCount, 1);
    assert.strictEqual(client.lastRequest.data.jsonrpc, '2.0');
    assert.strictEqual(client.lastRequest.data.method, 'register');
});

test('TC004 - rpcCall - params 为 None', async () => {
    const { rpcCall } = await import('../dist/index.js');
    const client = new MockClient();
    client.setResponse({
        jsonrpc: '2.0',
        result: { status: 'active' },
        id: 2,
    });

    const result = await rpcCall(
        client,
        '/did-auth/rpc',
        'getStatus',
        null,
        2
    );

    assert.deepStrictEqual(result, { status: 'active' });
    // Python: params or {} -> null 转为空对象
    assert.deepStrictEqual(client.lastRequest.data.params, {});
});

test('TC005 - rpcCall - JSON-RPC 错误响应', async () => {
    const { rpcCall } = await import('../dist/index.js');
    const client = new MockClient();
    client.setResponse({
        jsonrpc: '2.0',
        error: {
            code: -32601,
            message: 'Method not found',
            data: 'The method does not exist',
        },
        id: 3,
    });

    await assert.rejects(
        async () => {
            await rpcCall(client, '/did-auth/rpc', 'invalidMethod', {}, 3);
        },
        (err) => {
            assert.strictEqual(err instanceof JsonRpcError, true);
            assert.strictEqual(err.code, -32601);
            assert.strictEqual(err.message, 'JSON-RPC error -32601: Method not found');
            assert.strictEqual(err.data, 'The method does not exist');
            return true;
        }
    );
});

test('TC006 - rpcCall - 自定义 request_id', async () => {
    const { rpcCall } = await import('../dist/index.js');
    const client = new MockClient();
    client.setResponse({
        jsonrpc: '2.0',
        result: { data: 'response' },
        id: 'req-abc-123',
    });

    const result = await rpcCall(
        client,
        '/did-auth/rpc',
        'query',
        { key: 'value' },
        'req-abc-123'
    );

    assert.deepStrictEqual(result, { data: 'response' });
    assert.strictEqual(client.lastRequest.data.id, 'req-abc-123');
});

// ============================================
// authenticatedRpcCall 测试
// ============================================

test('TC008 - authenticatedRpcCall - 成功场景（首次认证成功）', async () => {
    const { authenticatedRpcCall, setUpdateJwtFunction } = await import('../dist/index.js');
    
    let credentialStoreUpdated = false;
    let storedCredentialName = null;
    let storedToken = null;
    
    setUpdateJwtFunction((name, token) => {
        credentialStoreUpdated = true;
        storedCredentialName = name;
        storedToken = token;
    });

    const client = new MockClient();
    const auth = new MockAuthenticator('valid');
    
    client.setResponse({
        jsonrpc: '2.0',
        result: { messageId: 'msg-001' },
        id: 1,
        status_code: 200,
        headers: {
            authorization: 'DIDWBA new_jwt_token_xyz',
        },
    });

    const result = await authenticatedRpcCall(
        client,
        '/user-service/did-auth/rpc',
        'sendMessage',
        { to: 'did:wba:target', message: 'hello' },
        { auth, credentialName: 'default' }
    );

    assert.deepStrictEqual(result, { messageId: 'msg-001' });
    assert.strictEqual(client.requestCount, 1);
    assert.strictEqual(auth.getHeaderCallCount, 1);
    assert.strictEqual(auth.clearTokenCallCount, 0);
    assert.strictEqual(auth.updateTokenCallCount, 1);
    assert.strictEqual(credentialStoreUpdated, true);
    assert.strictEqual(storedToken, 'new_jwt_token_xyz');
});

test('TC009 - authenticatedRpcCall - 401 自动重试成功', async () => {
    const { authenticatedRpcCall, setUpdateJwtFunction } = await import('../dist/index.js');
    
    let credentialStoreUpdated = false;
    let storedToken = null;
    
    setUpdateJwtFunction((name, token) => {
        credentialStoreUpdated = true;
        storedToken = token;
    });

    const client = new MockClient();
    const auth = new MockAuthenticator('expired');
    
    // 第一次返回 401，第二次返回成功
    client.setResponse({
        jsonrpc: '2.0',
        error: null,
        id: 2,
        status_code: 401,
    });
    client.setResponse({
        jsonrpc: '2.0',
        result: { secret: 'data' },
        id: 2,
        status_code: 200,
        headers: {
            authorization: 'DIDWBA refreshed_jwt_token',
        },
    });

    const result = await authenticatedRpcCall(
        client,
        '/user-service/did-auth/rpc',
        'protectedMethod',
        { data: 'sensitive' },
        { auth, credentialName: 'default' }
    );

    assert.deepStrictEqual(result, { secret: 'data' });
    assert.strictEqual(client.requestCount, 2);
    assert.strictEqual(auth.clearTokenCallCount, 1);
    assert.strictEqual(auth.forceNewCallCount, 1);
    assert.strictEqual(auth.updateTokenCallCount, 1);
    assert.strictEqual(credentialStoreUpdated, true);
    assert.strictEqual(storedToken, 'refreshed_jwt_token');
});

test('TC010 - authenticatedRpcCall - 401 重试后仍失败', async () => {
    const { authenticatedRpcCall } = await import('../dist/index.js');

    const client = new MockClient();
    const auth = new MockAuthenticator('invalid');
    
    // 两次都返回 401
    client.setResponse({
        jsonrpc: '2.0',
        error: null,
        id: 3,
        status_code: 401,
        statusText: 'Unauthorized',
    });
    client.setResponse({
        jsonrpc: '2.0',
        error: null,
        id: 3,
        status_code: 401,
        statusText: 'Unauthorized',
    });

    await assert.rejects(
        async () => {
            await authenticatedRpcCall(
                client,
                '/user-service/did-auth/rpc',
                'protectedMethod',
                {},
                { auth }
            );
        },
        (err) => {
            assert.strictEqual(err.message.includes('HTTP 401'), true);
            return true;
        }
    );

    assert.strictEqual(client.requestCount, 2);
    assert.strictEqual(auth.clearTokenCallCount, 1);
    assert.strictEqual(auth.forceNewCallCount, 1);
});

test('TC011 - authenticatedRpcCall - JSON-RPC 错误（带认证）', async () => {
    const { authenticatedRpcCall } = await import('../dist/index.js');

    const client = new MockClient();
    const auth = new MockAuthenticator('valid');
    
    client.setResponse({
        jsonrpc: '2.0',
        error: {
            code: -32000,
            message: 'Permission denied',
            data: { required: 'admin', current: 'user' },
        },
        id: 4,
        status_code: 200,
    });

    await assert.rejects(
        async () => {
            await authenticatedRpcCall(
                client,
                '/user-service/did-auth/rpc',
                'validatePermission',
                { permission: 'admin' },
                { auth }
            );
        },
        (err) => {
            assert.strictEqual(err instanceof JsonRpcError, true);
            assert.strictEqual(err.code, -32000);
            assert.strictEqual(err.message, 'JSON-RPC error -32000: Permission denied');
            assert.deepStrictEqual(err.data, { required: 'admin', current: 'user' });
            return true;
        }
    );

    assert.strictEqual(client.requestCount, 1);
    assert.strictEqual(auth.clearTokenCallCount, 0);
});

test('TC012 - authenticatedRpcCall - 无响应 Authorization 头', async () => {
    const { authenticatedRpcCall, setUpdateJwtFunction } = await import('../dist/index.js');
    
    let credentialStoreUpdated = false;
    
    setUpdateJwtFunction(() => {
        credentialStoreUpdated = true;
    });

    const client = new MockClient();
    const auth = new MockAuthenticator('valid');
    
    client.setResponse({
        jsonrpc: '2.0',
        result: { status: 'ok' },
        id: 5,
        status_code: 200,
        headers: {},
    });

    const result = await authenticatedRpcCall(
        client,
        '/user-service/did-auth/rpc',
        'noTokenRefresh',
        {},
        { auth }
    );

    assert.deepStrictEqual(result, { status: 'ok' });
    assert.strictEqual(client.requestCount, 1);
    assert.strictEqual(auth.updateTokenCallCount, 1);
    assert.strictEqual(credentialStoreUpdated, false);
});

test('TC013 - authenticatedRpcCall - credential_name 参数传递', async () => {
    const { authenticatedRpcCall, setUpdateJwtFunction } = await import('../dist/index.js');
    
    let storedCredentialName = null;
    
    setUpdateJwtFunction((name, token) => {
        storedCredentialName = name;
    });

    const client = new MockClient();
    const auth = new MockAuthenticator('valid');
    
    client.setResponse({
        jsonrpc: '2.0',
        result: {},
        id: 6,
        status_code: 200,
        headers: {
            authorization: 'DIDWBA test_token',
        },
    });

    await authenticatedRpcCall(
        client,
        '/user-service/did-auth/rpc',
        'test',
        {},
        { auth, credentialName: 'test-credential' }
    );

    assert.strictEqual(storedCredentialName, 'test-credential');
});

test('TC014 - authenticatedRpcCall - 非 401 HTTP 错误', async () => {
    const { authenticatedRpcCall } = await import('../dist/index.js');

    const client = new MockClient();
    const auth = new MockAuthenticator('valid');
    
    client.setResponse({
        jsonrpc: '2.0',
        error: null,
        id: 7,
        status_code: 503,
        statusText: 'Service Unavailable',
    });

    await assert.rejects(
        async () => {
            await authenticatedRpcCall(
                client,
                '/user-service/did-auth/rpc',
                'test',
                {},
                { auth }
            );
        },
        (err) => {
            assert.strictEqual(err.message.includes('HTTP 503'), true);
            return true;
        }
    );

    assert.strictEqual(client.requestCount, 1);
    assert.strictEqual(auth.clearTokenCallCount, 0);
});

test('TC015 - authenticatedRpcCall - server_url 从 client.baseURL 获取', async () => {
    const { authenticatedRpcCall, setUpdateJwtFunction } = await import('../dist/index.js');
    
    let authGetHeaderCalledWith = null;
    let authUpdateTokenCalledWith = null;

    const client = new MockClient('https://awiki.ai');
    
    class TestAuthenticator extends MockAuthenticator {
        getAuthHeader(serverUrl, forceNew = false) {
            authGetHeaderCalledWith = serverUrl;
            return super.getAuthHeader(serverUrl, forceNew);
        }
        
        updateToken(serverUrl, headers) {
            authUpdateTokenCalledWith = serverUrl;
            return super.updateToken(serverUrl, headers);
        }
    }
    
    const auth = new TestAuthenticator('valid');
    
    client.setResponse({
        jsonrpc: '2.0',
        result: {},
        id: 8,
        status_code: 200,
        headers: {
            authorization: 'DIDWBA token',
        },
    });

    await authenticatedRpcCall(
        client,
        '/user-service/did-auth/rpc',
        'test',
        {},
        { auth }
    );

    assert.strictEqual(authGetHeaderCalledWith, 'https://awiki.ai');
    assert.strictEqual(authUpdateTokenCalledWith, 'https://awiki.ai');
});

console.log('All tests completed!');
