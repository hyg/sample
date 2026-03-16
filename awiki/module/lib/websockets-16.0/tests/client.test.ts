/**
 * WebSocket 客户端测试套件
 * 
 * 基于 distill.json 中的 24 个测试用例
 * 
 * @module websockets-16.0/tests/client.test
 */

import { WsClient } from '../src/client';
import {
    ConnectionClosedError,
    NotConnectedError,
    JsonRpcError,
    TimeoutError,
    ConnectionError,
    MissingJwtTokenError,
} from '../src/errors';
import type { WsClientConfig } from '../src/types';

// 定义 WebSocket 常量
const WS_OPEN = 1;
const WS_CONNECTING = 0;
const WS_CLOSING = 2;
const WS_CLOSED = 3;

// Mock WebSocket
jest.mock('ws', () => {
    const mockWsInstance = {
        readyState: 1, // WebSocket.OPEN
        send: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        removeListener: jest.fn(),
        ping: jest.fn(),
        addListener: jest.fn(),
    };

    const MockWebSocket = jest.fn().mockImplementation(() => {
        return mockWsInstance;
    });

    (MockWebSocket as any).OPEN = 1;
    (MockWebSocket as any).CONNECTING = 0;
    (MockWebSocket as any).CLOSING = 2;
    (MockWebSocket as any).CLOSED = 3;

    return MockWebSocket;
});

// 导入 mock 后的 WebSocket
import WebSocket from 'ws';

describe('WsClient - WebSocket 客户端测试', () => {
    let client: WsClient;
    let mockWs: any;
    let eventHandlers: Record<string, Function[]>;

    const baseConfig: WsClientConfig = {
        url: 'https://awiki.ai',
        token: 'test_jwt_token_123',
        pingInterval: 20,
        pingTimeout: 20,
        requestTimeout: 30,
        receiveTimeout: 10,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        eventHandlers = {};

        // 重置 mock WebSocket 实例
        mockWs = {
            readyState: WS_OPEN,
            send: jest.fn(),
            close: jest.fn(),
            on: jest.fn((event: string, handler: Function) => {
                if (!eventHandlers[event]) {
                    eventHandlers[event] = [];
                }
                eventHandlers[event].push(handler);
            }),
            once: jest.fn((event: string, handler: Function) => {
                if (!eventHandlers[event]) {
                    eventHandlers[event] = [];
                }
                eventHandlers[event].push(handler);
                // 模拟立即触发
                if (event === 'open') {
                    setTimeout(() => handler(), 10);
                }
            }),
            removeListener: jest.fn((event: string, handler: Function) => {
                if (eventHandlers[event]) {
                    eventHandlers[event] = eventHandlers[event].filter(h => h !== handler);
                }
            }),
            ping: jest.fn(),
        };

        (WebSocket as jest.MockedFunction<any>).mockImplementation(() => mockWs);

        client = new WsClient(baseConfig);
    });

    afterEach(async () => {
        try {
            await client.close();
        } catch {
            // 忽略关闭错误
        }
        jest.clearAllMocks();
    });

    // ============================================
    // 连接建立测试 (TC001-TC006)
    // ============================================

    describe('连接建立', () => {
        // TC001: 测试正常建立 WebSocket 连接
        test('TC001 - connect_success: 正常建立连接', async () => {
            const connectPromise = client.connect();

            // 模拟连接成功
            setTimeout(() => {
                const openHandlers = eventHandlers['open'] || [];
                openHandlers.forEach((h: Function) => h());
            }, 10);

            await expect(connectPromise).resolves.not.toThrow();
            expect(client['getState']()).toBe('open');
        });

        // TC002: 测试 JWT token 缺失时的错误处理
        test('TC002 - connect_missing_jwt: JWT token 缺失错误', async () => {
            const clientWithoutToken = new WsClient({
                url: 'https://awiki.ai',
                token: '',
            });

            await expect(clientWithoutToken.connect()).rejects.toThrow(MissingJwtTokenError);
            await expect(clientWithoutToken.connect()).rejects.toThrow('identity missing jwt_token');
        });

        // TC003: 测试 HTTP URL 转换为 WebSocket URL
        test('TC003 - connect_url_conversion_http: HTTP URL 转换', async () => {
            const clientWithHttp = new WsClient({
                url: 'https://example.com/api',
                token: 'test_token',
            });

            const connectPromise = clientWithHttp.connect();

            // 模拟连接成功
            setTimeout(() => {
                const openHandlers = eventHandlers['open'] || [];
                openHandlers.forEach((h: Function) => h());
            }, 10);

            await connectPromise;

            // 验证 WebSocket 被正确调用
            expect(WebSocket).toHaveBeenCalledWith(
                expect.stringContaining('wss://example.com/api/message/ws'),
                expect.any(Object)
            );
        });

        // TC004: 测试 ws://开头的 URL 不被重复转换
        test('TC004 - connect_url_already_ws: WebSocket URL 不转换', async () => {
            const clientWithWs = new WsClient({
                url: 'ws://example.com/ws',
                token: 'test_token',
            });

            const connectPromise = clientWithWs.connect();

            setTimeout(() => {
                const openHandlers = eventHandlers['open'] || [];
                openHandlers.forEach((h: Function) => h());
            }, 10);

            await connectPromise;

            expect(WebSocket).toHaveBeenCalledWith(
                expect.stringContaining('ws://example.com/ws/message/ws'),
                expect.any(Object)
            );
        });

        // TC005: 测试 SSL 上下文的正确配置
        test('TC005 - connect_ssl_context: SSL 配置', async () => {
            // 注意：实际测试中需要真实的 CA 文件
            // 这里只验证配置传递
            const clientWithSsl = new WsClient({
                url: 'https://example.com/api',
                token: 'test_token',
                caBundle: './test-ca.pem',
            });

            // 由于没有真实的 CA 文件，这里会抛出 ConnectionError
            await expect(clientWithSsl.connect()).rejects.toThrow(ConnectionError);
        });

        // TC006: 测试异步上下文管理器自动连接
        test('TC006 - connect_context_manager: 上下文管理器', async () => {
            // 使用 async dispose 模拟上下文管理器
            const clientWithContext = new WsClient(baseConfig);

            const connectPromise = clientWithContext.connect();

            setTimeout(() => {
                const openHandlers = eventHandlers['open'] || [];
                openHandlers.forEach((h: Function) => h());
            }, 10);

            await connectPromise;
            expect(clientWithContext['isConnected']()).toBe(true);

            await clientWithContext.close();
        });
    });

    // ============================================
    // 发送消息测试 (TC007-TC015)
    // ============================================

    describe('发送消息', () => {
        beforeEach(async () => {
            // 先建立连接
            const connectPromise = client.connect();
            setTimeout(() => {
                const openHandlers = eventHandlers['open'] || [];
                openHandlers.forEach((h: Function) => h());
            }, 10);
            await connectPromise;
        });

        // TC007: 测试成功发送 JSON-RPC 请求并接收响应
        test('TC007 - send_rpc_success: 发送 RPC 成功', async () => {
            const mockResponse = {
                jsonrpc: '2.0',
                id: 1,
                result: { success: true },
            };

            const sendPromise = client.sendRpc('testMethod', { param: 'value' });

            // 模拟收到响应
            setTimeout(() => {
                const messageHandlers = eventHandlers['message'] || [];
                messageHandlers.forEach((h: Function) => h(Buffer.from(JSON.stringify(mockResponse))));
            }, 100);

            const result = await sendPromise;
            expect(result).toEqual({ success: true });
            expect(mockWs.send).toHaveBeenCalled();
        });

        // TC008: 测试未连接时发送 RPC 的错误处理
        test('TC008 - send_rpc_not_connected: 未连接错误', async () => {
            const disconnectedClient = new WsClient(baseConfig);
            // 不连接直接发送

            await expect(disconnectedClient.sendRpc('testMethod')).rejects.toThrow(NotConnectedError);
            await expect(disconnectedClient.sendRpc('testMethod')).rejects.toThrow('WebSocket not connected');
        });

        // TC009: 测试发送 RPC 时跳过推送通知
        test('TC009 - send_rpc_skip_notifications: 跳过通知', async () => {
            const notification = {
                jsonrpc: '2.0',
                method: 'notification',
                params: { type: 'new_message' },
            };

            const mockResponse = {
                jsonrpc: '2.0',
                id: 1,
                result: { success: true },
            };

            const sendPromise = client.sendRpc('testMethod');

            // 先发送通知，再发送响应
            setTimeout(() => {
                const messageHandlers = eventHandlers['message'] || [];
                messageHandlers.forEach((h: Function) => {
                    h(Buffer.from(JSON.stringify(notification))); // 通知（无 id）
                    h(Buffer.from(JSON.stringify(mockResponse))); // 响应（有 id）
                });
            }, 100);

            const result = await sendPromise;
            expect(result).toEqual({ success: true });
        });

        // TC010: 测试 JSON-RPC 错误响应的处理
        test('TC010 - send_rpc_error_response: 错误响应处理', async () => {
            const errorResponse = {
                jsonrpc: '2.0',
                id: 1,
                error: {
                    code: -32600,
                    message: 'Invalid Request',
                    data: { detail: 'Method not found' },
                },
            };

            const sendPromise = client.sendRpc('testMethod');

            setTimeout(() => {
                const messageHandlers = eventHandlers['message'] || [];
                messageHandlers.forEach((h: Function) => {
                    h(Buffer.from(JSON.stringify(errorResponse)));
                });
            }, 100);

            await expect(sendPromise).rejects.toThrow(JsonRpcError);
            await expect(sendPromise).rejects.toThrow('JSON-RPC error -32600');
        });

        // TC011: 测试 send_message 自动生成 client_msg_id
        test('TC011 - send_message_auto_client_msg_id: 自动生成消息 ID', async () => {
            const mockResponse = {
                jsonrpc: '2.0',
                id: 1,
                result: { message_id: 'msg_123' },
            };

            const sendPromise = client.sendMessage({
                content: 'Hello!',
                receiverDid: 'did:wba:test',
            });

            setTimeout(() => {
                const messageHandlers = eventHandlers['message'] || [];
                messageHandlers.forEach((h: Function) => {
                    h(Buffer.from(JSON.stringify(mockResponse)));
                });
            }, 100);

            await sendPromise;

            // 验证发送的内容包含 client_msg_id
            const sentData = JSON.parse((mockWs.send as jest.Mock).mock.calls[0][0]);
            expect(sentData.params.client_msg_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });

        // TC012: 测试 send_message 使用自定义 client_msg_id
        test('TC012 - send_message_custom_client_msg_id: 自定义消息 ID', async () => {
            const mockResponse = {
                jsonrpc: '2.0',
                id: 1,
                result: { message_id: 'msg_123' },
            };

            const sendPromise = client.sendMessage({
                content: 'Hello!',
                clientMsgId: 'custom-id-123',
            });

            setTimeout(() => {
                const messageHandlers = eventHandlers['message'] || [];
                messageHandlers.forEach((h: Function) => {
                    h(Buffer.from(JSON.stringify(mockResponse)));
                });
            }, 100);

            await sendPromise;

            const sentData = JSON.parse((mockWs.send as jest.Mock).mock.calls[0][0]);
            expect(sentData.params.client_msg_id).toBe('custom-id-123');
        });

        // TC013: 测试 send_message 指定 receiver_did
        test('TC013 - send_message_with_receiver_did: 指定接收者 DID', async () => {
            const mockResponse = {
                jsonrpc: '2.0',
                id: 1,
                result: { message_id: 'msg_123' },
            };

            const sendPromise = client.sendMessage({
                content: 'Hello!',
                receiverDid: 'did:wba:awiki.ai:user:test',
            });

            setTimeout(() => {
                const messageHandlers = eventHandlers['message'] || [];
                messageHandlers.forEach((h: Function) => {
                    h(Buffer.from(JSON.stringify(mockResponse)));
                });
            }, 100);

            await sendPromise;

            const sentData = JSON.parse((mockWs.send as jest.Mock).mock.calls[0][0]);
            expect(sentData.params.receiver_did).toBe('did:wba:awiki.ai:user:test');
        });

        // TC014: 测试 send_message 指定群组参数
        test('TC014 - send_message_with_group_params: 群组参数', async () => {
            const mockResponse = {
                jsonrpc: '2.0',
                id: 1,
                result: { message_id: 'msg_123' },
            };

            const sendPromise = client.sendMessage({
                content: 'Hello!',
                groupDid: 'group:xxx',
                groupId: '123',
            });

            setTimeout(() => {
                const messageHandlers = eventHandlers['message'] || [];
                messageHandlers.forEach((h: Function) => {
                    h(Buffer.from(JSON.stringify(mockResponse)));
                });
            }, 100);

            await sendPromise;

            const sentData = JSON.parse((mockWs.send as jest.Mock).mock.calls[0][0]);
            expect(sentData.params.group_did).toBe('group:xxx');
            expect(sentData.params.group_id).toBe('123');
        });

        // TC015: 测试 send_message 指定 title 参数
        test('TC015 - send_message_with_title: 标题参数', async () => {
            const mockResponse = {
                jsonrpc: '2.0',
                id: 1,
                result: { message_id: 'msg_123' },
            };

            const sendPromise = client.sendMessage({
                content: 'Hello!',
                title: 'Test Title',
            });

            setTimeout(() => {
                const messageHandlers = eventHandlers['message'] || [];
                messageHandlers.forEach((h: Function) => {
                    h(Buffer.from(JSON.stringify(mockResponse)));
                });
            }, 100);

            await sendPromise;

            const sentData = JSON.parse((mockWs.send as jest.Mock).mock.calls[0][0]);
            expect(sentData.params.title).toBe('Test Title');
        });
    });

    // ============================================
    // 接收消息测试 (TC016-TC020)
    // ============================================

    describe('接收消息', () => {
        beforeEach(async () => {
            const connectPromise = client.connect();
            setTimeout(() => {
                const openHandlers = eventHandlers['open'] || [];
                openHandlers.forEach((h: Function) => h());
            }, 10);
            await connectPromise;
        });

        // TC016: 测试成功接收消息
        test('TC016 - receive_success: 成功接收消息', async () => {
            const mockMessage = {
                jsonrpc: '2.0',
                method: 'new_message',
                params: { content: 'Hello!' },
            };

            const receivePromise = client.receive(5.0);

            setTimeout(() => {
                const messageHandlers = eventHandlers['message'] || [];
                messageHandlers.forEach((h: Function) => {
                    h(Buffer.from(JSON.stringify(mockMessage)));
                });
            }, 100);

            const result = await receivePromise;
            expect(result).toEqual(mockMessage);
        });

        // TC017: 测试接收消息超时处理
        test('TC017 - receive_timeout: 接收超时', async () => {
            const receivePromise = client.receive(0.1);

            const result = await receivePromise;
            expect(result).toBeNull();
        });

        // TC018: 测试未连接时接收消息的错误处理
        test('TC018 - receive_not_connected: 未连接错误', async () => {
            const disconnectedClient = new WsClient(baseConfig);

            await expect(disconnectedClient.receive()).rejects.toThrow(NotConnectedError);
            await expect(disconnectedClient.receive()).rejects.toThrow('WebSocket not connected');
        });

        // TC019: 测试成功接收推送通知（过滤响应消息）
        test('TC019 - receive_notification_success: 接收通知', async () => {
            const responseMessage = {
                jsonrpc: '2.0',
                id: 1,
                result: { success: true },
            };

            const notification = {
                jsonrpc: '2.0',
                method: 'new_message',
                params: { content: 'Notification!' },
            };

            const receivePromise = client.receiveNotification(5.0);

            setTimeout(() => {
                const messageHandlers = eventHandlers['message'] || [];
                messageHandlers.forEach((h: Function) => {
                    h(Buffer.from(JSON.stringify(responseMessage))); // 先响应（有 id）
                    h(Buffer.from(JSON.stringify(notification)));    // 后通知（无 id）
                });
            }, 100);

            const result = await receivePromise;
            expect(result).toEqual(notification);
        });

        // TC020: 测试接收通知超时
        test('TC020 - receive_notification_timeout: 通知超时', async () => {
            const receivePromise = client.receiveNotification(0.1);

            const result = await receivePromise;
            expect(result).toBeNull();
        });
    });

    // ============================================
    // 心跳检测测试 (TC021-TC022)
    // ============================================

    describe('心跳检测', () => {
        beforeEach(async () => {
            const connectPromise = client.connect();
            setTimeout(() => {
                const openHandlers = eventHandlers['open'] || [];
                openHandlers.forEach((h: Function) => h());
            }, 10);
            await connectPromise;
        });

        // TC021: 测试心跳检测成功
        test('TC021 - ping_success: 心跳成功', async () => {
            const pongResponse = {
                jsonrpc: '2.0',
                method: 'pong',
                id: 1,
            };

            const pingPromise = client.ping();

            setTimeout(() => {
                const messageHandlers = eventHandlers['message'] || [];
                messageHandlers.forEach((h: Function) => {
                    h(Buffer.from(JSON.stringify(pongResponse)));
                });
            }, 100);

            const result = await pingPromise;
            expect(result).toBe(true);
            expect(mockWs.send).toHaveBeenCalled();
        });

        // TC022: 测试未连接时心跳的错误处理
        test('TC022 - ping_not_connected: 未连接错误', async () => {
            const disconnectedClient = new WsClient(baseConfig);

            await expect(disconnectedClient.ping()).rejects.toThrow(NotConnectedError);
            await expect(disconnectedClient.ping()).rejects.toThrow('WebSocket not connected');
        });
    });

    // ============================================
    // 连接关闭测试 (TC023-TC024)
    // ============================================

    describe('连接关闭', () => {
        beforeEach(async () => {
            const connectPromise = client.connect();
            setTimeout(() => {
                const openHandlers = eventHandlers['open'] || [];
                openHandlers.forEach((h: Function) => h());
            }, 10);
            await connectPromise;
        });

        // TC023: 测试正常关闭连接
        test('TC023 - close_success: 正常关闭', async () => {
            await client.close();

            expect(mockWs.close).toHaveBeenCalledWith(1000, 'Normal closure');
            expect(client['getState']()).toBe('closed');
        });

        // TC024: 测试上下文管理器退出时自动关闭
        test('TC024 - close_context_manager: 上下文管理器自动关闭', async () => {
            // 模拟 Symbol.dispose 调用
            await client[Symbol.dispose]();

            expect(mockWs.close).toHaveBeenCalled();
            expect(client['getState']()).toBe('closed');
        });
    });

    // ============================================
    // 错误处理测试
    // ============================================

    describe('错误处理', () => {
        test('ConnectionClosedError: 连接关闭错误', () => {
            const error = new ConnectionClosedError(1001, 'Going away');
            expect(error.name).toBe('ConnectionClosedError');
            expect(error.code).toBe(1001);
            expect(error.reason).toBe('Going away');
            expect(error.message).toContain('Connection closed');
        });

        test('NotConnectedError: 未连接错误', () => {
            const error = new NotConnectedError('Custom message');
            expect(error.name).toBe('NotConnectedError');
            expect(error.message).toBe('Custom message');
        });

        test('JsonRpcError: JSON-RPC 错误', () => {
            const error = new JsonRpcError(-32600, 'Invalid Request', { detail: 'test' });
            expect(error.name).toBe('JsonRpcError');
            expect(error.code).toBe(-32600);
            expect(error.message).toContain('JSON-RPC error -32600');
            expect(error.data).toEqual({ detail: 'test' });
        });

        test('TimeoutError: 超时错误', () => {
            const error = new TimeoutError('Custom timeout');
            expect(error.name).toBe('TimeoutError');
            expect(error.message).toBe('Custom timeout');
        });

        test('ConnectionError: 连接错误', () => {
            const cause = new Error('Underlying error');
            const error = new ConnectionError('Connection failed', cause);
            expect(error.name).toBe('ConnectionError');
            expect(error.cause).toBe(cause);
        });

        test('MissingJwtTokenError: JWT 缺失错误', () => {
            const error = new MissingJwtTokenError();
            expect(error.name).toBe('MissingJwtTokenError');
            expect(error.message).toContain('identity missing jwt_token');
        });
    });

    // ============================================
    // 边界测试
    // ============================================

    describe('边界测试', () => {
        test('边界：空 token 字符串', async () => {
            const clientEmptyToken = new WsClient({
                url: 'https://awiki.ai',
                token: '',
            });

            await expect(clientEmptyToken.connect()).rejects.toThrow(MissingJwtTokenError);
        });

        test('边界：URL 末尾斜杠处理', async () => {
            const clientWithSlash = new WsClient({
                url: 'https://awiki.ai/',
                token: 'test_token',
            });

            const connectPromise = clientWithSlash.connect();
            setTimeout(() => {
                const openHandlers = eventHandlers['open'] || [];
                openHandlers.forEach((h: Function) => h());
            }, 10);
            await connectPromise;

            expect(WebSocket).toHaveBeenCalledWith(
                expect.not.stringMatching(/\/$/),
                expect.any(Object)
            );
        });

        test('边界：请求 ID 递增', async () => {
            const connectPromise = client.connect();
            setTimeout(() => {
                const openHandlers = eventHandlers['open'] || [];
                openHandlers.forEach((h: Function) => h());
            }, 10);
            await connectPromise;

            // 发送多个请求，验证 ID 递增
            const promises = [];
            for (let i = 0; i < 3; i++) {
                const mockResponse = { jsonrpc: '2.0', id: i + 1, result: i };
                promises.push(
                    new Promise<void>((resolve) => {
                        setTimeout(() => {
                            const messageHandlers = eventHandlers['message'] || [];
                            messageHandlers.forEach((h: Function) => {
                                h(Buffer.from(JSON.stringify(mockResponse)));
                            });
                            resolve();
                        }, 50 * (i + 1));
                    })
                );
                client.sendRpc('test');
            }

            await Promise.all(promises);

            // 验证 send 被调用 3 次
            expect(mockWs.send).toHaveBeenCalledTimes(3);
        });

        test('边界：UUID 生成格式', () => {
            // 通过 sendMessage 间接测试 UUID 生成
            const testClient = new WsClient(baseConfig);
            const uuid = (testClient as any).generateUuid();
            expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });
    });
});
