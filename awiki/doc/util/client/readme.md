# client.py 模块文档

## 1. 概述

**文件路径**: `python/scripts/utils/client.py`

**主要功能**: 
- 创建预配置的 httpx AsyncClient
- 管理 TLS/SSL 验证设置
- 支持本地开发环境的证书配置

**依赖关系**:
- `httpx`: HTTP 客户端库
- `ssl`: SSL/TLS 配置
- 本地模块：`config`

---

## 2. 导入模块

| 模块 | 用途 |
|------|------|
| `httpx` | 异步 HTTP 客户端 |
| `ssl` | SSL/TLS 配置 |
| `os` | 环境变量读取 |
| `pathlib.Path` | 路径操作 |
| `urllib.parse.urlparse` | URL 解析 |
| `utils.config.SDKConfig` | SDK 配置 |

---

## 3. 函数详解

### 3.1 `_resolve_verify`

**签名**:
```python
def _resolve_verify(base_url: str) -> bool | ssl.SSLContext:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `base_url` | `str` | - | 服务基础 URL |

**返回值**: `bool | ssl.SSLContext` - SSL 验证配置

**功能**: 
解析 TLS 验证设置，优先级：
1. 环境变量 `AWIKI_CA_BUNDLE` / `E2E_CA_BUNDLE` / `SSL_CERT_FILE`
2. macOS 本地 `*.test` 域名的 mkcert 根证书
3. 默认系统/Certifi 验证

**调用位置**: 
- `create_user_service_client()`
- `create_molt_message_client()`
- `resolve.py`

**实现细节**:
```python
def _resolve_verify(base_url: str) -> bool | ssl.SSLContext:
    # 1. 检查环境变量指定的 CA bundle
    for env_name in ("AWIKI_CA_BUNDLE", "E2E_CA_BUNDLE", "SSL_CERT_FILE"):
        candidate = os.environ.get(env_name, "").strip()
        if candidate and Path(candidate).is_file():
            return ssl.create_default_context(cafile=candidate)

    # 2. 检查是否为本地 *.test 域名
    host = (urlparse(base_url).hostname or "").lower()
    if host.endswith(".test") or host == "localhost":
        mkcert_root = Path.home() / "Library" / "Application Support" / "mkcert" / "rootCA.pem"
        if mkcert_root.is_file():
            return ssl.create_default_context(cafile=str(mkcert_root))

    # 3. 使用默认验证
    return True
```

---

### 3.2 `create_user_service_client`

**签名**:
```python
def create_user_service_client(config: SDKConfig) -> httpx.AsyncClient:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `config` | `SDKConfig` | - | SDK 配置对象 |

**返回值**: `httpx.AsyncClient` - 配置好的 user-service 客户端

**功能**: 
创建用于访问 user-service 的异步 HTTP 客户端。

**配置详情**:
- `base_url`: 来自 `config.user_service_url`
- `timeout`: 30.0 秒
- `trust_env`: False（不使用环境变量代理）
- `verify`: 通过 `_resolve_verify()` 解析

**调用位置**: 
- `setup_identity.py`
- `register_handle.py`
- 其他需要访问 user-service 的脚本

**使用示例**:
```python
from utils.config import SDKConfig
from utils.client import create_user_service_client

config = SDKConfig()
client = create_user_service_client(config)
async with client:
    # 使用客户端发送请求
    pass
```

---

### 3.3 `create_molt_message_client`

**签名**:
```python
def create_molt_message_client(config: SDKConfig) -> httpx.AsyncClient:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `config` | `SDKConfig` | - | SDK 配置对象 |

**返回值**: `httpx.AsyncClient` - 配置好的 molt-message 客户端

**功能**: 
创建用于访问 molt-message 服务的异步 HTTP 客户端。

**配置详情**:
- `base_url`: 来自 `config.molt_message_url`
- `timeout`: 30.0 秒
- `trust_env`: False
- `verify`: 通过 `_resolve_verify()` 解析

**调用位置**: 
- `send_message.py`
- `check_inbox.py`
- 其他需要访问消息服务的脚本

---

## 4. 调用关系

### 被谁调用
- 所有需要 HTTP 客户端的脚本模块
- `resolve.py`: 解析 Handle 时使用

### 调用谁
- `utils.config`: 获取服务 URL 配置
- `ssl`: 创建 SSL 上下文
- `httpx`: 创建客户端实例

---

## 5. TLS 验证优先级

```
1. 环境变量 AWIKI_CA_BUNDLE
   ↓ (未设置)
2. 环境变量 E2E_CA_BUNDLE
   ↓ (未设置)
3. 环境变量 SSL_CERT_FILE
   ↓ (未设置)
4. macOS *.test 域名的 mkcert 证书
   ↓ (非本地域名)
5. 默认系统证书验证
```

---

## 6. 使用示例

### 6.1 基本使用

```python
from utils.config import SDKConfig
from utils.client import create_user_service_client, create_molt_message_client

config = SDKConfig()

# 创建 user-service 客户端
user_client = create_user_service_client(config)

# 创建 message 客户端
message_client = create_molt_message_client(config)
```

### 6.2 自定义 CA 证书

```bash
# 设置环境变量指定 CA bundle
export AWIKI_CA_BUNDLE=/path/to/ca-bundle.crt
```

### 6.3 本地开发环境

```bash
# 使用 mkcert 签发的本地证书
# 证书位置：~/Library/Application Support/mkcert/rootCA.pem
```

---

## 7. 注意事项

1. **trust_env=False**: 禁用环境变量代理，避免意外使用系统代理
2. **超时设置**: 固定 30 秒超时，适合 RPC 调用
3. **本地开发**: 自动检测 mkcert 证书，方便本地 HTTPS 开发
4. **证书安全**: 生产环境应使用有效的 CA 证书
