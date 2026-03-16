/**
 * client 模块类型定义
 * 
 * 移植自：python/scripts/utils/client.py
 */

import * as https from 'https';

/**
 * SDK 配置接口
 * 
 * 对应 Python: utils.config.SDKConfig
 */
export interface SDKConfig {
    /** user-service 服务 URL */
    user_service_url: string;
    /** molt-message 服务 URL */
    molt_message_url: string;
    /** molt-message WebSocket URL (可选) */
    molt_message_ws_url?: string;
    /** DID 域名 */
    did_domain: string;
    /** 凭证目录路径 */
    credentials_dir: string;
    /** 数据目录路径 */
    data_dir: string;
}

/**
 * TLS 验证配置结果
 * 
 * 对应 Python: bool | ssl.SSLContext
 */
export type VerifyConfig = boolean | https.Agent;

/**
 * HTTP 客户端接口
 * 
 * 对应 Python: httpx.AsyncClient
 */
export interface AsyncClient {
    /** 基础 URL */
    readonly baseURL: string;
    /** 超时时间 (毫秒) */
    readonly timeout: number;
    /** HTTPS Agent (如果配置了自定义 CA) */
    readonly httpsAgent?: https.Agent;
    /** 是否信任环境变量 (固定为 false) */
    readonly trustEnv: false;
    
    /**
     * 发送 POST 请求
     * @param endpoint - 端点路径
     * @param data - 请求数据
     * @param options - 可选配置
     */
    post<T = any>(endpoint: string, data?: any, options?: RequestOptions): Promise<T>;
    
    /**
     * 发送 GET 请求
     * @param endpoint - 端点路径
     * @param options - 可选配置
     */
    get<T = any>(endpoint: string, options?: RequestOptions): Promise<T>;
    
    /**
     * 发送 PUT 请求
     * @param endpoint - 端点路径
     * @param data - 请求数据
     * @param options - 可选配置
     */
    put<T = any>(endpoint: string, data?: any, options?: RequestOptions): Promise<T>;
    
    /**
     * 发送 DELETE 请求
     * @param endpoint - 端点路径
     * @param options - 可选配置
     */
    delete<T = any>(endpoint: string, options?: RequestOptions): Promise<T>;
    
    /**
     * 关闭客户端连接
     */
    close(): void;
}

/**
 * 请求选项接口
 */
export interface RequestOptions {
    /** 请求头 */
    headers?: Record<string, string>;
    /** 查询参数 */
    params?: Record<string, any>;
    /** 超时覆盖 (毫秒) */
    timeout?: number;
}

/**
 * 客户端工厂函数类型
 */
export type ClientFactory = (config: SDKConfig) => AsyncClient;
