# scripts/utils/rpc.py 分析

## 文件信息

- **路径**: `python/scripts/utils/rpc.py`
- **用途**: JSON-RPC 2.0 客户端辅助函数

## 异常类

### JsonRpcError

```python
class JsonRpcError(Exception):
    """JSON-RPC 错误响应异常"""
    
    def __init__(self, code: int, message: str, data: Any = None):
        self.code = code       # 错误码
        self.message = message # 错误消息
        self.data = data       # 附加数据
```

## 函数签名

### rpc_call()

```python
async def rpc_call(
    client: httpx.AsyncClient,
    endpoint: str,
    method: str,
    params: dict | None = None,
    request_id: int | str = 1,
) -> Any:
    """发送 JSON-RPC 2.0 请求并返回结果
    
    参数:
        client: httpx 异步客户端
        endpoint: RPC 端点路径 (如 "/did-auth/rpc")
        method: RPC 方法名 (如 "register")
        params: 方法参数
        request_id: 请求 ID
    
    返回:
        JSON-RPC result 字段值
    
    异常:
        JsonRpcError: 服务器返回 JSON-RPC 错误
        httpx.HTTPStatusError: HTTP 层错误
    """
```

### authenticated_rpc_call()

```python
async def authenticated_rpc_call(
    client: httpx.AsyncClient,
    endpoint: str,
    method: str,
    params: dict | None = None,
    request_id: int | str = 1,
    *,
    auth: Any = None,              # DIDWbaAuthHeader 实例
    credential_name: str = "default",
) -> Any:
    """带自动 401 重试的 JSON-RPC 2.0 请求
    
    使用 DIDWbaAuthHeader 管理认证头和 token 缓存。
    遇到 401 时自动清除过期 token 并重新生成 DIDWBA 认证头重试。
    
    参数:
        client: httpx 异步客户端
        endpoint: RPC 端点路径
        method: RPC 方法名
        params: 方法参数
        request_id: 请求 ID
        auth: DIDWbaAuthHeader 实例
        credential_name: 凭证名称 (用于持久化新 JWT)
    
    返回:
        JSON-RPC result 字段值
    """
```

## 导入的模块

```python
from __future__ import annotations
from typing import Any
import httpx
```

## JSON-RPC 请求格式

```python
payload = {
    "jsonrpc": "2.0",
    "method": method,
    "params": params or {},
    "id": request_id,
}
```

## 响应格式

```python
# 成功响应
{
    "jsonrpc": "2.0",
    "result": <结果数据>,
    "id": 1
}

# 错误响应
{
    "jsonrpc": "2.0",
    "error": {
        "code": -32000,
        "message": "错误消息",
        "data": <附加数据>
    },
    "id": 1
}
```

## 401 自动重试流程

```python
# 1. 获取认证头
auth_headers = auth.get_auth_header(server_url)
resp = await client.post(endpoint, json=payload, headers=auth_headers)

# 2. 401 → 清除过期 token → 重新认证 → 重试
if resp.status_code == 401:
    auth.clear_token(server_url)
    auth_headers = auth.get_auth_header(server_url, force_new=True)
    resp = await client.post(endpoint, json=payload, headers=auth_headers)

# 3. 成功：缓存新 token
auth_header_value = resp.headers.get("authorization", "")
new_token = auth.update_token(server_url, {"Authorization": auth_header_value})
if new_token:
    from credential_store import update_jwt
    update_jwt(credential_name, new_token)
```

## 被调用关系

| 调用文件 | 调用内容 |
|----------|----------|
| `utils/__init__.py` | 导出 `JsonRpcError`, `rpc_call`, `authenticated_rpc_call` |
| `utils/auth.py` | `rpc_call` |
| `utils/handle.py` | `rpc_call` |
| `scripts/check_inbox.py` | `authenticated_rpc_call` |
| `scripts/check_status.py` | `authenticated_rpc_call`, `rpc_call` |
| `scripts/send_message.py` | `authenticated_rpc_call` |
| `scripts/manage_group.py` | `authenticated_rpc_call` |
| `scripts/manage_content.py` | `authenticated_rpc_call` |
| `scripts/get_profile.py` | `authenticated_rpc_call`, `rpc_call` |
| `scripts/update_profile.py` | `authenticated_rpc_call` |
| `scripts/manage_credits.py` | `authenticated_rpc_call`, `rpc_call` |
| `scripts/manage_relationship.py` | `authenticated_rpc_call` |
| `scripts/search_users.py` | `authenticated_rpc_call` |
| `scripts/e2ee_messaging.py` | `authenticated_rpc_call` |
| `scripts/ws_listener.py` | `authenticated_rpc_call` |

## 常用 RPC 端点

| 端点 | 服务 |
|------|------|
| `/user-service/did-auth/rpc` | 身份认证 |
| `/user-service/did/profile/rpc` | Profile 管理 |
| `/user-service/handle/rpc` | Handle 管理 |
| `/message/rpc` | 消息服务 |
| `/group/rpc` | 群组服务 |
| `/content/rpc` | 内容页面 |
| `/search/rpc` | 用户搜索 |
| `/user-service/credits/rpc` | 积分管理 |
