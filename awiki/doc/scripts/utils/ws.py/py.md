# scripts/utils/ws.py 分析

## 文件信息

- **路径**: `python/scripts/utils/ws.py`
- **用途**: WebSocket 客户端封装 (连接 molt-message)

## 类定义

### WsClient

```python
class WsClient:
    """molt-message WebSocket 客户端
    
    使用 JWT Bearer 认证 (通过查询参数)
    支持 JSON-RPC 请求发送和推送通知接收
    """
    
    def __init__(
        self,
        config: SDKConfig,
        identity: DIDIdentity,
    ) -> None:
        """初始化 WebSocket 客户端
        
        参数:
            config: SDK 配置
            identity: DID 身份 (需要 jwt_token)
        """
    
    async def connect(self) -> None:
        """建立 WebSocket 连接
        
        URL 格式: wss://{host}/message/ws?token={jwt_token}
        """
    
    async def close(self) -> None:
        """关闭连接"""
    
    async def __aenter__(self) -> WsClient:
        """异步上下文管理器入口"""
    
    async def __aexit__(self, *args: Any) -> None:
        """异步上下文管理器出口"""
    
    async def send_rpc(
        self,
        method: str,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """发送 JSON-RPC 请求并等待响应
        
        返回:
            JSON-RPC result 字段内容
        """
    
    async def send_message(
        self,
        content: str,
        receiver_did: str | None = None,
        receiver_id: str | None = None,
        group_did: str | None = None,
        group_id: str | None = None,
        msg_type: str = "text",
        client_msg_id: str | None = None,  # 自动生成 uuid4
        title: str | None = None,
    ) -> dict[str, Any]:
        """发送消息的便捷方法
        
        sender_did 由服务器自动注入
        client_msg_id 自动生成 (uuid4) 用于幂等投递
        
        返回:
            消息响应 dict
        """
    
    async def ping(self) -> bool:
        """发送应用层心跳并等待 pong
        
        返回:
            是否收到 pong
        """
    
    async def receive(self, timeout: float = 10.0) -> dict[str, Any] | None:
        """接收单个消息 (请求响应或推送通知)
        
        返回:
            JSON 消息 dict，超时时返回 None
        """
    
    async def receive_notification(
        self, timeout: float = 10.0
    ) -> dict[str, Any] | None:
        """接收单个推送通知 (跳过请求响应)
        
        通知特征：无 id 字段
        
        返回:
            JSON-RPC Notification dict，超时时返回 None
        """
```

## 导入的模块

```python
import asyncio
import json
import logging
import ssl
import uuid
from typing import Any
import websockets
from websockets.asyncio.client import ClientConnection
from utils.client import _resolve_verify
from utils.config import SDKConfig
from utils.identity import DIDIdentity
```

## WebSocket URL 构建

```python
# 1. 获取基础 URL
base_url = config.molt_message_ws_url or config.molt_message_url

# 2. 转换为 WebSocket URL
if base_url.startswith("ws://") or base_url.startswith("wss://"):
    ws_url = base_url.rstrip("/")
else:
    ws_url = base_url.replace("http://", "ws://").replace("https://", "wss://")

# 3. 添加 JWT token 认证
url = f"{ws_url}/message/ws?token={identity.jwt_token}"
```

## TLS 配置

```python
verify_target = base_url.replace("ws://", "http://").replace("wss://", "https://")
verify = _resolve_verify(verify_target)

if url.startswith("wss://"):
    if isinstance(verify, ssl.SSLContext):
        ssl_context = verify
    elif verify is not False:
        ssl_context = True
```

## JSON-RPC 消息格式

### 发送请求
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

### 推送通知
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

### 响应
```json
{
  "jsonrpc": "2.0",
  "result": {
    "id": "msg_123",
    "server_seq": 42,
    "sent_at": "2026-03-19T10:00:00Z"
  },
  "id": 1
}
```

## 被调用关系

| 调用文件 | 调用内容 |
|----------|----------|
| `utils/__init__.py` | 导出 `WsClient` |
| `scripts/ws_listener.py` | 间接使用 (通过 WebSocket 连接) |
| `scripts/e2ee_messaging.py` | 不直接使用 (使用 HTTP RPC) |

## 使用示例

```python
from utils import SDKConfig, WsClient
from credential_store import load_identity

config = SDKConfig()
data = load_identity("default")

identity = DIDIdentity(
    did=data["did"],
    did_document=data["did_document"],
    private_key_pem=data["private_key_pem"].encode(),
    public_key_pem=data["public_key_pem"].encode(),
    jwt_token=data["jwt_token"],
)

async with WsClient(config, identity) as ws:
    # 发送消息
    result = await ws.send_message(
        content="Hello!",
        receiver_did="did:wba:...",
    )
    
    # 接收推送
    notification = await ws.receive_notification(timeout=5.0)
```

## 心跳机制

```python
async def ping(self) -> bool:
    """应用层心跳"""
    await self._conn.send(json.dumps({"jsonrpc": "2.0", "method": "ping"}))
    raw = await self._conn.recv()
    data = json.loads(raw)
    return data.get("method") == "pong"
```

## 通知识别

```python
async def receive_notification(self, timeout: float = 10.0):
    """接收推送通知 (无 id 字段)"""
    while True:
        raw = await asyncio.wait_for(self._conn.recv(), timeout=timeout)
        data = json.loads(raw)
        # 通知没有 id 字段
        if "id" not in data:
            return data
```
