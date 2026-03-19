# test_contact_sedimentation_cli.py 分析报告

## 文件概述
本地联系人沉淀工作流的测试。为联系人快照和关系事件持久化提供回归覆盖。CLI 级别的本地关系沉淀测试。

## 测试类

### `_AsyncClientContext`
用于模拟客户端的简单异步上下文管理器。

### `TestManageContactsCli`
manage_contacts 持久化行为测试。

#### 测试方法

##### `test_record_recommendation_writes_event(monkeypatch, temp_local_db)`
测试 record_recommendation 写入关系事件。

##### `test_save_from_group_writes_contact_snapshot(monkeypatch, temp_local_db)`
测试 save_from_group 写入联系人快照。

### `TestSocialPersistence`
现有社交动作应该更新本地沉淀。

#### 测试方法

##### `test_follow_updates_contact_and_event(monkeypatch, temp_local_db)`
测试 follow 更新联系人和事件。

##### `test_send_message_marks_contact_as_messaged(monkeypatch, temp_local_db)`
测试 send_message 标记联系人为已发消息。

## 导入的模块

```python
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

import local_store
import manage_contacts as manage_contacts_cli
import manage_relationship as manage_relationship_cli
import send_message as send_message_cli
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| local_store | get_connection, ensure_schema, execute_sql | 本地存储和验证 |
| manage_contacts | _identity_or_exit, _build_parser, record_recommendation, save_from_group | 被测试函数 |
| manage_relationship | create_authenticator, create_user_service_client, authenticated_rpc_call, follow | 被测试函数 |
| send_message | resolve_to_did, create_authenticator, create_molt_message_client, authenticated_rpc_call, send_message | 被测试函数 |
| pytest | monkeypatch, fixture | 依赖注入和测试夹具 |
| asyncio | run | 运行异步测试 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_contact_sedimentation_cli.py
├── local_store (测试数据验证)
├── manage_contacts (被测试)
├── manage_relationship (被测试)
├── send_message (被测试)
├── pytest (测试框架)
└── asyncio (异步运行)
```

## 测试覆盖

| 函数 | 测试场景 |
|------|---------|
| record_recommendation | 关系事件写入 |
| save_from_group | 联系人快照和事件写入 |
| follow | 联系人和事件更新 |
| send_message | 联系人标记为已发消息 |

## 夹具

| 夹具 | 说明 |
|------|------|
| temp_local_db | 提供临时本地 SQLite 数据库 |

## 运行测试

```bash
pytest tests/test_contact_sedimentation_cli.py -v
```
