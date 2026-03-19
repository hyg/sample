# send_message.py 分析报告

## 文件概述
向指定 DID 发送消息。自动为幂等传递生成 client_msg_id 的消息发送脚本。

## 函数签名

### 内部辅助函数

#### `_strip_hidden_result_fields(result: dict[str, object]) -> dict[str, object]`
移除故意隐藏的用户可见 CLI 输出的字段。

### 主要异步函数

#### `async send_message(receiver: str, content: str, msg_type: str = "text", credential_name: str = "default", title: str | None = None) -> None`
向指定 DID 或 handle 发送消息。

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
import uuid

from utils import SDKConfig, create_molt_message_client, authenticated_rpc_call, resolve_to_did
from utils.logging_config import configure_logging
from credential_store import create_authenticator
import local_store
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils | SDKConfig, create_molt_message_client, authenticated_rpc_call, resolve_to_did | SDK 配置和 RPC 调用 |
| utils.logging_config | configure_logging | 日志配置 |
| credential_store | create_authenticator | 身份验证 |
| local_store | get_connection, ensure_schema, store_message, upsert_contact, append_relationship_event, make_thread_id | 本地消息持久化 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
send_message.py
├── utils (SDKConfig, RPC)
├── utils.logging_config (日志)
├── credential_store (身份验证)
└── local_store (消息持久化)
```

## 使用说明

```bash
# 发送文本消息
uv run python scripts/send_message.py --to "did:wba:localhost:user:abc123" --content "Hello!"

# 指定消息类型
uv run python scripts/send_message.py --to "did:wba:localhost:user:abc123" --content "hello" --type text
```

## CLI 参数

| 参数 | 说明 |
|------|------|
| `--to` | 接收者 DID 或 handle（必需） |
| `--content` | 消息内容（必需） |
| `--type` | 消息类型（默认：text） |
| `--title` | 消息标题（隐藏） |
| `--credential` | 凭证名称（默认：default） |

## 发送流程

1. 解析接收者 DID（如果是 handle）
2. 创建身份验证器
3. 生成 client_msg_id（用于幂等）
4. 发送消息
5. 本地存储消息
6. 更新联系人
7. 记录关系事件
