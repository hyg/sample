# migrate_credentials.py 分析报告

## 文件概述
将遗留平面文件凭证迁移到索引目录布局。用于升级本地凭证存储的独立迁移 CLI。

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

from credential_migration import migrate_legacy_credentials
from utils.logging_config import configure_logging
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| credential_migration | migrate_legacy_credentials | 执行凭证迁移 |
| utils.logging_config | configure_logging | 日志配置 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
migrate_credentials.py
├── credential_migration (迁移逻辑)
└── utils.logging_config (日志)
```

## 使用说明

```bash
# 迁移所有遗留凭证
uv run python scripts/migrate_credentials.py

# 迁移特定凭证
uv run python scripts/migrate_credentials.py --credential default
```

## CLI 参数

| 参数 | 说明 |
|------|------|
| `--credential` | 仅迁移特定凭证名称 |

## 输出示例

```json
{
  "status": "migrated",
  "legacy_credentials": ["default"],
  "unique_dids": ["did:wba:awiki.ai:user:xxx"],
  "unique_did_count": 1,
  "migrated": [
    {
      "credential_name": "default",
      "did": "did:wba:awiki.ai:user:xxx",
      "dir_name": "xxx",
      "backup_dir": "/path/to/backup"
    }
  ],
  "skipped": [],
  "conflicts": [],
  "errors": []
}
```
