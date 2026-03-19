# database_migration.py 分析报告

## 文件概述
本地数据库迁移助手，用于 owner_did 感知的多身份存储。提供数据库布局检测、迁移执行和就绪检查功能。

## 函数签名

### 内部辅助函数

#### `_database_path(config: SDKConfig | None = None) -> Path`
返回本地 SQLite 数据库路径。

#### `_backup_root(config: SDKConfig | None = None) -> Path`
返回数据库迁移备份目录。

#### `_backup_database(config: SDKConfig | None = None) -> Path`
在迁移之前创建 SQLite 备份。

#### `_ensure_database_schema(*, db_path: str, status: str, backup_path: str | None) -> dict[str, Any]`
运行幂等模式修复并返回迁移摘要。

### 主要函数

#### `detect_local_database_layout(config: SDKConfig | None = None) -> dict[str, Any]`
检测本地数据库是否需要迁移。
- **返回值**: 包含状态、数据库路径、版本信息的字典

#### `migrate_local_database(config: SDKConfig | None = None) -> dict[str, Any]`
将本地 SQLite 数据库迁移到最新模式。
- **返回值**: 迁移结果摘要

#### `ensure_local_database_ready(config: SDKConfig | None = None) -> dict[str, Any]`
确保本地数据库已准备好多身份使用。
- **返回值**: 数据库就绪状态

## 导入的模块

```python
from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import local_store
from utils.config import SDKConfig
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| local_store | get_connection, ensure_schema, _SCHEMA_VERSION | SQLite 模式管理 |
| utils.config | SDKConfig | SDK 配置 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| check_status.py | ensure_local_database_ready | 本地升级检查 |
| migrate_local_database.py | migrate_local_database | 独立数据库迁移 CLI |

## 依赖关系图

```
database_migration.py
├── local_store (SQLite 模式)
└── utils.config (SDKConfig)
    ↓
check_status.py
migrate_local_database.py
```

## 导出接口

```python
__all__ = [
    "detect_local_database_layout",
    "ensure_local_database_ready",
    "migrate_local_database",
]
```

## 使用说明

```bash
# 检测数据库布局
python -c "from database_migration import detect_local_database_layout; print(detect_local_database_layout())"

# 迁移数据库
python scripts/migrate_local_database.py

# 检查数据库就绪状态
python -c "from database_migration import ensure_local_database_ready; print(ensure_local_database_ready())"
```
