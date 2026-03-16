# websockets 库实现细节文档

## 1. 概述

**包名**: `websockets`  
**版本**: `16.0` (requirements.txt 指定 >=14.0)  
**用途**: WebSocket 客户端和服务器库

---

## 2. 安装信息

```bash
pip install websockets>=14.0
```

**查看安装位置**:
```bash
pip show websockets
```

---

## 3. 被调用的接口

### 3.1 connect

**调用位置**: `python/scripts/utils/ws.py`, `python/scripts/ws_listener.py`

**功能**: 建立 WebSocket 连接

**实现细节**:
```python
import websockets

async def connect(uri: str, **kwargs) -> WebSocketClientProtocol:
    """建立 WebSocket 连接"""
    # 1. 解析 URI
    # 2. 执行 WebSocket 握手
    # 3. 返回连接对象
```

**使用示例**:
```python
async with websockets.connect(
    "wss://awiki.ai/ws/notifications",
    extra_headers={"Authorization": "DIDWba ..."}
) as websocket:
    # 接收消息
    message = await websocket.recv()
    # 发送消息
    await websocket.send(message)
```

**关键参数**:
| 参数 | 描述 | 默认值 |
|------|------|--------|
| `uri` | WebSocket URI | - |
| `extra_headers` | 额外请求头 | - |
| `subprotocols` | 子协议 | - |
| `ping_interval` | Ping 间隔 | 20s |
| `ping_timeout` | Ping 超时 | 20s |

### 3.2 WebSocketClientProtocol

**调用位置**: `python/scripts/utils/ws.py`

**功能**: WebSocket 客户端协议对象

**关键方法**:
| 方法 | 描述 | 返回 |
|------|------|------|
| `send(data)` | 发送消息 | None |
| `recv()` | 接收消息 | str/bytes |
| `close()` | 关闭连接 | None |
| `ping()` | 发送 Ping | Future |
| `pong()` | 发送 Pong | None |

**实现细节**:
```python
class WebSocketClientProtocol:
    async def send(self, data: Union[str, bytes]):
        """发送消息"""
        # 1. 编码为 WebSocket 帧
        # 2. 添加 FIN 和 opcode
        # 3. 发送数据
    
    async def recv(self) -> Union[str, bytes]:
        """接收消息"""
        # 1. 读取 WebSocket 帧
        # 2. 解析 opcode 和长度
        # 3. 处理控制帧 (ping/pong/close)
        # 4. 重组数据帧
        # 5. 返回消息
    
    async def close(self, code=1000, reason=""):
        """关闭连接"""
        # 1. 发送 Close 帧
        # 2. 等待响应
        # 3. 关闭底层连接
```

### 3.3 ConnectionClosed

**调用位置**: `python/scripts/ws_listener.py`

**功能**: 连接关闭异常

**实现细节**:
```python
class ConnectionClosed(Exception):
    def __init__(self, code: int, reason: str):
        self.code = code  # 关闭码
        self.reason = reason  # 关闭原因
```

**关闭码**:
| 码 | 含义 |
|-----|------|
| 1000 | 正常关闭 |
| 1001 | 端点离开 |
| 1002 | 协议错误 |
| 1003 | 不支持的数据 |
| 1006 | 异常关闭 |
| 1011 | 服务器错误 |

---

## 4. 调用位置汇总

| 模块 | 接口 | 调用文件 | 调用函数 |
|------|------|----------|----------|
| `websockets` | `connect` | `utils/ws.py` | `create_websocket()` |
| `websockets` | `WebSocketClientProtocol` | `utils/ws.py` | `receive_notification()` |
| `websockets` | `ConnectionClosed` | `ws_listener.py` | `run_listener()` |
| `websockets` | `InvalidURI` | `utils/ws.py` | `create_websocket()` |

---

## 5. 源码位置

**典型位置**:
- **Windows**: `C:\Users\<user>\AppData\Roaming\Python\Python314\site-packages\websockets\`
- **Linux/Mac**: `~/.local/lib/python3.14/site-packages/websockets/`

**主要文件**:
```
websockets/
├── __init__.py
├── client.py         # connect, WebSocketClientProtocol
├── protocol.py       # WebSocket 协议实现
├── frames.py         # WebSocket 帧处理
├── exceptions.py     # 异常类
└── ...
```

---

## 6. 核心实现细节

### 6.1 WebSocket 握手

```python
# WebSocket 握手流程
async def handshake(uri, headers):
    # 1. 生成 Sec-WebSocket-Key (16 字节随机 Base64)
    # 2. 发送 HTTP 升级请求
    #    GET /ws/notifications HTTP/1.1
    #    Host: awiki.ai
    #    Upgrade: websocket
    #    Connection: Upgrade
    #    Sec-WebSocket-Key: <random>
    #    Sec-WebSocket-Version: 13
    # 3. 等待服务器响应
    #    HTTP/1.1 101 Switching Protocols
    #    Upgrade: websocket
    #    Connection: Upgrade
    #    Sec-WebSocket-Accept: <key_hash>
    # 4. 验证 Sec-WebSocket-Accept
    # 5. 握手完成
```

### 6.2 WebSocket 帧格式

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-------+-+-------------+-------------------------------+
|F|R|R|R| opcode|M| Payload len |    Extended payload length    |
|I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
|N|V|V|V|       |S|             |   (if Payload len==126/127)   |
| |1|2|3|       |K|             |                               |
+-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
|     Extended payload length continued, if Payload len == 127  |
+ - - - - - - - - - - - - - - - +-------------------------------+
|                               |Masking-key, if MASK set to 1  |
+-------------------------------+-------------------------------+
| Masking-key (continued)       |          Payload Data         |
+-------------------------------- - - - - - - - - - - - - - - - +
:                     Payload Data continued ...                :
+ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
|                     Payload Data continued ...                |
+---------------------------------------------------------------+
```

### 6.3 消息接收流程

```
1. 读取 2 字节（FIN + opcode + 长度）
   ↓
2. 解析扩展长度（如需要）
   ↓
3. 读取掩码（如需要）
   ↓
4. 读取负载数据
   ↓
5. 解掩码（如需要）
   ↓
6. 处理控制帧（ping/pong/close）
   ↓
7. 重组数据帧
   ↓
8. 返回消息
```

### 6.4 心跳机制

```python
# 自动 Ping/Pong
class WebSocketClientProtocol:
    async def keepalive():
        while True:
            await asyncio.sleep(ping_interval)
            # 发送 Ping
            ping_future = await self.ping()
            # 等待 Pong
            try:
                await asyncio.wait_for(ping_future, timeout=ping_timeout)
            except asyncio.TimeoutError:
                # 超时，关闭连接
                await self.close(1000, "Ping timeout")
```

---

## 7. 使用示例

```python
import websockets
import asyncio

async def example():
    try:
        async with websockets.connect(
            "wss://awiki.ai/ws/notifications",
            extra_headers={"Authorization": "DIDWba ..."},
            ping_interval=20,
            ping_timeout=20
        ) as websocket:
            while True:
                try:
                    message = await websocket.recv()
                    print(f"收到：{message}")
                except websockets.ConnectionClosed as e:
                    print(f"连接关闭：{e.code} {e.reason}")
                    break
    except websockets.InvalidURI as e:
        print(f"URI 无效：{e}")
```

---

## 8. 注意事项

1. **异步编程**: websockets 是异步库，需要使用 asyncio
2. **连接管理**: 使用 `async with` 确保连接正确关闭
3. **异常处理**: 捕获 `ConnectionClosed` 处理断线
4. **心跳配置**: 合理设置 ping_interval 防止连接超时
