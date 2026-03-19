# local_store.py 分析报告

## 文件概述
SQLite 本地存储，用于消息、联系人、关系事件、群组和 E2EE 发件箱状态。为离线消息存储、关系/联系人快照、群组状态快照和可重发 E2EE 发件箱跟踪提供持久化层。

## 函数签名

### 连接和模式管理

#### `get_connection() -> sqlite3.Connection`
打开（或创建）共享 SQLite 数据库。

#### `_table_exists(conn: sqlite3.Connection, table_name: str) -> bool`
返回表是否存在。

#### `_normalize_credential_name(credential_name: str | None) -> str`
规范化 credential_name 用于本地存储。

#### `_normalize_owner_did(owner_did: str | None) -> str`
规范化 owner_did 用于本地存储。

#### `_normalize_optional_text(value: Any) -> str | None`
规范化可选值为文本。

#### `_normalize_optional_int(value: Any) -> int | None`
规范化可选值为 int。

#### `_normalize_optional_bool(value: Any) -> int | None`
规范化可选值为 SQLite 布尔整数。

#### `_normalize_optional_float(value: Any) -> float | None`
规范化可选值为 float。

#### `_normalize_metadata(value: str | dict[str, Any] | None) -> str | None`
将元数据规范化为 JSON 文本负载。

#### `_schema_object_exists(conn: sqlite3.Connection, *, object_type: str, object_name: str) -> bool`
返回模式对象是否存在。

#### `ensure_schema(conn: sqlite3.Connection) -> None`
确保数据库模式是最新的。

### 索引管理

#### `_ensure_v6_indexes(conn: sqlite3.Connection) -> list[str]`
创建任何缺失的 v6 索引。

#### `_ensure_v7_indexes(conn: sqlite3.Connection) -> list[str]`
创建任何缺失的 v7 索引。

#### `_ensure_v8_indexes(conn: sqlite3.Connection) -> list[str]`
创建任何缺失的 v8 索引。

### 视图管理

#### `_recreate_v6_views(conn: sqlite3.Connection) -> None`
重新创建规范的 v6 视图。

#### `_ensure_v6_views(conn: sqlite3.Connection) -> list[str]`
创建任何缺失的 v6 视图。

### 模式创建

#### `_create_schema_v6(conn: sqlite3.Connection) -> None`
创建 owner_did 感知模式。

#### `_create_schema_v7_extensions(conn: sqlite3.Connection) -> None`
创建 v7 群组状态扩展。

#### `_create_schema_v8_extensions(conn: sqlite3.Connection) -> None`
创建 v8 关系事件扩展。

#### `_create_schema_v7(conn: sqlite3.Connection) -> None`
创建完整的 owner_did 感知模式。

### 迁移辅助

#### `_load_credential_owner_dids() -> dict[str, str]`
从凭证存储加载 credential_name -> owner_did 映射。

#### `_extract_dm_owner_from_thread(thread_id: str, sender_did: str | None) -> str`
从 DM 线程 ID 和发送者 DID 推断 owner_did。

#### `_infer_owner_did_from_message_row(row: dict[str, Any], credential_owner_dids: dict[str, str]) -> str`
为迁移的遗留消息行推断 owner_did。

#### `_infer_owner_did_from_outbox_row(row: dict[str, Any], credential_owner_dids: dict[str, str], conn: sqlite3.Connection) -> str`
为迁移的遗留发件箱行推断 owner_did。

#### `_merge_metadata(metadata: str | None, extra: dict[str, Any]) -> str`
将额外元数据合并到 JSON 元数据字符串。

#### `_infer_contact_owner_dids(conn: sqlite3.Connection, contact_did: str, known_owner_dids: set[str]) -> tuple[list[str], bool]`
为迁移的遗留联系人行推断 owner_did。

#### `_migrate_existing_schema_to_v6(conn: sqlite3.Connection, version: int) -> None`
将现有数据库迁移到模式 v6。

### 消息操作

#### `make_thread_id(owner_did: str, *, peer_did: str | None = None, group_id: str | None = None) -> str`
为消息生成线程 ID。

#### `store_message(conn: sqlite3.Connection, msg_id: str, owner_did: str, thread_id: str, direction: int, sender_did: str | None, receiver_did: str | None, content_type: str, content: str, title: str | None = None, server_seq: int | None = None, sent_at: str | None = None, is_e2ee: bool = False, is_read: bool = False, sender_name: str | None = None, metadata: str | dict[str, Any] | None = None, credential_name: str = "default") -> None`
存储单条消息。

#### `store_messages_batch(conn: sqlite3.Connection, batch: list[dict[str, Any]], owner_did: str, credential_name: str) -> None`
批量存储消息。

#### `get_message_by_id(conn: sqlite3.Connection, *, msg_id: str, owner_did: str | None, credential_name: str) -> dict[str, Any] | None`
按 ID 获取消息。

### 联系人操作

#### `upsert_contact(conn: sqlite3.Connection, owner_did: str, did: str, name: str | None = None, handle: str | None = None, nick_name: str | None = None, bio: str | None = None, profile_md: str | None = None, tags: str | None = None, relationship: str | None = None, source_type: str | None = None, source_name: str | None = None, source_group_id: str | None = None, connected_at: str | None = None, recommended_reason: str | None = None, followed: bool | None = None, messaged: bool | None = None, note: str | None = None, metadata: str | dict[str, Any] | None = None) -> None`
上插联系人记录。

### 关系事件操作

#### `append_relationship_event(conn: sqlite3.Connection, owner_did: str, target_did: str, target_handle: str | None = None, event_type: str = "ai_recommended", source_type: str | None = None, source_name: str | None = None, source_group_id: str | None = None, reason: str | None = None, score: float | None = None, status: str = "pending", metadata: str | dict[str, Any] | None = None, credential_name: str = "default") -> str`
追加关系事件。
- **返回值**: event_id

### 群组操作

#### `upsert_group(conn: sqlite3.Connection, owner_did: str, group_id: str, group_did: str | None = None, name: str | None = None, slug: str | None = None, description: str | None = None, goal: str | None = None, rules: str | None = None, message_prompt: str | None = None, doc_url: str | None = None, group_owner_did: str | None = None, group_owner_handle: str | None = None, my_role: str | None = None, membership_status: str | None = None, join_enabled: bool | None = None, join_code: str | None = None, join_code_expires_at: str | None = None, member_count: int | None = None, last_synced_seq: int | None = None, last_read_seq: int | None = None, last_message_at: str | None = None, remote_created_at: str | None = None, remote_updated_at: str | None = None, metadata: str | dict[str, Any] | None = None, credential_name: str = "default") -> None`
上插群组记录。

#### `replace_group_members(conn: sqlite3.Connection, owner_did: str, group_id: str, members: list[dict[str, Any]], credential_name: str = "default") -> None`
替换群组的活跃成员快照。

#### `delete_group_members(conn: sqlite3.Connection, owner_did: str, group_id: str, target_did: str | None = None, target_user_id: str | None = None) -> None`
删除群组成员。

#### `upsert_group_member(conn: sqlite3.Connection, owner_did: str, group_id: str, user_id: str, member_did: str | None = None, member_handle: str | None = None, profile_url: str | None = None, role: str | None = None, status: str | None = None, joined_at: str | None = None, sent_message_count: int | None = None, metadata: str | dict[str, Any] | None = None, credential_name: str = "default") -> None`
上插群组成员记录。

#### `sync_group_member_from_system_event(conn: sqlite3.Connection, owner_did: str, group_id: str, system_event: dict[str, Any], credential_name: str) -> None`
从系统事件同步群组成员。

### E2EE 发件箱操作

#### `queue_e2ee_outbox(conn: sqlite3.Connection, owner_did: str, peer_did: str, plaintext: str, session_id: str | None, original_type: str, credential_name: str) -> str`
队列 E2EE 发件箱条目。
- **返回值**: outbox_id

#### `update_e2ee_outbox_status(conn: sqlite3.Connection, outbox_id: str, local_status: str, owner_did: str, credential_name: str) -> None`
更新 E2EE 发件箱状态。

#### `mark_e2ee_outbox_sent(conn: sqlite3.Connection, outbox_id: str, owner_did: str, credential_name: str, session_id: str | None, sent_msg_id: str | None, sent_server_seq: int | None, metadata: str | None) -> None`
标记 E2EE 发件箱为已发送。

#### `mark_e2ee_outbox_failed(conn: sqlite3.Connection, owner_did: str, credential_name: str, peer_did: str, session_id: str | None, failed_msg_id: str | None, failed_server_seq: int | None, error_code: str, retry_hint: str | None, metadata: str | None) -> str | None`
标记 E2EE 发件箱为失败。

#### `list_e2ee_outbox(conn: sqlite3.Connection, owner_did: str, credential_name: str, local_status: str | None = None) -> list[dict[str, Any]]`
列出 E2EE 发件箱条目。

#### `get_e2ee_outbox(conn: sqlite3.Connection, outbox_id: str, owner_did: str, credential_name: str) -> dict[str, Any] | None`
获取 E2EE 发件箱记录。

#### `set_e2ee_outbox_failure_by_id(conn: sqlite3.Connection, outbox_id: str, owner_did: str, credential_name: str, error_code: str, retry_hint: str | None = None, metadata: str | None = None) -> None`
按 ID 设置 E2EE 发件箱失败。

### 所有者 DID 重绑定

#### `rebind_owner_did(conn: sqlite3.Connection, old_owner_did: str, new_owner_did: str) -> dict[str, int]`
重绑定消息和联系人的 owner_did。
- **返回值**: 重绑定的记录数

#### `clear_owner_e2ee_data(conn: sqlite3.Connection, owner_did: str, credential_name: str) -> dict[str, int]`
清除所有者的 E2EE 数据。

### SQL 执行

#### `execute_sql(conn: sqlite3.Connection, sql: str) -> list[dict[str, Any]] | dict[str, Any]`
执行 SQL 查询（只读）。

## 导入的模块

```python
from __future__ import annotations

import json
import logging
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

from utils.config import SDKConfig
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils.config | SDKConfig | SDK 配置（数据库路径） |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| check_inbox.py | 多个存储函数 | 本地消息存储 |
| check_status.py | 多个存储函数 | 本地消息存储 |
| database_migration.py | get_connection, ensure_schema, _SCHEMA_VERSION | 数据库迁移 |
| e2ee_outbox.py | 多个发件箱函数 | E2EE 发件箱管理 |
| manage_contacts.py | 多个联系人和事件函数 | 联系人沉淀 |
| manage_group.py | 多个群组函数 | 群组持久化 |
| manage_relationship.py | upsert_contact, append_relationship_event | 关系持久化 |
| query_db.py | get_connection, ensure_schema, execute_sql | SQL 查询 |
| recover_handle.py | rebind_owner_did, clear_owner_e2ee_data | 缓存迁移 |
| send_message.py | store_message, upsert_contact, append_relationship_event | 消息持久化 |
| ws_listener.py | 多个存储函数 | 消息持久化 |

## 依赖关系图

```
local_store.py
└── utils.config (SDKConfig)
    ↓
几乎所有 scripts 文件 (本地存储)
```

## 常量定义

```python
_SCHEMA_VERSION = 9
```

## 数据库表

- `contacts`: 联系人
- `messages`: 消息
- `e2ee_outbox`: E2EE 发件箱
- `groups`: 群组
- `group_members`: 群组成员
- `relationship_events`: 关系事件

## 视图

- `threads`: 线程视图
- `inbox`: 收件箱视图
- `outbox`: 发件箱视图
