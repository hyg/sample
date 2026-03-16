/**
 * httpx 库 JavaScript/TypeScript 移植 - HTTP 客户端工厂
 *
 * 对应 Python:
 * - utils/client.py: create_user_service_client(), create_molt_message_client()
 * - httpx.AsyncClient 创建和配置
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { ClientConfig, HttpClient, HttpResponse, VerifySetting } from './types';
import { handleHttpClientError, HTTPStatusError } from './errors';

/**
 * 解析 TLS 验证设置
 *
 * 对应 Python utils/client._resolve_verify()
 *
 * 优先级:
 * 1. AWIKI_CA_BUNDLE / E2E_CA_BUNDLE / SSL_CERT_FILE 环境变量
 * 2. 自动检测 mkcert 根证书 (用于本地 *.test 域名)
 * 3. 默认系统/Certifi 验证
 *
 * @param baseURL 基础 URL
 * @param caBundle 自定义 CA 证书路径 (可选)
 * @returns SSLContext 或 boolean
 */
export function _resolveVerify(baseURL: string, caBundle?: string): VerifySetting {
    // 1. 检查环境变量
    const envVars = ['AWIKI_CA_BUNDLE', 'E2E_CA_BUNDLE', 'SSL_CERT_FILE'];
    for (const envVar of envVars) {
        const candidate = process.env[envVar]?.trim();
        if (candidate && fs.existsSync(candidate)) {
            return {
                caFile: candidate,
                ca: fs.readFileSync(candidate),
            };
        }
    }

    // 2. 检查自定义 CA
    if (caBundle && fs.existsSync(caBundle)) {
        return {
            caFile: caBundle,
            ca: fs.readFileSync(caBundle),
        };
    }

    // 3. 检查本地 *.test 域名 (mkcert 支持)
    try {
        const { hostname } = new URL(baseURL);
        const lowerHost = hostname.toLowerCase();

        if (lowerHost.endsWith('.test') || lowerHost === 'localhost') {
            // macOS mkcert 路径
            const mkcertRoot = path.join(
                process.env['HOME'] || '',
                'Library',
                'Application Support',
                'mkcert',
                'rootCA.pem'
            );

            if (fs.existsSync(mkcertRoot)) {
                return {
                    caFile: mkcertRoot,
                    ca: fs.readFileSync(mkcertRoot),
                };
            }
        }
    } catch (e) {
        // URL 解析失败，返回默认验证
    }

    // 4. 默认验证
    return true;
}

/**
 * 创建 HTTPS Agent (如需要)
 *
 * @param verify TLS 验证设置
 * @returns https.Agent 或 undefined
 */
function _createHttpsAgent(verify: VerifySetting): https.Agent | undefined {
    if (typeof verify === 'boolean') {
        if (verify === false) {
            // 禁用 TLS 验证 (不推荐)
            return new https.Agent({ rejectUnauthorized: false });
        }
        // 默认验证，不需要自定义 agent
        return undefined;
    }

    // 使用自定义 CA
    return new https.Agent({
        ca: verify.ca,
        rejectUnauthorized: true,
    });
}

/**
 * 创建 HTTP 客户端
 *
 * 对应 Python httpx.AsyncClient()
 *
 * @param config 客户端配置
 * @returns HttpClient 实例
 */
export function createHttpClient(config: ClientConfig): HttpClient {
    const verify = _resolveVerify(config.baseURL, config.verify as string | undefined);
    const httpsAgent = _createHttpsAgent(verify);

    // 创建 axios 实例
    const axiosInstance = axios.create({
        baseURL: config.baseURL,
        timeout: (config.timeout || 30.0) * 1000, // 秒转毫秒
        httpsAgent,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...config.headers,
        },
        // trustEnv: false (axios 默认不使用环境变量中的代理)
        proxy: false,
        // 不自动抛出 HTTP 错误，让调用方自行处理
        validateStatus: () => true,
    });

    // 封装为 HttpClient
    const client: HttpClient = axiosInstance as HttpClient;
    client.baseURL = config.baseURL;
    client.timeout = (config.timeout || 30.0) * 1000;

    return client;
}

/**
 * 创建用户服务客户端
 *
 * 对应 Python utils/client.create_user_service_client()
 *
 * @param config 客户端配置
 * @returns HttpClient 实例
 */
export function createUserSvcClient(config: ClientConfig): HttpClient {
    return createHttpClient(config);
}

/**
 * 创建消息服务客户端
 *
 * 对应 Python utils/client.create_molt_message_client()
 *
 * @param config 客户端配置
 * @returns HttpClient 实例
 */
export function createMessageClient(config: ClientConfig): HttpClient {
    return createHttpClient(config);
}

/**
 * 发送 POST 请求 (JSON-RPC 风格)
 *
 * 对应 Python client.post(endpoint, json=payload)
 *
 * @param client HTTP 客户端
 * @param endpoint 端点路径
 * @param data 请求数据 (自动序列化为 JSON)
 * @param headers 额外请求头 (可选)
 * @returns HttpResponse
 */
export async function httpPost<T = any>(
    client: HttpClient,
    endpoint: string,
    data: Record<string, any>,
    headers?: Record<string, string>
): Promise<HttpResponse<T>> {
    try {
        const config: AxiosRequestConfig = headers ? { headers } : {};
        const response: AxiosResponse<T> = await client.post(endpoint, data, config);

        return {
            statusCode: response.status,
            statusText: response.statusText || 'Unknown',
            headers: response.headers as Record<string, string>,
            text: typeof response.data === 'string'
                ? response.data
                : JSON.stringify(response.data),
            content: Buffer.from(typeof response.data === 'string'
                ? response.data
                : JSON.stringify(response.data)),
            data: response.data,
            config: response.config,
        };
    } catch (error) {
        handleHttpClientError(error as any);
    }
}

/**
 * 发送 GET 请求
 *
 * 对应 Python client.get(url)
 *
 * @param client HTTP 客户端
 * @param url 请求 URL (相对于 baseURL 或完整 URL)
 * @param headers 额外请求头 (可选)
 * @returns HttpResponse
 */
export async function httpGet<T = any>(
    client: HttpClient,
    url: string,
    headers?: Record<string, string>
): Promise<HttpResponse<T>> {
    try {
        const config: AxiosRequestConfig = headers ? { headers } : {};
        const response: AxiosResponse<T> = await client.get(url, config);

        return {
            statusCode: response.status,
            statusText: response.statusText || 'Unknown',
            headers: response.headers as Record<string, string>,
            text: typeof response.data === 'string'
                ? response.data
                : JSON.stringify(response.data),
            content: Buffer.from(typeof response.data === 'string'
                ? response.data
                : JSON.stringify(response.data)),
            data: response.data,
            config: response.config,
        };
    } catch (error) {
        handleHttpClientError(error as any);
    }
}

/**
 * 检查响应状态并抛出错误
 *
 * 对应 Python response.raise_for_status()
 *
 * @param response HTTP 响应
 * @throws HTTPStatusError 如果状态码 >= 400
 */
export function raiseForStatus(response: HttpResponse): void {
    if (response.statusCode >= 400) {
        throw new HTTPStatusError(
            `HTTP error ${response.statusCode}: ${response.statusText}`,
            response.statusCode,
            response.statusText,
            response
        );
    }
}

/**
 * 从响应头获取值 (不区分大小写)
 *
 * 对应 Python response.headers.get()
 *
 * @param headers 响应头
 * @param name 头名称
 * @param defaultValue 默认值
 * @returns 头值或默认值
 */
export function getHeader(
    headers: Record<string, string>,
    name: string,
    defaultValue?: string
): string | undefined {
    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === lowerName) {
            return value;
        }
    }
    return defaultValue;
}
