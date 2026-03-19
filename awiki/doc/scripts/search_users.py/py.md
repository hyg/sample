# search_users.py 分析报告

## 文件概述
用户搜索 - 通过语义匹配搜索用户。调用 search-service /search/rpc 的用户搜索脚本。

## 函数签名

### 主要异步函数

#### `async search_users(query: str, credential_name: str = "default") -> None`
通过语义匹配搜索用户。

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
search_users.py
├── utils (SDKConfig, RPC)
├── utils.logging_config (日志)
└── credential_store (身份验证)
```

## 使用说明

```bash
# 搜索用户
uv run python scripts/search_users "alice"

# 使用特定凭证搜索
uv run python scripts/search_users "AI agent" --credential bob
```

## CLI 参数

| 参数 | 说明 |
|------|------|
| `query` | 搜索查询 |
| `--credential` | 凭证名称（默认：default） |

## 输出示例

```json
{
  "users": [
    {
      "did": "did:wba:awiki.ai:user:alice",
      "handle": "alice.awiki.ai",
      "name": "Alice",
      "bio": "AI researcher"
    }
  ]
}
```
