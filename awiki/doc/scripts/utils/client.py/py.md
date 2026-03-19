# scripts/utils/client.py 分析

## 文件信息

- **路径**: `python/scripts/utils/client.py`
- **用途**: httpx AsyncClient 工厂函数

## 函数签名

### _resolve_verify()

```python
def _resolve_verify(base_url: str) -> bool | ssl.SSLContext:
    """解析 TLS 验证设置
    
    优先级:
    1. AWIKI_CA_BUNDLE / E2E_CA_BUNDLE 环境变量
    2. macOS mkcert 根 CA 自动检测 (.test 域名)
    3. 默认系统/Certifi 验证
    
    返回:
        SSLContext 或 True/False
    """
```

### create_user_service_client()

```python
def create_user_service_client(config: SDKConfig) -> httpx.AsyncClient:
    """创建 user-service 异步 HTTP 客户端
    
    返回:
        httpx.AsyncClient(base_url=config.user_service_url, timeout=30.0)
    """
```

### create_molt_message_client()

```python
def create_molt_message_client(config: SDKConfig) -> httpx.AsyncClient:
    """创建 molt-message 异步 HTTP 客户端
    
    返回:
        httpx.AsyncClient(base_url=config.molt_message_url, timeout=30.0)
    """
```

## 导入的模块

```python
from __future__ import annotations
import os
import ssl
from pathlib import Path
from urllib.parse import urlparse
import httpx
from utils.config import SDKConfig
```

## TLS 验证配置逻辑

```python
def _resolve_verify(base_url: str) -> bool | ssl.SSLContext:
    # 1. 检查环境变量
    for env_name in ("AWIKI_CA_BUNDLE", "E2E_CA_BUNDLE", "SSL_CERT_FILE"):
        candidate = os.environ.get(env_name, "").strip()
        if candidate and Path(candidate).is_file():
            return ssl.create_default_context(cafile=candidate)
    
    # 2. 检测 mkcert (.test 域名)
    host = (urlparse(base_url).hostname or "").lower()
    if host.endswith(".test") or host == "localhost":
        mkcert_root = Path.home() / "Library" / "Application Support" / "mkcert" / "rootCA.pem"
        if mkcert_root.is_file():
            return ssl.create_default_context(cafile=str(mkcert_root))
    
    # 3. 默认验证
    return True
```

## 客户端配置

| 参数 | 值 | 说明 |
|------|-----|------|
| `timeout` | 30.0 | 请求超时 30 秒 |
| `trust_env` | False | 不使用环境变量代理 |
| `verify` | _resolve_verify() | TLS 验证配置 |

## 被调用关系

| 调用文件 | 调用内容 |
|----------|----------|
| `utils/__init__.py` | 导出工厂函数 |
| `utils/auth.py` | `create_user_service_client` |
| `utils/handle.py` | `create_user_service_client` |
| `utils/ws.py` | `_resolve_verify` |
| `scripts/check_inbox.py` | `create_molt_message_client`, `create_user_service_client` |
| `scripts/check_status.py` | `create_molt_message_client`, `create_user_service_client` |
| `scripts/send_message.py` | `create_molt_message_client` |
| `scripts/get_profile.py` | `create_user_service_client` |
| `scripts/update_profile.py` | `create_user_service_client` |
| `scripts/manage_content.py` | `create_user_service_client` |
| `scripts/manage_credits.py` | `create_user_service_client` |
| `scripts/manage_relationship.py` | `create_user_service_client` |
| `scripts/manage_group.py` | `create_user_service_client` |
| `scripts/search_users.py` | `create_user_service_client` |
| `scripts/e2ee_messaging.py` | `create_molt_message_client` |
| `scripts/ws_listener.py` | `create_user_service_client` |
| `scripts/regenerate_e2ee_keys.py` | `create_user_service_client` |

## 使用示例

```python
from utils import SDKConfig, create_user_service_client, authenticated_rpc_call
from credential_store import create_authenticator

config = SDKConfig()
auth_result = create_authenticator("default", config)
auth, data = auth_result

async with create_user_service_client(config) as client:
    result = await authenticated_rpc_call(
        client,
        "/user-service/did-auth/rpc",
        "get_me",
        auth=auth,
        credential_name="default",
    )
```
