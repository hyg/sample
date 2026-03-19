# credential_migration.py 分析报告

## 文件概述
遗留凭证迁移到索引凭证目录布局。提供遗留布局检测、迁移执行和存储就绪检查功能。

## 函数签名

### 内部辅助函数

#### `_read_json(path: Path) -> dict[str, Any]`
从路径加载 JSON 内容。

#### `_backup_legacy_files(credential_name: str, run_id: str) -> Path`
将遗留文件移动到时戳备份目录。

#### `_migrate_single_credential(credential_name: str, run_id: str) -> dict[str, Any]`
将一个遗留凭证迁移到新布局。

### 主要函数

#### `detect_legacy_layout() -> dict[str, Any]`
检查遗留凭证文件是否仍然存在。
- **返回值**: 包含状态、遗留凭证列表、唯一 DID 等信息的字典

#### `migrate_legacy_credentials(credential_name: str | None = None) -> dict[str, Any]`
将遗留平面文件凭证迁移到新的索引布局。
- **参数**: 
  - `credential_name`: 可选的特定凭证名称
- **返回值**: 迁移结果摘要

#### `ensure_credential_storage_ready(credential_name: str | None = None) -> dict[str, Any]`
确保证券存储布局已准备好运行时使用。
- **返回值**: 包含状态、布局类型、就绪状态和迁移信息的字典

## 导入的模块

```python
from __future__ import annotations

import json
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from credential_layout import (
    get_index_entry,
    has_legacy_layout,
    legacy_auth_export_paths,
    legacy_backup_root,
    legacy_e2ee_state_path,
    legacy_identity_path,
    resolve_credential_paths,
    scan_legacy_layout,
)
from credential_store import save_identity
from e2ee_store import save_e2ee_state
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| credential_layout | get_index_entry, has_legacy_layout, legacy_* 路径，resolve_credential_paths, scan_legacy_layout | 凭证布局检测和路径解析 |
| credential_store | save_identity | 保存迁移后的身份 |
| e2ee_store | save_e2ee_state | 保存 E2EE 状态 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| check_status.py | ensure_credential_storage_ready | 本地升级检查 |
| migrate_credentials.py | migrate_legacy_credentials | 独立迁移 CLI |

## 依赖关系图

```
credential_migration.py
├── credential_layout (布局检测)
├── credential_store (身份保存)
└── e2ee_store (E2EE 状态保存)
    ↓
check_status.py
migrate_credentials.py
```

## 导出接口

```python
__all__ = [
    "detect_legacy_layout",
    "ensure_credential_storage_ready",
    "migrate_legacy_credentials",
]
```

## 使用说明

```bash
# 检测遗留布局
python -c "from credential_migration import detect_legacy_layout; print(detect_legacy_layout())"

# 迁移所有遗留凭证
python scripts/migrate_credentials.py

# 迁移特定凭证
python scripts/migrate_credentials.py --credential default

# 检查存储就绪状态
python -c "from credential_migration import ensure_credential_storage_ready; print(ensure_credential_storage_ready())"
```
