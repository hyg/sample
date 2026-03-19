# credential_layout.py 分析报告

## 文件概述
凭证存储布局助手，支持多凭证索引目录布局。提供凭证路径解析、索引管理和遗留布局检测功能。

## 函数签名

### 数据类

#### `CredentialPaths`
解析后的单个凭证目录路径集合。
- **属性**:
  - `root_dir`: 凭证存储根目录
  - `dir_name`: 目录名称
  - `credential_dir`: 凭证目录
  - `identity_path`: identity.json 路径
  - `auth_path`: auth.json 路径
  - `did_document_path`: did_document.json 路径
  - `key1_private_path`: key-1-private.pem 路径
  - `key1_public_path`: key-1-public.pem 路径
  - `e2ee_signing_private_path`: e2ee-signing-private.pem 路径
  - `e2ee_agreement_private_path`: e2ee-agreement-private.pem 路径
  - `e2ee_state_path`: e2ee-state.json 路径

### 路径解析函数

#### `_get_credentials_root(config: SDKConfig | None = None) -> Path`
返回凭证存储根目录。

#### `ensure_credentials_root(config: SDKConfig | None = None) -> Path`
创建凭证存储根目录（带安全权限）。

#### `index_path(config: SDKConfig | None = None) -> Path`
返回凭证索引文件路径。

#### `legacy_backup_root(config: SDKConfig | None = None) -> Path`
返回遗留备份目录路径。

#### `build_credential_paths(dir_name: str, config: SDKConfig | None = None) -> CredentialPaths`
为凭证目录名称构建所有存储路径。

#### `resolve_credential_paths(credential_name: str, config: SDKConfig | None = None) -> CredentialPaths | None`
从顶层索引解析凭证路径。

#### `ensure_credential_directory(paths: CredentialPaths) -> Path`
创建凭证目录（带安全权限）。

### 索引管理函数

#### `_default_index() -> dict[str, Any]`
返回空的凭证索引负载。

#### `_normalize_index_payload(data: dict[str, Any]) -> dict[str, Any]`
将旧索引负载规范化为当前模式形状。

#### `load_index(config: SDKConfig | None = None) -> dict[str, Any]`
加载凭证索引，或返回空的默认索引。

#### `save_index(index: dict[str, Any], config: SDKConfig | None = None) -> Path`
持久化凭证索引（带安全权限）。

#### `get_index_entry(credential_name: str, config: SDKConfig | None = None) -> dict[str, Any] | None`
返回凭证名称的索引条目。

#### `set_index_entry(credential_name: str, entry: dict[str, Any], config: SDKConfig | None = None) -> Path`
上插凭证索引条目。

#### `remove_index_entry(credential_name: str, config: SDKConfig | None = None) -> bool`
移除凭证索引条目。

### 文件操作函数

#### `write_secure_text(path: Path, content: str) -> None`
写入文本文件（600 权限）。

#### `write_secure_json(path: Path, payload: dict[str, Any]) -> None`
写入 JSON（600 权限）。

#### `write_secure_bytes(path: Path, content: bytes) -> None`
写入二进制文件（600 权限）。

### 遗留布局函数

#### `legacy_identity_path(credential_name: str, config: SDKConfig | None = None) -> Path`
返回遗留凭证 JSON 路径。

#### `legacy_e2ee_state_path(credential_name: str, config: SDKConfig | None = None) -> Path`
返回遗留 E2EE 状态 JSON 路径。

#### `legacy_auth_export_paths(credential_name: str, config: SDKConfig | None = None) -> tuple[Path, Path]`
返回遗留提取的 DID 文档/私钥路径。

#### `_is_legacy_identity_payload(payload: Any) -> bool`
返回 JSON 负载是否匹配遗留凭证形状。

#### `scan_legacy_layout(config: SDKConfig | None = None) -> dict[str, Any]`
扫描根凭证目录中的遗留平面文件工件。

#### `list_legacy_credential_names(config: SDKConfig | None = None) -> list[str]`
列出仍使用平面文件布局的验证遗留凭证名称。

#### `has_legacy_layout(config: SDKConfig | None = None) -> bool`
返回是否存在任何遗留平面文件工件。

#### `legacy_layout_hint() -> str`
返回标准遗留布局迁移提示。

### 名称处理函数

#### `sanitize_credential_dir_name(raw_value: str) -> str`
将首选目录标签转换为安全的文件系统名称。

#### `preferred_credential_dir_name(*, handle: str | None, unique_id: str) -> str`
选择首选凭证目录名称。

## 导入的模块

```python
from __future__ import annotations

import json
import logging
import os
import re
import stat
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from utils.config import SDKConfig
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils.config | SDKConfig | SDK 配置 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| credential_store.py | 导入所有路径助手 | 凭证存储路径解析 |
| credential_migration.py | scan_legacy_layout, legacy_* 路径 | 遗留凭证迁移 |
| e2ee_store.py | resolve_credential_paths, write_secure_json | E2EE 状态持久化 |

## 依赖关系图

```
credential_layout.py
└── utils.config (SDKConfig)
    ↓
credential_store.py
credential_migration.py
e2ee_store.py
```

## 常量定义

```python
INDEX_SCHEMA_VERSION = 3
INDEX_FILE_NAME = "index.json"
LEGACY_BACKUP_DIR_NAME = ".legacy-backup"
IDENTITY_FILE_NAME = "identity.json"
AUTH_FILE_NAME = "auth.json"
DID_DOCUMENT_FILE_NAME = "did_document.json"
KEY1_PRIVATE_FILE_NAME = "key-1-private.pem"
KEY1_PUBLIC_FILE_NAME = "key-1-public.pem"
E2EE_SIGNING_PRIVATE_FILE_NAME = "e2ee-signing-private.pem"
E2EE_AGREEMENT_PRIVATE_FILE_NAME = "e2ee-agreement-private.pem"
E2EE_STATE_FILE_NAME = "e2ee-state.json"
```

## 导出接口

```python
__all__ = [
    "AUTH_FILE_NAME",
    "CredentialPaths",
    "DID_DOCUMENT_FILE_NAME",
    "E2EE_AGREEMENT_PRIVATE_FILE_NAME",
    "E2EE_SIGNING_PRIVATE_FILE_NAME",
    "E2EE_STATE_FILE_NAME",
    "IDENTITY_FILE_NAME",
    "INDEX_FILE_NAME",
    "INDEX_SCHEMA_VERSION",
    "KEY1_PRIVATE_FILE_NAME",
    "KEY1_PUBLIC_FILE_NAME",
    "build_credential_paths",
    "ensure_credential_directory",
    "ensure_credentials_root",
    "get_index_entry",
    "has_legacy_layout",
    "index_path",
    "legacy_auth_export_paths",
    "legacy_backup_root",
    "legacy_e2ee_state_path",
    "legacy_identity_path",
    "legacy_layout_hint",
    "list_legacy_credential_names",
    "load_index",
    "preferred_credential_dir_name",
    "remove_index_entry",
    "resolve_credential_paths",
    "sanitize_credential_dir_name",
    "scan_legacy_layout",
    "save_index",
    "set_index_entry",
    "write_secure_bytes",
    "write_secure_json",
    "write_secure_text",
]
```
