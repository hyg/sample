# test_check_inbox_cli.py 分析报告

## 文件概述
check_inbox CLI 路由和作用域过滤的单元测试。为统一直接/群组收件箱行为提供回归覆盖。

## 测试类

### `TestCheckInboxCli`
测试收件箱 CLI 解析和群组感知路由。

#### 测试方法

##### `test_filter_messages_by_scope_variants()`
测试按作用域过滤消息的变体（all/direct/group）。

##### `test_parse_group_history_target()`
测试解析群组历史记录目标。

##### `test_main_dispatches_group_history_from_group_id(monkeypatch)`
测试 main 从 group_id 参数分派 get_group_history。

##### `test_main_dispatches_group_history_from_history_prefix(monkeypatch)`
测试 main 从 history: 前缀分派 get_group_history。

##### `test_main_dispatches_inbox_with_scope(monkeypatch)`
测试 main 带作用域分派 check_inbox。

##### `test_main_rejects_since_seq_without_group_history(monkeypatch, capsys)`
测试 main 在没有群组历史时拒绝 since_seq。

##### `test_resolve_group_since_seq_prefers_explicit_argument(monkeypatch, tmp_path)`
测试 resolve_group_since_seq 优先使用显式参数。

##### `test_resolve_group_since_seq_reads_group_snapshot_first(monkeypatch, tmp_path)`
测试 resolve_group_since_seq 首先读取群组快照。

##### `test_resolve_group_since_seq_falls_back_to_message_cache(monkeypatch, tmp_path)`
测试 resolve_group_since_seq 回退到消息缓存。

##### `test_get_group_history_uses_resolved_local_cursor(monkeypatch)`
测试 get_group_history 使用解析的本地游标。

## 导入的模块

```python
from __future__ import annotations

import sys
from pathlib import Path

import pytest

import check_inbox as check_inbox_cli
import local_store
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| check_inbox | _filter_messages_by_scope, _parse_group_history_target, _resolve_group_since_seq, get_group_history, check_inbox, main | 被测试函数 |
| local_store | get_connection, ensure_schema, upsert_group, store_message | 测试数据设置 |
| pytest | monkeypatch, capsys | 依赖注入和输出捕获 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_check_inbox_cli.py
├── check_inbox (被测试)
├── local_store (测试数据)
└── pytest (测试框架)
```

## 测试覆盖

| 函数 | 测试场景 |
|------|---------|
| _filter_messages_by_scope | all/direct/group 作用域 |
| _parse_group_history_target | group: 前缀解析 |
| _resolve_group_since_seq | 显式参数/群组快照/消息缓存 |
| main | CLI 参数分派 |
| get_group_history | 本地游标使用 |

## 运行测试

```bash
pytest tests/test_check_inbox_cli.py -v
```
