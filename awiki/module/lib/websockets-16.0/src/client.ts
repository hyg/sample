/**
 * WebSocket 客户端实现
 * 
 * 封装 ws 库，提供与 Python websockets 库一致的 API
 * 
 * @module websockets-16.0/client
 */

import WebSocket, { RawData } from 'ws';
import * as https from 'https';
import * as fs from 'fs';
import { EventEmitter } from 'events';

import type {
    WsClientConfig,
    SendMessageParams,
    JsonRpcMessage,
    JsonRpcRequest,
    JsonRpcResponse,
    JsonRpcNotification,
    WebSocketEvents,
    PushNotification,
} from './types';

import {
    ConnectionClosedError,
    NotConnectedError,
    JsonRpcError as JsonRpcErrorClass,
    TimeoutError,
    ConnectionError,
    MissingJwtTokenError,
} from './errors';

/**
 * WebSocket 客户端类
 * 
 * 提供与 Python WsClient 一致的 API:
 * - connect() / close()
 * - send_rpc() / send_message()
 * - receive() / receive_notification()
 * - ping()
 * 
 * 使用示例:
 * ```typescript
 * const client = new WsClient({
 *     url: 'https://awiki.ai',
 *     token: 'jwt_token',
 * });
 * 
 * await client.connect();
 * const result = await client.send_message({
 *     content: 'Hello!',
 *     receiverDid: 'did:wba:...',
 * });
 * await client.close();
 * ```
 */
export class WsClient extends EventEmitter {
    /** WebSocket 连接实例 */
    private ws: WebSocket | null = null;
    /** 客户端配置 */
    private config: WsClientConfig;
    /** 请求 ID 计数器 */
    private requestId = 0;
    /** Ping 定时器 */
    private pingInterval?: NodeJS.Timeout;
    /** 连接状态 */
    private state: 'disconnected' | 'connecting' | 'open' | 'closing' | 'closed' = 'disconnected';

    /**
     * 创建 WebSocket 客户端
     * 
     * @param config - 客户端配置
     */
    constructor(config: WsClientConfig) {
        super();
        this.config = config;
    }

    /**
     * 建立 WebSocket 连接
     * 
     * 对应 Python: async def connect(self)
     * 
     * 使用 JWT token 通过查询参数进行认证。
     * 自动将 HTTP URL 转换为 WebSocket URL。
     * 
     * @throws {MissingJwtTokenError} JWT token 缺失
     * @throws {ConnectionError} 连接失败
     */
    async connect(): Promise<void> {
        // 检查 JWT token
        if (!this.config.token) {
            throw new MissingJwtTokenError('identity missing jwt_token, call get_jwt_via_wba first');
        }

        // 转换 HTTP URL 为 WebSocket URL
        let baseUrl = this.config.url;
        let wsUrl: string;

        if (baseUrl.startsWith('ws://') || baseUrl.startsWith('wss://')) {
            wsUrl = baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
        } else {
            wsUrl = baseUrl
                .replace('http://', 'ws://')
                .replace('https://', 'wss://')
                .replace(/\/$/, '');
        }

        const url = `${wsUrl}/message/ws?token=${encodeURIComponent(this.config.token)}`;

        // 配置 SSL 上下文
        let agent: https.Agent | undefined;
        if (this.config.caBundle && url.startsWith('wss://')) {
            try {
                const ca = fs.readFileSync(this.config.caBundle);
                agent = new https.Agent({ ca });
            } catch (error) {
                throw new ConnectionError(
                    `Failed to load CA bundle: ${this.config.caBundle}`,
                    error as Error
                );
            }
        }

        // 创建 WebSocket 连接
        return new Promise<void>((resolve, reject) => {
            this.state = 'connecting';

            try {
                this.ws = new WebSocket(url, {
                    agent,
                    handshakeTimeout: 10000,
                });
            } catch (error) {
                this.state = 'disconnected';
                reject(new ConnectionError('Failed to create WebSocket', error as Error));
                return;
            }

            // 连接成功
            this.ws.once('open', () => {
                this.state = 'open';
                this.setupEventHandlers();
                this.startPing();
                resolve();
            });

            // 连接失败
            this.ws.once('error', (error) => {
                this.state = 'disconnected';
                reject(new ConnectionError('WebSocket connection failed', error));
            });

            // 连接超时
            setTimeout(() => {
                if (this.state === 'connecting' && this.ws) {
                    this.state = 'disconnected';
                    this.ws.close();
                    reject(new TimeoutError('WebSocket connection timeout'));
                }
            }, 10000);
        });
    }

    /**
     * 关闭 WebSocket 连接
     * 
     * 对应 Python: async def close(self)
     */
    async close(): Promise<void> {
        this.stopPing();

        if (this.ws) {
            this.state = 'closing';
            this.ws.close(1000, 'Normal closure');
            this.ws = null;
            this.state = 'closed';
        }
    }

    /**
     * 异步上下文管理器进入
     * 
     * 对应 Python: async def __aenter__(self)
     */
    async [Symbol.asyncDispose](): Promise<this> {
        await this.connect();
        return this;
    }

    /**
     * 异步上下文管理器退出
     * 
     * 对应 Python: async def __aexit__(self, *args)
     */
    async [Symbol.dispose](): Promise<void> {
        await this.close();
    }

    /**
     * 发送 JSON-RPC 请求并等待响应
     * 
     * 对应 Python: async def send_rpc(self, method, params)
     * 
     * @param method - RPC 方法名
     * @param params - 方法参数
     * @returns JSON-RPC result 字段内容
     * @throws {NotConnectedError} 未连接
     * @throws {JsonRpcError} 收到错误响应
     * @throws {TimeoutError} 请求超时
     */
    async sendRpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new NotConnectedError('WebSocket not connected');
        }

        const reqId = this.nextId();
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            method,
            id: reqId,
        };
        if (params) {
            request.params = params;
        }

        this.ws.send(JSON.stringify(request));

        // 等待匹配的响应 (跳过期间收到的推送通知)
        return new Promise((resolve, reject) => {
            const timeout = (this.config.requestTimeout || 30) * 1000;
            let resolved = false;

            const handler = (data: RawData) => {
                if (resolved) return;

                let message: JsonRpcMessage;
                try {
                    message = JSON.parse(data.toString());
                } catch {
                    return; // 忽略无效 JSON
                }

                // 跳过通知 (无 id 字段)
                if (!('id' in message)) {
                    return;
                }

                // 只处理匹配的响应
                if (message.id !== reqId) {
                    return;
                }

                resolved = true;
                this.ws?.removeListener('message', handler);

                if ('error' in message && message.error) {
                    reject(new JsonRpcErrorClass(
                        message.error.code,
                        message.error.message,
                        message.error.data
                    ));
                } else {
                    resolve(message.result ?? {});
                }
            };

            this.ws?.on('message', handler);

            // 超时处理
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    this.ws?.removeListener('message', handler);
                    reject(new TimeoutError('Request timeout'));
                }
            }, timeout);
        });
    }

    /**
     * 发送消息的便捷方法
     * 
     * 对应 Python: async def send_message(self, content, ...)
     * 
     * sender_did 由服务器自动注入。
     * client_msg_id 自动生成 (uuid4)，用于幂等投递。
     * 
     * @param params - 发送参数
     * @returns 消息响应
     */
    async sendMessage(params: SendMessageParams): Promise<unknown> {
        const {
            content,
            receiverDid,
            receiverId,
            groupDid,
            groupId,
            msgType = 'text',
            clientMsgId,
            title,
        } = params;

        // 生成 client_msg_id
        const finalClientMsgId = clientMsgId ?? this.generateUuid();

        const rpcParams: Record<string, unknown> = {
            content,
            type: msgType,
            client_msg_id: finalClientMsgId,
        };

        if (receiverDid) rpcParams.receiver_did = receiverDid;
        if (receiverId) rpcParams.receiver_id = receiverId;
        if (groupDid) rpcParams.group_did = groupDid;
        if (groupId) rpcParams.group_id = groupId;
        if (title !== undefined) rpcParams.title = title;

        return this.sendRpc('send', rpcParams);
    }

    /**
     * 接收单条消息 (请求响应或推送通知)
     * 
     * 对应 Python: async def receive(self, timeout)
     * 
     * @param timeout - 超时时间 (秒)，默认配置值
     * @returns JSON 消息对象，超时时返回 null
     * @throws {NotConnectedError} 未连接
     */
    async receive(timeout?: number): Promise<JsonRpcMessage | null> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new NotConnectedError('WebSocket not connected');
        }

        const timeoutMs = (timeout ?? this.config.receiveTimeout ?? 10) * 1000;

        return new Promise((resolve) => {
            let resolved = false;

            const handler = (data: RawData) => {
                if (resolved) return;

                try {
                    const message = JSON.parse(data.toString());
                    resolved = true;
                    this.ws?.removeListener('message', handler);
                    resolve(message);
                } catch {
                    // 忽略无效 JSON
                }
            };

            this.ws?.on('message', handler);

            // 超时处理
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    this.ws?.removeListener('message', handler);
                    resolve(null);
                }
            }, timeoutMs);
        });
    }

    /**
     * 接收单条推送通知 (跳过请求响应)
     * 
     * 对应 Python: async def receive_notification(self, timeout)
     * 
     * @param timeout - 超时时间 (秒)，默认配置值
     * @returns JSON-RPC 通知对象，超时时返回 null
     * @throws {NotConnectedError} 未连接
     */
    async receiveNotification(timeout?: number): Promise<JsonRpcNotification | null> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new NotConnectedError('WebSocket not connected');
        }

        const timeoutMs = (timeout ?? this.config.receiveTimeout ?? 10) * 1000;
        const deadline = Date.now() + timeoutMs;

        return new Promise((resolve) => {
            let resolved = false;

            const checkTimeout = (): number => {
                return deadline - Date.now();
            };

            const handler = (data: RawData) => {
                if (resolved) return;

                try {
                    const message = JSON.parse(data.toString());

                    // 通知没有 id 字段
                    if (!('id' in message)) {
                        resolved = true;
                        this.ws?.removeListener('message', handler);
                        resolve(message as JsonRpcNotification);
                    }
                    // 有 id 的响应消息，继续等待
                } catch {
                    // 忽略无效 JSON
                }
            };

            this.ws?.on('message', handler);

            // 超时处理
            const timeoutCheck = setInterval(() => {
                if (checkTimeout() <= 0) {
                    if (!resolved) {
                        resolved = true;
                        this.ws?.removeListener('message', handler);
                        resolve(null);
                    }
                    clearInterval(timeoutCheck);
                }
            }, 100);

            // 初始检查
            if (checkTimeout() <= 0) {
                resolved = true;
                this.ws?.removeListener('message', handler);
                clearInterval(timeoutCheck);
                resolve(null);
            }
        });
    }

    /**
     * 发送应用层心跳并等待 pong
     * 
     * 对应 Python: async def ping(self)
     * 
     * @returns 收到 pong 响应返回 true
     * @throws {NotConnectedError} 未连接
     */
    async ping(): Promise<boolean> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new NotConnectedError('WebSocket not connected');
        }

        const pingRequest: JsonRpcRequest = {
            jsonrpc: '2.0',
            method: 'ping',
            id: this.nextId(),
        };

        this.ws.send(JSON.stringify(pingRequest));

        // 等待 pong 响应
        return new Promise((resolve) => {
            const timeoutMs = (this.config.pingTimeout || 20) * 1000;
            let resolved = false;

            const handler = (data: RawData) => {
                if (resolved) return;

                try {
                    const message = JSON.parse(data.toString());
                    // 检查是否是 pong 响应
                    if (message.method === 'pong') {
                        resolved = true;
                        this.ws?.removeListener('message', handler);
                        resolve(true);
                    }
                } catch {
                    // 忽略无效 JSON
                }
            };

            this.ws?.on('message', handler);

            // 超时处理
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    this.ws?.removeListener('message', handler);
                    resolve(false);
                }
            }, timeoutMs);
        });
    }

    /**
     * 获取连接状态
     * 
     * @returns 连接状态
     */
    getState(): 'disconnected' | 'connecting' | 'open' | 'closing' | 'closed' {
        return this.state;
    }

    /**
     * 检查是否已连接
     * 
     * @returns 是否已连接
     */
    isConnected(): boolean {
        return this.state === 'open' && this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * 生成下一个请求 ID
     */
    private nextId(): number {
        this.requestId += 1;
        return this.requestId;
    }

    /**
     * 生成 UUID v4
     */
    private generateUuid(): string {
        // 简单的 UUID v4 生成
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    /**
     * 设置事件处理器
     */
    private setupEventHandlers(): void {
        if (!this.ws) return;

        // 消息事件
        this.ws.on('message', (data: RawData) => {
            try {
                const message = JSON.parse(data.toString());
                this.emit('message', message);
            } catch {
                // 忽略无效 JSON
            }
        });

        // 关闭事件
        this.ws.on('close', (code: number, reason: Buffer) => {
            this.state = 'closed';
            this.stopPing();
            this.emit('close', code, reason.toString());

            if (code !== 1000) {
                this.emit('error', new ConnectionClosedError(code, reason.toString()));
            }
        });

        // 错误事件
        this.ws.on('error', (error: Error) => {
            this.emit('error', error);
        });

        // Pong 事件
        this.ws.on('pong', () => {
            this.emit('pong');
        });
    }

    /**
     * 启动心跳
     */
    private startPing(): void {
        this.stopPing(); // 先停止已有的定时器

        const interval = (this.config.pingInterval || 20) * 1000;

        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // 使用 WebSocket 层的 ping (ws 库自动处理 pong)
                this.ws.ping();
            }
        }, interval);
    }

    /**
     * 停止心跳
     */
    private stopPing(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = undefined;
        }
    }
}
