# migrate_local_database.py 分析报告

## 文件概述
将本地 SQLite 数据库迁移到 owner_did 感知模式。用于本地数据库迁移的独立 CLI。

## 函数签名

### 主函数

#### `main() -> None`
CLI 入口点。

## 导入的模块

```python
from __future__ import annotations

import argparse
import json
import logging

from database_migration import migrate_local_database
from utils.logging_config import configure_logging
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| database_migration | migrate_local_database | 执行数据库迁移 |
| utils.logging_config | configure_logging | 日志配置 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
migrate_local_database.py
├── database_migration (迁移逻辑)
└── utils.logging_config (日志)
```

## 使用说明

```bash
# 迁移本地数据库
uv run python scripts/migrate_local_database.py
```

## 输出示例

```json
{
  "status": "migrated",
  "db_path": "/path/to/awiki.db",
  "before_version": 8,
  "after_version": 9,
  "backup_path": "/path/to/backup.db"
}
```
