# test_recover_handle_cli.py 分析报告

## 文件概述
recover_handle CLI 安全行为的单元测试。测试恢复 CLI 的凭证别名选择、覆盖保护和缓存迁移行为。

## 测试类

### `_AsyncClientContext`
用于 CLI 测试的最小异步客户端上下文管理器。

## 辅助函数

### `_make_identity(did, *, user_id) -> DIDIdentity`
为 CLI 测试创建最小 DID 身份。

## 测试函数

### `test_resolve_recovery_target_auto_selects_non_destructive_alias(monkeypatch)`
测试自动恢复别名应跳过已占用的凭证名称。

验证逻辑：
- "alice" 已存在
- "alice_recovered" 已存在
- 应返回 "alice_recovered_2"

### `test_resolve_recovery_target_rejects_implicit_overwrite(monkeypatch)`
测试显式凭证目标不应默认覆盖现有数据。

验证抛出 ValueError 包含 "already exists for DID"。

### `test_do_recover_preserves_existing_default_when_no_credential_is_requested(monkeypatch)`
测试不带 --credential 的恢复应保存到新别名并保持 default 完整。

验证：
- save_identity 使用 name="alice"
- replace_existing=False
- 不调用 backup_identity
- 不调用 _migrate_local_cache

### `test_do_recover_replaces_existing_credential_only_when_requested(monkeypatch)`
测试有意替换应备份并迁移选定的凭证。

验证：
- save_identity 使用 name="default", replace_existing=True
- 调用 backup_identity
- 调用 _migrate_local_cache
- 调用 prune_unreferenced_credential_dir

## 导入的模块

```python
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

import recover_handle as recover_cli
from utils.identity import DIDIdentity
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| recover_handle | _resolve_recovery_target, do_recover, load_identity, save_identity, backup_identity, _migrate_local_cache, prune_unreferenced_credential_dir, create_user_service_client, recover_handle | 被测试函数 |
| utils.identity | DIDIdentity | 身份构建 |
| pytest | monkeypatch, fail | 依赖注入和失败断言 |
| asyncio | run | 异步运行 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_recover_handle_cli.py
├── recover_handle (被测试)
├── utils.identity (DIDIdentity)
├── pytest (测试框架)
└── asyncio (异步运行)
```

## 测试覆盖

| 功能 | 测试场景 |
|------|---------|
| 别名选择 | 自动非破坏性别名 |
| 覆盖保护 | 拒绝隐式覆盖 |
| 无凭证请求 | 保存到新别名 |
| 显式替换 | 备份和迁移 |

## 运行测试

```bash
pytest tests/test_recover_handle_cli.py -v
```
