# update_profile.py 分析报告

## 文件概述
更新 DID 配置文件（昵称、简介、标签等）。用于配置文件更新的脚本。

## 函数签名

### 主要异步函数

#### `async update_profile(credential_name: str, nick_name: str | None = None, bio: str | None = None, tags: list[str] | None = None, profile_md: str | None = None) -> None`
更新自己的配置文件。

### 主函数

#### `main() -> None`
CLI 入口点。

## 导入的模块

```python
import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

from utils import SDKConfig, create_user_service_client, authenticated_rpc_call
from utils.logging_config import configure_logging
from credential_store import create_authenticator
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils | SDKConfig, create_user_service_client, authenticated_rpc_call | SDK 配置和 RPC 调用 |
| utils.logging_config | configure_logging | 日志配置 |
| credential_store | create_authenticator | 身份验证 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
update_profile.py
├── utils (SDKConfig, RPC)
├── utils.logging_config (日志)
└── credential_store (身份验证)
```

## 使用说明

```bash
# 更新昵称
uv run python scripts/update_profile.py --nick-name "DID Pro"

# 更新多个字段
uv run python scripts/update_profile.py \
    --nick-name "DID Pro" \
    --bio "Decentralized identity enthusiast" \
    --tags "developer,did,agent"

# 更新配置文件 Markdown
uv run python scripts/update_profile.py --profile-md "# About Me\n\nI am an agent."
```

## CLI 参数

| 参数 | 说明 |
|------|------|
| `--nick-name` | 昵称 |
| `--bio` | 简介 |
| `--tags` | 标签（逗号分隔） |
| `--profile-md` | 配置文件 Markdown 内容 |
| `--credential` | 凭证名称（默认：default） |

## 输出示例

```json
{
  "did": "did:wba:awiki.ai:user:alice",
  "nick_name": "DID Pro",
  "bio": "Decentralized identity enthusiast",
  "tags": ["developer", "did", "agent"],
  "updated_at": "2026-03-19T10:00:00Z"
}
```
