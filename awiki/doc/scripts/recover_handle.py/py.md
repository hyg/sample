# recover_handle.py 分析报告

## 文件概述
通过重新绑定到新 DID 来恢复 Handle。用于丢失旧 DID 私钥但仍控制原始 Handle 电话号码的用户的恢复 CLI。

## 函数签名

### 内部辅助函数

#### `_allocate_recovery_credential_name(handle: str) -> str`
为恢复的 Handle 返回非破坏性凭证名称。

#### `_resolve_recovery_target(*, handle: str, requested_credential_name: str | None, replace_existing: bool) -> tuple[str, dict[str, Any] | None]`
解析恢复的凭证目标，无隐式覆盖。

#### `_migrate_local_cache(*, credential_name: str, old_did: str, new_did: str) -> dict[str, Any]`
重新绑定本地消息/联系人并清除过时的 E2EE 工件。

### 主要异步函数

#### `async do_recover(*, handle: str, phone: str, otp_code: str | None, requested_credential_name: str | None, replace_existing: bool) -> None`
使用电话 OTP 验证恢复 Handle。

### 主函数

#### `main() -> None`
CLI 入口点。

## 导入的模块

```python
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from typing import Any

import local_store
from credential_store import (
    backup_identity,
    load_identity,
    prune_unreferenced_credential_dir,
    save_identity,
)
from e2ee_store import delete_e2ee_state
from utils import SDKConfig, create_user_service_client, recover_handle, send_otp
from utils.logging_config import configure_logging
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| local_store | get_connection, ensure_schema, rebind_owner_did, clear_owner_e2ee_data | 本地缓存迁移 |
| credential_store | backup_identity, load_identity, prune_unreferenced_credential_dir, save_identity | 凭证管理 |
| e2ee_store | delete_e2ee_state | 删除 E2EE 状态 |
| utils | SDKConfig, create_user_service_client, recover_handle, send_otp | SDK 配置和 Handle 恢复 |
| utils.logging_config | configure_logging | 日志配置 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
recover_handle.py
├── local_store (缓存迁移)
├── credential_store (凭证管理)
├── e2ee_store (E2EE 状态)
├── utils (Handle 恢复)
└── utils.logging_config (日志)
```

## 使用说明

```bash
# 恢复 Handle（将提示输入 OTP）
uv run python scripts/recover_handle.py --handle alice --phone +8613800138000

# 指定凭证名称
uv run python scripts/recover_handle.py --handle alice --phone +8613800138000 --credential alice

# 替换现有凭证
uv run python scripts/recover_handle.py --handle alice --phone +8613800138000 --credential default --replace-existing

# 提供 OTP 代码
uv run python scripts/recover_handle.py --handle alice --phone +8613800138000 --otp-code 123456
```

## CLI 参数

| 参数 | 说明 |
|------|------|
| `--handle` | Handle 本地部分（必需） |
| `--phone` | 电话号码（必需） |
| `--otp-code` | OTP 代码（可选） |
| `--credential` | 恢复的 DID 的凭证存储名称 |
| `--replace-existing` | 允许覆盖现有凭证 |

## 恢复流程

1. 解析恢复目标凭证
2. 发送 OTP（如果未提供）
3. 验证 OTP 并恢复 Handle
4. 备份现有凭证（如果替换）
5. 保存新身份
6. 迁移本地缓存（如果替换）
7. 清除未引用的凭证目录
