# check_inbox.py 分析报告

## 文件概述
检查收件箱，查看私有/群组历史消息，并标记消息为已读。支持 E2EE 加密消息的自动处理和解密。

## 函数签名

### 内部辅助函数

#### `_message_time_value(message: dict[str, Any]) -> str`
返回消息的可排序时间戳字符串。

#### `_message_sort_key(message: dict[str, Any]) -> tuple[Any, ...]`
构建稳定的 E2EE 收件箱排序键。

#### `_decorate_user_visible_e2ee_message(message: dict[str, Any], *, original_type: str, plaintext: str) -> dict[str, Any]`
装饰解密后的 E2EE 消息用于用户可见输出。

#### `_strip_hidden_user_fields(message: dict[str, Any]) -> dict[str, Any]`
移除故意隐藏的用户可见字段。

#### `_filter_messages_by_scope(messages: list[dict[str, Any]], scope: str) -> list[dict[str, Any]]`
按请求的范围过滤混合收件箱消息。

#### `_parse_group_history_target(target: str) -> str | None`
解析群组前缀的历史记录目标为群组 ID。

#### `_resolve_group_since_seq(*, owner_did: str, group_id: str, explicit_since_seq: int | None) -> tuple[int | None, str]`
解析群组历史读取的增量游标。

#### `_load_or_create_e2ee_client(local_did: str, credential_name: str) -> E2eeClient`
加载持久化的 E2EE 状态或创建新客户端。

#### `_send_msg(http_client, sender_did, receiver_did, msg_type, content, *, auth, credential_name="default")`
发送 E2EE 协议/错误消息。

#### `_group_rpc_call(*, credential_name: str, method: str, params: dict[str, Any], auth: Any) -> dict[str, Any]`
运行一个经过身份验证的发现群组 RPC 调用。

#### `_classify_decrypt_error(exc: BaseException) -> tuple[str, str]`
将解密失败映射为 e2ee_error 代码和重试提示。

#### `_auto_process_e2ee_messages(messages: list[dict[str, Any]], *, local_did: str, auth: Any, credential_name: str) -> tuple[list[dict[str, Any]], list[str], E2eeClient]`
立即处理 E2EE 协议消息并在可能时解密明文。

#### `_render_local_outgoing_e2ee_message(credential_name: str, message: dict[str, Any]) -> dict[str, Any] | None`
用本地明文替换 outgoing 加密历史项。

#### `_store_inbox_messages(credential_name: str, my_did: str, inbox: Any) -> None`
本地存储收件箱消息。

#### `_store_history_messages(credential_name: str, my_did: str, peer_did: str, history: Any) -> None`
本地存储聊天记录消息。

### 主要异步函数

#### `async check_inbox(credential_name: str = "default", limit: int = 20, scope: str = "all") -> None`
查看收件箱并在可能时立即处理私有 E2EE 消息。

#### `async get_history(peer_did: str, credential_name: str = "default", limit: int = 50) -> None`
查看与特定 DID 的聊天记录并在可能时立即渲染 E2EE 明文。

#### `async get_group_history(group_id: str, credential_name: str = "default", limit: int = 50, since_seq: int | None = None) -> None`
查看一个发现群组的消息历史。

#### `async mark_read(message_ids: list[str], credential_name: str = "default") -> None`
标记消息为已读。

## 导入的模块

```python
import argparse
import asyncio
import json
import logging
import sys
from typing import Any

from utils import (
    SDKConfig,
    E2eeClient,
    create_molt_message_client,
    create_user_service_client,
    authenticated_rpc_call,
    resolve_to_did,
)
from utils.logging_config import configure_logging
from credential_store import create_authenticator, load_identity
from e2ee_outbox import record_remote_failure
from e2ee_store import load_e2ee_state, save_e2ee_state
from utils.e2ee import (
    SUPPORTED_E2EE_VERSION,
    build_e2ee_error_content,
    build_e2ee_error_message,
)
import local_store
from manage_group import _persist_group_messages
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils | SDKConfig, E2eeClient, create_molt_message_client, create_user_service_client, authenticated_rpc_call, resolve_to_did | SDK 配置和 RPC 调用 |
| utils.logging_config | configure_logging | 日志配置 |
| credential_store | create_authenticator, load_identity | 身份验证和凭证加载 |
| e2ee_outbox | record_remote_failure | 记录远程 E2EE 失败 |
| e2ee_store | load_e2ee_state, save_e2ee_state | E2EE 状态持久化 |
| utils.e2ee | SUPPORTED_E2EE_VERSION, build_e2ee_error_content, build_e2ee_error_message | E2EE 错误处理 |
| local_store | get_connection, ensure_schema, store_messages_batch, upsert_group, sync_group_member_from_system_event, upsert_contact, make_thread_id, get_message_by_id | 本地 SQLite 存储 |
| manage_group | _persist_group_messages | 群组消息持久化 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
check_inbox.py
├── utils (SDKConfig, E2eeClient, RPC 客户端)
├── credential_store (身份验证)
├── e2ee_outbox (E2EE 失败记录)
├── e2ee_store (E2EE 状态)
├── utils.e2ee (E2EE 错误处理)
├── local_store (本地存储)
└── manage_group (群组消息持久化)
```

## 使用说明

```bash
# 查看收件箱
uv run python scripts/check_inbox.py

# 限制结果数量
uv run python scripts/check_inbox.py --limit 5

# 查看与特定 DID 的聊天记录
uv run python scripts/check_inbox.py --history "did:wba:localhost:user:abc123"

# 仅查看群组消息
uv run python scripts/check_inbox.py --scope group

# 查看群组历史
uv run python scripts/check_inbox.py --group-id grp_123 --limit 50

# 标记消息为已读
uv run python scripts/check_inbox.py --mark-read msg_id_1 msg_id_2
```
