# test_credential_store.py 分析报告

## 文件概述
索引凭证存储布局的单元测试。测试凭证存储、迁移和 E2EE 状态持久化的各种场景。

## 夹具

### `isolated_home(tmp_path, monkeypatch) -> Path`
在临时 HOME 下隔离凭证目录。

## 辅助函数

### `_credentials_root(home: Path) -> Path`
返回临时 HOME 的预期凭证根目录。

### `_save_sample_identity(...) -> Path`
保存最小 credential_store 身份用于测试。

### `_write_legacy_credential(root, *, credential_name, handle, did)`
写入遗留平面凭证和 E2EE 状态文件。

## 测试函数

### `test_save_identity_with_handle_uses_unique_id_directory_and_indexes_handle(isolated_home)`
测试带 handle 的身份保存使用 unique_id 目录并索引 handle。

### `test_save_identity_without_handle_uses_unique_id_directory(isolated_home)`
测试不带 handle 的身份保存使用 unique_id 目录。

### `test_default_alias_falls_back_to_configured_default_credential_name(isolated_home)`
测试默认别名回退到配置的默认凭证名称。

### `test_save_identity_rejects_overwrite_for_different_did(isolated_home)`
测试保存身份拒绝为不同 DID 覆盖。

### `test_save_identity_allows_replace_existing_when_requested(isolated_home)`
测试恢复流程可以在请求时替换现有凭证。

### `test_backup_identity_copies_current_credential_directory(isolated_home)`
测试备份身份复制当前凭证目录。

### `test_e2ee_state_is_stored_inside_credential_directory(isolated_home)`
测试 E2EE 状态存储在凭证目录内。

### `test_migrate_legacy_credentials_creates_new_layout_and_backup(isolated_home)`
测试迁移遗留凭证创建新布局和备份。

### `test_detect_legacy_layout_reports_legacy_files(isolated_home)`
测试检测遗留布局报告遗留文件。

### `test_detect_legacy_layout_uses_payload_validation(isolated_home)`
测试检测遗留布局使用负载验证。

### `test_detect_legacy_layout_reports_unique_dids_not_credential_count(isolated_home)`
测试检测遗留布局报告唯一 DID 而非凭证数量。

### `test_migrate_legacy_credentials_does_not_treat_orphan_files_as_users(isolated_home)`
测试迁移遗留凭证不将孤立文件视为用户。

### `test_list_identities_reads_from_index(isolated_home)`
测试列出身份从索引读取。

### `test_multiple_credential_names_can_reference_same_unique_id_directory(isolated_home)`
测试多个凭证名称可以引用同一 unique_id 目录。

### `test_delete_identity_keeps_shared_directory_until_last_reference(isolated_home)`
测试删除身份保留共享目录直到最后一个引用。

## 导入的模块

```python
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

import credential_layout
import credential_migration
import credential_store
import e2ee_store
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| credential_layout | load_index, save_index, get_index_entry | 索引管理 |
| credential_migration | migrate_legacy_credentials, detect_legacy_layout | 凭证迁移 |
| credential_store | save_identity, load_identity, list_identities, delete_identity, backup_identity | 凭证存储 |
| e2ee_store | save_e2ee_state, load_e2ee_state | E2EE 状态 |
| pytest | monkeypatch, fixture | 测试框架 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_credential_store.py
├── credential_layout (索引管理)
├── credential_migration (迁移)
├── credential_store (被测试)
├── e2ee_store (E2EE 状态)
└── pytest (测试框架)
```

## 测试覆盖

| 功能 | 测试场景 |
|------|---------|
| save_identity | 带/不带 handle, 拒绝覆盖，允许替换 |
| load_identity | 从索引加载 |
| delete_identity | 共享目录处理 |
| backup_identity | 目录备份 |
| E2EE 状态 | 目录内存储 |
| 迁移 | 遗留凭证迁移和备份 |
| 检测 | 遗留布局检测和验证 |

## 运行测试

```bash
pytest tests/test_credential_store.py -v
```
