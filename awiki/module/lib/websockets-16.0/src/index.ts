/**
 * websockets 库 JavaScript/TypeScript 移植
 * 
 * 版本：16.0
 * 底层实现：ws
 * 
 * @module websockets-16.0
 * 
 * @example
 * ```typescript
 * import { WsClient } from 'websockets-16.0';
 * 
 * const client = new WsClient({
 *     url: 'https://awiki.ai',
 *     token: 'jwt_token',
 * });
 * 
 * await client.connect();
 * 
 * // 发送消息
 * const result = await client.send_message({
 *     content: 'Hello!',
 *     receiverDid: 'did:wba:...',
 * });
 * 
 * // 接收通知
 * const notification = await client.receive_notification(5.0);
 * 
 * await client.close();
 * ```
 */

// 客户端类
export { WsClient } from './client';

// 错误类
export {
    ConnectionClosedError,
    NotConnectedError,
    JsonRpcError,
    TimeoutError,
    ConnectionError,
    UrlConversionError,
    MissingJwtTokenError,
} from './errors';

// 类型定义
export type {
    WsClientConfig,
    SendMessageParams,
    JsonRpcMessage,
    JsonRpcRequest,
    JsonRpcResponse,
    JsonRpcNotification,
    JsonRpcError as IJsonRpcError,
    WebSocketState,
    WebSocketEvents,
    PushNotification,
} from './types';

// 默认导出
export default WsClient;
