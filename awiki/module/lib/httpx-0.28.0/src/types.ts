/**
 * httpx 库 JavaScript/TypeScript 移植 - 类型定义
 * 
 * 基于 Python httpx 0.28.0 API 设计
 * 使用 axios 作为底层 HTTP 客户端
 */

import { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * HTTP 客户端配置接口
 * 
 * 对应 Python httpx.AsyncClient 的参数
 */
export interface ClientConfig {
    /** 基础 URL (对应 base_url) */
    baseURL: string;
    /** 超时时间 (秒)，对应 timeout (默认 30.0) */
    timeout?: number;
    /** 是否信任环境变量中的代理/证书配置 (默认 false) */
    trustEnv?: boolean;
    /** SSL/TLS 验证配置 (对应 verify) */
    verify?: boolean | string;
    /** 默认请求头 */
    headers?: Record<string, string>;
}

/**
 * SSL/TLS 验证设置
 * 
 * 对应 Python ssl.SSLContext 或 bool
 */
export type VerifySetting = boolean | SSLContext;

/**
 * SSL 上下文配置
 * 
 * 对应 Python ssl.create_default_context(cafile=...)
 */
export interface SSLContext {
    /** CA 证书文件路径 */
    caFile?: string;
    /** CA 证书内容 */
    ca?: Buffer;
}

/**
 * HTTP 响应接口
 * 
 * 对应 Python httpx.Response
 */
export interface HttpResponse<T = any> {
    /** HTTP 状态码 (对应 status_code) */
    statusCode: number;
    /** HTTP 状态文本 (对应 reason_phrase) */
    statusText: string;
    /** 响应头 (对应 headers) */
    headers: Record<string, string>;
    /** 响应体文本 (对应 text) */
    text: string;
    /** 响应体字节 (对应 content) */
    content: Buffer;
    /** JSON 解析结果 (对应 json()) */
    data: T;
    /** 请求配置 */
    config: AxiosRequestConfig;
}

/**
 * JSON-RPC 2.0 请求体
 */
export interface JsonRpcRequest {
    jsonrpc: '2.0';
    method: string;
    params: Record<string, any>;
    id: number | string;
}

/**
 * JSON-RPC 2.0 响应体
 */
export interface JsonRpcResponse<T = any> {
    jsonrpc: '2.0';
    result?: T;
    error?: JsonRpcErrorData;
    id: number | string;
}

/**
 * JSON-RPC 错误数据
 */
export interface JsonRpcErrorData {
    code: number;
    message: string;
    data?: any;
}

/**
 * HTTP 客户端实例类型
 * 
 * 封装 axios.AxiosInstance，添加 httpx 风格的 API
 */
export interface HttpClient extends AxiosInstance {
    /** 基础 URL */
    baseURL: string;
    /** 超时时间 (毫秒) */
    timeout: number;
}

/**
 * 认证头管理器接口
 * 
 * 用于 authenticated_rpc_call 的 auth 参数
 */
export interface AuthHeaderProvider {
    /** 获取认证头 */
    getAuthHeader(serverUrl: string, forceNew?: boolean): Record<string, string>;
    /** 清除过期 token */
    clearToken(serverUrl: string): void;
    /** 更新 token (从响应头) */
    updateToken(serverUrl: string, responseHeaders: Record<string, string>): string | null;
}

/**
 * RPC 调用选项
 */
export interface RpcCallOptions {
    /** 请求 ID (默认 1) */
    requestId?: number | string;
    /** 认证提供者 */
    auth?: AuthHeaderProvider;
    /** 凭证名称 (用于保存 JWT) */
    credentialName?: string;
}
