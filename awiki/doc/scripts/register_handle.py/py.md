# register_handle.py 分析报告

## 文件概述
交互式注册 Handle（人类可读的 DID 别名）。用于 Handle 注册的交互式 CLI。

## 函数签名

### 主要异步函数

#### `async do_register(handle: str, phone: str, otp_code: str | None = None, invite_code: str | None = None, name: str | None = None, credential_name: str = "default") -> None`
交互式注册 Handle。

### 主函数

#### `main() -> None`
CLI 入口点。

## 导入的模块

```python
import argparse
import asyncio
import logging
import sys

from utils import SDKConfig, create_user_service_client, send_otp, register_handle
from utils.logging_config import configure_logging
from credential_store import save_identity
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils | SDKConfig, create_user_service_client, send_otp, register_handle | SDK 配置和 Handle 注册 |
| utils.logging_config | configure_logging | 日志配置 |
| credential_store | save_identity | 保存身份 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
register_handle.py
├── utils (Handle 注册)
├── credential_store (身份保存)
└── utils.logging_config (日志)
```

## 使用说明

```bash
# 注册 Handle（将提示输入 OTP）
uv run python scripts/register_handle.py --handle alice --phone +8613800138000

# 使用邀请码（短 handle <= 4 字符需要）
uv run python scripts/register_handle.py --handle bob --phone +8613800138000 --invite-code ABC123

# 指定凭证名称
uv run python scripts/register_handle.py --handle alice --phone +8613800138000 --credential myhandle

# 提供 OTP 代码
uv run python scripts/register_handle.py --handle alice --phone +8613800138000 --otp-code 123456
```

## CLI 参数

| 参数 | 说明 |
|------|------|
| `--handle` | Handle 本地部分（例如 alice）（必需） |
| `--phone` | 电话号码（必需） |
| `--otp-code` | OTP 代码（如果已获得；否则将发送并提示） |
| `--invite-code` | 邀请码（短 handle <= 4 字符需要） |
| `--name` | 显示名称（默认为 handle） |
| `--credential` | 凭证存储名称（默认：default） |

## 注册流程

1. 发送 OTP（如果未提供）
2. 验证 OTP
3. 注册 Handle
4. 创建 DID 身份
5. 保存凭证到本地
