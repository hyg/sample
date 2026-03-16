/**
 * httpx 库使用示例
 * 
 * 演示如何使用移植的 httpx JavaScript/TypeScript 客户端
 */

import {
    createHttpClient,
    createUserSvcClient,
    createMessageClient,
    rpcCall,
    authenticatedRpcCall,
    httpPost,
    httpGet,
    raiseForStatus,
    getHeader,
    HTTPStatusError,
    RequestError,
    JsonRpcError,
    _resolveVerify,
} from './index';

// ============================================================================
// 示例 1: 创建 HTTP 客户端
// ============================================================================

async function example1_createClient() {
    // 基本客户端创建
    const client = createHttpClient({
        baseURL: 'https://awiki.ai',
        timeout: 30.0,  // 秒
    });

    console.log('Client created:', client.baseURL);
    console.log('Timeout:', client.timeout, 'ms');
}

// ============================================================================
// 示例 2: TLS 验证配置
// ============================================================================

async function example2_tlsVerification() {
    // 自动检测 CA 证书 (通过环境变量)
    process.env.AWIKI_CA_BUNDLE = '/path/to/ca.pem';
    
    const verify = _resolveVerify('https://api.awiki.test');
    console.log('TLS verify setting:', verify);

    // 使用自定义 CA 创建客户端
    const client = createHttpClient({
        baseURL: 'https://api.awiki.test',
        verify: '/path/to/ca.pem',
    });
}

// ============================================================================
// 示例 3: 发送 POST 请求
// ============================================================================

async function example3_postRequest() {
    const client = createUserSvcClient({
        baseURL: 'https://awiki.ai',
        timeout: 30.0,
    });

    try {
        const response = await httpPost(
            client,
            '/user-service/did-auth/rpc',
            {
                jsonrpc: '2.0',
                method: 'register',
                params: {
                    did_document: { /* ... */ },
                    name: 'Test User',
                },
                id: 1,
            }
        );

        console.log('Status:', response.statusCode);
        console.log('Result:', response.data.result);
    } catch (error) {
        if (error instanceof JsonRpcError) {
            console.error('JSON-RPC error:', error.code, error.message);
        } else if (error instanceof HTTPStatusError) {
            console.error('HTTP error:', error.status, error.statusText);
        } else if (error instanceof RequestError) {
            console.error('Network error:', error.message);
        }
    }
}

// ============================================================================
// 示例 4: 发送 GET 请求
// ============================================================================

async function example4_getRequest() {
    const client = createHttpClient({
        baseURL: 'https://awiki.ai',
        timeout: 10.0,
    });

    try {
        const response = await httpGet(
            client,
            '/user-service/.well-known/handle/alice'
        );

        console.log('Status:', response.statusCode);
        console.log('Data:', response.data);
        
        // 读取响应头 (不区分大小写)
        const contentType = getHeader(response.headers, 'Content-Type');
        console.log('Content-Type:', contentType);
    } catch (error) {
        if (error instanceof HTTPStatusError) {
            if (error.status === 404) {
                console.log('Handle not found');
            }
        }
    }
}

// ============================================================================
// 示例 5: JSON-RPC 调用
// ============================================================================

async function example5_jsonRpc() {
    const client = createUserSvcClient({
        baseURL: 'https://awiki.ai',
        timeout: 30.0,
    });

    try {
        // 基本 RPC 调用
        const result = await rpcCall(
            client,
            '/user-service/did-auth/rpc',
            'register',
            {
                did_document: { /* ... */ },
                name: 'Test User',
            },
            1  // request ID
        );

        console.log('RPC result:', result);
    } catch (error) {
        if (error instanceof JsonRpcError) {
            console.error('RPC error:', error.code, error.message);
        }
    }
}

// ============================================================================
// 示例 6: 带认证的 RPC 调用 (自动 401 重试)
// ============================================================================

async function example6_authenticatedRpc() {
    const client = createUserSvcClient({
        baseURL: 'https://awiki.ai',
        timeout: 30.0,
    });

    // 模拟认证提供者
    const authProvider = {
        getAuthHeader(serverUrl: string, forceNew = false) {
            return { 'Authorization': 'DIDWba ...' };
        },
        clearToken(serverUrl: string) {
            console.log('Token cleared');
        },
        updateToken(serverUrl: string, headers: Record<string, string>) {
            const auth = headers['Authorization'] || headers['authorization'];
            if (auth?.startsWith('Bearer ')) {
                return auth.substring(7);
            }
            return null;
        },
    };

    try {
        const result = await authenticatedRpcCall(
            client,
            '/group/rpc',
            'create',
            {
                name: 'Test Group',
                slug: 'test-group',
            },
            1,
            {
                auth: authProvider,
                credentialName: 'default',
            }
        );

        console.log('Authenticated RPC result:', result);
    } catch (error) {
        if (error instanceof JsonRpcError) {
            console.error('RPC error:', error.code, error.message);
        }
    }
}

// ============================================================================
// 示例 7: 错误处理
// ============================================================================

async function example7_errorHandling() {
    const client = createHttpClient({
        baseURL: 'https://awiki.ai',
        timeout: 30.0,
    });

    try {
        const response = await httpPost(client, '/rpc', { test: 'data' });
        raiseForStatus(response);  // 检查状态码
        console.log('Success:', response.data);
    } catch (error) {
        if (error instanceof HTTPStatusError) {
            console.error(`HTTP ${error.status}: ${error.statusText}`);
            console.error('Response:', error.response?.data);
        } else if (error instanceof JsonRpcError) {
            console.error(`JSON-RPC ${error.code}: ${error.message}`);
        } else if (error instanceof RequestError) {
            console.error('Network error:', error.message);
            if (error.cause) {
                console.error('Cause:', error.cause.message);
            }
        }
    }
}

// ============================================================================
// 示例 8: 完整 DID 注册流程
// ============================================================================

async function example8_completeFlow() {
    // 创建客户端
    const client = createUserSvcClient({
        baseURL: 'https://awiki.ai',
        timeout: 30.0,
    });

    try {
        // 1. 注册 DID
        const registerResult = await rpcCall(
            client,
            '/user-service/did-auth/rpc',
            'register',
            {
                did_document: { /* ... */ },
                name: 'Alice',
                is_public: true,
            }
        );
        console.log('Registered:', registerResult);

        // 2. 获取 JWT
        const verifyResult = await rpcCall(
            client,
            '/user-service/did-auth/rpc',
            'verify',
            {
                authorization: 'DIDWba ...',
                domain: 'awiki.ai',
            }
        );
        console.log('JWT:', verifyResult.access_token);

        // 3. 使用 JWT 调用认证 API
        // (需要实际的认证提供者实现)
    } catch (error) {
        console.error('Flow error:', error);
    }
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
    console.log('=== httpx JavaScript/TypeScript 使用示例 ===\n');

    // 运行示例 (取消注释以运行)
    // await example1_createClient();
    // await example2_tlsVerification();
    // await example3_postRequest();
    // await example4_getRequest();
    // await example5_jsonRpc();
    // await example6_authenticatedRpc();
    // await example7_errorHandling();
    // await example8_completeFlow();

    console.log('示例代码已加载，取消注释相应函数以运行');
}

// 运行主函数
main().catch(console.error);
