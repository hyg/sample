# manage_credits.py 分析报告

## 文件概述
查询积分余额、交易记录和规则。用于余额、交易和规则的积分配额查询脚本。

## 函数签名

### 主要异步函数

#### `async get_balance(credential_name: str = "default") -> None`
查看当前积分余额。

#### `async get_transactions(credential_name: str = "default", limit: int = 20, offset: int = 0) -> None`
查看积分交易历史。

#### `async get_rules() -> None`
查看所有积分规则（无需身份验证）。

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
manage_credits.py
├── utils (SDKConfig, RPC 客户端)
├── utils.logging_config (日志)
└── credential_store (身份验证)
```

## 使用说明

```bash
# 查看积分余额
python scripts/manage_credits.py --balance

# 查看积分交易历史
python scripts/manage_credits.py --transactions
python scripts/manage_credits.py --transactions --limit 20 --offset 0

# 查看所有积分规则（无需身份验证）
python scripts/manage_credits.py --rules
```

## CLI 参数

| 参数 | 说明 |
|------|------|
| `--balance` | 查看当前积分余额 |
| `--transactions` | 查看积分交易历史 |
| `--rules` | 查看所有积分规则 |
| `--credential` | 凭证名称（默认：default） |
| `--limit` | 交易列表限制（默认：20） |
| `--offset` | 交易列表偏移（默认：0） |
