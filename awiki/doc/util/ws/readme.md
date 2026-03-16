# ws.py 模块文档

## 1. 概述

**文件路径**: `python/scripts/utils/ws.py`

**主要功能**: 
- WebSocket 客户端封装
- 连接 molt-message WebSocket 端点
- JSON-RPC 请求发送和推送通知接收
- 自动心跳和重连

**依赖关系**:
- `websockets`: WebSocket 库
- `asyncio`: 异步编程
- `json`: JSON 序列化
- `ssl`: SSL/TLS 配置
- 本地模块：`client`, `config`, `identity`

---

## 2. 导入模块

| 模块 | 用途 |
|------|------|
| `asyncio` | 异步编程 |
| `json` | JSON 序列化 |
| `logging` | 日志记录 |
| `ssl` | SSL/TLS 配置 |
| `uuid` | 生成请求 ID |
| `websockets` | WebSocket 客户端 |
| `websockets.asyncio.client.ClientConnection` | WebSocket 连接类型 |
| `utils.client._resolve_verify` | SSL 验证配置 |
| `utils.config.SDKConfig` | SDK 配置 |
| `utils.identity.DIDIdentity` | DID 身份 |

---

## 3. 类详解

### 3.1 `WsClient`

**定义**:
```python
class WsClient:
    """molt-message WebSocket 客户端。"""
```

**初始化参数**:
```python
def __init__(
    self,
    config: SDKConfig,
    identity: DIDIdentity,
) -> None:
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `config` | `SDKConfig` | SDK 配置 |
| `identity` | `DIDIdentity` | DID 身份（需要 jwt_token） |

**属性**:
| 属性 | 类型 | 描述 |
|------|------|------|
| `_config` | `SDKConfig` | SDK 配置 |
| `_identity` | `DIDIdentity` | DID 身份 |
| `_conn` | `ClientConnection | None` | WebSocket 连接 |
| `_request_id` | `int` | 请求 ID 计数器 |

---

### 3.1.1 `connect`

**签名**:
```python
async def connect(self) -> None:
```

**异常**: 
- `ValueError`: 缺少 JWT 令牌

**功能**: 
建立 WebSocket 连接。

**连接 URL 格式**:
```
wss://awiki.ai/message/ws?token={jwt_token}
```

**SSL 配置**:
- 自动解析 CA 证书（通过 `_resolve_verify`）
- 支持本地开发环境的 mkcert 证书

**调用位置**: 
- `__aenter__()`
- `ws_listener.py`

---

### 3.1.2 `close`

**签名**:
```python
async def close(self) -> None:
```

**功能**: 
关闭 WebSocket 连接。

**调用位置**: 
- `__aexit__()`
- `ws_listener.py`

---

### 3.1.3 `send_rpc`

**签名**:
```python
async def send_rpc(
    self,
    method: str,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `method` | `str` | - | RPC 方法名 |
| `params` | `dict` | `None` | 方法参数 |

**返回值**: `dict[str, Any]` - JSON-RPC result

**异常**: 
- `RuntimeError`: 未连接或收到错误响应

**功能**: 
发送 JSON-RPC 请求并等待响应。

**请求格式**:
```json
{
  "jsonrpc": "2.0",
  "method": "ping",
  "id": 1
}
```

**调用位置**: 
- `send_message()`
- `ping()`

---

### 3.1.4 `send_message`

**签名**:
```python
async def send_message(
    self,
    content: str,
    receiver_did: str | None = None,
    receiver_id: str | None = None,
    group_did: str | None = None,
    group_id: str | None = None,
    msg_type: str = "text",
    client_msg_id: str | None = None,
    title: str | None = None,
) -> dict[str, Any]:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `content` | `str` | - | 消息内容 |
| `receiver_did` | `str` | `None` | 接收方 DID |
| `receiver_id` | `str` | `None` | 接收方用户 ID |
| `group_did` | `str` | `None` | 群组 DID |
| `group_id` | `str` | `None` | 群组 ID |
| `msg_type` | `str` | `"text"` | 消息类型 |
| `client_msg_id` | `str` | `None` | 客户端消息 ID（用于幂等） |
| `title` | `str` | `None` | 消息标题 |

**返回值**: `dict[str, Any]` - 消息响应

**功能**: 
发送消息的便捷方法。

**特性**:
- `sender_did` 由服务器自动注入
- `client_msg_id` 自动生成（uuid4），用于幂等投递

**调用位置**: `send_message.py`, `e2ee_messaging.py`

---

### 3.1.5 `ping`

**签名**:
```python
async def ping(self) -> bool:
```

**返回值**: `bool` - 是否收到 pong

**功能**: 
发送应用层心跳并等待 pong。

**请求**:
```json
{"jsonrpc": "2.0", "method": "ping"}
```

**响应**:
```json
{"jsonrpc": "2.0", "method": "pong"}
```

---

### 3.1.6 `receive`

**签名**:
```python
async def receive(self, timeout: float = 10.0) -> dict[str, Any] | None:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `timeout` | `float` | `10.0` | 超时时间（秒） |

**返回值**: `dict[str, Any] | None` - JSON 消息或超时返回 None

**功能**: 
接收单条消息（请求响应或推送通知）。

---

### 3.1.7 `receive_notification`

**签名**:
```python
async def receive_notification(
    self, timeout: float = 10.0
) -> dict[str, Any] | None:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `timeout` | `float` | `10.0` | 超时时间（秒） |

**返回值**: `dict[str, Any] | None` - 推送通知或 None

**功能**: 
接收推送通知（跳过请求响应）。

**通知特征**: 没有 `id` 字段

---

### 3.1.8 上下文管理器

**签名**:
```python
async def __aenter__(self) -> WsClient:
async def __aexit__(self, *args: Any) -> None:
```

**功能**: 
支持 `async with` 语法，自动连接和关闭。

**使用示例**:
```python
async with WsClient(config, identity) as ws:
    result = await ws.send_message("Hello!", receiver_did=did)
```

---

## 4. WebSocket 协议

### 4.1 连接建立

```
1. 获取 JWT 令牌
   ↓
2. 构建 WebSocket URL: wss://.../message/ws?token={jwt}
   ↓
3. 执行 WebSocket 握手
   ↓
4. 连接建立
```

### 4.2 消息格式

**请求**:
```json
{
  "jsonrpc": "2.0",
  "method": "send",
  "params": {
    "content": "Hello!",
    "type": "text",
    "receiver_did": "did:wba:..."
  },
  "id": 1
}
```

**响应**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "message_id": "msg_123"
  },
  "id": 1
}
```

**推送通知**:
```json
{
  "jsonrpc": "2.0",
  "method": "new_message",
  "params": {
    "message_id": "msg_123",
    "from": "did:wba:...",
    "content": "Hello!"
  }
}
```

---

## 5. 调用关系

### 被谁调用
- `ws_listener.py`: WebSocket 监听器
- `send_message.py`: 发送消息
- `e2ee_messaging.py`: E2EE 消息处理

### 调用谁
- `websockets`: WebSocket 连接
- `utils.client`: SSL 验证配置
- `utils.config`: 获取服务 URL
- `utils.identity`: 获取 JWT 令牌

---

## 6. 使用示例

### 6.1 基本使用

```python
from utils.ws import WsClient

async with WsClient(config, identity) as ws:
    # 发送消息
    result = await ws.send_message(
        "Hello!",
        receiver_did="did:wba:awiki.ai:user:k1_abc123"
    )
    print(f"Message sent: {result['message_id']}")
    
    # 接收通知
    notification = await ws.receive_notification(timeout=5.0)
    if notification:
        print(f"Received: {notification}")
```

### 6.2 手动连接管理

```python
ws = WsClient(config, identity)
try:
    await ws.connect()
    result = await ws.send_message("Hello!", receiver_did=did)
finally:
    await ws.close()
```

### 6.3 心跳保活

```python
async def keepalive(ws: WsClient):
    while True:
        try:
            pong = await ws.ping()
            if not pong:
                print("Heartbeat failed")
                break
            await asyncio.sleep(30)
        except Exception as e:
            print(f"Heartbeat error: {e}")
            break
```

### 6.4 监听推送通知

```python
async def listen_notifications(ws: WsClient):
    while True:
        notification = await ws.receive_notification(timeout=30)
        if notification:
            method = notification.get("method")
            params = notification.get("params", {})
            
            if method == "new_message":
                print(f"New message: {params}")
            elif method == "group_message":
                print(f"Group message: {params}")
```

---

## 7. 错误处理

```python
from utils.ws import WsClient
import websockets

async def safe_send(ws: WsClient, content, receiver_did):
    try:
        return await ws.send_message(content, receiver_did=receiver_did)
    except RuntimeError as e:
        print(f"WebSocket error: {e}")
        # 尝试重连
        await ws.close()
        await ws.connect()
        return await ws.send_message(content, receiver_did=receiver_did)
    except websockets.ConnectionClosed as e:
        print(f"Connection closed: {e.code} {e.reason}")
    except asyncio.TimeoutError:
        print("Request timeout")
```

---

## 8. 注意事项

1. **JWT 令牌**: 必须在创建客户端前获取有效的 JWT
2. **连接管理**: 使用 `async with` 确保正确关闭
3. **超时设置**: 合理设置 `timeout` 避免阻塞
4. **幂等性**: `client_msg_id` 用于防止重复投递
5. **心跳**: 长时间连接需要定期发送 ping 保持活跃
