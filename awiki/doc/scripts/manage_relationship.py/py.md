# manage_relationship.py 分析报告

## 文件概述
关注/取消关注/查看关系状态/列表。用于社交关系管理的脚本。

## 函数签名

### 主要异步函数

#### `async follow(target_did: str, credential_name: str = "default") -> None`
关注特定 DID。

#### `async unfollow(target_did: str, credential_name: str = "default") -> None`
取消关注特定 DID。

#### `async get_status(target_did: str, credential_name: str = "default") -> None`
查看与特定 DID 的关系状态。

#### `async get_following(credential_name: str = "default", limit: int = 50, offset: int = 0) -> None`
查看关注列表。

#### `async get_followers(credential_name: str = "default", limit: int = 50, offset: int = 0) -> None`
查看粉丝列表。

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

from utils import SDKConfig, create_user_service_client, authenticated_rpc_call, resolve_to_did
from utils.logging_config import configure_logging
from credential_store import create_authenticator
import local_store
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils | SDKConfig, create_user_service_client, authenticated_rpc_call, resolve_to_did | SDK 配置和 RPC 调用 |
| utils.logging_config | configure_logging | 日志配置 |
| credential_store | create_authenticator | 身份验证 |
| local_store | get_connection, ensure_schema, upsert_contact, append_relationship_event | 本地关系持久化 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
manage_relationship.py
├── utils (SDKConfig, RPC)
├── utils.logging_config (日志)
├── credential_store (身份验证)
└── local_store (关系持久化)
```

## 使用说明

```bash
# 关注
uv run python scripts/manage_relationship.py --follow "did:wba:localhost:user:abc123"

# 取消关注
uv run python scripts/manage_relationship.py --unfollow "did:wba:localhost:user:abc123"

# 查看关系状态
uv run python scripts/manage_relationship.py --status "did:wba:localhost:user:abc123"

# 查看关注列表
uv run python scripts/manage_relationship.py --following

# 查看粉丝列表
uv run python scripts/manage_relationship.py --followers
```

## CLI 参数

| 参数 | 说明 |
|------|------|
| `--follow` | 关注特定 DID 或 handle |
| `--unfollow` | 取消关注特定 DID 或 handle |
| `--status` | 查看与特定 DID 的关系状态 |
| `--following` | 查看关注列表 |
| `--followers` | 查看粉丝列表 |
| `--credential` | 凭证名称（默认：default） |
| `--limit` | 列表结果数量（默认：50） |
| `--offset` | 列表偏移（默认：0） |
