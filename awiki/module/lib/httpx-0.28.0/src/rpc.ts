/**
 * httpx 库 JavaScript/TypeScript 移植 - JSON-RPC 客户端
 * 
 * 对应 Python utils/rpc.py:
 * - rpc_call(): 发送 JSON-RPC 2.0 请求
 * - authenticated_rpc_call(): 带自动 401 重试的 RPC 调用
 * - JsonRpcError: JSON-RPC 错误异常类
 */

import { HttpClient } from './types';
import { JsonRpcError } from './errors';
import { httpPost, raiseForStatus, getHeader } from './client';
import type { AuthHeaderProvider } from './types';

/**
 * 发送 JSON-RPC 2.0 请求
 * 
 * 对应 Python utils/rpc.rpc_call()
 * 
 * @param client HTTP 客户端
 * @param endpoint RPC 端点路径 (如 "/did-auth/rpc")
 * @param method RPC 方法名 (如 "register")
 * @param params 方法参数
 * @param requestId 请求 ID (默认 1)
 * @returns RPC 结果
 * @throws JsonRpcError 当服务器返回 JSON-RPC 错误
 * @throws HTTPStatusError 当 HTTP 层错误
 */
export async function rpcCall<T = any>(
    client: HttpClient,
    endpoint: string,
    method: string,
    params: Record<string, any> | null = null,
    requestId: number | string = 1
): Promise<T> {
    const payload = {
        jsonrpc: '2.0' as const,
        method,
        params: params || {},
        id: requestId,
    };

    const response = await httpPost(client, endpoint, payload);
    raiseForStatus(response);

    const body = response.data as any;
    if (body.error !== undefined && body.error !== null) {
        const error = body.error;
        throw new JsonRpcError(
            error.code,
            error.message,
            error.data
        );
    }

    return body.result as T;
}

/**
 * 带认证的 JSON-RPC 2.0 请求 (自动 401 重试)
 * 
 * 对应 Python utils/rpc.authenticated_rpc_call()
 * 
 * 使用 DIDWbaAuthHeader 管理认证头和 token 缓存。
 * 遇到 401 时，自动清除过期 token 并重新生成认证头后重试。
 * 
 * @param client HTTP 客户端 (已设置 baseURL)
 * @param endpoint RPC 端点路径
 * @param method RPC 方法名
 * @param params 方法参数
 * @param requestId 请求 ID (默认 1)
 * @param auth 认证提供者 (DIDWbaAuthHeader 实例)
 * @param credentialName 凭证名称 (用于保存新 JWT)
 * @returns RPC 结果
 * @throws JsonRpcError 当服务器返回 JSON-RPC 错误
 * @throws HTTPStatusError 当 HTTP 层错误 (非 401)
 */
export async function authenticatedRpcCall<T = any>(
    client: HttpClient,
    endpoint: string,
    method: string,
    params: Record<string, any> | null = null,
    requestId: number | string = 1,
    options: {
        auth?: AuthHeaderProvider;
        credentialName?: string;
    } = {}
): Promise<T> {
    const { auth, credentialName = 'default' } = options;
    const serverUrl = client.baseURL;

    const payload = {
        jsonrpc: '2.0' as const,
        method,
        params: params || {},
        id: requestId,
    };

    if (!auth) {
        // 无认证，直接发送请求
        return rpcCall(client, endpoint, method, params, requestId);
    }

    // 获取认证头
    let authHeaders = auth.getAuthHeader(serverUrl);
    let response = await httpPost(client, endpoint, payload, authHeaders);

    // 401 -> 清除过期 token -> 重新认证 -> 重试
    if (response.statusCode === 401) {
        auth.clearToken(serverUrl);
        authHeaders = auth.getAuthHeader(serverUrl, true);
        response = await httpPost(client, endpoint, payload, authHeaders);
    }

    raiseForStatus(response);

    // 成功：从响应头缓存新 token
    // 注意：axios 响应头键是小写的，DIDWbaAuthHeader.update_token() 期望 "Authorization"
    const authHeaderValue = getHeader(response.headers, 'authorization', '') || '';
    const newToken = auth.updateToken(serverUrl, { 'Authorization': authHeaderValue });
    
    if (newToken && credentialName) {
        // 保存新 JWT 到凭证存储
        // 注意：这里需要外部传入 updateJwt 函数，避免循环依赖
        // 调用方需要自行处理凭证持久化
    }

    const body = response.data as any;
    if (body.error !== undefined && body.error !== null) {
        const error = body.error;
        throw new JsonRpcError(
            error.code,
            error.message,
            error.data
        );
    }

    return body.result as T;
}

/**
 * JSON-RPC 批量请求
 * 
 * 对应 Python 可能的批量 RPC 调用场景
 * 
 * @param client HTTP 客户端
 * @param endpoint RPC 端点路径
 * @param requests 请求数组 [{method, params, id}, ...]
 * @returns 响应数组
 */
export async function batchRpcCall<T = any>(
    client: HttpClient,
    endpoint: string,
    requests: Array<{
        method: string;
        params?: Record<string, any>;
        id?: number | string;
    }>
): Promise<Array<T | JsonRpcError>> {
    const payload = requests.map((req, index) => ({
        jsonrpc: '2.0' as const,
        method: req.method,
        params: req.params || {},
        id: req.id !== undefined ? req.id : index,
    }));

    const response = await httpPost(client, endpoint, payload);
    raiseForStatus(response);

    const body = response.data as any[];
    
    return body.map((item: any) => {
        if (item.error !== undefined && item.error !== null) {
            return new JsonRpcError(
                item.error.code,
                item.error.message,
                item.error.data
            );
        }
        return item.result as T;
    });
}
