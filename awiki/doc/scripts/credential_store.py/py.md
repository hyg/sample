# credential_store.py 分析报告

## 文件概述
凭证持久化：索引多凭证存储，带凭证目录。支持跨会话身份重用、索引多凭证存储和 DIDWbaAuthHeader 工厂。

## 函数签名

### 内部辅助函数

#### `_coerce_text(value: bytes | str) -> str`
将 bytes/str 内容规范化为 UTF-8 字符串。

#### `_read_json_if_exists(path: Path) -> dict[str, Any] | None`
当路径存在时读取 JSON 内容。

#### `_read_text_if_exists(path: Path) -> str | None`
当路径存在时读取文本内容。

#### `_build_index_entry(credential_name: str, *, dir_name: str, did: str, unique_id: str, user_id: str | None, display_name: str | None, handle: str | None, created_at: str) -> dict[str, Any]`
构建规范化的凭证索引条目。

#### `_validate_target_directory(credential_name: str, *, dir_name: str, did: str) -> None`
确保目标目录名称未被其他凭证使用。

#### `_credential_reference_count(dir_name: str) -> int`
计算有多少凭证名称引用同一目录。

### 主要函数

#### `list_identities_by_name() -> dict[str, dict[str, Any]]`
返回原始凭证索引映射。

#### `save_identity(did: str, unique_id: str, user_id: str | None, private_key_pem: bytes, public_key_pem: bytes, jwt_token: str | None = None, display_name: str | None = None, handle: str | None = None, name: str = "default", did_document: dict[str, Any] | None = None, e2ee_signing_private_pem: bytes | None = None, e2ee_agreement_private_pem: bytes | None = None, replace_existing: bool = False) -> Path`
将 DID 身份保存到索引多凭证布局。

#### `load_identity(name: str = "default") -> dict[str, Any] | None`
从索引多凭证布局加载 DID 身份。

#### `list_identities() -> list[dict[str, Any]]`
从凭证索引列出所有保存的身份。

#### `delete_identity(name: str) -> bool`
删除保存的身份及其凭证目录。

#### `backup_identity(name: str) -> Path | None`
在破坏性更改之前备份当前凭证目录。

#### `update_jwt(name: str, jwt_token: str) -> bool`
更新保存身份的 JWT 令牌。

#### `extract_auth_files(name: str = "default") -> tuple[Path, Path] | None`
返回凭证 DID 文档和 key-1 私钥路径用于身份验证。

#### `create_authenticator(name: str = "default", config: Any = None) -> tuple[Any, dict[str, Any]] | None`
从保存的凭证创建 DIDWbaAuthHeader 实例。

#### `prune_unreferenced_credential_dir(dir_name: str) -> bool`
当目录不再被索引引用时删除凭证目录。

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
    legacy_layout_hint,
    list_legacy_credential_names,
    preferred_credential_dir_name,
    remove_index_entry,
    resolve_credential_paths,
    set_index_entry,
    write_secure_json,
    write_secure_text,
    ensure_credential_directory,
    build_credential_paths,
)
from utils.config import SDKConfig
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| credential_layout | 所有路径和索引管理函数 | 凭证路径解析和索引管理 |
| utils.config | SDKConfig | SDK 配置 |
| anp.authentication | DIDWbaAuthHeader | 创建身份验证头 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| check_inbox.py | create_authenticator, load_identity | 身份验证 |
| check_status.py | load_identity, create_authenticator | 身份验证 |
| credential_migration.py | save_identity | 保存迁移后的身份 |
| e2ee_handler.py | load_identity | 加载 E2EE 密钥 |
| e2ee_messaging.py | create_authenticator, load_identity | 身份验证 |
| e2ee_outbox.py | load_identity | 加载所有者 DID |
| get_profile.py | create_authenticator | 身份验证 |
| manage_contacts.py | create_authenticator | 身份验证 |
| manage_content.py | create_authenticator | 身份验证 |
| manage_credits.py | create_authenticator | 身份验证 |
| manage_group.py | create_authenticator | 身份验证 |
| manage_relationship.py | create_authenticator | 身份验证 |
| recover_handle.py | backup_identity, load_identity, save_identity, prune_unreferenced_credential_dir | 凭证恢复 |
| regenerate_e2ee_keys.py | load_identity, save_identity | E2EE 密钥再生 |
| register_handle.py | save_identity | 保存注册的身份 |
| search_users.py | create_authenticator | 身份验证 |
| send_message.py | create_authenticator | 身份验证 |
| setup_identity.py | save_identity, load_identity, list_identities, delete_identity, update_jwt, create_authenticator | 身份管理 |
| update_profile.py | create_authenticator | 身份验证 |
| ws_listener.py | create_authenticator, load_identity, update_jwt | 身份验证和 JWT 刷新 |

## 依赖关系图

```
credential_store.py
├── credential_layout (路径和索引)
├── utils.config (SDKConfig)
└── anp.authentication (DIDWbaAuthHeader)
    ↓
几乎所有 scripts 文件 (身份验证)
```

## 导出接口

```python
__all__ = [
    "backup_identity",
    "create_authenticator",
    "delete_identity",
    "extract_auth_files",
    "list_identities",
    "load_identity",
    "prune_unreferenced_credential_dir",
    "save_identity",
    "update_jwt",
]
```
