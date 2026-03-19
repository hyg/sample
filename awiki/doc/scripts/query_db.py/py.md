# query_db.py 分析报告

## 文件概述
对本地 SQLite 数据库的只读 SQL 查询 CLI。用于临时本地数据库查询的 CLI 入口点。

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
import sys

import local_store
from utils.logging_config import configure_logging
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| local_store | get_connection, ensure_schema, execute_sql | SQLite 连接和查询执行 |
| utils.logging_config | configure_logging | 日志配置 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
query_db.py
├── local_store (SQLite 操作)
└── utils.logging_config (日志)
```

## 使用说明

```bash
# 查询线程
python scripts/query_db.py "SELECT * FROM threads LIMIT 10"

# 查询特定凭证的消息
python scripts/query_db.py "SELECT * FROM messages WHERE credential_name='alice' LIMIT 10"

# 查询群组
python scripts/query_db.py "SELECT * FROM groups ORDER BY last_message_at DESC LIMIT 10"

# 查询群组成员
python scripts/query_db.py "SELECT * FROM group_members WHERE group_id='grp_xxx' LIMIT 20"

# 查询关系事件
python scripts/query_db.py "SELECT * FROM relationship_events WHERE status='pending' ORDER BY created_at DESC LIMIT 20"
```

## CLI 参数

| 参数 | 说明 |
|------|------|
| `sql` | 要执行的 SQL 语句 |
| `--credential` | 遗留选项；建议在 SQL 中使用显式 owner_did/credential_name 过滤器 |

## 安全限制

- 禁止 DROP 语句
- 禁止 TRUNCATE 语句
- 禁止不带 WHERE 的 DELETE 语句
