/**
 * ws 模块类型定义
 *
 * 移植自：python/scripts/utils/ws.py
 */

import type { SDKConfig as BaseSDKConfig } from '@awiki/config';

/**
 * SDK 配置接口（扩展自基础配置）
 *
 * 对应 Python: utils.config.SDKConfig
 */
export type SDKConfig = BaseSDKConfig;

/**
 * DID 身份接口
 *
 * 对应 Python: utils.identity.DIDIdentity
 */
export interface DIDIdentity {
    /** JWT token */
    jwt_token: string;
    /** DID 标识符 */
    did?: string;
    /** 用户 ID (可选) */
    user_id?: string;
}

/**
 * JSON-RPC 请求结构
 */
export interface JsonRpcRequest {
    jsonrpc: '2.0';
    method: string;
    id: number;
    params?: Record<string, any>;
}

/**
 * JSON-RPC 响应结构
 */
export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: number;
    result?: any;
    error?: JsonRpcError;
}

/**
 * JSON-RPC 错误结构
 */
export interface JsonRpcError {
    code: number;
    message: string;
    data?: any;
}

/**
 * JSON-RPC 通知结构（无 id 字段）
 */
export interface JsonRpcNotification {
    jsonrpc: '2.0';
    method: string;
    params?: Record<string, any>;
}

/**
 * WebSocket 消息类型（响应或通知）
 */
export type WebSocketMessage = JsonRpcResponse | JsonRpcNotification;

/**
 * 发送消息选项
 *
 * 对应 Python: send_message() 参数
 */
export interface SendMessageOptions {
    /** 接收者 DID */
    receiver_did?: string;
    /** 接收者用户 ID */
    receiver_id?: string;
    /** 群组 DID */
    group_did?: string;
    /** 群组 ID */
    group_id?: string;
    /** 消息类型，默认 'text' */
    msg_type?: string;
    /** 客户端消息 ID（用于幂等投递），未提供时自动生成 uuid4 */
    client_msg_id?: string;
    /** 消息标题（可选） */
    title?: string;
}

/**
 * WsClient 配置选项
 */
export interface WsClientOptions {
    /** WebSocket 连接超时（毫秒），默认 10000 */
    connectTimeout?: number;
    /** 接收消息默认超时（毫秒），默认 10000 */
    receiveTimeout?: number;
}
