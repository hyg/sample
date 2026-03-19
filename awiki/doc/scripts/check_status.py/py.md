# check_status.py 分析报告

## 文件概述
统一状态检查脚本：本地升级 + 身份验证 + 收件箱/群组摘要。支持 E2EE 自动处理和解密。

## 函数签名

### 内部辅助函数

#### `_message_time_value(message: dict[str, Any]) -> str`
返回消息的可排序时间戳字符串。

#### `_message_sort_key(message: dict[str, Any]) -> tuple[Any, ...]`
构建稳定的 E2EE 收件箱排序键。

#### `_is_user_visible_message_type(msg_type: str) -> bool`
返回消息类型是否应暴露给终端用户。

#### `_decorate_user_visible_e2ee_message(message: dict[str, Any], *, original_type: str, plaintext: str) -> dict[str, Any]`
装饰解密后的 E2EE 消息用于状态输出。

#### `_strip_hidden_user_fields(message: dict[str, Any]) -> dict[str, Any]`
移除故意隐藏的用户可见字段。

#### `_classify_decrypt_error(exc: BaseException) -> tuple[str, str]`
将解密失败映射为稳定的发送者可见错误元数据。

#### `_build_visible_inbox_report(visible_messages: list[dict[str, Any]]) -> dict[str, Any]`
从用户可见消息构建状态友好的收件箱报告。

#### `_classify_group_messages(messages: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]`
将群组消息分类为文本/成员加入/成员离开/成员被踢桶。

#### `_persist_and_classify_group_messages(*, owner_did: str, group_id: str, payload: dict[str, Any], credential_name: str) -> dict[str, Any]`
持久化获取的群组消息并返回分类桶。

#### `_fetch_one_group_messages(client, *, group_id: str, since_seq: int | None, owner_did: str, credential_name: str, auth) -> dict[str, Any]`
为一个群组获取增量消息并返回分类结果。

#### `_load_or_create_e2ee_client(local_did: str, credential_name: str) -> E2eeClient`
加载现有 E2EE 客户端状态或创建新客户端。

#### `_save_e2ee_client(client: E2eeClient, credential_name: str) -> None`
保存 E2EE 客户端状态到磁盘。

#### `_send_msg(http_client, sender_did, receiver_did, msg_type, content, *, auth, credential_name="default")`
发送消息（E2EE 或明文）。

### 主要函数

#### `ensure_local_upgrade_ready(credential_name: str = "default") -> dict[str, Any]`
运行当前技能版本所需的本地凭证/数据库升级。

#### `summarize_group_watch(owner_did: str | None) -> dict[str, Any]`
总结本地跟踪的发现群组用于心跳决策。

#### `async fetch_group_messages(group_watch: dict[str, Any], *, owner_did: str, credential_name: str) -> dict[str, Any]`
为监视集中的所有活动群组获取增量消息。

#### `async check_identity(credential_name: str = "default") -> dict[str, Any]`
检查身份状态；引导缺失的 JWT 和刷新过期的 JWT。

#### `async summarize_inbox(credential_name: str = "default") -> dict[str, Any]`
总结收件箱状态。

#### `async _build_inbox_report_with_auto_e2ee(credential_name: str) -> dict[str, Any]`
构建带有自动 E2EE 处理的收件箱报告。

#### `async check_status(credential_name: str = "default") -> dict[str, Any]`
统一状态检查入口点。

## 导入的模块

```python
import argparse
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from utils import (
    SDKConfig,
    E2eeClient,
    rpc_call,
    create_user_service_client,
    create_molt_message_client,
    authenticated_rpc_call,
)
from utils.e2ee import (
    SUPPORTED_E2EE_VERSION,
    build_e2ee_error_content,
    build_e2ee_error_message,
)
from utils.logging_config import configure_logging
import local_store
from credential_migration import ensure_credential_storage_ready
from database_migration import ensure_local_database_ready
from credential_store import load_identity, create_authenticator
from e2ee_store import load_e2ee_state, save_e2ee_state
from e2ee_outbox import record_remote_failure
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils | SDKConfig, E2eeClient, rpc_call, create_user_service_client, create_molt_message_client, authenticated_rpc_call | SDK 配置和 RPC 调用 |
| utils.e2ee | SUPPORTED_E2EE_VERSION, build_e2ee_error_content, build_e2ee_error_message | E2EE 错误处理 |
| utils.logging_config | configure_logging | 日志配置 |
| local_store | get_connection, ensure_schema, upsert_group, replace_group_members, store_message, store_messages_batch, sync_group_member_from_system_event, upsert_group_member, upsert_contact, make_thread_id | 本地 SQLite 存储 |
| credential_migration | ensure_credential_storage_ready | 凭证存储就绪检查 |
| database_migration | ensure_local_database_ready | 数据库就绪检查 |
| credential_store | load_identity, create_authenticator | 身份验证和凭证加载 |
| e2ee_store | load_e2ee_state, save_e2ee_state | E2EE 状态持久化 |
| e2ee_outbox | record_remote_failure | 记录远程 E2EE 失败 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
check_status.py
├── utils (SDKConfig, E2eeClient, RPC 客户端)
├── utils.e2ee (E2EE 错误处理)
├── local_store (本地存储)
├── credential_migration (凭证迁移)
├── database_migration (数据库迁移)
├── credential_store (身份验证)
├── e2ee_store (E2EE 状态)
└── e2ee_outbox (E2EE 失败记录)
```

## 使用说明

```bash
# 状态检查（带 E2EE 自动处理）
python scripts/check_status.py

# 指定凭证
python scripts/check_status.py --credential alice

# 仅运行本地升级
python scripts/check_status.py --upgrade-only
```
