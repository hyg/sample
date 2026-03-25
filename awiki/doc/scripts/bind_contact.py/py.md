# scripts/bind_contact.py 分析

## 文件信息

- **路径**: `python/scripts/bind_contact.py`
- **用途**: 绑定额外联系方式（邮箱或手机）到现有账户

## 常量

```python
PENDING_VERIFICATION_EXIT_CODE = 3
```

## 函数签名

### 内部函数

```python
async def _bind_email(
    client: httpx.AsyncClient,
    email: str,
    jwt_token: str,
    *,
    wait_for_verification: bool = False,
    verification_timeout: int = 300,
    poll_interval: float = 5.0,
) -> bool:
    """Bind email and optionally wait for verification."""

async def _bind_phone(
    client: httpx.AsyncClient,
    phone: str,
    jwt_token: str,
    options: dict[str, Any],
) -> bool:
    """Bind phone with OTP verification."""
```

### 公共函数

```python
async def do_bind(
    bind_email: str | None = None,
    bind_phone: str | None = None,
    otp_code: str | None = None,
    send_phone_otp: bool = False,
    credential_name: str = "default",
    wait_for_email_verification: bool = False,
    email_verification_timeout: int = 300,
    email_poll_interval: float = 5.0,
) -> bool:
    """Execute the binding flow."""

def main() -> None:
    """CLI entry point."""
```

## 导入的模块

```python
import argparse
import asyncio
import logging

from utils import SDKConfig, create_user_service_client
from utils.cli_errors import exit_with_cli_error
from utils.handle import (
    bind_email_send,
    bind_phone_send_otp,
    bind_phone_verify,
    ensure_email_verification,
)
from utils.logging_config import configure_logging
from credential_store import load_identity
```

## 依赖关系图

```
bind_contact.py
├── utils/config.py (SDKConfig)
├── utils/client.py (create_user_service_client)
├── utils/handle.py (bind_email_send, bind_phone_send_otp, bind_phone_verify, ensure_email_verification)
├── utils/cli_errors.py (exit_with_cli_error)
├── utils/logging_config.py (configure_logging)
└── credential_store.py (load_identity)
```

## CLI 参数

| 参数 | 必需 | 说明 |
|------|------|------|
| `--bind-email` | 否 | 要绑定的邮箱地址 |
| `--bind-phone` | 否 | 要绑定的手机号 |
| `--otp-code` | 否 | 手机验证码 |
| `--send-phone-otp` | 否 | 发送手机验证码 |
| `--credential` | 否 | 凭证名称（默认：default） |
| `--wait-for-email-verification` | 否 | 等待邮箱验证完成 |
| `--email-verification-timeout` | 否 | 邮箱验证超时（秒，默认：300） |

## 退出码

| 退出码 | 说明 |
|--------|------|
| 0 | 成功 |
| 1 | 一般错误 |
| 3 | 等待验证中 |
