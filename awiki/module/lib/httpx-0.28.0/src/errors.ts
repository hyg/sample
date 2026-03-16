/**
 * httpx 库 JavaScript/TypeScript 移植 - 错误类
 * 
 * 对应 Python httpx 的异常层次结构:
 * - HTTPError (基类)
 *   - HTTPStatusError (HTTP 错误状态)
 *   - RequestError (网络错误)
 *     - ConnectError, ReadError, WriteError, CloseError
 * - JsonRpcError (JSON-RPC 错误)
 */

import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { HttpResponse, JsonRpcErrorData } from './types';

/**
 * HTTP 错误基类
 * 
 * 对应 Python httpx.HTTPError
 */
export class HttpError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'HttpError';
    }
}

/**
 * HTTP 状态错误
 * 
 * 对应 Python httpx.HTTPStatusError
 * 当响应状态码为 4xx 或 5xx 时抛出
 */
export class HTTPStatusError extends HttpError {
    /** HTTP 状态码 */
    public readonly status: number;
    /** HTTP 状态文本 */
    public readonly statusText: string;
    /** 响应对象 */
    public readonly response: HttpResponse | undefined;

    constructor(message: string, status: number, statusText: string, response?: HttpResponse) {
        super(message);
        this.name = 'HTTPStatusError';
        this.status = status;
        this.statusText = statusText;
        this.response = response;
    }

    /**
     * 从 AxiosError 创建 HTTPStatusError
     */
    static fromAxiosError(error: AxiosError): HTTPStatusError {
        const status = error.response?.status || 0;
        const statusText = error.response?.statusText || 'Unknown';
        const message = `HTTP error ${status}: ${statusText}`;
        
        let httpResponse: HttpResponse | undefined;
        if (error.response) {
            httpResponse = {
                statusCode: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers as Record<string, string>,
                text: typeof error.response.data === 'string' 
                    ? error.response.data 
                    : JSON.stringify(error.response.data),
                content: Buffer.from(typeof error.response.data === 'string' 
                    ? error.response.data 
                    : JSON.stringify(error.response.data)),
                data: error.response.data,
                config: error.config || {} as InternalAxiosRequestConfig,
            };
        }
        
        return new HTTPStatusError(
            message,
            status,
            statusText,
            httpResponse
        );
    }
}

/**
 * 请求错误 (网络层错误)
 * 
 * 对应 Python httpx.RequestError
 * 当网络请求失败时抛出 (如连接超时、DNS 解析失败等)
 */
export class RequestError extends HttpError {
    /** 底层错误原因 */
    public readonly cause: Error | undefined;

    constructor(message: string, cause?: Error) {
        super(message);
        this.name = 'RequestError';
        this.cause = cause;
    }

    /**
     * 从 AxiosError 创建 RequestError
     */
    static fromAxiosError(error: AxiosError): RequestError {
        // 连接错误
        if (error.code === 'ECONNREFUSED') {
            return new ConnectError(`Connection refused: ${error.message}`, error);
        }
        
        // 超时错误
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            return new ConnectError(`Connection timeout: ${error.message}`, error);
        }
        
        // DNS 解析错误
        if (error.code === 'ENOTFOUND') {
            return new ConnectError(`DNS lookup failed: ${error.message}`, error);
        }
        
        // 其他网络错误
        return new RequestError(error.message || 'Unknown error', error);
    }
}

/**
 * 连接错误
 * 
 * 对应 Python httpx.ConnectError
 */
export class ConnectError extends RequestError {
    constructor(message: string, cause?: Error) {
        super(message, cause);
        this.name = 'ConnectError';
    }
}

/**
 * 读取错误
 * 
 * 对应 Python httpx.ReadError
 */
export class ReadError extends RequestError {
    constructor(message: string, cause?: Error) {
        super(message, cause);
        this.name = 'ReadError';
    }
}

/**
 * 写入错误
 * 
 * 对应 Python httpx.WriteError
 */
export class WriteError extends RequestError {
    constructor(message: string, cause?: Error) {
        super(message, cause);
        this.name = 'WriteError';
    }
}

/**
 * 连接关闭错误
 * 
 * 对应 Python httpx.CloseError
 */
export class CloseError extends RequestError {
    constructor(message: string, cause?: Error) {
        super(message, cause);
        this.name = 'CloseError';
    }
}

/**
 * JSON-RPC 错误
 * 
 * 对应 Python utils.rpc.JsonRpcError
 * 当服务器返回 JSON-RPC error 字段时抛出
 */
export class JsonRpcError extends HttpError {
    /** JSON-RPC 错误码 */
    public readonly code: number;
    /** JSON-RPC 错误数据 (可选) */
    public readonly data: any;

    constructor(code: number, message: string, data?: any) {
        super(`JSON-RPC error ${code}: ${message}`);
        this.name = 'JsonRpcError';
        this.code = code;
        this.data = data;
        // message 由 Error 基类继承
    }

    /**
     * 获取 JSON-RPC 错误消息 (覆盖基类 message)
     */
    public override toString(): string {
        return `JsonRpcError: ${this.code} - ${this.message}`;
    }

    /**
     * 从 JSON-RPC 错误数据创建
     */
    static fromErrorData(errorData: JsonRpcErrorData): JsonRpcError {
        return new JsonRpcError(
            errorData.code,
            errorData.message,
            errorData.data
        );
    }
}

/**
 * 处理 HTTP 客户端错误
 * 
 * 将 AxiosError 转换为适当的 httpx 风格错误
 * 
 * @param error AxiosError
 * @throws HTTPStatusError | RequestError
 */
export function handleHttpClientError(error: AxiosError): never {
    if (error.response) {
        // 服务器返回错误响应 (4xx, 5xx)
        throw HTTPStatusError.fromAxiosError(error);
    } else if (error.request) {
        // 请求已发送但无响应 (网络错误)
        throw RequestError.fromAxiosError(error);
    } else {
        // 其他错误 (配置错误等)
        throw new RequestError(error.message || 'Unknown error', error);
    }
}

/**
 * 检查是否为 axios 错误
 */
export function isAxiosError(error: unknown): error is AxiosError {
    return (error as AxiosError)?.isAxiosError === true;
}
