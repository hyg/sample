/**
 * httpx 库 JavaScript/TypeScript 移植
 * 
 * 基于 Python httpx 0.28.0 API 设计
 * 使用 axios 作为底层 HTTP 客户端
 * 
 * @module httpx
 */

// 类型导出
export {
    ClientConfig,
    VerifySetting,
    SSLContext,
    HttpResponse,
    JsonRpcRequest,
    JsonRpcResponse,
    JsonRpcErrorData,
    HttpClient,
    AuthHeaderProvider,
    RpcCallOptions,
} from './types';

// 错误类导出
export {
    HttpError,
    HTTPStatusError,
    RequestError,
    ConnectError,
    ReadError,
    WriteError,
    CloseError,
    JsonRpcError,
    handleHttpClientError,
    isAxiosError,
} from './errors';

// 客户端工厂导出
export {
    _resolveVerify,
    createHttpClient,
    createUserSvcClient,
    createMessageClient,
    httpPost,
    httpGet,
    raiseForStatus,
    getHeader,
} from './client';

// JSON-RPC 客户端导出
export {
    rpcCall,
    authenticatedRpcCall,
    batchRpcCall,
} from './rpc';

/**
 * 版本信息
 */
export const VERSION = '0.28.0';

// 导入用于默认导出的内容
import { createHttpClient, createUserSvcClient, createMessageClient, httpPost, httpGet, raiseForStatus, getHeader, _resolveVerify } from './client';
import { rpcCall, authenticatedRpcCall, batchRpcCall } from './rpc';
import {
    HttpError,
    HTTPStatusError,
    RequestError,
    ConnectError,
    ReadError,
    WriteError,
    CloseError,
    JsonRpcError,
    handleHttpClientError,
    isAxiosError,
} from './errors';

/**
 * 默认导出
 * 
 * 提供与 Python httpx 类似的默认导出
 */
const httpx = {
    // 客户端工厂
    createHttpClient,
    createUserSvcClient,
    createMessageClient,
    // RPC 调用
    rpcCall,
    authenticatedRpcCall,
    batchRpcCall,
    // 错误类
    HttpError,
    HTTPStatusError,
    RequestError,
    ConnectError,
    ReadError,
    WriteError,
    CloseError,
    JsonRpcError,
    // 工具函数
    _resolveVerify,
    httpPost,
    httpGet,
    raiseForStatus,
    getHeader,
    handleHttpClientError,
    isAxiosError,
    // 版本
    VERSION,
};

export default httpx;
