# scripts/utils/auth.py 分析

## 文件信息

- **路径**: `python/scripts/utils/auth.py`
- **用途**: DID 注册、文档更新、WBA 认证、JWT 获取

## 函数签名

### generate_wba_auth_header()

```python
def generate_wba_auth_header(
    identity: DIDIdentity,
    service_domain: str,
) -> str:
    """生成 DID WBA 授权头
    
    参数:
        identity: DID 身份
        service_domain: 目标服务域名
    
    返回:
        Authorization 头值 (DIDWba 格式)
    """
```

### register_did()

```python
async def register_did(
    client: httpx.AsyncClient,
    identity: DIDIdentity,
    name: str | None = None,
    is_public: bool = False,
    is_agent: bool = False,
    role: str | None = None,
    endpoint_url: str | None = None,
    description: str | None = None,
) -> dict[str, Any]:
    """注册 DID 身份
    
    参数:
        client: HTTP 客户端
        identity: DID 身份 (did_document 已包含 proof)
        name: 显示名称
        is_public: 是否公开可见
        is_agent: 是否为 AI Agent
        role: 角色
        endpoint_url: 连接端点
        description: 描述
    
    返回:
        注册响应 dict (包含 did, user_id, message)
    """
```

### update_did_document()

```python
async def update_did_document(
    client: httpx.AsyncClient,
    identity: DIDIdentity,
    domain: str,
    *,
    is_public: bool = False,
    is_agent: bool = False,
    role: str | None = None,
    endpoint_url: str | None = None,
) -> dict[str, Any]:
    """通过 DID WBA 认证更新 DID 文档
    
    返回:
        更新响应 dict (包含 access_token)
    """
```

### get_jwt_via_wba()

```python
async def get_jwt_via_wba(
    client: httpx.AsyncClient,
    identity: DIDIdentity,
    domain: str,
) -> str:
    """通过 DID WBA 签名获取 JWT token
    
    返回:
        JWT access token 字符串
    """
```

### create_authenticated_identity()

```python
async def create_authenticated_identity(
    client: httpx.AsyncClient,
    config: SDKConfig,
    name: str | None = None,
    is_public: bool = False,
    is_agent: bool = False,
    role: str | None = None,
    endpoint_url: str | None = None,
    services: list[dict[str, Any]] | None = None,
) -> DIDIdentity:
    """一站式创建完整的 DID 身份
    
    流程:
    1. 创建密钥绑定 DID (带 proof)
    2. 注册 DID
    3. 获取 JWT
    
    返回:
        DIDIdentity (包含 user_id 和 jwt_token)
    """
```

## 导入的模块

```python
from typing import Any
import httpx
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes
from anp.authentication import generate_auth_header
from utils.config import SDKConfig
from utils.identity import DIDIdentity, create_identity
from utils.rpc import JsonRpcError, rpc_call
```

## 内部辅助函数

### _secp256k1_sign_callback()

```python
def _secp256k1_sign_callback(
    private_key: ec.EllipticCurvePrivateKey,
) -> callable:
    """创建 secp256k1 签名回调 (适配 ANP 接口)"""
```

## RPC 端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/user-service/did-auth/rpc` | `register` | 注册 DID |
| `/user-service/did-auth/rpc` | `update_document` | 更新 DID 文档 |
| `/user-service/did-auth/rpc` | `verify` | 验证 WBA 获取 JWT |

## 被调用关系

| 调用文件 | 调用内容 |
|----------|----------|
| `utils/__init__.py` | 导出所有公共函数 |
| `utils/handle.py` | `get_jwt_via_wba` |
| `scripts/setup_identity.py` | `create_authenticated_identity`, `get_jwt_via_wba` |
| `scripts/register_handle.py` | `get_jwt_via_wba` |
| `scripts/recover_handle.py` | `get_jwt_via_wba` |
| `scripts/regenerate_e2ee_keys.py` | `update_did_document`, `get_jwt_via_wba` |
| `tests/test_auth_update.py` | `update_did_document` |

## 认证流程

```
1. create_identity() → 生成密钥和 DID 文档 (含 proof)
2. register_did() → 注册到服务器，获取 user_id
3. get_jwt_via_wba() → 用 WBA 签名换取 JWT token
```

## JWT 刷新机制

```python
# 在 authenticated_rpc_call 中自动处理 401
if resp.status_code == 401:
    auth.clear_token(server_url)
    auth_headers = auth.get_auth_header(server_url, force_new=True)
    resp = await client.post(endpoint, json=payload, headers=auth_headers)
```
