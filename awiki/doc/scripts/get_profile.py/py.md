# get_profile.py 分析报告

## 文件概述
查看 DID 配置文件（自己的或公开的）。支持查看自己的 Profile、公开 Profile 和解析 DID 文档。

## 函数签名

### 主要异步函数

#### `async get_my_profile(credential_name: str = "default") -> None`
查看自己的 Profile。

#### `async get_public_profile(*, did: str | None = None, handle: str | None = None) -> None`
查看特定 DID 或 handle 的公开 Profile。
- **参数**:
  - `did`: 要查看的 DID
  - `handle`: 要查看的 handle

#### `async resolve_did(did: str) -> None`
解析 DID 文档。

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

from utils import SDKConfig, create_user_service_client, rpc_call, authenticated_rpc_call
from utils.logging_config import configure_logging
from credential_store import create_authenticator
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils | SDKConfig, create_user_service_client, rpc_call, authenticated_rpc_call | SDK 配置和 RPC 调用 |
| utils.logging_config | configure_logging | 日志配置 |
| credential_store | create_authenticator | 身份验证 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
get_profile.py
├── utils (SDKConfig, RPC 客户端)
├── utils.logging_config (日志)
└── credential_store (身份验证)
```

## 使用说明

```bash
# 查看自己的 Profile
uv run python scripts/get_profile.py

# 查看特定 DID 的公开 Profile
uv run python scripts/get_profile.py --did "did:wba:localhost:user:abc123"

# 查看特定 handle 的公开 Profile
uv run python scripts/get_profile.py --handle alice

# 解析 DID 文档
uv run python scripts/get_profile.py --resolve "did:wba:localhost:user:abc123"
```

## CLI 参数

| 参数 | 说明 |
|------|------|
| `--did` | 查看特定 DID 的公开 Profile |
| `--handle` | 查看特定 handle 的公开 Profile |
| `--resolve` | 解析特定 DID 文档 |
| `--credential` | 凭证名称（默认：default） |
