# httpx-0.28.0

**用途**: 异步 HTTP 客户端，用于与 awiki 服务进行 JSON-RPC 通信

## 依赖信息

- **库名**: httpx
- **版本**: >=0.28.0
- **来源**: requirements.txt, pyproject.toml

## 主要功能

### AsyncClient

```python
import httpx

async with httpx.AsyncClient(
    base_url="https://awiki.ai",
    timeout=30.0,
    trust_env=False,
    verify=True
) as client:
    response = await client.post("/rpc", json=payload)
```

**参数**:
- `base_url`: 服务基础 URL
- `timeout`: 请求超时时间 (秒)
- `trust_env`: 是否信任环境变量 (awiki 中设为 False)
- `verify`: TLS 验证设置

## 在 awiki-did 中的使用

| 文件 | 用途 |
|------|------|
| `utils/client.py` | 创建 user-service 和 molt-message 客户端 |
| `utils/rpc.py` | JSON-RPC 请求发送 |
| `utils/auth.py` | DID 注册和认证 |
| `utils/handle.py` | Handle 注册和解析 |
| `scripts/get_profile.py` | 获取 Profile 信息 |
| `scripts/manage_content.py` | 内容页面管理 |
| `scripts/manage_group.py` | 群组管理 (fetch_doc) |

## 客户端工厂

```python
# utils/client.py
def create_user_service_client(config: SDKConfig) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=config.user_service_url,
        timeout=30.0,
        trust_env=False,
        verify=_resolve_verify(config.user_service_url),
    )

def create_molt_message_client(config: SDKConfig) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=config.molt_message_url,
        timeout=30.0,
        trust_env=False,
        verify=_resolve_verify(config.molt_message_url),
    )
```

## TLS 验证配置

`_resolve_verify()` 函数支持:
1. 环境变量 `AWIKI_CA_BUNDLE` / `E2E_CA_BUNDLE`
2. macOS mkcert 根 CA 自动检测 (`.test` 域名)
3. 默认系统/Certifi 验证
