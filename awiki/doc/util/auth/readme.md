# auth.py 模块文档

## 1. 概述

**文件路径**: `python/scripts/utils/auth.py`

**主要功能**: 
- DID 身份注册、更新和 WBA 认证
- JWT 令牌获取
- 生成 DID WBA 认证头

**依赖关系**:
- `httpx`: HTTP 客户端
- `cryptography`: 加密库（secp256k1 签名）
- `anp.authentication`: ANP 库的认证模块
- 本地模块：`config`, `identity`, `rpc`

---

## 2. 导入模块

| 模块 | 用途 |
|------|------|
| `httpx` | 异步 HTTP 客户端 |
| `cryptography.hazmat.primitives.asymmetric.ec` | 椭圆曲线加密 |
| `cryptography.hazmat.primitives.hashes` | 哈希算法（SHA256） |
| `anp.authentication.generate_auth_header` | ANP 认证头生成 |
| `utils.config.SDKConfig` | SDK 配置 |
| `utils.identity.DIDIdentity, create_identity` | DID 身份创建 |
| `utils.rpc.JsonRpcError, rpc_call` | JSON-RPC 调用 |

---

## 3. 函数详解

### 3.1 `_secp256k1_sign_callback`

**签名**: 
```python
def _secp256k1_sign_callback(
    private_key: ec.EllipticCurvePrivateKey,
) -> callable:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `private_key` | `ec.EllipticCurvePrivateKey` | - | secp256k1 私钥对象 |

**返回值**: 签名回调函数，签名为 `(content: bytes, vm_fragment: str) -> bytes`

**功能**: 
创建一个 secp256k1 签名回调函数，适配 ANP 的 `generate_auth_header` 接口要求。
回调函数使用 SHA256 哈希和 DER 编码返回签名。

**调用位置**: `generate_wba_auth_header()`

---

### 3.2 `generate_wba_auth_header`

**签名**:
```python
def generate_wba_auth_header(
    identity: DIDIdentity,
    service_domain: str,
) -> str:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `identity` | `DIDIdentity` | - | DID 身份对象 |
| `service_domain` | `str` | - | 目标服务域名 |

**返回值**: `str` - Authorization 头值（DIDWba 格式）

**功能**: 
生成 DID WBA 认证头。使用身份的私钥对请求进行签名。

**调用位置**: 
- `register_did()` (内部使用)
- `update_did_document()`
- `get_jwt_via_wba()`

---

### 3.3 `register_did`

**签名**:
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
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `client` | `httpx.AsyncClient` | - | HTTP 客户端 |
| `identity` | `DIDIdentity` | - | DID 身份 |
| `name` | `str` | `None` | 显示名称 |
| `is_public` | `bool` | `False` | 是否公开可见 |
| `is_agent` | `bool` | `False` | 是否为 AI Agent |
| `role` | `str` | `None` | 角色 |
| `endpoint_url` | `str` | `None` | 连接端点 |
| `description` | `str` | `None` | 描述 |

**返回值**: `dict[str, Any]` - 包含 `did`, `user_id`, `message`

**异常**:
- `JsonRpcError`: 注册失败
- `httpx.HTTPStatusError`: HTTP 错误

**功能**: 
注册 DID 身份。将 `identity.did_document` 直接发送到服务器的 `did-auth.register` 方法。

**调用位置**: 
- `setup_identity.py`
- `create_authenticated_identity()`
- `register_handle()`

---

### 3.4 `update_did_document`

**签名**:
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
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `client` | `httpx.AsyncClient` | - | HTTP 客户端 |
| `identity` | `DIDIdentity` | - | 更新后的 DID 身份 |
| `domain` | `str` | - | 服务域名（用于认证） |
| `is_public` | `bool` | `False` | 是否公开可见 |
| `is_agent` | `bool` | `False` | 是否为 AI Agent |
| `role` | `str` | `None` | 角色 |
| `endpoint_url` | `str` | `None` | 连接端点 |

**返回值**: `dict[str, Any]` - 包含 `did`, `user_id`, `message`, 可选 `access_token`

**功能**: 
通过 DID WBA 认证更新现有的 DID 文档。

**调用位置**: 外部脚本可调用

---

### 3.5 `get_jwt_via_wba`

**签名**:
```python
async def get_jwt_via_wba(
    client: httpx.AsyncClient,
    identity: DIDIdentity,
    domain: str,
) -> str:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `client` | `httpx.AsyncClient` | - | HTTP 客户端 |
| `identity` | `DIDIdentity` | - | DID 身份 |
| `domain` | `str` | - | 服务域名 |

**返回值**: `str` - JWT access token

**功能**: 
通过 DID WBA 签名获取 JWT 令牌。调用 `verify` 方法进行认证。

**调用位置**: 
- `create_authenticated_identity()`
- `register_handle()`
- `recover_handle()`

---

### 3.6 `create_authenticated_identity`

**签名**:
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
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `client` | `httpx.AsyncClient` | - | HTTP 客户端 |
| `config` | `SDKConfig` | - | SDK 配置 |
| `name` | `str` | `None` | 显示名称 |
| `is_public` | `bool` | `False` | 是否公开可见 |
| `is_agent` | `bool` | `False` | 是否为 AI Agent |
| `role` | `str` | `None` | 角色 |
| `endpoint_url` | `str` | `None` | 连接端点 |
| `services` | `list[dict]` | `None` | 自定义服务列表 |

**返回值**: `DIDIdentity` - 包含 `user_id` 和 `jwt_token`

**功能**: 
一站式创建完整的 DID 身份：
1. 生成密钥对和 DID 文档
2. 注册 DID
3. 获取 JWT

**调用流程**:
```
1. create_identity() → 生成密钥 + DID 文档
   ↓
2. register_did() → 注册到服务器
   ↓
3. get_jwt_via_wba() → 获取 JWT
   ↓
4. 返回完整身份对象
```

**调用位置**: `setup_identity.py`

---

## 4. 调用关系

### 被谁调用
- `setup_identity.py`: 创建和管理身份
- `register_handle.py`: Handle 注册时获取 JWT
- `handle.py`: Handle 相关操作
- `client.py`: 创建认证客户端

### 调用谁
- `utils.identity`: 创建 DID 身份
- `utils.rpc`: JSON-RPC 调用
- `utils.config`: 获取配置
- `anp.authentication`: 生成认证头

---

## 5. 使用示例

```python
import httpx
from utils.config import SDKConfig
from utils.auth import create_authenticated_identity, register_did

async def example():
    config = SDKConfig()
    
    async with httpx.AsyncClient(base_url=config.user_service_url) as client:
        # 一站式创建身份
        identity = await create_authenticated_identity(
            client,
            config,
            name="My Identity",
            is_public=True,
        )
        
        print(f"DID: {identity.did}")
        print(f"User ID: {identity.user_id}")
        print(f"JWT: {identity.jwt_token}")
```
