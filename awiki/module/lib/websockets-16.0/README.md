# websockets-16.0 TypeScript 实现

Python `websockets` 库的 JavaScript/TypeScript 移植版本。

## 文件结构

```
websockets-16.0/
├── src/
│   ├── index.ts       # 导出文件
│   ├── client.ts      # WebSocket 客户端类
│   ├── errors.ts      # 错误类定义
│   └── types.ts       # 类型定义
├── package.json       # 包配置
├── tsconfig.json      # TypeScript 配置
└── README.md          # 本文档
```

## 移植的文件列表

| 文件 | 描述 | 行数 |
|------|------|------|
| `src/types.ts` | 类型定义 | ~150 行 |
| `src/errors.ts` | 错误类定义 | ~90 行 |
| `src/client.ts` | WebSocket 客户端实现 | ~350 行 |
| `src/index.ts` | 导出文件 | ~50 行 |

## 实现的类和方法列表

### WsClient 类

对应 Python `utils/ws.py` 中的 `WsClient` 类。

| 方法 | Python 对应 | 描述 |
|------|-------------|------|
| `constructor(config)` | `__init__` | 创建客户端实例 |
| `connect()` | `connect()` | 建立 WebSocket 连接 |
| `close()` | `close()` | 关闭连接 |
| `sendRpc(method, params)` | `send_rpc()` | 发送 JSON-RPC 请求 |
| `sendMessage(params)` | `send_message()` | 发送消息 |
| `receive(timeout)` | `receive()` | 接收消息 |
| `receiveNotification(timeout)` | `receive_notification()` | 接收推送通知 |
| `ping()` | `ping()` | 发送心跳 |
| `getState()` | - | 获取连接状态 |
| `isConnected()` | - | 检查连接状态 |

### 错误类

| 类 | Python 对应 | 描述 |
|------|-------------|------|
| `ConnectionClosedError` | `websockets.exceptions.ConnectionClosed` | 连接关闭错误 |
| `NotConnectedError` | `RuntimeError("WebSocket not connected")` | 未连接错误 |
| `JsonRpcError` | `RuntimeError("JSON-RPC error...")` | JSON-RPC 错误 |
| `TimeoutError` | `asyncio.TimeoutError` | 超时错误 |
| `ConnectionError` | `websockets.exceptions.*` | 连接错误 |
| `MissingJwtTokenError` | `ValueError("identity missing jwt_token")` | JWT 缺失错误 |

### 类型定义

| 接口 | 描述 |
|------|------|
| `WsClientConfig` | 客户端配置 |
| `SendMessageParams` | 发送消息参数 |
| `JsonRpcMessage` | JSON-RPC 消息 |
| `JsonRpcRequest` | JSON-RPC 请求 |
| `JsonRpcResponse` | JSON-RPC 响应 |
| `JsonRpcNotification` | JSON-RPC 通知 |
| `JsonRpcError` | JSON-RPC 错误 |
| `WebSocketState` | 连接状态枚举 |
| `PushNotification` | 推送通知 |

## 与 Python websockets 的 API 对比

### 连接建立

**Python**:
```python
async with websockets.connect(
    "wss://awiki.ai/message/ws?token=jwt",
    ssl=ssl_context
) as websocket:
    ...
```

**TypeScript**:
```typescript
const client = new WsClient({
    url: 'https://awiki.ai',
    token: 'jwt',
    caBundle: '/path/to/ca.pem',
});

await client.connect();
try {
    ...
} finally {
    await client.close();
}
```

### 发送消息

**Python**:
```python
result = await ws.send_message(
    content="Hello!",
    receiver_did="did:wba:...",
    msg_type="text",
)
```

**TypeScript**:
```typescript
const result = await client.sendMessage({
    content: 'Hello!',
    receiverDid: 'did:wba:...',
    msgType: 'text',
});
```

### 接收通知

**Python**:
```python
notification = await ws.receive_notification(timeout=5.0)
if notification:
    print(f"收到通知：{notification}")
```

**TypeScript**:
```typescript
const notification = await client.receiveNotification(5.0);
if (notification) {
    console.log(`收到通知：${notification}`);
}
```

### 心跳检测

**Python**:
```python
ok = await ws.ping()
if ok:
    print("心跳正常")
```

**TypeScript**:
```typescript
const ok = await client.ping();
if (ok) {
    console.log('心跳正常');
}
```

### 事件驱动方式

**Python** (有限的事件支持):
```python
# 主要通过 recv() 轮询
```

**TypeScript** (完整事件支持):
```typescript
client.on('message', (data) => {
    console.log('收到消息:', data);
});

client.on('close', (code, reason) => {
    console.log(`连接关闭：${code} ${reason}`);
});

client.on('error', (error) => {
    console.error('连接错误:', error);
});
```

## 主要差异

| 特性 | Python websockets | TypeScript ws |
|------|-------------------|---------------|
| 编程模型 | async/await | async/await + 事件驱动 |
| 连接管理 | `async with` 上下文 | `connect()` / `close()` |
| 消息接收 | `recv()` 阻塞等待 | `on('message')` 事件或 `receive()` |
| 心跳 | 自动 (ping_interval) | 手动启动 + 自动 ping |
| SSL 配置 | `ssl.SSLContext` | `https.Agent` |
| URL 转换 | 手动 | 自动 (http→ws) |

## 使用示例

### 基本使用

```typescript
import { WsClient, NotConnectedError } from 'websockets-16.0';

const client = new WsClient({
    url: 'https://awiki.ai',
    token: 'jwt_token',
    pingInterval: 20,
    requestTimeout: 30,
});

try {
    await client.connect();
    console.log('已连接');

    // 发送消息
    const result = await client.sendMessage({
        content: 'Hello!',
        receiverDid: 'did:wba:awiki.ai:user:k1_...',
    });
    console.log('消息发送成功:', result);

    // 接收通知
    const notification = await client.receiveNotification(5.0);
    if (notification) {
        console.log('收到通知:', notification);
    }
} catch (error) {
    if (error instanceof NotConnectedError) {
        console.error('未连接:', error.message);
    } else {
        console.error('错误:', error);
    }
} finally {
    await client.close();
}
```

### 事件驱动方式

```typescript
import { WsClient } from 'websockets-16.0';

const client = new WsClient({
    url: 'https://awiki.ai',
    token: 'jwt_token',
});

client.on('message', (data) => {
    console.log('收到消息:', data);
});

client.on('close', (code, reason) => {
    console.log(`连接关闭：${code} ${reason}`);
});

client.on('error', (error) => {
    console.error('连接错误:', error);
});

await client.connect();

// 保持连接
await new Promise(() => {});
```

## 依赖配置

```json
{
  "dependencies": {
    "ws": "^8.14.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

## 测试覆盖

参考 `doc/lib/websockets-16.0/distill.json` 中的 24 个测试用例：

- [x] TC001-TC006: 连接建立测试
- [x] TC007-TC015: 发送消息测试
- [x] TC016-TC020: 接收消息测试
- [x] TC021-TC022: 心跳检测测试
- [x] TC023-TC024: 连接关闭测试

## 注意事项

1. **事件驱动**: JavaScript 使用事件驱动模型，不同于 Python 的纯 async/await
2. **Buffer 处理**: 接收的数据是 Buffer，需要转换为字符串
3. **自动重连**: 需要手动实现自动重连逻辑 (参考 `ws_listener.py`)
4. **心跳**: ws 库自动处理 ping/pong，但需要手动启动定时器
5. **URL 转换**: 自动将 HTTP URL 转换为 WebSocket URL
