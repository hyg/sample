# e2ee_messaging.py 分析报告

## 文件概述
E2EE 端到端加密消息（HPKE 方案，带跨进程状态持久化）。支持发送加密消息、处理收件箱 E2EE 消息和手动握手。

## 函数签名

### 内部辅助函数

#### `_message_time_value(message: dict[str, Any]) -> str`
返回消息的可排序时间戳字符串。

#### `_sender_did_value(message: dict[str, Any], fallback: str = "?") -> str`
返回安全的发送者 DID 字符串用于日志和用户可见输出。

#### `_message_sort_key(message: dict[str, Any]) -> tuple[Any, ...]`
构建稳定的收件箱排序键。

#### `_render_user_visible_e2ee_text(plaintext: str) -> str`
为解密后的 E2EE 消息渲染最小用户可见文本。

#### `_render_auto_session_notice(peer_did: str) -> str`
为发送优先自动初始化流程渲染用户可见通知。

#### `_classify_decrypt_error(exc: BaseException) -> tuple[str, str]`
将解密失败映射为 e2ee_error 代码和重试提示。

#### `_load_or_create_e2ee_client(local_did: str, credential_name: str) -> E2eeClient`
从磁盘加载现有 E2EE 客户端状态，或创建新客户端。

#### `_save_e2ee_client(client: E2eeClient, credential_name: str) -> None`
保存 E2EE 客户端状态到磁盘。

#### `async _send_msg(client, sender_did, receiver_did, msg_type, content, *, auth, credential_name="default", client_msg_id: str | None = None, title: str | None = None)`
发送消息（E2EE 或明文）。

### 主要异步函数

#### `async initiate_handshake(peer_did: str, credential_name: str = "default") -> None`
手动启动 E2EE 会话（高级/手动路径）。

#### `async send_encrypted(peer_did: str, plaintext: str, credential_name: str = "default", original_type: str = "text", outbox_id: str | None = None, title: str | None = None) -> None`
通过正常发送优先流程发送加密消息。

#### `async process_inbox(peer_did: str, credential_name: str = "default") -> None`
处理收件箱中的 E2EE 消息。

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
from pathlib import Path
from typing import Any

from utils import SDKConfig, E2eeClient, create_molt_message_client, authenticated_rpc_call, resolve_to_did
from utils.e2ee import (
    SUPPORTED_E2EE_VERSION,
    build_e2ee_error_content,
    build_e2ee_error_message,
)
from utils.logging_config import configure_logging
from credential_store import create_authenticator, load_identity
from e2ee_store import save_e2ee_state, load_e2ee_state
from e2ee_outbox import (
    begin_send_attempt,
    get_record,
    list_failed_records,
    mark_dropped,
    record_local_failure,
    mark_send_success,
    record_remote_failure,
)
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils | SDKConfig, E2eeClient, create_molt_message_client, authenticated_rpc_call, resolve_to_did | SDK 配置和 RPC 调用 |
| utils.e2ee | SUPPORTED_E2EE_VERSION, build_e2ee_error_content, build_e2ee_error_message | E2EE 错误处理 |
| utils.logging_config | configure_logging | 日志配置 |
| credential_store | create_authenticator, load_identity | 身份验证 |
| e2ee_store | save_e2ee_state, load_e2ee_state | E2EE 状态持久化 |
| e2ee_outbox | begin_send_attempt, get_record, list_failed_records, mark_dropped, record_local_failure, mark_send_success, record_remote_failure | E2EE 发件箱管理 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
e2ee_messaging.py
├── utils (SDKConfig, E2eeClient, RPC)
├── utils.e2ee (E2EE 错误处理)
├── credential_store (身份验证)
├── e2ee_store (E2EE 状态)
└── e2ee_outbox (发件箱管理)
```

## 使用说明

```bash
# 发送加密消息（自动初始化会话）
uv run python scripts/e2ee_messaging.py --send "did:wba:awiki.ai:user:abc123" --content "secret message"

# 预初始化 E2EE 会话
uv run python scripts/e2ee_messaging.py --handshake "did:wba:awiki.ai:user:abc123"

# 处理收件箱 E2EE 消息
uv run python scripts/e2ee_messaging.py --process --peer "did:wba:awiki.ai:user:abc123"

# 列出失败的发件箱记录
uv run python scripts/e2ee_messaging.py --list-failed

# 重试失败的记录
uv run python scripts/e2ee_messaging.py --retry <outbox_id>

# 丢弃失败的记录
uv run python scripts/e2ee_messaging.py --drop <outbox_id>
```
