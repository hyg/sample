# websockets-14.0

**用途**: WebSocket 客户端，用于接收 molt-message 推送通知

## 依赖信息

- **库名**: websockets
- **版本**: >=14.0
- **来源**: requirements.txt

## 主要功能

### 连接管理

```python
import websockets
from websockets.asyncio.client import ClientConnection

async with websockets.connect(url, ssl=ssl_context) as ws:
    # 发送消息
    await ws.send(json.dumps(message))
    
    # 接收消息
    data = await ws.recv()
```

## 在 awiki-did 中的使用

| 文件 | 用途 |
|------|------|
| `utils/ws.py` | WsClient 封装类 |
| `scripts/ws_listener.py` | WebSocket 监听器后台服务 |

## WsClient 封装

```python
# utils/ws.py
class WsClient:
    async def connect(self) -> None:
        """建立 WebSocket 连接 (JWT token 认证)"""
        
    async def close(self) -> None:
        """关闭连接"""
        
    async def send_rpc(self, method: str, params: dict) -> dict:
        """发送 JSON-RPC 请求"""
        
    async def send_message(self, content: str, receiver_did: str, ...) -> dict:
        """发送消息 (自动生成 client_msg_id)"""
        
    async def receive(self, timeout: float = 10.0) -> dict | None:
        """接收消息"""
        
    async def receive_notification(self, timeout: float = 10.0) -> dict | None:
        """接收推送通知 (跳过请求响应)"""
        
    async def ping(self) -> bool:
        """应用层心跳"""
```

## 认证方式

JWT token 通过查询参数传递:
```
wss://awiki.ai/message/ws?token=<jwt_token>
```

## 消息格式

### 发送消息 (JSON-RPC)
```json
{
  "jsonrpc": "2.0",
  "method": "send",
  "params": {
    "content": "Hello",
    "type": "text",
    "receiver_did": "did:wba:...",
    "client_msg_id": "uuid4"
  },
  "id": 1
}
```

### 接收推送通知
```json
{
  "method": "new_message",
  "params": {
    "id": "msg_123",
    "sender_did": "did:wba:...",
    "content": "Hello",
    "type": "text",
    "server_seq": 42,
    "sent_at": "2026-03-19T10:00:00Z"
  }
}
```

## E2EE 消息类型

| 类型 | 用途 |
|------|------|
| `e2ee_init` | 会话初始化 |
| `e2ee_ack` | 会话确认 |
| `e2ee_msg` | 加密消息 |
| `e2ee_rekey` | 会话重新密钥 |
| `e2ee_error` | E2EE 错误响应 |
