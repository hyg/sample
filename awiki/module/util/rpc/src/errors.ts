/**
 * JSON-RPC 错误类
 *
 * 移植自：python/scripts/utils/rpc.py - JsonRpcError
 */

import type { JsonRpcErrorObject } from './types.js';

/**
 * JSON-RPC 错误响应异常类
 *
 * 对应 Python: class JsonRpcError(Exception)
 */
export class JsonRpcError extends Error {
    /** 错误代码 */
    public readonly code: number;
    /** 错误消息 */
    public readonly message: string;
    /** 错误数据 (可选) */
    public readonly data: any;

    /**
     * 创建 JSON-RPC 错误
     * @param code - 错误代码
     * @param message - 错误消息
     * @param data - 错误数据 (可选)
     */
    constructor(code: number, message: string, data?: any) {
        super(`JSON-RPC error ${code}: ${message}`);
        this.name = 'JsonRpcError';
        this.code = code;
        this.message = `JSON-RPC error ${code}: ${message}`;
        this.data = data;

        // 确保错误堆栈正确捕获
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, JsonRpcError);
        }
    }

    /**
     * 从响应错误对象创建异常
     * @param error - JSON-RPC 错误对象
     * @returns JsonRpcError 实例
     */
    static fromErrorObject(error: JsonRpcErrorObject): JsonRpcError {
        return new JsonRpcError(error.code, error.message, error.data);
    }

    /**
     * 返回错误字符串表示
     */
    toString(): string {
        return `${this.name}: ${this.message}`;
    }
}
