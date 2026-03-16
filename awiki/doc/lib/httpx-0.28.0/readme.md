# httpx 库实现细节文档

## 1. 概述

**包名**: `httpx`  
**版本**: `0.28.0`  
**用途**: 现代 HTTP 客户端库，支持同步和异步请求

---

## 2. 安装信息

```bash
pip install httpx>=0.28.0
```

**查看安装位置**:
```bash
pip show httpx
```

---

## 3. 被调用的接口

### 3.1 AsyncClient

**调用位置**: `python/scripts/utils/client.py`, `python/scripts/utils/rpc.py`

**功能**: 异步 HTTP 客户端

**实现细节**:
```python
import httpx

async def create_client(base_url: str, timeout: float = 30.0) -> httpx.AsyncClient:
    """创建 HTTP 客户端"""
    client = httpx.AsyncClient(
        base_url=base_url,
        timeout=httpx.Timeout(timeout),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    )
    return client
```

**关键参数**:
| 参数 | 描述 | 默认值 |
|------|------|--------|
| `base_url` | 基础 URL | - |
| `timeout` | 超时时间 | 30.0 |
| `headers` | 默认请求头 | - |
| `follow_redirects` | 跟随重定向 | False |
| `verify` | SSL 验证 | True |

### 3.2 AsyncClient.post

**调用位置**: `python/scripts/utils/rpc.py`, `python/scripts/utils/auth.py`

**功能**: 发送 POST 请求

**实现细节**:
```python
async def post(self, url: str, json: dict = None, headers: dict = None) -> Response:
    """发送 POST 请求"""
    # 1. 序列化 JSON 数据
    # 2. 合并请求头
    # 3. 发送 HTTP POST
    # 4. 返回响应对象
```

**使用示例**:
```python
async with httpx.AsyncClient() as client:
    response = await client.post(
        "https://awiki.ai/user-service/did-auth/rpc",
        json={"jsonrpc": "2.0", "method": "register", ...},
        headers={"Authorization": "DIDWba ..."}
    )
```

### 3.3 Response

**调用位置**: `python/scripts/utils/rpc.py`

**功能**: HTTP 响应对象

**关键属性**:
| 属性 | 描述 | 类型 |
|------|------|------|
| `status_code` | 状态码 | int |
| `headers` | 响应头 | Headers |
| `text` | 原始文本 | str |
| `content` | 原始字节 | bytes |
| `json()` | JSON 解析 | method |

**实现细节**:
```python
class Response:
    @property
    def status_code(self) -> int:
        """HTTP 状态码"""
    
    @property
    def headers(self) -> Headers:
        """响应头"""
    
    def json(self) -> dict:
        """解析 JSON 响应"""
        return json.loads(self.text)
```

### 3.4 Timeout

**调用位置**: `python/scripts/utils/client.py`

**功能**: 超时配置

**实现细节**:
```python
httpx.Timeout(
    timeout=30.0,      # 总超时
    connect_timeout=10.0,  # 连接超时
    read_timeout=30.0,     # 读取超时
    write_timeout=10.0     # 写入超时
)
```

---

## 4. 调用位置汇总

| 模块 | 接口 | 调用文件 | 调用函数 |
|------|------|----------|----------|
| `httpx` | `AsyncClient` | `utils/client.py` | `create_client()` |
| `httpx` | `AsyncClient.post` | `utils/rpc.py` | `rpc_call()` |
| `httpx` | `Response` | `utils/rpc.py` | `rpc_call()` |
| `httpx` | `Timeout` | `utils/client.py` | `create_client()` |
| `httpx` | `HTTPStatusError` | `utils/rpc.py` | `rpc_call()` |
| `httpx` | `RequestError` | `utils/rpc.py` | `rpc_call()` |

---

## 5. 源码位置

**典型位置**:
- **Windows**: `C:\Users\<user>\AppData\Roaming\Python\Python314\site-packages\httpx\`
- **Linux/Mac**: `~/.local/lib/python3.14/site-packages/httpx/`

**主要文件**:
```
httpx/
├── __init__.py
├── _client.py        # AsyncClient, Client
├── _models.py        # Request, Response
├── _config.py        # Timeout, Config
├── _exceptions.py    # 异常类
└── ...
```

---

## 6. 核心实现细节

### 6.1 连接池管理

```python
# httpx 内部维护连接池
class ConnectionPool:
    def __init__(self, max_connections=100, max_keepalive=20):
        self.max_connections = max_connections
        self.max_keepalive = max_keepalive
    
    async def acquire(self) -> Connection:
        """获取连接"""
        # 1. 检查空闲连接
        # 2. 如无则创建新连接
        # 3. 返回连接
    
    async def release(self, connection: Connection):
        """释放连接"""
        # 1. 回收到空闲池
        # 2. 如池满则关闭
```

### 6.2 异步请求流程

```
1. 创建 AsyncClient
   ↓
2. 调用 post() 方法
   ↓
3. 创建 Request 对象
   ↓
4. 获取连接
   ↓
5. 发送请求
   ↓
6. 等待响应
   ↓
7. 解析响应
   ↓
8. 释放连接
```

### 6.3 错误处理

```python
# httpx 异常层次结构
HTTPError
├── RequestError (网络错误)
│   ├── ConnectError
│   ├── ReadError
│   ├── WriteError
│   └── CloseError
└── HTTPStatusError (HTTP 错误状态)
    ├── 4xx Client Errors
    └── 5xx Server Errors
```

---

## 7. 使用示例

```python
import httpx

async def example():
    async with httpx.AsyncClient(
        base_url="https://awiki.ai",
        timeout=30.0
    ) as client:
        try:
            response = await client.post(
                "/user-service/did-auth/rpc",
                json={"jsonrpc": "2.0", "method": "register"},
                headers={"Authorization": "DIDWba ..."}
            )
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as e:
            print(f"HTTP 错误：{e.response.status_code}")
        except httpx.RequestError as e:
            print(f"网络错误：{e}")
```
