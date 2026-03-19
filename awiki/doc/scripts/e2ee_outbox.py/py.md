# e2ee_outbox.py 分析报告

## 文件概述
E2EE 发件箱助手，用于可重发的私有加密消息。在 E2EE 消息脚本/监听器和 SQLite 发件箱状态之间提供持久化助手层。

## 函数签名

### 内部辅助函数

#### `_open_db()`
打开数据库连接。

#### `_load_owner_did(credential_name: str) -> str`
从凭证存储解析 owner_did。

### 主要函数

#### `begin_send_attempt(*, peer_did: str, plaintext: str, original_type: str, credential_name: str, session_id: str | None, outbox_id: str | None = None) -> str`
在尝试网络发送之前创建或重置 E2EE 发件箱条目。
- **返回值**: outbox_id

#### `mark_send_success(*, outbox_id: str, credential_name: str, local_did: str, peer_did: str, plaintext: str, original_type: str, session_id: str | None, sent_msg_id: str | None, sent_server_seq: int | None, sent_at: str | None, client_msg_id: str, title: str | None = None) -> None`
将成功的加密发送持久化到发件箱和本地消息。

#### `record_remote_failure(*, credential_name: str, peer_did: str, content: dict[str, Any]) -> str | None`
从接收到的 e2ee_error 负载更新最佳匹配的发件箱条目。
- **返回值**: 匹配的发件箱 ID 或 None

#### `list_failed_records(credential_name: str) -> list[dict[str, Any]]`
列出凭证的失败 E2EE 发件箱条目。

#### `get_record(outbox_id: str, credential_name: str) -> dict[str, Any] | None`
获取一个 E2EE 发件箱记录。

#### `mark_dropped(outbox_id: str, credential_name: str) -> None`
将 E2EE 发件箱记录标记为被本地用户丢弃。

#### `record_local_failure(*, outbox_id: str, credential_name: str, error_code: str, retry_hint: str | None = None, metadata: str | None = None) -> None`
在任何对等响应存在之前将本地发送尝试标记为失败。

## 导入的模块

```python
from __future__ import annotations

import json
from typing import Any

from credential_store import load_identity
import local_store
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| credential_store | load_identity | 加载所有者 DID |
| local_store | get_connection, ensure_schema, queue_e2ee_outbox, update_e2ee_outbox_status, mark_e2ee_outbox_sent, store_message, upsert_contact, make_thread_id, mark_e2ee_outbox_failed, list_e2ee_outbox, get_e2ee_outbox, set_e2ee_outbox_failure_by_id | SQLite 发件箱操作 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| check_inbox.py | record_remote_failure | 记录远程失败 |
| check_status.py | record_remote_failure | 记录远程失败 |
| e2ee_handler.py | record_remote_failure | 记录远程失败 |
| e2ee_messaging.py | begin_send_attempt, get_record, list_failed_records, mark_dropped, record_local_failure, mark_send_success, record_remote_failure | 发件箱管理 |

## 依赖关系图

```
e2ee_outbox.py
├── credential_store (加载所有者 DID)
└── local_store (SQLite 发件箱操作)
    ↓
check_inbox.py
check_status.py
e2ee_handler.py
e2ee_messaging.py
```

## 导出接口

```python
__all__ = [
    "begin_send_attempt",
    "mark_send_success",
    "record_remote_failure",
    "record_local_failure",
    "list_failed_records",
    "get_record",
    "mark_dropped",
]
```

## 使用说明

```python
# 开始发送尝试
outbox_id = begin_send_attempt(
    peer_did="did:bob",
    plaintext="Hello",
    original_type="text",
    credential_name="default",
    session_id="sess_123",
)

# 标记发送成功
mark_send_success(
    outbox_id=outbox_id,
    credential_name="default",
    local_did="did:alice",
    peer_did="did:bob",
    plaintext="Hello",
    original_type="text",
    session_id="sess_123",
    sent_msg_id="msg_123",
    sent_server_seq=1,
    sent_at="2026-03-19T10:00:00Z",
    client_msg_id="client_123",
)

# 记录远程失败
record_remote_failure(
    credential_name="default",
    peer_did="did:bob",
    content={"error_code": "session_not_found", "session_id": "sess_123"},
)

# 列出失败记录
failed = list_failed_records("default")

# 获取记录
record = get_record(outbox_id, "default")

# 丢弃记录
mark_dropped(outbox_id, "default")
```
