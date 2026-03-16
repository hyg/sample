# ws 模块 JS 移植设计文档

## 1. 概述

**Python 源文件**: `python/scripts/utils/ws.py`  
**JavaScript 目标文件**: `module/src/ws.js`  
**功能**: WebSocket 客户端封装

---

## 2. 依赖关系

### 2.1 Python 依赖

```python
import websockets
from websockets.asyncio.client import ClientConnection
```

### 2.2 JavaScript 依赖

```javascript
import WebSocket from 'ws';  // Node.js
// 或使用原生 WebSocket (浏览器环境)
```

---

## 3. 接口设计

### 3.1 `WsClient` 类

**JavaScript**:
```javascript
/**
 * WebSocket 客户端
 */
class WsClient {
    /**
     * @param {SDKConfig} config - SDK 配置
     * @param {DIDIdentity} identity - DID 身份
     */
    constructor(config, identity) {
        this.config = config;
        this.identity = identity;
        this.ws = null;
        this.requestId = 0;
    }

    /**
     * 建立 WebSocket 连接
     */
    async connect() {
        if (!this.identity.jwtToken) {
            throw new Error('Missing JWT token');
        }

        const baseUrl = this.config.moltMessageWsUrl || this.config.moltMessageUrl;
        const wsUrl = baseUrl
            .replace('http://', 'ws://')
            .replace('https://', 'wss://');
        
        const url = `${wsUrl}/message/ws?token=${this.identity.jwtToken}`;
        
        this.ws = new WebSocket(url);
        
        return new Promise((resolve, reject) => {
            this.ws.on('open', resolve);
            this.ws.on('error', reject);
        });
    }

    /**
     * 关闭连接
     */
    async close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * 发送 RPC 请求
     * @param {string} method - 方法名
     * @param {Object} [params] - 参数
     * @returns {Promise<any>}
     */
    async sendRpc(method, params = null) {
        if (!this.ws) {
            throw new Error('WebSocket not connected');
        }

        const requestId = ++this.requestId;
        const request = {
            jsonrpc: '2.0',
            method,
            ...(params && { params }),
            id: requestId,
        };

        this.ws.send(JSON.stringify(request));

        // 等待响应
        return new Promise((resolve, reject) => {
            const handler = (data) => {
                const message = JSON.parse(data.toString());
                if (message.id === requestId) {
                    this.ws.off('message', handler);
                    if (message.error) {
                        reject(new Error(message.error.message));
                    } else {
                        resolve(message.result);
                    }
                }
            };
            this.ws.on('message', handler);
        });
    }

    /**
     * 发送消息
     * @param {string} content - 消息内容
     * @param {Object} options - 选项
     * @returns {Promise<any>}
     */
    async sendMessage(content, options = {}) {
        const {
            receiverDid = null,
            receiverId = null,
            groupDid = null,
            groupId = null,
            type = 'text',
            clientMsgId = crypto.randomUUID(),
            title = null,
        } = options;

        const params = {
            content,
            type,
            client_msg_id: clientMsgId,
        };

        if (receiverDid) params.receiver_did = receiverDid;
        if (receiverId) params.receiver_id = receiverId;
        if (groupDid) params.group_did = groupDid;
        if (groupId) params.group_id = groupId;
        if (title !== null) params.title = title;

        return this.sendRpc('send', params);
    }

    /**
     * 接收消息
     * @param {number} [timeout=10000] - 超时时间 (ms)
     * @returns {Promise<Object|null>}
     */
    async receive(timeout = 10000) {
        if (!this.ws) {
            throw new Error('WebSocket not connected');
        }

        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(null), timeout);
            
            const handler = (data) => {
                clearTimeout(timer);
                this.ws.off('message', handler);
                resolve(JSON.parse(data.toString()));
            };
            
            this.ws.once('message', handler);
        });
    }

    /**
     * 接收推送通知
     * @param {number} [timeout=10000] - 超时时间 (ms)
     * @returns {Promise<Object|null>}
     */
    async receiveNotification(timeout = 10000) {
        if (!this.ws) {
            throw new Error('WebSocket not connected');
        }

        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(null), timeout);
            
            const handler = (data) => {
                const message = JSON.parse(data.toString());
                // 通知没有 id 字段
                if (!('id' in message)) {
                    clearTimeout(timer);
                    this.ws.off('message', handler);
                    resolve(message);
                }
            };
            
            this.ws.on('message', handler);
        });
    }
}
```

---

## 4. 导出接口

```javascript
export {
    WsClient,
};
```

---

## 5. 使用示例

```javascript
import { WsClient } from './ws.js';

async function example() {
    const ws = new WsClient(config, identity);
    
    try {
        await ws.connect();
        
        // 发送消息
        const result = await ws.sendMessage('Hello!', {
            receiverDid: 'did:wba:...',
        });
        console.log('Message sent:', result);
        
        // 接收通知
        const notification = await ws.receiveNotification();
        if (notification) {
            console.log('Received:', notification);
        }
    } finally {
        await ws.close();
    }
}
```

---

## 6. 迁移检查清单

- [ ] 实现 `WsClient` 类
- [ ] 实现连接管理
- [ ] 实现 RPC 调用
- [ ] 实现消息发送
- [ ] 实现通知接收
- [ ] 添加 TypeScript 类型定义
- [ ] 编写单元测试
- [ ] 更新文档
