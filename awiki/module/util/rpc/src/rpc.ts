/**
 * JSON-RPC 2.0 客户端辅助函数
 *
 * 移植自：python/scripts/utils/rpc.py
 *
 * 功能：
 * - rpc_call(): 基础 JSON-RPC 调用
 * - authenticated_rpc_call(): 带 401 自动重试的认证调用
 */

import type { AsyncClient } from '@awiki/client';
import type { AuthRpcOptions, UpdateJwtFunction } from './types.js';
import { JsonRpcError } from './errors.js';

/**
 * 凭证存储更新函数 (模块级单例)
 *
 * 对应 Python: from credential_store import update_jwt
 */
let _updateJwtFn: UpdateJwtFunction | null = null;

/**
 * 设置凭证存储更新函数
 *
 * 必须在调用 authenticated_rpc_call 之前设置
 *
 * @param fn - 更新函数
 */
export function set_update_jwt_function(fn: UpdateJwtFunction): void {
    _updateJwtFn = fn;
}

/**
 * 发送 JSON-RPC 2.0 请求并返回结果
 *
 * 对应 Python: async def rpc_call(...)
 *
 * @param client - httpx async client (AsyncClient 实现)
 * @param endpoint - RPC 端点路径 (e.g., "/did-auth/rpc")
 * @param method - RPC 方法名 (e.g., "register")
 * @param params - 方法参数
 * @param request_id - 请求 ID (默认 1)
 * @returns JSON-RPC result 字段的值
 * @throws {JsonRpcError} 当服务器返回 JSON-RPC 错误时
 * @throws {Error} HTTP 层错误时抛出
 */
export async function rpc_call<T = any>(
    client: AsyncClient,
    endpoint: string,
    method: string,
    params: Record<string, any> | null = null,
    request_id: number | string = 1
): Promise<T> {
    // 构建 JSON-RPC 2.0 请求体
    // 对应 Python: params or {}
    const payload = {
        jsonrpc: '2.0' as const,
        method,
        params: params ?? {},
        id: request_id,
    };

    // 发送 POST 请求
    const response = await client.post(endpoint, payload);

    // 检查 HTTP 状态码错误
    const statusCode = (response as any).status_code ?? (response as any).statusCode;
    if (statusCode >= 400) {
        const statusText = (response as any).statusText ?? 'Unknown error';
        throw new Error(`HTTP ${statusCode}: ${statusText}`);
    }

    // 检查响应中的 error 字段
    const respBody = response as any;
    if (respBody.error !== undefined && respBody.error !== null) {
        const error = respBody.error;
        throw new JsonRpcError(
            error.code,
            error.message,
            error.data
        );
    }

    return respBody.result;
}

/**
 * 带自动 401 重试的 JSON-RPC 2.0 请求
 *
 * 对应 Python: async def authenticated_rpc_call(...)
 *
 * 使用 Authenticator 管理认证头和令牌缓存。
 * 收到 401 时自动清除过期令牌并重新生成认证头重试。
 *
 * 流程：
 * 1. 首次请求使用缓存的 JWT
 * 2. 收到 401 时清除过期令牌
 * 3. 强制重新生成认证头
 * 4. 重试请求
 * 5. 从响应头缓存新 JWT
 *
 * @param client - httpx async client (with base_url set)
 * @param endpoint - RPC 端点路径
 * @param method - RPC 方法名
 * @param params - 方法参数
 * @param options - 选项
 * @param options.auth - Authenticator 实例
 * @param options.credential_name - 凭证名称 (用于持久化新 JWT)
 * @returns JSON-RPC result 字段的值
 * @throws {JsonRpcError} 当服务器返回 JSON-RPC 错误时
 * @throws {Error} HTTP 层错误时抛出 (非 401)
 */
export async function authenticated_rpc_call<T = any>(
    client: AsyncClient,
    endpoint: string,
    method: string,
    params: Record<string, any> | null = null,
    options: AuthRpcOptions = {}
): Promise<T> {
    const { auth, credential_name = 'default' } = options;

    if (!auth) {
        throw new Error('authenticated_rpc_call requires an authenticator');
    }

    const serverUrl = client.baseURL;

    // 构建 JSON-RPC 2.0 请求体
    const payload = {
        jsonrpc: '2.0' as const,
        method,
        params: params ?? {},
        id: 1, // 默认请求 ID 为 1
    };

    // 获取认证头
    const authHeaders = auth.getAuthHeader(serverUrl);

    // 首次请求
    let response = await client.post(endpoint, payload, {
        headers: authHeaders,
    });

    // 401 -> 清除过期令牌 -> 重新认证 -> 重试
    const statusCode = (response as any).status_code ?? (response as any).statusCode;

    if (statusCode === 401) {
        // 清除过期令牌
        auth.clearToken(serverUrl);

        // 强制重新生成认证头
        const newAuthHeaders = auth.getAuthHeader(serverUrl, true);

        // 重试请求
        response = await client.post(endpoint, payload, {
            headers: newAuthHeaders,
        });
    }

    // 检查 HTTP 状态码错误 (非 401)
    const finalStatusCode = (response as any).status_code ?? (response as any).statusCode;
    if (finalStatusCode >= 400) {
        throw new Error(`HTTP ${finalStatusCode}: ${(response as any).statusText ?? 'Unknown error'}`);
    }

    // 成功：从响应头缓存新令牌
    // 注意：httpx 响应头键是小写的，DIDWbaAuthHeader.updateToken() 期望 "Authorization"
    const respHeaders = (response as any).headers ?? {};
    const authHeaderValue = respHeaders.authorization ?? respHeaders.Authorization ?? '';

    // 构造标准格式的头对象供 updateToken 使用
    const headersForUpdate: Record<string, string> = {
        Authorization: authHeaderValue,
    };

    const newToken = auth.updateToken(serverUrl, headersForUpdate);

    // 如果有新令牌，保存到凭证存储
    if (newToken && _updateJwtFn) {
        _updateJwtFn(credential_name, newToken);
    }

    // 检查 JSON-RPC 错误
    const finalRespBody = response as any;
    if (finalRespBody.error !== undefined && finalRespBody.error !== null) {
        const error = finalRespBody.error;
        throw new JsonRpcError(
            error.code,
            error.message,
            error.data
        );
    }

    return finalRespBody.result;
}
