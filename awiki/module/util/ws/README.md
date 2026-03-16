# @awiki/ws

WebSocket 客户端封装模块，用于 awiki SDK。

## 概述

本模块移植自 Python 版本的 `python/scripts/utils/ws.py`，提供 molt-message WebSocket 客户端封装。

## 功能特性

- **WebSocket 连接管理**: 支持建立和关闭 WebSocket 连接
- **JSON-RPC 请求**: 发送 JSON-RPC 2.0 请求并等待响应
- **消息发送**: 便捷的消息发送方法，支持多种接收者类型
- **推送通知**: 接收服务器推送的通知
- **心跳检测**: 应用层 ping/pong 心跳
- **JWT 认证**: 通过查询参数传递 JWT token
- **SSL 配置**: 自动处理 TLS 验证设置

## 安装

```bash
npm install
```

## 使用示例

### 基本用法

```typescript
import { WsClient } from '@awiki/ws';

async function example() {
    const ws = new WsClient(config, identity);
    
    try {
        // 建立连接
        await ws.connect();
        
        // 发送消息
        const result = await ws.sendMessage({
            content: "Hello, World!",
            receiver_did: "did:wba:awiki.ai:user:k1_xxx",
        });
        console.log("Message sent:", result);
        
        // 接收推送通知
        const notification = await ws.receiveNotification({ timeout: 5000 });
        if (notification) {
            console.log("Received notification:", notification);
        }
        
        // 发送心跳
        const isAlive = await ws.ping();
        console.log("Heartbeat:", isAlive);
        
    } finally {
        // 关闭连接
        await ws.close();
    }
}
```

### 发送消息选项

```typescript
// 发送给个人用户 (receiver_id)
await ws.sendMessage({
    content: "Direct message",
    receiver_id: "user-uuid-123",
});

// 发送给群组
await ws.sendMessage({
    content: "Group message",
    group_did: "did:wba:awiki.ai:group:k1_group",
});

// 自定义消息类型和标题
await ws.sendMessage({
    content: "Message content",
    receiver_did: "did:wba:...",
    msg_type: "notification",
    title: "Important Notice",
});

// 自定义 client_msg_id (用于幂等投递)
await ws.sendMessage({
    content: "Test message",
    client_msg_id: "custom-id-12345",
});
```

## API 参考

### WsClient 类

#### 构造函数

```typescript
new WsClient(config: SDKConfig, identity: DIDIdentity, options?: WsClientOptions)
```

- `config`: SDK 配置对象
- `identity`: DID 身份（包含 `jwt_token`）
- `options`: 可选配置
  - `connectTimeout`: 连接超时（毫秒），默认 10000
  - `receiveTimeout`: 接收超时（毫秒），默认 10000

#### 方法

| 方法 | 描述 | 返回值 |
|------|------|--------|
| `connect()` | 建立 WebSocket 连接 | `Promise<void>` |
| `close()` | 关闭连接 | `Promise<void>` |
| `sendRpc(method, params)` | 发送 JSON-RPC 请求 | `Promise<any>` |
| `sendMessage(options)` | 发送消息 | `Promise<any>` |
| `ping()` | 发送心跳 | `Promise<boolean>` |
| `receive(options)` | 接收消息 | `Promise<WebSocketMessage \| null>` |
| `receiveNotification(options)` | 接收推送通知 | `Promise<JsonRpcNotification \| null>` |

## 关键实现细节

### 1. URL 转换

- `http://` -> `ws://`
- `https://` -> `wss://`
- `ws://` 或 `wss://` 保持不变

### 2. JWT 认证

JWT token 通过查询参数传递：`?token={jwt}`

### 3. 推送通知识别

推送通知的特征：**无 `id` 字段**

### 4. client_msg_id

未提供时自动生成 UUID v4，用于幂等投递。

### 5. 请求 ID

自增整数，从 1 开始。

### 6. SSL 配置

使用 `_resolveVerify()` 函数（来自 `@awiki/client` 模块）处理 TLS 验证：

1. 检查环境变量：`AWIKI_CA_BUNDLE` / `E2E_CA_BUNDLE` / `SSL_CERT_FILE`
2. macOS mkcert 自动检测
3. 默认系统验证

## 测试

```bash
npm run build
npm test
```

## 依赖

- `@awiki/client`: HTTP 客户端工厂
- `@awiki/config`: SDK 配置
- `ws`: WebSocket 实现
- `@types/ws`: WebSocket 类型定义

## 构建

```bash
npm run build    # 编译 TypeScript
npm run clean    # 清理 dist 目录
```

## 移植状态

| 功能 | Python | JavaScript | 状态 |
|------|--------|------------|------|
| `connect()` | ✓ | ✓ | ✅ 完成 |
| `close()` | ✓ | ✓ | ✅ 完成 |
| `send_rpc()` | ✓ | ✓ | ✅ 完成 |
| `send_message()` | ✓ | ✓ | ✅ 完成 |
| `ping()` | ✓ | ✓ | ✅ 完成 |
| `receive()` | ✓ | ✓ | ✅ 完成 |
| `receive_notification()` | ✓ | ✓ | ✅ 完成 |
| URL 转换 | ✓ | ✓ | ✅ 完成 |
| JWT 认证 | ✓ | ✓ | ✅ 完成 |
| SSL 配置 | ✓ | ✓ | ✅ 完成 |

## 注意事项

1. **Node.js 版本**: 需要 Node.js >= 18.0.0
2. **WebSocket 库**: 使用 `ws` 包（Node.js 环境）
3. **异步上下文管理器**: Python 的 `async with` 在 JS 中推荐使用 `try-finally` 模式

## 许可证

MIT
