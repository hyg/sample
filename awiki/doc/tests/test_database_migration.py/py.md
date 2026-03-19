# test_database_migration.py 分析报告

## 文件概述
database_migration 就绪状态自修复的测试。为数据库迁移助手提供 pytest 断言。

## 常量

### `_REPAIRED_INDEXES`
要测试的修复索引集合。

## 辅助函数

### `_index_names(conn: sqlite3.Connection) -> set[str]`
返回非内部 SQLite 索引名称。

## 夹具

### `prepared_ready_database(tmp_path: Path, monkeypatch) -> Path`
创建带有删除索引的就绪数据库。

## 测试函数

### `test_ensure_local_database_ready_repairs_ready_database(prepared_ready_database)`
测试就绪状态检查在返回之前修复缺失索引。

### `test_migrate_local_database_repairs_ready_database_without_backup(prepared_ready_database)`
测试独立迁移助手自修复就绪数据库。

### `test_migrate_local_database_treats_outdated_v6_database_as_legacy(tmp_path, monkeypatch)`
测试过时模式触发备份 + 迁移而非就绪状态修复。

## 导入的模块

```python
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pytest

import database_migration
import local_store
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| database_migration | ensure_local_database_ready, migrate_local_database, detect_local_database_layout | 被测试函数 |
| local_store | get_connection, ensure_schema, _SCHEMA_VERSION | 模式管理 |
| pytest | monkeypatch, fixture | 测试框架 |
| sqlite3 | connect | 数据库操作 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_database_migration.py
├── database_migration (被测试)
├── local_store (模式管理)
├── pytest (测试框架)
└── sqlite3 (数据库操作)
```

## 测试覆盖

| 函数 | 测试场景 |
|------|---------|
| ensure_local_database_ready | 就绪数据库修复 |
| migrate_local_database | 自修复就绪数据库，过时模式迁移 |
| detect_local_database_layout | 遗留模式检测 |

## 运行测试

```bash
pytest tests/test_database_migration.py -v
```
