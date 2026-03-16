# rpc.py 模块文档

## 1. 概述

**文件路径**: `python/scripts/utils/rpc.py`

**主要功能**: 
- JSON-RPC 2.0 客户端辅助函数
- 带 401 自动重试的认证调用
- JSON-RPC 错误处理

**依赖关系**:
- `httpx`: HTTP 客户端

---

## 2. 导入模块

| 模块 | 用途 |
|------|------|
| `httpx` | 异步 HTTP 客户端 |
| `typing.Any` | 类型注解 |

---

## 3. 异常类详解

### 3.1 `JsonRpcError`

**定义**:
```python
class JsonRpcError(Exception):
    """JSON-RPC 错误响应异常。"""
    
    def __init__(self, code: int, message: str, data: Any = None):
        self.code = code
        self.message = message
        self.data = data
        super().__init__(f"JSON-RPC error {code}: {message}")
```

**属性**:
| 属性 | 类型 | 描述 |
|------|------|------|
| `code` | `int` | JSON-RPC 错误码 |
| `message` | `str` | 错误消息 |
| `data` | `Any` | 附加错误数据 |

**标准错误码**:
| 错误码 | 含义 |
|--------|------|
| -32700 | 解析错误 |
| -32600 | 无效请求 |
| -32601 | 方法不存在 |
| -32602 | 无效参数 |
| -32603 | 内部错误 |

---

## 4. 函数详解

### 4.1 `rpc_call`

**签名**:
```python
async def rpc_call(
    client: httpx.AsyncClient,
    endpoint: str,
    method: str,
    params: dict | None = None,
    request_id: int | str = 1,
) -> Any:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `client` | `httpx.AsyncClient` | - | HTTP 客户端 |
| `endpoint` | `str` | - | RPC 端点路径 |
| `method` | `str` | - | RPC 方法名 |
| `params` | `dict` | `None` | 方法参数 |
| `request_id` | `int | str` | `1` | 请求 ID |

**返回值**: `Any` - JSON-RPC result 字段内容

**异常**:
- `JsonRpcError`: 服务器返回 JSON-RPC 错误
- `httpx.HTTPStatusError`: HTTP 错误

**功能**: 
发送 JSON-RPC 2.0 请求并返回结果。

**请求格式**:
```json
{
  "jsonrpc": "2.0",
  "method": "register",
  "params": {...},
  "id": 1
}
```

**响应格式**:
```json
{
  "jsonrpc": "2.0",
  "result": {...},
  "id": 1
}
```

**调用位置**: 
- `auth.py`: 注册和认证
- `handle.py`: Handle 操作
- 所有需要 RPC 调用的模块

**使用示例**:
```python
from utils.rpc import rpc_call, JsonRpcError

try:
    result = await rpc_call(
        client,
        "/user-service/did-auth/rpc",
        "register",
        {"did_document": doc}
    )
    print(f"Registered: {result}")
except JsonRpcError as e:
    print(f"RPC Error: {e.code} - {e.message}")
```

---

### 4.2 `authenticated_rpc_call`

**签名**:
```python
async def authenticated_rpc_call(
    client: httpx.AsyncClient,
    endpoint: str,
    method: str,
    params: dict | None = None,
    request_id: int | str = 1,
    *,
    auth: Any = None,
    credential_name: str = "default",
) -> Any:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `client` | `httpx.AsyncClient` | - | HTTP 客户端 |
| `endpoint` | `str` | - | RPC 端点路径 |
| `method` | `str` | - | RPC 方法名 |
| `params` | `dict` | `None` | 方法参数 |
| `request_id` | `int | str` | `1` | 请求 ID |
| `auth` | `Any` | `None` | 认证头管理器 |
| `credential_name` | `str` | `"default"` | 凭证名称 |

**返回值**: `Any` - JSON-RPC result 字段内容

**功能**: 
带自动 401 重试的 JSON-RPC 调用。

**401 处理流程**:
```
1. 发送请求（带认证头）
   ↓
2. 收到 401 响应
   ↓
3. 清除过期令牌
   ↓
4. 重新生成认证头
   ↓
5. 重试请求
   ↓
6. 缓存新令牌
```

**调用位置**: 需要认证的 RPC 调用

---

## 5. JSON-RPC 2.0 协议

### 5.1 请求对象

```json
{
  "jsonrpc": "2.0",
  "method": "method_name",
  "params": {
    "param1": "value1"
  },
  "id": 1
}
```

### 5.2 成功响应

```json
{
  "jsonrpc": "2.0",
  "result": {
    "key": "value"
  },
  "id": 1
}
```

### 5.3 错误响应

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32600,
    "message": "Invalid Request",
    "data": "additional info"
  },
  "id": 1
}
```

### 5.4 通知（无响应）

```json
{
  "jsonrpc": "2.0",
  "method": "event_name",
  "params": {...}
}
```

---

## 6. 调用关系

### 被谁调用
- `auth.py`: DID 注册和认证
- `handle.py`: Handle 注册和解析
- 所有需要 RPC 调用的脚本

### 调用谁
- `httpx`: HTTP 请求
- `credential_store`: 凭证存储（认证调用中）

---

## 7. 使用示例

### 7.1 基本 RPC 调用

```python
from utils.rpc import rpc_call, JsonRpcError

async def example():
    try:
        result = await rpc_call(
            client,
            "/user-service/handle/rpc",
            "lookup",
            {"handle": "alice"}
        )
        print(f"DID: {result['did']}")
    except JsonRpcError as e:
        print(f"Lookup failed: {e.message}")
```

### 7.2 认证 RPC 调用

```python
from utils.rpc import authenticated_rpc_call
from utils.auth import DIDWbaAuthHeader

auth = DIDWbaAuthHeader(identity_path)
result = await authenticated_rpc_call(
    client,
    "/message/rpc",
    "send",
    {"to": did, "content": "Hello"},
    auth=auth
)
```

---

## 8. 错误处理最佳实践

```python
from utils.rpc import rpc_call, JsonRpcError
import httpx

async def safe_rpc_call(client, method, params):
    try:
        return await rpc_call(client, "/rpc", method, params)
    except JsonRpcError as e:
        # 处理业务错误
        if e.code == -32602:
            print(f"Invalid parameters: {e.message}")
        else:
            print(f"RPC error: {e.message}")
    except httpx.HTTPStatusError as e:
        # 处理 HTTP 错误
        if e.response.status_code == 401:
            print("Authentication failed")
        elif e.response.status_code == 500:
            print("Server error")
    except httpx.RequestError as e:
        # 处理网络错误
        print(f"Network error: {e}")
```
