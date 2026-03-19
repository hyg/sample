# e2ee_store.py 分析报告

## 文件概述
E2EE 状态持久化，使用凭证目录。支持跨进程 HPKE E2EE 通信的 E2EE 会话状态持久化。

## 函数签名

### 内部辅助函数

#### `_e2ee_state_path(credential_name: str) -> Path | None`
解析凭证的 E2EE 状态路径。

### 主要函数

#### `save_e2ee_state(state: dict[str, Any], credential_name: str = "default") -> Path`
将 E2EE 客户端状态保存到凭证目录。
- **参数**:
  - `state`: E2eeClient.export_state() 生成的字典
  - `credential_name`: 凭证名称
- **返回值**: 保存的路径

#### `load_e2ee_state(credential_name: str = "default") -> dict[str, Any] | None`
从凭证目录加载 E2EE 客户端状态。
- **返回值**: E2EE 状态字典或 None

#### `delete_e2ee_state(credential_name: str = "default") -> bool`
从凭证目录删除保存的 E2EE 状态文件。
- **返回值**: 是否成功删除

## 导入的模块

```python
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from credential_layout import (
    has_legacy_layout,
    legacy_layout_hint,
    resolve_credential_paths,
    write_secure_json,
)
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| credential_layout | has_legacy_layout, legacy_layout_hint, resolve_credential_paths, write_secure_json | 凭证路径解析和安全写入 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| check_inbox.py | load_e2ee_state, save_e2ee_state | E2EE 状态持久化 |
| check_status.py | load_e2ee_state, save_e2ee_state | E2EE 状态持久化 |
| credential_migration.py | save_e2ee_state | 迁移 E2EE 状态 |
| e2ee_handler.py | load_e2ee_state, save_e2ee_state | E2EE 状态持久化 |
| e2ee_messaging.py | save_e2ee_state, load_e2ee_state | E2EE 状态持久化 |
| recover_handle.py | delete_e2ee_state | 删除 E2EE 状态 |

## 依赖关系图

```
e2ee_store.py
└── credential_layout (路径解析)
    ↓
check_inbox.py
check_status.py
credential_migration.py
e2ee_handler.py
e2ee_messaging.py
recover_handle.py
```

## 导出接口

```python
__all__ = ["delete_e2ee_state", "load_e2ee_state", "save_e2ee_state"]
```

## 使用说明

```python
# 保存 E2EE 状态
from e2ee_store import save_e2ee_state
state = {"local_did": "did:alice", "sessions": [...]}
save_e2ee_state(state, "default")

# 加载 E2EE 状态
from e2ee_store import load_e2ee_state
state = load_e2ee_state("default")

# 删除 E2EE 状态
from e2ee_store import delete_e2ee_state
delete_e2ee_state("default")
```
