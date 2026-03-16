/**
 * ws 模块导出
 *
 * 移植自：python/scripts/utils/ws.py
 *
 * 提供：
 * - WsClient: WebSocket 客户端封装，用于 molt-message WebSocket 端点
 */

import WsClient from './ws.js';
import type {
    SDKConfig,
    DIDIdentity,
    JsonRpcRequest,
    JsonRpcResponse,
    JsonRpcNotification,
    JsonRpcError,
    WebSocketMessage,
    SendMessageOptions,
    WsClientOptions,
} from './types.js';

export {
    WsClient,
};

export type {
    SDKConfig,
    DIDIdentity,
    JsonRpcRequest,
    JsonRpcResponse,
    JsonRpcNotification,
    JsonRpcError,
    WebSocketMessage,
    SendMessageOptions,
    WsClientOptions,
};

export default {
    WsClient,
};
