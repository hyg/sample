# scripts/send_verification_code.py 分析

## 文件信息

- **路径**: `python/scripts/send_verification_code.py`
- **用途**: 发送 Handle OTP 验证码

## 函数签名

### do_send()

```python
async def do_send(phone: str) -> None:
    """Send one OTP code to the requested phone number."""
```

### main()

```python
def main() -> None:
    """CLI entry point."""
```

## 导入的模块

```python
from __future__ import annotations

import argparse
import asyncio
import logging

from utils import SDKConfig, create_user_service_client, send_otp
from utils.cli_errors import exit_with_cli_error
from utils.logging_config import configure_logging
```

## 依赖关系图

```
send_verification_code.py
├── utils/config.py (SDKConfig)
├── utils/client.py (create_user_service_client)
├── utils/handle.py (send_otp)
├── utils/cli_errors.py (exit_with_cli_error)
└── utils/logging_config.py (configure_logging)
```

## CLI 参数

| 参数 | 必需 | 说明 |
|------|------|------|
| `--phone` | 是 | 国际格式手机号（如 +8613800138000） |

## 输出

- 成功：发送 OTP 验证码，打印下一步指引
- 失败：通过 `exit_with_cli_error` 退出
