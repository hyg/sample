/**
 * WebSocket 客户端错误类
 * 
 * 对应 Python websockets 库的异常体系
 */

/**
 * WebSocket 连接关闭错误
 * 
 * 对应 Python: websockets.exceptions.ConnectionClosed
 */
export class ConnectionClosedError extends Error {
    /** WebSocket 关闭码 */
    public readonly code: number;
    /** 关闭原因 */
    public readonly reason: string;

    constructor(code: number, reason: string = '') {
        super(`Connection closed: ${code} ${reason ? reason : ''}`.trim());
        this.name = 'ConnectionClosedError';
        this.code = code;
        this.reason = reason;
    }
}

/**
 * WebSocket 未连接错误
 * 
 * 对应 Python: RuntimeError("WebSocket not connected")
 */
export class NotConnectedError extends Error {
    constructor(message: string = 'WebSocket not connected') {
        super(message);
        this.name = 'NotConnectedError';
    }
}

/**
 * JSON-RPC 错误
 * 
 * 对应 Python: RuntimeError("JSON-RPC error {code}: {message}")
 */
export class JsonRpcError extends Error {
    /** 错误码 */
    public readonly code: number;
    /** 错误数据 */
    public readonly data?: unknown;

    constructor(code: number, message: string, data?: unknown) {
        super(`JSON-RPC error ${code}: ${message}`);
        this.name = 'JsonRpcError';
        this.code = code;
        this.data = data;
    }
}

/**
 * WebSocket 超时错误
 * 
 * 对应 Python: asyncio.TimeoutError
 */
export class TimeoutError extends Error {
    constructor(message: string = 'Operation timed out') {
        super(message);
        this.name = 'TimeoutError';
    }
}

/**
 * WebSocket 连接错误
 * 
 * 对应 Python: websockets.exceptions.InvalidURI 等连接异常
 */
export class ConnectionError extends Error {
    /** 底层错误 */
    public readonly cause?: Error;

    constructor(message: string, cause?: Error) {
        super(message);
        this.name = 'ConnectionError';
        this.cause = cause;
    }
}

/**
 * WebSocket URL 转换错误
 */
export class UrlConversionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UrlConversionError';
    }
}

/**
 * JWT Token 缺失错误
 * 
 * 对应 Python: ValueError("identity missing jwt_token")
 */
export class MissingJwtTokenError extends Error {
    constructor(message: string = 'identity missing jwt_token') {
        super(message);
        this.name = 'MissingJwtTokenError';
    }
}
