# test_local_store.py 分析报告

## 文件概述
local_store 模块的单元测试。测试 SQLite 本地存储的各种功能，包括模式创建、消息存储、联系人管理、群组操作和 E2EE 发件箱。

## 常量

### `EXPECTED_SCHEMA_INDEXES`
预期模式索引集合。

## 辅助函数

### `_schema_object_names(conn, object_type) -> set[str]`
返回命名片段对象用于断言。

## 夹具

### `db(tmp_path, monkeypatch)`
为测试创建临时 SQLite 数据库。

## 测试类

### `TestSchema`
模式创建和版本控制。

#### 测试方法
- `test_tables_created`: 测试所有表已创建
- `test_views_created`: 测试所有视图已创建
- `test_expected_indexes_created`: 测试预期索引已创建
- `test_schema_version`: 测试模式版本为 9
- `test_ensure_schema_idempotent`: 测试 ensure_schema 幂等性
- `test_wal_mode`: 测试 WAL 模式
- `test_credential_name_column_exists`: 测试 credential_name 列存在
- `test_database_path`: 测试数据库路径
- `test_ensure_schema_repairs_missing_indexes_on_v6_database`: 测试修复缺失索引

### `TestThreadId`
线程 ID 生成。

#### 测试方法
- `test_dm_sorted`: 测试 DM 线程 ID 排序
- `test_group`: 测试群组线程 ID

### `TestStoreMessage`
单条消息存储。

#### 测试方法
- `test_store_and_retrieve`: 测试存储和检索
- `test_dedup_scoped_by_owner_did`: 测试按 owner_did 去重
- `test_get_message_by_id_uses_owner_did`: 测试按 ID 查找使用 owner_did

### `TestStoreMessagesBatch`
批量消息存储。

#### 测试方法
- `test_batch_with_default_owner`: 测试带默认所有者的批量
- `test_batch_per_message_owner_override`: 测试每条消息所有者覆盖

### `TestUpsertContact`
联系人插入/更新与所有者隔离。

#### 测试方法
- `test_insert_new_contact`: 测试插入新联系人
- `test_contact_sedimentation_fields_are_persisted`: 测试联系人沉淀字段持久化
- `test_same_contact_can_exist_for_multiple_owners`: 测试同一联系人可存在于多个所有者
- `test_rebind_owner_did_moves_contacts`: 测试 rebind_owner_did 移动联系人

### `TestRelationshipEvents`
关系事件持久化。

#### 测试方法
- `test_append_relationship_event`: 测试追加关系事件

### `TestGroups`
本地群组状态持久化。

#### 测试方法
- `test_upsert_group_persists_owner_and_join_code`: 测试 upsert_group 持久化所有者和加入码
- `test_replace_group_members_replaces_snapshot`: 测试 replace_group_members 替换快照
- `test_delete_group_members_by_target_did`: 测试按 target_did 删除群组成员
- `test_sync_group_member_from_system_event_updates_status`: 测试从系统事件同步群组成员

### `TestE2eeOutbox`
E2EE 发件箱持久化和重试状态跟踪。

#### 测试方法
- `test_queue_and_fetch_outbox_record`: 测试队列和获取发件箱记录
- `test_mark_outbox_failed_uses_owner_did`: 测试标记发件箱失败使用 owner_did
- `test_clear_owner_e2ee_data_removes_outbox_records`: 测试清除所有者 E2EE 数据移除发件箱记录

### `TestViews`
带 owner_did 分组的视图正确性。

#### 测试方法
- `test_threads_view_groups_by_owner_did`: 测试 threads 视图按 owner_did 分组
- `test_inbox_and_outbox_views_include_owner_did`: 测试 inbox 和 outbox 视图包含 owner_did

### `TestExecuteSql`
SQL 安全检查。

#### 测试方法
- `test_select`: 测试 SELECT 查询
- `test_reject_drop`: 测试拒绝 DROP
- `test_allow_delete_with_where`: 测试允许带 WHERE 的 DELETE

## 导入的模块

```python
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

import pytest

import local_store
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| local_store | 所有公共函数 | 被测试函数 |
| pytest | fixture, mark | 测试框架 |
| sqlite3 | connect | 数据库操作 |
| json | dumps, loads | JSON 处理 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_local_store.py
├── local_store (被测试)
├── pytest (测试框架)
├── sqlite3 (数据库操作)
└── json (JSON 处理)
```

## 测试覆盖

| 功能 | 测试场景 |
|------|---------|
| 模式 | 表、视图、索引、版本、WAL 模式 |
| 线程 ID | DM 和群组生成 |
| 消息存储 | 单条、批量、去重、查找 |
| 联系人 | 插入、更新、沉淀字段、所有者隔离 |
| 关系事件 | 追加事件 |
| 群组 | upsert、成员替换、删除、同步 |
| E2EE 发件箱 | 队列、失败标记、清除 |
| 视图 | threads、inbox、outbox |
| SQL 安全 | SELECT 允许、DROP 拒绝、DELETE 限制 |

## 运行测试

```bash
pytest tests/test_local_store.py -v
```
