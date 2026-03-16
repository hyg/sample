# utils/__init__.py 模块文档

## 1. 概述

**文件路径**: `python/scripts/utils/__init__.py`

**主要功能**: 
- 包入口点
- 集中导出所有公共接口
- 简化导入语句

**依赖关系**:
- 所有 utils 子模块

---

## 2. 导入模块

本模块从以下子模块导入并重新导出：

| 子模块 | 导入内容 |
|--------|----------|
| `utils.config` | `SDKConfig` |
| `utils.identity` | `DIDIdentity`, `create_identity`, `load_private_key` |
| `utils.auth` | `generate_wba_auth_header`, `register_did`, `update_did_document`, `get_jwt_via_wba`, `create_authenticated_identity` |
| `utils.client` | `create_user_service_client`, `create_molt_message_client` |
| `utils.e2ee` | `E2eeClient` |
| `utils.rpc` | `JsonRpcError`, `rpc_call`, `authenticated_rpc_call` |
| `utils.handle` | `send_otp`, `register_handle`, `recover_handle`, `resolve_handle`, `lookup_handle`, `normalize_phone` |
| `utils.logging_config` | `cleanup_log_files`, `configure_logging`, `find_latest_log_file`, `get_log_dir`, `get_log_file_path` |
| `utils.ws` | `WsClient` |
| `utils.resolve` | `resolve_to_did` |

---

## 3. 导出接口

### 3.1 配置

```python
from utils import SDKConfig

config = SDKConfig()
config = SDKConfig.load()  # 从配置文件加载
```

### 3.2 身份管理

```python
from utils import DIDIdentity, create_identity, load_private_key

identity = create_identity(hostname="awiki.ai", path_prefix=["user"])
private_key = load_private_key(identity.private_key_pem)
```

### 3.3 认证

```python
from utils import (
    generate_wba_auth_header,
    register_did,
    update_did_document,
    get_jwt_via_wba,
    create_authenticated_identity,
)

identity = await create_authenticated_identity(client, config)
```

### 3.4 HTTP 客户端

```python
from utils import create_user_service_client, create_molt_message_client

user_client = create_user_service_client(config)
message_client = create_molt_message_client(config)
```

### 3.5 E2EE 加密

```python
from utils import E2eeClient

e2ee = E2eeClient(local_did, signing_pem=..., x25519_pem=...)
```

### 3.6 RPC 调用

```python
from utils import JsonRpcError, rpc_call, authenticated_rpc_call

result = await rpc_call(client, "/rpc", "method", params)
```

### 3.7 Handle 管理

```python
from utils import (
    send_otp,
    register_handle,
    recover_handle,
    resolve_handle,
    lookup_handle,
    normalize_phone,
)

await send_otp(client, "13800138000")
identity = await register_handle(client, config, phone, otp, handle)
```

### 3.8 日志配置

```python
from utils import (
    cleanup_log_files,
    configure_logging,
    find_latest_log_file,
    get_log_dir,
    get_log_file_path,
)

log_file = configure_logging()
```

### 3.9 WebSocket

```python
from utils import WsClient

async with WsClient(config, identity) as ws:
    await ws.send_message("Hello!", receiver_did=did)
```

### 3.10 标识符解析

```python
from utils import resolve_to_did

did = await resolve_to_did("alice")
```

---

## 4. __all__ 列表

```python
__all__ = [
    # config
    "SDKConfig",
    # identity
    "DIDIdentity",
    "create_identity",
    "load_private_key",
    # auth
    "generate_wba_auth_header",
    "register_did",
    "update_did_document",
    "get_jwt_via_wba",
    "create_authenticated_identity",
    # client
    "create_user_service_client",
    "create_molt_message_client",
    # e2ee
    "E2eeClient",
    # rpc
    "JsonRpcError",
    "rpc_call",
    "authenticated_rpc_call",
    # handle
    "send_otp",
    "register_handle",
    "recover_handle",
    "resolve_handle",
    "lookup_handle",
    "normalize_phone",
    # logging
    "cleanup_log_files",
    "configure_logging",
    "find_latest_log_file",
    "get_log_dir",
    "get_log_file_path",
    # ws
    "WsClient",
    # resolve
    "resolve_to_did",
]
```

---

## 5. 使用示例

### 5.1 完整的使用流程

```python
import asyncio
from utils import (
    SDKConfig,
    create_user_service_client,
    create_authenticated_identity,
    WsClient,
    configure_logging,
    E2eeClient,
)

async def main():
    # 配置日志
    configure_logging()
    
    # 加载配置
    config = SDKConfig()
    
    # 创建 HTTP 客户端
    client = create_user_service_client(config)
    
    try:
        # 创建身份
        identity = await create_authenticated_identity(client, config)
        print(f"DID: {identity.did}")
        
        # 创建 WebSocket 客户端
        async with WsClient(config, identity) as ws:
            # 发送消息
            result = await ws.send_message(
                "Hello!",
                receiver_did="did:wba:..."
            )
            print(f"Message sent: {result['message_id']}")
    finally:
        await client.aclose()

asyncio.run(main())
```

### 5.2 简化导入

```python
# 使用 utils 包导入
from utils import SDKConfig, create_identity, register_did

# 而不是从子模块导入
# from utils.config import SDKConfig
# from utils.identity import create_identity
# from utils.auth import register_did
```

---

## 6. 模块依赖关系图

```
utils/__init__.py
├── config.py
│   └── (无内部依赖)
├── identity.py
│   └── anp.authentication
├── auth.py
│   ├── config
│   ├── identity
│   ├── rpc
│   └── anp.authentication
├── client.py
│   └── config
├── rpc.py
│   └── (无内部依赖)
├── handle.py
│   ├── config
│   ├── identity
│   ├── rpc
│   └── auth
├── e2ee.py
│   ├── identity
│   ├── resolve
│   └── anp.*
├── ws.py
│   ├── client
│   ├── config
│   └── identity
├── resolve.py
│   ├── client
│   └── config
└── logging_config.py
    └── config
```

---

## 7. 设计原则

1. **集中导出**: 所有公共接口从包入口统一导出
2. **简化导入**: 用户只需从 `utils` 导入，不需要知道子模块结构
3. **向后兼容**: 内部重构不影响外部导入
4. **明确接口**: `__all__` 明确定义公共 API

---

## 8. 最佳实践

### 8.1 推荐导入方式

```python
# 推荐：从 utils 包导入
from utils import SDKConfig, create_identity

# 也可以：从子模块导入（更明确）
from utils.config import SDKConfig
from utils.identity import create_identity
```

### 8.2 避免的导入方式

```python
# 避免：直接导入内部函数
from utils.auth import _secp256k1_sign_callback  # 私有函数

# 避免：导入整个模块
import utils  # 然后使用 utils.SDKConfig()
```
