# manage_group.py 分析报告

## 文件概述
管理发现导向的群组。用于发现群组管理的 CLI，支持创建、加入、查看成员、发布消息等操作。

## 函数签名

### 内部辅助函数

#### `_get_identity_data_or_exit(credential_name: str, config: SDKConfig) -> dict[str, Any]`
返回活动凭证的持久化本地身份元数据。

#### `_persist_group_snapshot(*, credential_name: str, identity_data: dict[str, Any], group_payload: dict[str, Any], my_role: str | None = None, membership_status: str | None = None, last_synced_seq: int | None = None, last_message_at: str | None = None) -> None`
持久化一个群组的本地快照。

#### `_persist_group_member_snapshot(*, credential_name: str, identity_data: dict[str, Any], group_id: str, members: list[dict[str, Any]]) -> None`
替换一个群组的缓存活跃成员快照。

#### `_persist_group_messages(*, credential_name: str, identity_data: dict[str, Any], group_id: str, payload: dict[str, Any]) -> None`
将获取的群组历史批处理持久化到本地消息缓存。

#### `_persist_outgoing_group_message(*, credential_name: str, identity_data: dict[str, Any], group_id: str, content: str, client_msg_id: str | None, payload: dict[str, Any]) -> None`
在本地持久化一个成功的 outgoing 群组消息。

#### `_parse_bool(value: str) -> bool`
解析 CLI 布尔值。

#### `_get_authenticator_or_exit(credential_name: str, config: SDKConfig)`
返回身份验证器或在用户可见错误时终止。

#### `async _authenticated_group_call(credential_name: str, method: str, params: dict | None = None) -> dict`
运行经过身份验证的群组 RPC 调用。

#### `_build_parser() -> argparse.ArgumentParser`
构建 CLI 解析器。

### 主要异步函数

#### `async create_group(*, name: str, slug: str, description: str, goal: str, rules: str, message_prompt: str, join_enabled: bool, credential_name: str) -> None`
创建发现群组。

#### `async get_group(*, group_id: str, credential_name: str) -> None`
获取群组详情。

#### `async update_group(*, group_id: str, name: str | None, description: str | None, goal: str | None, rules: str | None, message_prompt: str | None, credential_name: str) -> None`
更新可变群组元数据。

#### `async refresh_join_code(*, group_id: str, credential_name: str) -> None`
刷新活跃加入码。

#### `async get_join_code(*, group_id: str, credential_name: str) -> None`
获取活跃加入码。

#### `async set_join_enabled(*, group_id: str, join_enabled: bool, credential_name: str) -> None`
启用或禁用群组加入。

#### `async join_group(*, join_code: str, credential_name: str) -> None`
使用全局 6 位加入码加入群组。

#### `async leave_group(*, group_id: str, credential_name: str) -> None`
离开群组。

#### `async kick_member(*, group_id: str, target_did: str | None, target_user_id: str | None, credential_name: str) -> None`
从群组中踢出成员。

#### `async get_group_members(*, group_id: str, credential_name: str) -> None`
查看群组成员。

#### `async post_message(*, group_id: str, content: str, client_msg_id: str | None, credential_name: str) -> None`
发布群组消息。

#### `async list_messages(*, group_id: str, since_seq: int | None, limit: int, credential_name: str) -> None`
列出群组消息。

#### `async fetch_doc(*, doc_url: str) -> None`
获取公共群组 Markdown 文档。

### 主函数

#### `main() -> None`
CLI 入口点。

## 导入的模块

```python
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from typing import Any
from urllib.parse import urlparse

import httpx
import local_store
from utils import (
    SDKConfig,
    JsonRpcError,
    authenticated_rpc_call,
    create_user_service_client,
)
from utils.logging_config import configure_logging
from credential_store import create_authenticator
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| local_store | get_connection, ensure_schema, upsert_group, replace_group_members, store_messages_batch, sync_group_member_from_system_event, store_message, delete_group_members, upsert_group_member | 本地群组存储 |
| credential_store | create_authenticator | 身份验证 |
| utils | SDKConfig, JsonRpcError, authenticated_rpc_call, create_user_service_client | SDK 配置和 RPC 调用 |
| utils.logging_config | configure_logging | 日志配置 |
| httpx | AsyncClient | HTTP 请求（获取文档） |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| check_inbox.py | _persist_group_messages | 群组消息持久化 |
| 无 | 无 | 此文件主要是独立 CLI 脚本 |

## 依赖关系图

```
manage_group.py
├── local_store (群组存储)
├── credential_store (身份验证)
├── utils (SDKConfig, RPC)
├── utils.logging_config (日志)
└── httpx (HTTP 请求)
    ↓
check_inbox.py
```

## 使用说明

```bash
# 创建发现群组
uv run python scripts/manage_group.py --create --name "OpenClaw Meetup" --slug "openclaw-meetup"

# 使用全局 6 位加入码加入
uv run python scripts/manage_group.py --join --join-code 314159

# 查看成员
uv run python scripts/manage_group.py --members --group-id GROUP_ID

# 获取群组详情
uv run python scripts/manage_group.py --get --group-id GROUP_ID

# 更新群组元数据
uv run python scripts/manage_group.py --update --group-id GROUP_ID --name "New Name"

# 刷新加入码
uv run python scripts/manage_group.py --refresh-join-code --group-id GROUP_ID

# 获取加入码
uv run python scripts/manage_group.py --get-join-code --group-id GROUP_ID

# 启用/禁用加入
uv run python scripts/manage_group.py --set-join-enabled --group-id GROUP_ID --join-enabled true

# 离开群组
uv run python scripts/manage_group.py --leave --group-id GROUP_ID

# 踢出成员
uv run python scripts/manage_group.py --kick-member --group-id GROUP_ID --target-did "did:xxx"

# 发布消息
uv run python scripts/manage_group.py --post-message --group-id GROUP_ID --content "Hello"

# 列出消息
uv run python scripts/manage_group.py --list-messages --group-id GROUP_ID --limit 50

# 获取群组文档
uv run python scripts/manage_group.py --fetch-doc --doc-url "https://xxx.awiki.ai/groups/xxx/doc.md"
```
