# websockets 库 JavaScript 移植设计文档

## 1. 概述

**Python 包**: `websockets`  
**版本**: `16.0`  
**JavaScript 替代**: `ws` (推荐)  
**用途**: WebSocket 客户端

---

## 2. 模块结构对比

### 2.1 Python 使用方式

```python
import websockets
from websockets.asyncio.client import ClientConnection

async with websockets.connect(
    "wss://awiki.ai/ws/notifications",
    extra_headers={"Authorization": "DIDWba ..."}
) as websocket:
    message = await websocket.recv()
    await websocket.send(data)
```

### 2.2 JavaScript 使用方式 (ws)

```javascript
import WebSocket from 'ws';

const ws = new WebSocket('wss://awiki.ai/ws/notifications', {
    headers: {
        'Authorization': 'DIDWba ...',
    },
});

ws.on('message', (data) => {
    console.log(data.toString());
});

ws.send(JSON.stringify(data));
```

---

## 3. API 映射设计

### 3.1 连接建立

**Python**:
```python
async def connect(
    uri: str,
    extra_headers: dict = None,
    ping_interval: float = 20,
    ping_timeout: float = 20,
    ssl: ssl.SSLContext = None,
) -> ClientConnection:
```

**JavaScript (ws)**:
```typescript
interface WebSocketOptions {
    headers?: Record<string, string>;
    handshakeTimeout?: number;
    protocol?: string;
    agent?: http.Agent | https.Agent;
}

class WebSocket extends EventTarget {
    constructor(url: string, options?: WebSocketOptions);
    
    // 事件
    onopen: ((event: Event) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    
    // 方法
    send(data: string | Buffer): void;
    close(code?: number, reason?: string): void;
    ping(data?: any): void;
    pong(data?: any): void;
    
    // 属性
    readonly readyState: number;
    readonly bufferedAmount: number;
    readonly protocol: string;
    readonly url: string;
}
```

**使用示例**:
```javascript
import WebSocket from 'ws';
import * as https from 'https';
import * as fs from 'fs';

// 创建 HTTPS Agent (用于 SSL 验证)
const agent = new https.Agent({
    ca: fs.readFileSync('/path/to/ca.pem'),
});

const ws = new WebSocket('wss://awiki.ai/ws/notifications?token=jwt_token', {
    agent,
    handshakeTimeout: 10000,
});

// 等待连接打开
await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
});
```

### 3.2 发送消息

**Python**:
```python
async def send(self, message: str | bytes) -> None:
```

**JavaScript**:
```typescript
send(data: string | Buffer): void;

// 使用示例
ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'send',
    params: { content: 'Hello!' },
}));
```

### 3.3 接收消息

**Python**:
```python
async def recv(self) -> str | bytes:
```

**JavaScript**:
```typescript
// 事件驱动方式
ws.on('message', (data: Buffer) => {
    const message = JSON.parse(data.toString());
    console.log('Received:', message);
});

// 或使用 Promise 封装
function receiveMessage(ws: WebSocket, timeout?: number): Promise<any> {
    return new Promise((resolve, reject) => {
        const timeoutId = timeout 
            ? setTimeout(() => reject(new Error('Timeout')), timeout) 
            : null;
        
        const handler = (data: Buffer) => {
            if (timeoutId) clearTimeout(timeoutId);
            ws.removeListener('message', handler);
            resolve(JSON.parse(data.toString()));
        };
        
        ws.on('message', handler);
    });
}
```

### 3.4 关闭连接

**Python**:
```python
async def close(self, code: int = 1000, reason: str = "") -> None:
```

**JavaScript**:
```typescript
close(code?: number, reason?: string): void;

// 使用示例
ws.close(1000, 'Normal closure');
```

### 3.5 心跳

**Python**:
```python
# 自动 ping/pong (通过 ping_interval 和 ping_timeout 配置)
```

**JavaScript**:
```typescript
// ws 库自动处理 ping/pong
// 手动发送 ping
ws.ping();

// 监听 pong
ws.on('pong', () => {
    console.log('Received pong');
});
```

---

## 4. 封装设计

### 4.1 WebSocket 客户端类

```typescript
// src/ws-client.ts
import WebSocket, { WebSocketServer } from 'ws';
import * as https from 'https';

interface WsClientConfig {
    url: string;
    token: string;
    caBundle?: string;
    pingInterval?: number;
    pingTimeout?: number;
}

interface JsonRpcMessage {
    jsonrpc: '2.0';
    method?: string;
    params?: any;
    id?: number | string;
    result?: any;
    error?: { code: number; message: string; data?: any };
}

export class WsClient {
    private ws: WebSocket | null = null;
    private config: WsClientConfig;
    private requestId = 0;
    private pingInterval?: NodeJS.Timeout;

    constructor(config: WsClientConfig) {
        this.config = config;
    }

    async connect(): Promise<void> {
        const url = `${this.config.url}?token=${this.config.token}`;
        
        const agent = this.config.caBundle 
            ? new https.Agent({ ca: this.config.caBundle })
            : undefined;

        this.ws = new WebSocket(url, { agent });

        await new Promise<void>((resolve, reject) => {
            if (!this.ws) return reject(new Error('WebSocket not created'));
            
            this.ws.on('open', () => resolve());
            this.ws.on('error', (err) => reject(err));
            
            // 连接超时
            setTimeout(() => {
                if (this.ws?.readyState === WebSocket.CONNECTING) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });

        // 启动心跳
        this.startPing();
    }

    async close(): Promise<void> {
        this.stopPing();
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    async sendRpc(method: string, params?: any): Promise<any> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket not connected');
        }

        const id = ++this.requestId;
        const request: JsonRpcMessage = {
            jsonrpc: '2.0',
            method,
            ...(params && { params }),
            id,
        };

        this.ws.send(JSON.stringify(request));

        // 等待响应
        return new Promise((resolve, reject) => {
            const handler = (data: Buffer) => {
                const message = JSON.parse(data.toString());
                
                // 跳过通知 (无 id)
                if (!('id' in message)) {
                    return;
                }
                
                // 只处理匹配的响应
                if (message.id === id) {
                    this.ws?.removeListener('message', handler);
                    
                    if (message.error) {
                        reject(new Error(message.error.message));
                    } else {
                        resolve(message.result);
                    }
                }
            };

            this.ws?.on('message', handler);

            // 超时
            setTimeout(() => {
                this.ws?.removeListener('message', handler);
                reject(new Error('Request timeout'));
            }, 30000);
        });
    }

    async sendMessage(content: string, options: {
        receiverDid?: string;
        receiverId?: string;
        groupDid?: string;
        groupId?: string;
        type?: string;
        clientMsgId?: string;
    }): Promise<any> {
        return this.sendRpc('send', {
            content,
            type: options.type || 'text',
            client_msg_id: options.clientMsgId || crypto.randomUUID(),
            ...(options.receiverDid && { receiver_did: options.receiverDid }),
            ...(options.receiverId && { receiver_id: options.receiverId }),
            ...(options.groupDid && { group_did: options.groupDid }),
            ...(options.groupId && { group_id: options.groupId }),
        });
    }

    async receive(timeout?: number): Promise<JsonRpcMessage | null> {
        if (!this.ws) {
            throw new Error('WebSocket not connected');
        }

        return new Promise((resolve) => {
            const timeoutId = timeout 
                ? setTimeout(() => {
                    this.ws?.removeListener('message', handler);
                    resolve(null);
                }, timeout)
                : null;

            const handler = (data: Buffer) => {
                if (timeoutId) clearTimeout(timeoutId);
                this.ws?.removeListener('message', handler);
                resolve(JSON.parse(data.toString()));
            };

            this.ws.on('message', handler);
        });
    }

    async receiveNotification(timeout?: number): Promise<JsonRpcMessage | null> {
        if (!this.ws) {
            throw new Error('WebSocket not connected');
        }

        return new Promise((resolve) => {
            const timeoutId = timeout 
                ? setTimeout(() => {
                    this.ws?.removeListener('message', handler);
                    resolve(null);
                }, timeout)
                : null;

            const handler = (data: Buffer) => {
                const message = JSON.parse(data.toString());
                
                // 通知没有 id 字段
                if (!('id' in message)) {
                    if (timeoutId) clearTimeout(timeoutId);
                    this.ws?.removeListener('message', handler);
                    resolve(message);
                }
            };

            this.ws.on('message', handler);
        });
    }

    private startPing(): void {
        const interval = this.config.pingInterval || 20000;
        
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.ping();
            }
        }, interval);
    }

    private stopPing(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = undefined;
        }
    }
}
```

---

## 5. 使用示例

### 5.1 基本使用

```javascript
import { WsClient } from './ws-client.js';

const client = new WsClient({
    url: 'wss://awiki.ai/message/ws',
    token: 'jwt_token',
});

try {
    await client.connect();
    
    // 发送消息
    const result = await client.sendMessage('Hello!', {
        receiverDid: 'did:wba:...',
    });
    console.log('Message sent:', result);
    
    // 接收通知
    const notification = await client.receiveNotification(5000);
    if (notification) {
        console.log('Received:', notification);
    }
} finally {
    await client.close();
}
```

### 5.2 事件驱动方式

```javascript
const ws = new WebSocket('wss://awiki.ai/ws?token=jwt');

ws.on('open', () => {
    console.log('Connected');
    ws.send(JSON.stringify({ message: 'Hello' }));
});

ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('Received:', message);
});

ws.on('close', () => {
    console.log('Disconnected');
});

ws.on('error', (err) => {
    console.error('Error:', err);
});
```

---

## 6. 错误处理

```typescript
// 连接错误
ws.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
        console.error('Connection refused');
    } else if (err.code === 'ECONNRESET') {
        console.error('Connection reset');
    } else {
        console.error('WebSocket error:', err);
    }
});

// 关闭事件
ws.on('close', (code, reason) => {
    console.log(`Closed: ${code} ${reason}`);
    
    // 常见关闭码
    // 1000: 正常关闭
    // 1001: 端点离开
    // 1006: 异常关闭
});
```

---

## 7. 依赖配置

```json
{
  "dependencies": {
    "ws": "^8.14.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## 8. 测试用例

参考 [distill.json](distill.json) 中的 24 个测试用例。

---

## 9. 迁移检查清单

- [ ] 实现 WebSocket 客户端类
- [ ] 实现连接管理
- [ ] 实现 RPC 请求发送
- [ ] 实现消息发送
- [ ] 实现通知接收
- [ ] 实现心跳机制
- [ ] 实现错误处理
- [ ] 添加 TypeScript 类型定义
- [ ] 编写单元测试
- [ ] 编写与 Python 版本的互操作测试

---

## 10. 注意事项

1. **事件驱动**: JavaScript WebSocket 使用事件驱动模型，不同于 Python 的 async/await
2. **Buffer 处理**: 接收的数据是 Buffer，需要转换为字符串
3. **自动重连**: 需要手动实现自动重连逻辑
4. **心跳**: ws 库自动处理 ping/pong，但需要手动启动
5. **TypeScript 支持**: @types/ws 提供完整的类型定义
