# setup_identity.py 分析报告

## 文件概述
创建或恢复 DID 身份。首次使用时创建新身份并保存到本地；之后重用保存的身份。身份管理入口脚本；首次使用前必须调用。

## 函数签名

### 主要异步函数

#### `async create_new_identity(name: str, display_name: str | None = None, credential_name: str = "default", is_agent: bool = False) -> None`
创建新的 DID 身份并保存。

#### `async load_saved_identity(credential_name: str = "default") -> None`
加载保存的身份并验证。

### 同步函数

#### `show_identities() -> None`
显示所有保存的身份。

#### `remove_identity(credential_name: str) -> None`
删除保存的身份。

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

from utils import (
    SDKConfig,
    create_identity,
    create_user_service_client,
    register_did,
    get_jwt_via_wba,
    create_authenticated_identity,
    authenticated_rpc_call,
    rpc_call,
)
from utils.logging_config import configure_logging
from credential_store import (
    save_identity,
    load_identity,
    list_identities,
    delete_identity,
    update_jwt,
    create_authenticator,
)
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils | SDKConfig, create_identity, create_user_service_client, register_did, get_jwt_via_wba, create_authenticated_identity, authenticated_rpc_call, rpc_call | SDK 配置和身份创建 |
| utils.logging_config | configure_logging | 日志配置 |
| credential_store | save_identity, load_identity, list_identities, delete_identity, update_jwt, create_authenticator | 凭证管理 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
setup_identity.py
├── utils (身份创建)
├── credential_store (凭证管理)
└── utils.logging_config (日志)
```

## 使用说明

```bash
# 创建新身份
uv run python scripts/setup_identity.py --name MyAgent

# 创建 Agent 身份
uv run python scripts/setup_identity.py --name MyAgent --agent

# 加载保存的身份
uv run python scripts/setup_identity.py --load default

# 列出所有保存的身份
uv run python scripts/setup_identity.py --list

# 删除保存的身份
uv run python scripts/setup_identity.py --delete myid

# 指定凭证名称
uv run python scripts/setup_identity.py --name MyAgent --credential mycred
```

## CLI 参数

| 参数 | 说明 |
|------|------|
| `--name` | 创建带显示名称的新身份 |
| `--load` | 加载保存的身份（默认：default） |
| `--list` | 列出所有保存的身份 |
| `--delete` | 删除保存的身份 |
| `--credential` | 凭证存储名称（默认：default） |
| `--agent` | 标记为 AI Agent 身份 |

## 身份创建流程

1. 创建 DID 身份
2. 注册 DID 到服务器
3. 获取 JWT 令牌
4. 保存凭证到本地

## 身份加载流程

1. 从本地加载凭证
2. 使用 DIDWbaAuthHeader 验证
3. 自动刷新 JWT（如果过期）
4. 显示当前身份信息
