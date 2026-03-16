/**
 * RPC 模块类型定义
 *
 * 移植自：python/scripts/utils/rpc.py
 */

import type { AsyncClient } from '@awiki/client';

/**
 * JSON-RPC 请求体
 */
export interface JsonRpcRequest {
    jsonrpc: '2.0';
    method: string;
    params: Record<string, any>;
    id: number | string;
}

/**
 * JSON-RPC 错误对象
 */
export interface JsonRpcErrorObject {
    code: number;
    message: string;
    data?: any;
}

/**
 * JSON-RPC 响应体
 */
export interface JsonRpcResponse<T = any> {
    jsonrpc: '2.0';
    result?: T;
    error?: JsonRpcErrorObject;
    id: number | string;
}

/**
 * 认证器接口
 *
 * 对应 Python: DIDWbaAuthHeader
 */
export interface Authenticator {
    /**
     * 获取认证头
     * @param serverUrl - 服务器 URL
     * @param forceNew - 是否强制生成新头
     * @returns 认证头对象
     */
    getAuthHeader(serverUrl: string, forceNew?: boolean): Record<string, string>;

    /**
     * 清除过期令牌
     * @param serverUrl - 服务器 URL
     */
    clearToken(serverUrl: string): void;

    /**
     * 从响应更新令牌
     * @param serverUrl - 服务器 URL
     * @param headers - 响应头对象
     * @returns 新令牌 (如果有)
     */
    updateToken(serverUrl: string, headers: Record<string, string>): string | null;
}

/**
 * 认证 RPC 调用选项
 * 
 * 对应 Python: authenticated_rpc_call 关键字参数
 */
export interface AuthRpcOptions {
    /** 认证器实例 */
    auth?: Authenticator;
    /** 凭证名称 (用于持久化新 JWT) - snake_case 与 Python 一致 */
    credential_name?: string;
}

/**
 * 凭证存储更新函数类型
 */
export type UpdateJwtFunction = (credentialName: string, token: string) => void;

/**
 * RPC 客户端接口
 */
export interface RpcClient {
    /**
     * 发送 JSON-RPC 请求
     * @param client - HTTP 客户端
     * @param endpoint - RPC 端点路径
     * @param method - RPC 方法名
     * @param params - 方法参数
     * @param request_id - 请求 ID
     * @returns 响应结果
     */
    rpc_call<T = any>(
        client: AsyncClient,
        endpoint: string,
        method: string,
        params?: Record<string, any> | null,
        request_id?: number | string
    ): Promise<T>;

    /**
     * 带认证的 JSON-RPC 调用
     * @param client - HTTP 客户端
     * @param endpoint - RPC 端点
     * @param method - 方法名
     * @param params - 参数
     * @param options - 选项
     * @returns 响应结果
     */
    authenticated_rpc_call<T = any>(
        client: AsyncClient,
        endpoint: string,
        method: string,
        params?: Record<string, any> | null,
        options?: AuthRpcOptions
    ): Promise<T>;
}
