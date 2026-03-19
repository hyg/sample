# resolve_handle.py 分析报告

## 文件概述
解析 Handle 到 DID 或通过 DID 查找 Handle。用于 Handle 解析和反向查找的 CLI。

## 函数签名

### 主要异步函数

#### `async do_resolve(handle: str | None, did: str | None) -> None`
解析 Handle 或通过 DID 查找。

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

from utils import SDKConfig, create_user_service_client, resolve_handle, lookup_handle
from utils.logging_config import configure_logging
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils | SDKConfig, create_user_service_client, resolve_handle, lookup_handle | SDK 配置和 Handle 解析 |
| utils.logging_config | configure_logging | 日志配置 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
resolve_handle.py
├── utils (Handle 解析)
└── utils.logging_config (日志)
```

## 使用说明

```bash
# 解析 handle 到 DID
uv run python scripts/resolve_handle.py --handle alice

# 通过 DID 查找 handle
uv run python scripts/resolve_handle.py --did "did:wba:awiki.ai:alice:k1_abc123"
```

## CLI 参数

| 参数 | 说明 |
|------|------|
| `--handle` | 要解析的 Handle（例如 alice） |
| `--did` | 要查找 handle 的 DID |

## 输出示例

```json
{
  "did": "did:wba:awiki.ai:user:alice",
  "handle": "alice.awiki.ai"
}
```
