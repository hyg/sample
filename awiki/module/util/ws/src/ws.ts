/**
 * WebSocket 客户端封装
 *
 * 移植自：python/scripts/utils/ws.py
 *
 * 功能：molt-message WebSocket 客户端封装，支持 JSON-RPC 请求和推送通知接收
 *
 * 关键实现细节：
 * 1. URL 转换：http:// -> ws://, https:// -> wss://
 * 2. JWT 通过查询参数传递：?token={jwt}
 * 3. 推送通知识别：无 id 字段
 * 4. client_msg_id 自动生成（uuid4）
 * 5. 请求 ID 自增
 * 6. SSL 配置使用 _resolveVerify() (来自 client 模块)
 *
 * [PROTOCOL]:
 * 1. 更新此头部当逻辑变化时
 * 2. 更新后检查文件夹的 CLAUDE.md
 */

import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import * as https from 'https';
import * as http from 'http';

import type {
    SDKConfig,
    DIDIdentity,
    JsonRpcRequest,
    JsonRpcResponse,
    JsonRpcNotification,
    WebSocketMessage,
    SendMessageOptions,
    WsClientOptions,
} from './types.js';
import { _resolveVerify } from '@awiki/client';

/**
 * molt-message WebSocket 客户端
 *
 * 使用 JWT Bearer 认证连接到 WebSocket 端点，
 * 支持 JSON-RPC 请求发送和推送通知接收。
 *
 * @example
 * ```typescript
 * // 使用异步上下文管理器
 * const ws = new WsClient(config, identity);
 * try {
 *     await ws.connect();
 *
 *     // 发送消息
 *     const result = await ws.sendMessage({
 *         content: "Hello!",
 *         receiver_did: "did:wba:...",
 *     });
 *
 *     // 接收推送通知
 *     const notification = await ws.receiveNotification({ timeout: 5000 });
 * } finally {
 *     await ws.close();
 * }
 * ```
 *
 * 对应 Python: WsClient
 */
export class WsClient {
    private readonly config: SDKConfig;
    private readonly identity: DIDIdentity;
    private readonly options: Required<WsClientOptions>;
    private ws: WebSocket | null;
    private requestId: number;

    /**
     * 创建 WsClient 实例
     *
     * @param config - SDK 配置
     * @param identity - DID 身份（包含 JWT token）
     * @param options - 可选配置选项
     */
    constructor(
        config: SDKConfig,
        identity: DIDIdentity,
        options?: WsClientOptions
    ) {
        this.config = config;
        this.identity = identity;
        this.options = {
            connectTimeout: options?.connectTimeout ?? 10000,
            receiveTimeout: options?.receiveTimeout ?? 10000,
        };
        this.ws = null;
        this.requestId = 0;
    }

    /**
     * 建立 WebSocket 连接
     *
     * 使用 JWT token 通过查询参数进行认证（最佳兼容性）。
     *
     * URL 转换逻辑：
     * - http:// -> ws://
     * - https:// -> wss://
     * - ws:// 或 wss:// 保持不变
     *
     * @throws {Error} 当 identity 缺少 jwt_token 时抛出
     * @throws {Error} 当 WebSocket 连接失败时抛出
     */
    async connect(): Promise<void> {
        // 检查 JWT token
        if (!this.identity.jwt_token) {
            throw new Error('identity missing jwt_token, call get_jwt_via_wba first');
        }

        // 构建 WebSocket URL
        const baseUrl = this.config.molt_message_ws_url || this.config.molt_message_url;
        let wsUrl: string;

        if (baseUrl.startsWith('ws://') || baseUrl.startsWith('wss://')) {
            wsUrl = baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
        } else {
            wsUrl = baseUrl
                .replace('http://', 'ws://')
                .replace('https://', 'wss://')
                .replace(/\/$/, ''); // 移除末尾斜杠
        }

        const url = `${wsUrl}/message/ws?token=${encodeURIComponent(this.identity.jwt_token)}`;

        // 配置 SSL 上下文
        let agent: https.Agent | http.Agent | undefined;
        const verifyTarget = baseUrl
            .replace('ws://', 'http://')
            .replace('wss://', 'https://');
        const verifyConfig = _resolveVerify(verifyTarget);

        if (url.startsWith('wss://')) {
            if (verifyConfig instanceof https.Agent) {
                agent = verifyConfig;
            } else if (verifyConfig === true) {
                agent = new https.Agent({ rejectUnauthorized: true });
            } else {
                // verifyConfig === false
                agent = new https.Agent({ rejectUnauthorized: false });
            }
        }

        // 创建 WebSocket 连接
        this.ws = await new Promise<WebSocket>((resolve, reject) => {
            const ws = new WebSocket(url, {
                agent,
                handshakeTimeout: this.options.connectTimeout,
            });

            ws.once('open', () => {
                console.log(`[WsClient] Connected to ${url.split('?')[0]}`);
                resolve(ws);
            });

            ws.once('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * 关闭连接
     */
    async close(): Promise<void> {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * 生成下一个请求 ID（自增）
     *
     * @returns 自增的请求 ID
     */
    private nextId(): number {
        this.requestId += 1;
        return this.requestId;
    }

    /**
     * 发送 JSON-RPC 请求并等待响应
     *
     * 逻辑：
     * 1. 构建 JSON-RPC 2.0 请求
     * 2. 发送请求
     * 3. 等待匹配的响应（跳过期间收到的推送通知）
     * 4. 处理错误响应
     *
     * @param method - RPC 方法名
     * @param params - 方法参数
     * @returns JSON-RPC result 字段内容
     * @throws {Error} 未连接或收到错误响应时抛出
     */
    async sendRpc(
        method: string,
        params?: Record<string, any>
    ): Promise<any> {
        if (!this.ws) {
            throw new Error('WebSocket not connected');
        }

        const reqId = this.nextId();
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            method,
            id: reqId,
        };
        if (params && Object.keys(params).length > 0) {
            request.params = params;
        }

        // 发送请求
        this.ws.send(JSON.stringify(request));

        // 等待匹配的响应（跳过推送通知）
        while (true) {
            const raw = await this.receiveRaw();
            const data = raw as JsonRpcResponse | JsonRpcNotification;

            // 跳过通知（无 id 字段）
            if (!('id' in data)) {
                continue;
            }

            // 跳过不匹配的响应
            if (data.id !== reqId) {
                continue;
            }

            // 处理错误响应
            if ('error' in data && data.error) {
                const error = data.error;
                throw new Error(
                    `JSON-RPC error ${error.code}: ${error.message}`
                );
            }

            return data.result ?? {};
        }
    }

    /**
     * 发送消息（便捷方法）
     *
     * sender_did 由服务器自动注入。
     * client_msg_id 未提供时自动生成（uuid4），用于幂等投递。
     *
     * @param options - 消息选项（包含 content）
     * @returns 消息响应 dict
     *
     * @example
     * ```typescript
     * // 发送基本消息
     * const result = await ws.sendMessage({
     *     content: "Hello, World!",
     *     receiver_did: "did:wba:...",
     * });
     *
     * // 发送带自定义 client_msg_id 的消息
     * const result = await ws.sendMessage({
     *     content: "Test message",
     *     client_msg_id: "custom-id-12345",
     * });
     *
     * // 发送群组消息
     * const result = await ws.sendMessage({
     *     content: "Group message",
     *     group_did: "did:wba:awiki.ai:group:k1_group",
     * });
     * ```
     */
    async sendMessage(
        options: SendMessageOptions & { content: string }
    ): Promise<any> {
        const {
            content,
            receiver_did,
            receiver_id,
            group_did,
            group_id,
            msg_type = 'text',
            client_msg_id,
            title,
        } = options;

        // 自动生成 client_msg_id（uuid4）
        const finalClientMsgId = client_msg_id ?? randomUUID();

        const params: Record<string, any> = {
            content,
            type: msg_type,
            client_msg_id: finalClientMsgId,
        };

        if (receiver_did) {
            params.receiver_did = receiver_did;
        }
        if (receiver_id) {
            params.receiver_id = receiver_id;
        }
        if (group_did) {
            params.group_did = group_did;
        }
        if (group_id) {
            params.group_id = group_id;
        }
        if (title !== undefined && title !== null) {
            params.title = title;
        }

        return this.sendRpc('send', params);
    }

    /**
     * 发送应用层心跳并等待 pong
     *
     * @returns 如果收到 pong 返回 true
     * @throws {Error} 未连接时抛出
     */
    async ping(): Promise<boolean> {
        if (!this.ws) {
            throw new Error('WebSocket not connected');
        }

        // 发送 ping 请求
        this.ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'ping' }));

        // 等待响应
        const raw = await this.receiveRaw();
        const data = raw as JsonRpcNotification;

        return data.method === 'pong';
    }

    /**
     * 接收单条消息（请求响应或推送通知）
     *
     * @param options - 可选配置
     * @param options.timeout - 超时时间（毫秒），默认 10000
     * @returns JSON 消息 dict，超时时返回 null
     * @throws {Error} 未连接时抛出
     */
    async receive(options?: { timeout?: number }): Promise<WebSocketMessage | null> {
        if (!this.ws) {
            throw new Error('WebSocket not connected');
        }

        const timeout = options?.timeout ?? this.options.receiveTimeout;

        try {
            const raw = await this.receiveRawWithTimeout(timeout);
            if (raw === null) {
                return null;
            }
            return raw as WebSocketMessage;
        } catch (error) {
            if (error instanceof Error && error.message.includes('timeout')) {
                return null;
            }
            throw error;
        }
    }

    /**
     * 接收单条推送通知（跳过请求响应）
     *
     * 推送通知的识别特征：无 id 字段
     *
     * @param options - 可选配置
     * @param options.timeout - 超时时间（毫秒），默认 10000
     * @returns JSON-RPC 通知 dict，超时时返回 null
     * @throws {Error} 未连接时抛出
     */
    async receiveNotification(options?: { timeout?: number }): Promise<JsonRpcNotification | null> {
        if (!this.ws) {
            throw new Error('WebSocket not connected');
        }

        const timeout = options?.timeout ?? this.options.receiveTimeout;
        const deadline = Date.now() + timeout;

        while (true) {
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                return null;
            }

            try {
                const raw = await this.receiveRawWithTimeout(remaining);
                if (raw === null) {
                    return null;
                }

                const data = raw as JsonRpcResponse | JsonRpcNotification;

                // 通知没有 id 字段
                if (!('id' in data)) {
                    return data as JsonRpcNotification;
                }
                // 跳过响应，继续等待通知
            } catch (error) {
                if (error instanceof Error && error.message.includes('timeout')) {
                    return null;
                }
                throw error;
            }
        }
    }

    /**
     * 接收原始消息（内部方法）
     *
     * @returns 解析后的 JSON 消息
     */
    private receiveRaw(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (!this.ws) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            const handler = (data: Buffer) => {
                try {
                    const parsed = JSON.parse(data.toString());
                    resolve(parsed);
                } catch (error) {
                    reject(error);
                }
            };

            this.ws.once('message', handler);
        });
    }

    /**
     * 带超时的原始消息接收（内部方法）
     *
     * @param timeoutMs - 超时时间（毫秒）
     * @returns 解析后的 JSON 消息，超时时返回 null
     */
    private receiveRawWithTimeout(timeoutMs: number): Promise<any | null> {
        return new Promise<any | null>((resolve) => {
            if (!this.ws) {
                resolve(null);
                return;
            }

            const timer = setTimeout(() => {
                this.ws?.off('message', handler);
                resolve(null);
            }, timeoutMs);

            const handler = (data: Buffer) => {
                clearTimeout(timer);
                this.ws?.off('message', handler);
                try {
                    const parsed = JSON.parse(data.toString());
                    resolve(parsed);
                } catch (error) {
                    resolve(null);
                }
            };

            this.ws.once('message', handler);
        });
    }
}

// 默认导出
export default WsClient;
