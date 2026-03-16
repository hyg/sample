/**
 * RPC 模块综合测试
 * 
 * 测试用例覆盖：
 * 1. 命名规范检查 (snake_case)
 * 2. JsonRpcError 类测试
 * 3. rpc_call 函数测试
 * 4. authenticated_rpc_call 函数测试
 * 5. 边界测试
 * 6. 与 Python 版本兼容性测试
 * 
 * 移植自：python/scripts/utils/rpc.py
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import * as rpcModule from '../src/index.js';
import { JsonRpcError } from '../src/index.js';
import type { Authenticator } from '../src/index.js';

// ============================================
// 模拟 HTTP 客户端 (使用鸭子类型，不实现接口)
// ============================================

class MockHttpClient {
    baseURL: string;
    private responseQueue: MockResponse[] = [];
    public requestCount = 0;
    public lastRequest: { endpoint: string; payload: any; headers?: Record<string, string> } | null = null;

    constructor(baseURL: string = 'https://awiki.ai') {
        this.baseURL = baseURL;
    }

    queueResponse(response: MockResponse) {
        this.responseQueue.push(response);
    }

    async post(endpoint: string, payload: any, options?: { headers?: Record<string, string> }): Promise<any> {
        this.requestCount++;
        this.lastRequest = { endpoint, payload, headers: options?.headers };

        const response = this.responseQueue.shift();
        if (!response) {
            throw new Error('No queued response available');
        }

        return new MockHttpResponse(response);
    }

    close() {}
}

interface MockResponse {
    status_code?: number;
    statusCode?: number;
    headers?: Record<string, string>;
    body: any;
    statusText?: string;
}

class MockHttpResponse {
    private response: MockResponse;

    constructor(response: MockResponse) {
        this.response = response;
    }

    get status_code() {
        return this.response.status_code ?? this.response.statusCode ?? 200;
    }

    get statusCode() {
        return this.response.statusCode ?? this.response.status_code ?? 200;
    }

    get statusText() {
        return this.response.statusText ?? 'OK';
    }

    get headers() {
        return this.response.headers ?? {};
    }

    get jsonrpc() {
        return this.response.body?.jsonrpc;
    }

    get result() {
        return this.response.body?.result;
    }

    get error() {
        return this.response.body?.error;
    }

    get id() {
        return this.response.body?.id;
    }
}

// ============================================
// 模拟认证器
// ============================================

class MockAuthenticator implements Authenticator {
    public getHeaderCallCount = 0;
    public clearTokenCallCount = 0;
    public updateTokenCallCount = 0;
    public lastServerUrl = '';
    public lastForceNew = false;
    private token: string | null = 'initial_jwt_token';

    getAuthHeader(serverUrl: string, forceNew: boolean = false): Record<string, string> {
        this.getHeaderCallCount++;
        this.lastServerUrl = serverUrl;
        this.lastForceNew = forceNew;

        if (forceNew) {
            this.token = 'refreshed_jwt_token';
        }

        return {
            Authorization: `DIDWBA ${this.token || 'no_token'}`,
        };
    }

    clearToken(serverUrl: string): void {
        this.clearTokenCallCount++;
        this.lastServerUrl = serverUrl;
        this.token = null;
    }

    updateToken(serverUrl: string, headers: Record<string, string>): string | null {
        this.updateTokenCallCount++;
        this.lastServerUrl = serverUrl;

        const authHeader = headers['Authorization'] || '';
        const match = authHeader.match(/^DIDWBA\s+(.+)$/);
        if (match) {
            this.token = match[1];
            return match[1];
        }
        return null;
    }
}

// ============================================
// 凭证存储模拟
// ============================================

let mockCredentialStore: { name: string; token: string } | null = null;

function mockUpdateJwtFunction(credentialName: string, token: string): void {
    mockCredentialStore = { name: credentialName, token };
}

function resetCredentialStore() {
    mockCredentialStore = null;
}

// ============================================
// 第一部分：命名规范检查测试
// ============================================

test('TC001 - 命名规范 - 导出函数使用 snake_case', () => {
    // 验证导出的函数名使用 snake_case
    assert.strictEqual(typeof (rpcModule as any).rpc_call, 'function', 'rpc_call 应该是函数');
    assert.strictEqual(typeof (rpcModule as any).authenticated_rpc_call, 'function', 'authenticated_rpc_call 应该是函数');
    assert.strictEqual(typeof (rpcModule as any).set_update_jwt_function, 'function', 'set_update_jwt_function 应该是函数');
    
    // 验证 camelCase 版本不存在（确保使用 snake_case）
    assert.strictEqual((rpcModule as any).rpcCall, undefined, 'rpcCall (camelCase) 不应该存在');
    assert.strictEqual((rpcModule as any).authenticatedRpcCall, undefined, 'authenticatedRpcCall (camelCase) 不应该存在');
    assert.strictEqual((rpcModule as any).setUpdateJwtFunction, undefined, 'setUpdateJwtFunction (camelCase) 不应该存在');
});

test('TC002 - 命名规范 - JsonRpcError 类使用 PascalCase', () => {
    // 类名应该使用 PascalCase
    assert.strictEqual(typeof JsonRpcError, 'function', 'JsonRpcError 应该是构造函数');
    assert.strictEqual(JsonRpcError.name, 'JsonRpcError', '类名应该是 JsonRpcError');
});

test('TC003 - 命名规范 - 类型定义使用 PascalCase', () => {
    // 验证类型导出存在（类型在运行时不存在，但可以通过模块结构验证）
    const moduleExports = Object.keys(rpcModule);
    // 验证导出的主要成员
    assert.ok(moduleExports.includes('JsonRpcError'), '应该导出 JsonRpcError');
    assert.ok(moduleExports.includes('rpc_call'), '应该导出 rpc_call');
    assert.ok(moduleExports.includes('authenticated_rpc_call'), '应该导出 authenticated_rpc_call');
    assert.ok(moduleExports.includes('set_update_jwt_function'), '应该导出 set_update_jwt_function');
});

// ============================================
// 第二部分：JsonRpcError 类测试
// ============================================

test('TC010 - JsonRpcError - 基本构造函数', () => {
    const error = new JsonRpcError(-32600, 'Invalid Request', null);
    
    assert.strictEqual(error.code, -32600);
    assert.strictEqual(error.message, 'JSON-RPC error -32600: Invalid Request');
    assert.strictEqual(error.data, null);
    assert.strictEqual(error.name, 'JsonRpcError');
});

test('TC011 - JsonRpcError - 带 data 字段', () => {
    const error = new JsonRpcError(-32602, 'Invalid params', { field: 'missing', reason: 'required' });
    
    assert.strictEqual(error.code, -32602);
    assert.strictEqual(error.message, 'JSON-RPC error -32602: Invalid params');
    assert.deepStrictEqual(error.data, { field: 'missing', reason: 'required' });
});

test('TC012 - JsonRpcError - data 为 undefined', () => {
    const error = new JsonRpcError(-32601, 'Method not found');
    
    assert.strictEqual(error.code, -32601);
    assert.strictEqual(error.message, 'JSON-RPC error -32601: Method not found');
    assert.strictEqual(error.data, undefined);
});

test('TC013 - JsonRpcError - fromErrorObject 静态方法', () => {
    const errorObj = {
        code: -32603,
        message: 'Internal error',
        data: 'Server crashed',
    };
    
    const error = JsonRpcError.fromErrorObject(errorObj);
    
    assert.strictEqual(error.code, -32603);
    assert.strictEqual(error.message, 'JSON-RPC error -32603: Internal error');
    assert.strictEqual(error.data, 'Server crashed');
});

test('TC014 - JsonRpcError - toString 方法', () => {
    const error = new JsonRpcError(-32600, 'Invalid Request');
    
    assert.strictEqual(error.toString(), 'JsonRpcError: JSON-RPC error -32600: Invalid Request');
});

test('TC015 - JsonRpcError - 继承自 Error', () => {
    const error = new JsonRpcError(-32600, 'Invalid Request');
    
    assert.ok(error instanceof Error);
    assert.ok(error instanceof JsonRpcError);
});

// ============================================
// 第三部分：rpc_call 函数测试
// ============================================

test('TC020 - rpc_call - 基本成功场景', async () => {
    const client = new MockHttpClient();
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            result: { success: true, txHash: '0x123abc' },
            id: 1,
        },
    });

    const result = await rpcModule.rpc_call(
        client as any,
        '/did-auth/rpc',
        'register',
        { did: 'did:wba:test' },
        1
    );

    assert.deepStrictEqual(result, { success: true, txHash: '0x123abc' });
    assert.strictEqual(client.requestCount, 1);
    assert.strictEqual(client.lastRequest?.endpoint, '/did-auth/rpc');
});

test('TC021 - rpc_call - 请求格式验证 jsonrpc: "2.0"', async () => {
    const client = new MockHttpClient();
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            result: { status: 'ok' },
            id: 1,
        },
    });

    await rpcModule.rpc_call(client as any, '/rpc', 'test', {}, 1);

    // 验证请求体格式
    assert.strictEqual(client.lastRequest?.payload.jsonrpc, '2.0');
    assert.strictEqual(client.lastRequest?.payload.method, 'test');
});

test('TC022 - rpc_call - 默认 request_id=1', async () => {
    const client = new MockHttpClient();
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            result: {},
            id: 1,
        },
    });

    // 不传 request_id，应该使用默认值 1
    await rpcModule.rpc_call(client as any, '/rpc', 'test', {});

    assert.strictEqual(client.lastRequest?.payload.id, 1);
});

test('TC023 - rpc_call - params 为 null 处理', async () => {
    const client = new MockHttpClient();
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            result: { status: 'active' },
            id: 2,
        },
    });

    await rpcModule.rpc_call(client as any, '/rpc', 'getStatus', null, 2);

    // Python: params or {} -> null 转为空对象
    assert.deepStrictEqual(client.lastRequest?.payload.params, {});
});

test('TC024 - rpc_call - params 为 undefined 处理', async () => {
    const client = new MockHttpClient();
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            result: { status: 'active' },
            id: 3,
        },
    });

    await rpcModule.rpc_call(client as any, '/rpc', 'getStatus', undefined, 3);

    assert.deepStrictEqual(client.lastRequest?.payload.params, {});
});

test('TC025 - rpc_call - 自定义 request_id (数字)', async () => {
    const client = new MockHttpClient();
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            result: { data: 'response' },
            id: 999,
        },
    });

    await rpcModule.rpc_call(client as any, '/rpc', 'query', { key: 'value' }, 999);

    assert.strictEqual(client.lastRequest?.payload.id, 999);
});

test('TC026 - rpc_call - 自定义 request_id (字符串)', async () => {
    const client = new MockHttpClient();
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            result: { data: 'response' },
            id: 'req-abc-123',
        },
    });

    await rpcModule.rpc_call(client as any, '/rpc', 'query', { key: 'value' }, 'req-abc-123');

    assert.strictEqual(client.lastRequest?.payload.id, 'req-abc-123');
});

test('TC027 - rpc_call - JSON-RPC 错误响应处理', async () => {
    const client = new MockHttpClient();
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            error: {
                code: -32601,
                message: 'Method not found',
                data: 'The method does not exist',
            },
            id: 3,
        },
    });

    await assert.rejects(
        async () => rpcModule.rpc_call(client as any, '/rpc', 'invalidMethod', {}, 3),
        (err: Error) => {
            assert.ok(err instanceof JsonRpcError);
            assert.strictEqual((err as JsonRpcError).code, -32601);
            assert.strictEqual((err as JsonRpcError).message, 'JSON-RPC error -32601: Method not found');
            assert.strictEqual((err as JsonRpcError).data, 'The method does not exist');
            return true;
        }
    );
});

test('TC028 - rpc_call - JSON-RPC 错误码 -32600 (Invalid Request)', async () => {
    const client = new MockHttpClient();
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            error: {
                code: -32600,
                message: 'Invalid Request',
            },
            id: 4,
        },
    });

    await assert.rejects(
        async () => rpcModule.rpc_call(client as any, '/rpc', 'test', {}, 4),
        (err: Error) => {
            assert.ok(err instanceof JsonRpcError);
            assert.strictEqual((err as JsonRpcError).code, -32600);
            return true;
        }
    );
});

test('TC029 - rpc_call - JSON-RPC 错误码 -32602 (Invalid params)', async () => {
    const client = new MockHttpClient();
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            error: {
                code: -32602,
                message: 'Invalid params',
                data: { missing: 'user_id' },
            },
            id: 5,
        },
    });

    await assert.rejects(
        async () => rpcModule.rpc_call(client as any, '/rpc', 'test', {}, 5),
        (err: Error) => {
            assert.ok(err instanceof JsonRpcError);
            assert.strictEqual((err as JsonRpcError).code, -32602);
            assert.deepStrictEqual((err as JsonRpcError).data, { missing: 'user_id' });
            return true;
        }
    );
});

test('TC030 - rpc_call - 返回类型泛型支持', async () => {
    const client = new MockHttpClient();
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            result: { userId: 'user-123', name: 'Test User' },
            id: 6,
        },
    });

    const result = await rpcModule.rpc_call<{ userId: string; name: string }>(
        client as any,
        '/rpc',
        'getUser',
        { id: 'user-123' },
        6
    );

    assert.strictEqual(result.userId, 'user-123');
    assert.strictEqual(result.name, 'Test User');
});

// ============================================
// 第四部分：authenticated_rpc_call 函数测试
// ============================================

test('TC040 - authenticated_rpc_call - 首次认证成功', async () => {
    resetCredentialStore();
    rpcModule.set_update_jwt_function(mockUpdateJwtFunction);

    const client = new MockHttpClient();
    const auth = new MockAuthenticator();

    client.queueResponse({
        status_code: 200,
        headers: { authorization: 'DIDWBA new_jwt_token_xyz' },
        body: {
            jsonrpc: '2.0',
            result: { messageId: 'msg-001' },
            id: 1,
        },
    });

    const result = await rpcModule.authenticated_rpc_call(
        client as any,
        '/user-service/did-auth/rpc',
        'sendMessage',
        { to: 'did:wba:target', message: 'hello' },
        { auth, credential_name: 'default' }
    );

    assert.deepStrictEqual(result, { messageId: 'msg-001' });
    assert.strictEqual(client.requestCount, 1);
    assert.strictEqual(auth.getHeaderCallCount, 1);
    assert.strictEqual(auth.clearTokenCallCount, 0);
    assert.strictEqual(auth.updateTokenCallCount, 1);
    assert.strictEqual(mockCredentialStore?.name, 'default');
    assert.strictEqual(mockCredentialStore?.token, 'new_jwt_token_xyz');
});

test('TC041 - authenticated_rpc_call - 401 自动重试逻辑', async () => {
    resetCredentialStore();
    rpcModule.set_update_jwt_function(mockUpdateJwtFunction);

    const client = new MockHttpClient();
    const auth = new MockAuthenticator();

    // 第一次返回 401
    client.queueResponse({
        status_code: 401,
        statusText: 'Unauthorized',
        body: { error: null },
    });
    // 第二次返回成功
    client.queueResponse({
        status_code: 200,
        headers: { authorization: 'DIDWBA refreshed_jwt_token' },
        body: {
            jsonrpc: '2.0',
            result: { secret: 'sensitive_data' },
            id: 2,
        },
    });

    const result = await rpcModule.authenticated_rpc_call(
        client as any,
        '/user-service/did-auth/rpc',
        'protectedMethod',
        { data: 'sensitive' },
        { auth, credential_name: 'test-cred' }
    );

    assert.deepStrictEqual(result, { secret: 'sensitive_data' });
    assert.strictEqual(client.requestCount, 2); // 重试了一次
    assert.strictEqual(auth.clearTokenCallCount, 1); // 清除了过期 token
    assert.strictEqual(auth.getHeaderCallCount, 2); // 调用了两次 getAuthHeader
    assert.strictEqual(auth.lastForceNew, true); // 第二次 forceNew=true
    assert.strictEqual(mockCredentialStore?.token, 'refreshed_jwt_token');
});

test('TC042 - authenticated_rpc_call - JWT 从响应头提取', async () => {
    resetCredentialStore();
    rpcModule.set_update_jwt_function(mockUpdateJwtFunction);

    const client = new MockHttpClient();
    const auth = new MockAuthenticator();

    client.queueResponse({
        status_code: 200,
        headers: { authorization: 'DIDWBA header_jwt_token' },
        body: {
            jsonrpc: '2.0',
            result: { data: 'test' },
            id: 3,
        },
    });

    await rpcModule.authenticated_rpc_call(
        client as any,
        '/rpc',
        'test',
        {},
        { auth, credential_name: 'header-test' }
    );

    assert.strictEqual(mockCredentialStore?.token, 'header_jwt_token');
    assert.strictEqual(auth.updateTokenCallCount, 1);
});

test('TC043 - authenticated_rpc_call - JWT 从响应体提取 (优先级测试)', async () => {
    // 注意：当前实现优先从响应头提取
    // 如果需要从响应体提取，需要在响应体中包含 token 字段
    resetCredentialStore();
    rpcModule.set_update_jwt_function(mockUpdateJwtFunction);

    const client = new MockHttpClient();
    const auth = new MockAuthenticator();

    client.queueResponse({
        status_code: 200,
        headers: {}, // 无响应头
        body: {
            jsonrpc: '2.0',
            result: { data: 'test' },
            id: 4,
        },
    });

    await rpcModule.authenticated_rpc_call(
        client as any,
        '/rpc',
        'test',
        {},
        { auth, credential_name: 'body-test' }
    );

    // 无响应头时，updateToken 返回 null，不更新凭证存储
    assert.strictEqual(mockCredentialStore, null);
    assert.strictEqual(auth.updateTokenCallCount, 1);
});

test('TC044 - authenticated_rpc_call - 认证头处理', async () => {
    const client = new MockHttpClient();
    const auth = new MockAuthenticator();

    client.queueResponse({
        status_code: 200,
        headers: {},
        body: {
            jsonrpc: '2.0',
            result: {},
            id: 5,
        },
    });

    await rpcModule.authenticated_rpc_call(
        client as any,
        '/rpc',
        'test',
        {},
        { auth }
    );

    // 验证请求包含了认证头
    assert.ok(client.lastRequest?.headers);
    assert.ok(client.lastRequest?.headers?.Authorization);
    assert.strictEqual(client.lastRequest?.headers?.Authorization.startsWith('DIDWBA '), true);
});

test('TC045 - authenticated_rpc_call - credential_name 参数传递', async () => {
    resetCredentialStore();
    rpcModule.set_update_jwt_function(mockUpdateJwtFunction);

    const client = new MockHttpClient();
    const auth = new MockAuthenticator();

    client.queueResponse({
        status_code: 200,
        headers: { authorization: 'DIDWBA test_token' },
        body: {
            jsonrpc: '2.0',
            result: {},
            id: 6,
        },
    });

    await rpcModule.authenticated_rpc_call(
        client as any,
        '/rpc',
        'test',
        {},
        { auth, credential_name: 'my-custom-credential' }
    );

    assert.strictEqual(mockCredentialStore?.name, 'my-custom-credential');
});

test('TC046 - authenticated_rpc_call - 无 auth 参数抛出错误', async () => {
    await assert.rejects(
        async () => rpcModule.authenticated_rpc_call(
            new MockHttpClient() as any,
            '/rpc',
            'test',
            {},
            {} // 不提供 auth
        ),
        (err: Error) => {
            assert.strictEqual(err.message, 'authenticated_rpc_call requires an authenticator');
            return true;
        }
    );
});

test('TC047 - authenticated_rpc_call - 401 重试后仍失败', async () => {
    const client = new MockHttpClient();
    const auth = new MockAuthenticator();

    // 两次都返回 401
    client.queueResponse({
        status_code: 401,
        statusText: 'Unauthorized',
        body: {},
    });
    client.queueResponse({
        status_code: 401,
        statusText: 'Unauthorized',
        body: {},
    });

    await assert.rejects(
        async () => rpcModule.authenticated_rpc_call(
            client as any,
            '/rpc',
            'test',
            {},
            { auth }
        ),
        (err: Error) => {
            assert.ok(err.message.includes('HTTP 401'));
            return true;
        }
    );

    assert.strictEqual(client.requestCount, 2);
    assert.strictEqual(auth.clearTokenCallCount, 1);
});

test('TC048 - authenticated_rpc_call - 非 401 HTTP 错误', async () => {
    const client = new MockHttpClient();
    const auth = new MockAuthenticator();

    client.queueResponse({
        status_code: 503,
        statusText: 'Service Unavailable',
        body: {},
    });

    await assert.rejects(
        async () => rpcModule.authenticated_rpc_call(
            client as any,
            '/rpc',
            'test',
            {},
            { auth }
        ),
        (err: Error) => {
            assert.ok(err.message.includes('HTTP 503'));
            return true;
        }
    );

    // 非 401 错误不清除 token
    assert.strictEqual(client.requestCount, 1);
    assert.strictEqual(auth.clearTokenCallCount, 0);
});

test('TC049 - authenticated_rpc_call - JSON-RPC 错误（带认证）', async () => {
    const client = new MockHttpClient();
    const auth = new MockAuthenticator();

    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Permission denied',
                data: { required: 'admin', current: 'user' },
            },
            id: 7,
        },
    });

    await assert.rejects(
        async () => rpcModule.authenticated_rpc_call(
            client as any,
            '/rpc',
            'adminOnly',
            {},
            { auth }
        ),
        (err: Error) => {
            assert.ok(err instanceof JsonRpcError);
            assert.strictEqual((err as JsonRpcError).code, -32000);
            assert.strictEqual((err as JsonRpcError).message, 'JSON-RPC error -32000: Permission denied');
            assert.deepStrictEqual((err as JsonRpcError).data, { required: 'admin', current: 'user' });
            return true;
        }
    );

    // JSON-RPC 错误不触发 401 重试逻辑
    assert.strictEqual(client.requestCount, 1);
    assert.strictEqual(auth.clearTokenCallCount, 0);
});

test('TC050 - authenticated_rpc_call - server_url 从 client.baseURL 获取', async () => {
    const client = new MockHttpClient('https://awiki.ai');
    const auth = new MockAuthenticator();

    client.queueResponse({
        status_code: 200,
        headers: { authorization: 'DIDWBA token' },
        body: {
            jsonrpc: '2.0',
            result: {},
            id: 8,
        },
    });

    await rpcModule.authenticated_rpc_call(
        client as any,
        '/rpc',
        'test',
        {},
        { auth }
    );

    assert.strictEqual(auth.lastServerUrl, 'https://awiki.ai');
});

test('TC051 - authenticated_rpc_call - 默认 credential_name 为 default', async () => {
    resetCredentialStore();
    rpcModule.set_update_jwt_function(mockUpdateJwtFunction);

    const client = new MockHttpClient();
    const auth = new MockAuthenticator();

    client.queueResponse({
        status_code: 200,
        headers: { authorization: 'DIDWBA token' },
        body: {
            jsonrpc: '2.0',
            result: {},
            id: 9,
        },
    });

    // 不传 credential_name，应该使用默认值 'default'
    await rpcModule.authenticated_rpc_call(
        client as any,
        '/rpc',
        'test',
        {},
        { auth }
    );

    assert.strictEqual(mockCredentialStore?.name, 'default');
});

// ============================================
// 第五部分：边界测试
// ============================================

test('TC060 - 边界测试 - HTTP 500 错误处理', async () => {
    const client = new MockHttpClient();
    
    client.queueResponse({
        status_code: 500,
        statusText: 'Internal Server Error',
        body: {},
    });

    await assert.rejects(
        async () => rpcModule.rpc_call(client as any, '/rpc', 'test', {}, 1),
        (err: Error) => {
            assert.ok(err.message.includes('HTTP 500'));
            return true;
        }
    );
});

test('TC061 - 边界测试 - HTTP 502 Bad Gateway', async () => {
    const client = new MockHttpClient();
    
    client.queueResponse({
        status_code: 502,
        statusText: 'Bad Gateway',
        body: {},
    });

    await assert.rejects(
        async () => rpcModule.rpc_call(client as any, '/rpc', 'test', {}, 1),
        (err: Error) => {
            assert.ok(err.message.includes('HTTP 502'));
            return true;
        }
    );
});

test('TC062 - 边界测试 - HTTP 504 Gateway Timeout', async () => {
    const client = new MockHttpClient();
    
    client.queueResponse({
        status_code: 504,
        statusText: 'Gateway Timeout',
        body: {},
    });

    await assert.rejects(
        async () => rpcModule.rpc_call(client as any, '/rpc', 'test', {}, 1),
        (err: Error) => {
            assert.ok(err.message.includes('HTTP 504'));
            return true;
        }
    );
});

test('TC063 - 边界测试 - 响应格式异常 - 缺少 jsonrpc 字段', async () => {
    const client = new MockHttpClient();
    
    client.queueResponse({
        status_code: 200,
        body: {
            result: { data: 'test' },
            id: 1,
            // 缺少 jsonrpc 字段
        },
    });

    // 当前实现不验证 jsonrpc 字段，只检查 error 字段
    const result = await rpcModule.rpc_call(client as any, '/rpc', 'test', {}, 1);
    assert.deepStrictEqual(result, { data: 'test' });
});

test('TC064 - 边界测试 - 响应格式异常 - 缺少 result 和 error 字段', async () => {
    const client = new MockHttpClient();
    
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            id: 1,
            // 缺少 result 和 error 字段
        },
    });

    // 应该返回 undefined
    const result = await rpcModule.rpc_call(client as any, '/rpc', 'test', {}, 1);
    assert.strictEqual(result, undefined);
});

test('TC065 - 边界测试 - 空响应体', async () => {
    const client = new MockHttpClient();
    
    client.queueResponse({
        status_code: 200,
        body: {},
    });

    const result = await rpcModule.rpc_call(client as any, '/rpc', 'test', {}, 1);
    assert.strictEqual(result, undefined);
});

test('TC066 - 边界测试 - JSON-RPC 错误 data 为 null', async () => {
    const client = new MockHttpClient();
    
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Error with null data',
                data: null,
            },
            id: 1,
        },
    });

    await assert.rejects(
        async () => rpcModule.rpc_call(client as any, '/rpc', 'test', {}, 1),
        (err: Error) => {
            assert.ok(err instanceof JsonRpcError);
            assert.strictEqual((err as JsonRpcError).code, -32000);
            assert.strictEqual((err as JsonRpcError).data, null);
            return true;
        }
    );
});

test('TC067 - 边界测试 - 大整数 request_id', async () => {
    const client = new MockHttpClient();
    
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            result: { ok: true },
            id: Number.MAX_SAFE_INTEGER,
        },
    });

    await rpcModule.rpc_call(client as any, '/rpc', 'test', {}, Number.MAX_SAFE_INTEGER);

    assert.strictEqual(client.lastRequest?.payload.id, Number.MAX_SAFE_INTEGER);
});

test('TC068 - 边界测试 - 空字符串 method', async () => {
    const client = new MockHttpClient();
    
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            result: { ok: true },
            id: 1,
        },
    });

    await rpcModule.rpc_call(client as any, '/rpc', '', {}, 1);

    assert.strictEqual(client.lastRequest?.payload.method, '');
});

test('TC069 - 边界测试 - 复杂 params 对象', async () => {
    const client = new MockHttpClient();
    
    client.queueResponse({
        status_code: 200,
        body: {
            jsonrpc: '2.0',
            result: { echoed: true },
            id: 1,
        },
    });

    const complexParams = {
        nested: { a: 1, b: { c: 2 } },
        array: [1, 2, 3],
        nullValue: null,
        boolValue: true,
    };

    await rpcModule.rpc_call(client as any, '/rpc', 'test', complexParams, 1);

    assert.deepStrictEqual(client.lastRequest?.payload.params, complexParams);
});

// ============================================
// 第六部分：与 Python 版本兼容性测试
// ============================================

test('TC070 - Python 兼容性 - JsonRpcError 字段 (code, message, data)', () => {
    // Python:
    // class JsonRpcError(Exception):
    //     def __init__(self, code: int, message: str, data: Any = None):
    //         self.code = code
    //         self.message = message
    //         self.data = data
    
    const error = new JsonRpcError(-32600, 'Invalid Request', { extra: 'info' });
    
    // 验证字段与 Python 一致
    assert.strictEqual(typeof error.code, 'number');
    assert.strictEqual(typeof error.message, 'string');
    assert.ok(error.data !== undefined); // Python 允许 None/null
    
    // 验证消息格式与 Python 一致
    assert.strictEqual(error.message, 'JSON-RPC error -32600: Invalid Request');
});

test('TC071 - Python 兼容性 - 请求格式 jsonrpc: "2.0"', async () => {
    // Python:
    // payload = {
    //     "jsonrpc": "2.0",
    //     "method": method,
    //     "params": params or {},
    //     "id": request_id,
    // }
    
    const client = new MockHttpClient();
    client.queueResponse({
        status_code: 200,
        body: { jsonrpc: '2.0', result: {}, id: 1 },
    });

    await rpcModule.rpc_call(client as any, '/rpc', 'test', { key: 'value' }, 1);

    // 验证请求格式与 Python 一致
    assert.strictEqual(client.lastRequest?.payload.jsonrpc, '2.0');
    assert.strictEqual(typeof client.lastRequest?.payload.method, 'string');
    assert.ok(typeof client.lastRequest?.payload.params === 'object');
    assert.ok(client.lastRequest?.payload.id !== undefined);
});

test('TC072 - Python 兼容性 - 401 重试逻辑', async () => {
    // Python:
    // if resp.status_code == 401:
    //     auth.clear_token(server_url)
    //     auth_headers = auth.get_auth_header(server_url, force_new=True)
    //     resp = await client.post(endpoint, json=payload, headers=auth_headers)
    
    const client = new MockHttpClient();
    const auth = new MockAuthenticator();

    client.queueResponse({ status_code: 401, statusText: 'Unauthorized', body: {} });
    client.queueResponse({
        status_code: 200,
        headers: { authorization: 'DIDWBA new_token' },
        body: { jsonrpc: '2.0', result: { retry: 'success' }, id: 1 },
    });

    const result = await rpcModule.authenticated_rpc_call(
        client as any,
        '/rpc',
        'test',
        {},
        { auth }
    );

    assert.deepStrictEqual(result, { retry: 'success' });
    assert.strictEqual(client.requestCount, 2); // 重试一次
    assert.strictEqual(auth.clearTokenCallCount, 1); // 调用 clear_token
});

test('TC073 - Python 兼容性 - JWT 提取优先级 (响应头)', async () => {
    // Python:
    // auth_header_value = resp.headers.get("authorization", "")
    // new_token = auth.update_token(server_url, {"Authorization": auth_header_value})
    
    resetCredentialStore();
    rpcModule.set_update_jwt_function(mockUpdateJwtFunction);

    const client = new MockHttpClient();
    const auth = new MockAuthenticator();

    client.queueResponse({
        status_code: 200,
        headers: { authorization: 'DIDWBA from_header' },
        body: { jsonrpc: '2.0', result: {}, id: 1 },
    });

    await rpcModule.authenticated_rpc_call(client as any, '/rpc', 'test', {}, { auth });

    // 从响应头提取 JWT
    assert.strictEqual(mockCredentialStore?.token, 'from_header');
});

test('TC074 - Python 兼容性 - params null 转空对象', async () => {
    // Python: "params": params or {}
    
    const client = new MockHttpClient();
    client.queueResponse({
        status_code: 200,
        body: { jsonrpc: '2.0', result: {}, id: 1 },
    });

    await rpcModule.rpc_call(client as any, '/rpc', 'test', null, 1);

    // null 应该转为空对象
    assert.deepStrictEqual(client.lastRequest?.payload.params, {});
});

test('TC075 - Python 兼容性 - 默认 request_id 为 1', async () => {
    // Python: request_id: int | str = 1
    
    const client = new MockHttpClient();
    client.queueResponse({
        status_code: 200,
        body: { jsonrpc: '2.0', result: {}, id: 1 },
    });

    // 不传 request_id
    await rpcModule.rpc_call(client as any, '/rpc', 'test', {});

    assert.strictEqual(client.lastRequest?.payload.id, 1);
});

test('TC076 - Python 兼容性 - credential_name 默认值', async () => {
    // Python: credential_name: str = "default"
    
    resetCredentialStore();
    rpcModule.set_update_jwt_function(mockUpdateJwtFunction);

    const client = new MockHttpClient();
    const auth = new MockAuthenticator();

    client.queueResponse({
        status_code: 200,
        headers: { authorization: 'DIDWBA token' },
        body: { jsonrpc: '2.0', result: {}, id: 1 },
    });

    // 不传 credential_name
    await rpcModule.authenticated_rpc_call(client as any, '/rpc', 'test', {}, { auth });

    assert.strictEqual(mockCredentialStore?.name, 'default');
});

test('TC077 - Python 兼容性 - snake_case 命名一致', () => {
    // 验证所有公开 API 使用 snake_case 与 Python 一致
    const exports = Object.keys(rpcModule);
    
    // 函数名应该是 snake_case
    assert.ok(exports.includes('rpc_call'), 'rpc_call 应该存在 (snake_case)');
    assert.ok(exports.includes('authenticated_rpc_call'), 'authenticated_rpc_call 应该存在 (snake_case)');
    assert.ok(exports.includes('set_update_jwt_function'), 'set_update_jwt_function 应该存在 (snake_case)');
    
    // 不应该存在 camelCase 版本
    assert.strictEqual((rpcModule as any).rpcCall, undefined);
    assert.strictEqual((rpcModule as any).authenticatedRpcCall, undefined);
    assert.strictEqual((rpcModule as any).setUpdateJwtFunction, undefined);
});

// ============================================
// 第七部分：集成测试
// ============================================

test('TC080 - 集成测试 - 完整 RPC 调用流程', async () => {
    resetCredentialStore();
    rpcModule.set_update_jwt_function(mockUpdateJwtFunction);

    const client = new MockHttpClient('https://awiki.ai');
    const auth = new MockAuthenticator();

    // 模拟完整的 RPC 调用流程
    client.queueResponse({
        status_code: 200,
        headers: { authorization: 'DIDWBA jwt_after_call' },
        body: {
            jsonrpc: '2.0',
            result: { userId: 'user-123', action: 'registered' },
            id: 1,
        },
    });

    const result = await rpcModule.authenticated_rpc_call(
        client as any,
        '/user-service/did-auth/rpc',
        'register',
        { did: 'did:wba:awiki.ai:user:k1_test' },
        { auth, credential_name: 'awiki-agent' }
    );

    // 验证完整流程
    assert.deepStrictEqual(result, { userId: 'user-123', action: 'registered' });
    assert.strictEqual(client.requestCount, 1);
    assert.strictEqual(auth.getHeaderCallCount, 1);
    assert.strictEqual(auth.updateTokenCallCount, 1);
    assert.strictEqual(mockCredentialStore?.name, 'awiki-agent');
    assert.strictEqual(mockCredentialStore?.token, 'jwt_after_call');
});

test('TC081 - 集成测试 - 401 重试端到端', async () => {
    resetCredentialStore();
    rpcModule.set_update_jwt_function(mockUpdateJwtFunction);

    const client = new MockHttpClient();
    const auth = new MockAuthenticator();

    // 第一次 401 (token 过期)
    client.queueResponse({
        status_code: 401,
        statusText: 'Unauthorized',
        body: {},
    });
    // 第二次成功 (使用新 token)
    client.queueResponse({
        status_code: 200,
        headers: { authorization: 'DIDWBA refreshed_token_xyz' },
        body: {
            jsonrpc: '2.0',
            result: { message: 'success after retry' },
            id: 2,
        },
    });

    const result = await rpcModule.authenticated_rpc_call(
        client as any,
        '/user-service/did-auth/rpc',
        'sendMessage',
        { to: 'did:wba:target', content: 'hello' },
        { auth, credential_name: 'retry-test' }
    );

    // 验证端到端流程
    assert.deepStrictEqual(result, { message: 'success after retry' });
    assert.strictEqual(client.requestCount, 2); // 重试一次
    assert.strictEqual(auth.clearTokenCallCount, 1); // 清除过期 token
    assert.strictEqual(auth.getHeaderCallCount, 2); // 获取两次头
    assert.strictEqual(auth.lastForceNew, true); // 第二次强制刷新
    assert.strictEqual(mockCredentialStore?.name, 'retry-test');
    assert.strictEqual(mockCredentialStore?.token, 'refreshed_token_xyz');
});

test('TC082 - 集成测试 - 多次连续调用', async () => {
    resetCredentialStore();
    rpcModule.set_update_jwt_function(mockUpdateJwtFunction);

    const client = new MockHttpClient();
    const auth = new MockAuthenticator();

    // 第一次调用
    client.queueResponse({
        status_code: 200,
        headers: { authorization: 'DIDWBA token_1' },
        body: { jsonrpc: '2.0', result: { call: 1 }, id: 1 },
    });
    // 第二次调用
    client.queueResponse({
        status_code: 200,
        headers: { authorization: 'DIDWBA token_2' },
        body: { jsonrpc: '2.0', result: { call: 2 }, id: 2 },
    });
    // 第三次调用
    client.queueResponse({
        status_code: 200,
        headers: { authorization: 'DIDWBA token_3' },
        body: { jsonrpc: '2.0', result: { call: 3 }, id: 3 },
    });

    const result1 = await rpcModule.authenticated_rpc_call(client as any, '/rpc', 'call1', {}, { auth });
    const result2 = await rpcModule.authenticated_rpc_call(client as any, '/rpc', 'call2', {}, { auth });
    const result3 = await rpcModule.authenticated_rpc_call(client as any, '/rpc', 'call3', {}, { auth });

    assert.deepStrictEqual(result1, { call: 1 });
    assert.deepStrictEqual(result2, { call: 2 });
    assert.deepStrictEqual(result3, { call: 3 });
    assert.strictEqual(client.requestCount, 3);
    assert.strictEqual(mockCredentialStore?.token, 'token_3'); // 最后一次调用的 token
});

console.log('All tests completed!');
