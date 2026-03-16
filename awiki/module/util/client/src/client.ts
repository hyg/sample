/**
 * HTTP 客户端工厂
 *
 * 移植自：python/scripts/utils/client.py
 *
 * 功能：创建预配置的 HTTP 客户端 (user-service 和 molt-message)
 *
 * 关键实现细节：
 * 1. _resolveVerify() 优先级逻辑：
 *    - AWIKI_CA_BUNDLE / E2E_CA_BUNDLE / SSL_CERT_FILE 环境变量
 *    - macOS mkcert 自动检测 (~/Library/Application Support/mkcert/rootCA.pem)
 *    - 默认系统验证
 * 2. trustEnv=false (不使用环境变量代理)
 * 3. timeout=30000 (固定 30 秒超时)
 */

import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import { AsyncClient, SDKConfig, VerifyConfig, RequestOptions } from './types.js';

/**
 * 解析 TLS 验证设置
 *
 * 优先级：
 * 1. AWIKI_CA_BUNDLE / E2E_CA_BUNDLE / SSL_CERT_FILE 环境变量
 * 2. macOS mkcert 自动检测 (~/Library/Application Support/mkcert/rootCA.pem)
 * 3. 默认系统验证
 *
 * @param baseUrl - 服务基础 URL
 * @returns SSL 验证配置 (boolean 或 https.Agent)
 */
function _resolveVerify(baseUrl: string): VerifyConfig {
    // 1. 检查环境变量指定的 CA bundle
    const envVars = ['AWIKI_CA_BUNDLE', 'E2E_CA_BUNDLE', 'SSL_CERT_FILE'];
    for (const envVar of envVars) {
        const candidate = process.env[envVar]?.trim();
        if (candidate && fs.existsSync(candidate)) {
            try {
                const stats = fs.statSync(candidate);
                if (!stats.isFile()) {
                    continue; // 跳过目录，继续检查下一个环境变量
                }
            } catch {
                continue; // stat 失败，继续检查下一个环境变量
            }
            const caContent = fs.readFileSync(candidate);
            return new https.Agent({
                ca: caContent,
                rejectUnauthorized: true,
            });
        }
    }

    // 2. 检查是否为本地 *.test 域名或 localhost
    let hostname: string;
    try {
        const parsedUrl = new URL(baseUrl);
        hostname = (parsedUrl.hostname || '').toLowerCase();
    } catch {
        // URL 解析失败，使用默认验证
        return true;
    }

    if (hostname.endsWith('.test') || hostname === 'localhost') {
        const mkcertRoot = path.join(
            process.env.HOME || process.env.USERPROFILE || '',
            'Library',
            'Application Support',
            'mkcert',
            'rootCA.pem'
        );
        if (fs.existsSync(mkcertRoot)) {
            try {
                const stats = fs.statSync(mkcertRoot);
                if (!stats.isFile()) {
                    return true;
                }
            } catch {
                return true;
            }
            const caContent = fs.readFileSync(mkcertRoot);
            return new https.Agent({
                ca: caContent,
                rejectUnauthorized: true,
            });
        }
    }

    // 3. 使用默认验证
    return true;
}

/**
 * 创建 HTTP 客户端实现类
 */
class HttpClientImpl implements AsyncClient {
    public readonly baseURL: string;
    public readonly timeout: number;
    public readonly httpsAgent?: https.Agent;
    public readonly trustEnv: false = false;

    private readonly agent: https.Agent | http.Agent;

    constructor(
        baseURL: string,
        verifyConfig: VerifyConfig,
        timeout: number = 30000
    ) {
        this.baseURL = baseURL;
        this.timeout = timeout;

        if (verifyConfig instanceof https.Agent) {
            this.httpsAgent = verifyConfig;
            this.agent = verifyConfig;
        } else if (verifyConfig === true) {
            // 使用默认 HTTPS Agent
            this.agent = new https.Agent({ rejectUnauthorized: true });
        } else {
            // verifyConfig === false，禁用证书验证 (不推荐)
            this.agent = new https.Agent({ rejectUnauthorized: false });
        }
    }

    /**
     * 构建完整 URL
     */
    private buildUrl(endpoint: string, params?: Record<string, any>): string {
        // 移除 endpoint 开头的斜杠，避免双斜杠
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
        const fullUrl = `${this.baseURL}/${cleanEndpoint}`;

        if (!params || Object.keys(params).length === 0) {
            return fullUrl;
        }

        const url = new URL(fullUrl);
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
            }
        }
        return url.toString();
    }

    async post<T = any>(
        endpoint: string,
        data?: any,
        options?: RequestOptions
    ): Promise<T> {
        const url = this.buildUrl(endpoint, options?.params);
        const timeout = options?.timeout ?? this.timeout;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...options?.headers,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: data !== undefined && data !== null ? JSON.stringify(data) : undefined,
            signal: AbortSignal.timeout(timeout),
            dispatcher: this.agent as any,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 处理空响应
        const text = await response.text();
        if (!text) {
            return {} as T;
        }
        return JSON.parse(text) as T;
    }

    async get<T = any>(
        endpoint: string,
        options?: RequestOptions
    ): Promise<T> {
        const url = this.buildUrl(endpoint, options?.params);
        const timeout = options?.timeout ?? this.timeout;
        const headers: Record<string, string> = {
            ...options?.headers,
        };

        const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(timeout),
            dispatcher: this.agent as any,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 处理空响应
        const text = await response.text();
        if (!text) {
            return {} as T;
        }
        return JSON.parse(text) as T;
    }

    async put<T = any>(
        endpoint: string,
        data?: any,
        options?: RequestOptions
    ): Promise<T> {
        const url = this.buildUrl(endpoint, options?.params);
        const timeout = options?.timeout ?? this.timeout;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...options?.headers,
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers,
            body: data !== undefined && data !== null ? JSON.stringify(data) : undefined,
            signal: AbortSignal.timeout(timeout),
            dispatcher: this.agent as any,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 处理空响应
        const text = await response.text();
        if (!text) {
            return {} as T;
        }
        return JSON.parse(text) as T;
    }

    async delete<T = any>(
        endpoint: string,
        options?: RequestOptions
    ): Promise<T> {
        const url = this.buildUrl(endpoint, options?.params);
        const timeout = options?.timeout ?? this.timeout;
        const headers: Record<string, string> = {
            ...options?.headers,
        };

        const response = await fetch(url, {
            method: 'DELETE',
            headers,
            signal: AbortSignal.timeout(timeout),
            dispatcher: this.agent as any,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 处理空响应
        const text = await response.text();
        if (!text) {
            return {} as T;
        }
        return JSON.parse(text) as T;
    }

    close(): void {
        this.agent.destroy();
    }
}

/**
 * 创建 user-service 异步 HTTP 客户端
 *
 * @param config - SDK 配置对象
 * @returns 配置好的 HTTP 客户端
 */
function createUserServiceClient(config: SDKConfig): AsyncClient {
    const verifyConfig = _resolveVerify(config.user_service_url);
    return new HttpClientImpl(config.user_service_url, verifyConfig, 30000);
}

/**
 * 创建 molt-message 异步 HTTP 客户端
 *
 * @param config - SDK 配置对象
 * @returns 配置好的 HTTP 客户端
 */
function createMoltMessageClient(config: SDKConfig): AsyncClient {
    const verifyConfig = _resolveVerify(config.molt_message_url);
    return new HttpClientImpl(config.molt_message_url, verifyConfig, 30000);
}

export {
    _resolveVerify,
    createUserServiceClient,
    createMoltMessageClient,
    HttpClientImpl,
};
