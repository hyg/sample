# test_check_status_group_watch.py 分析报告

## 文件概述
check_status 中发现群组心跳摘要的测试。为 check_status.py 暴露的发现群组监视状态提供单元测试。

## 测试函数

### `test_summarize_group_watch_reports_active_group_metrics(monkeypatch, tmp_path)`
群组监视摘要应该暴露心跳相关的本地指标。

测试内容：
- 创建群组快照
- 添加群组成员
- 添加群组消息
- 添加关系事件
- 添加联系人
- 验证摘要输出

### `test_check_status_includes_group_watch_summary(monkeypatch)`
统一状态应该为心跳调用者附加群组监视数据。

测试内容：
- 模拟本地升级就绪
- 模拟身份检查
- 模拟收件箱报告
- 模拟群组监视摘要
- 模拟群组消息获取
- 验证状态报告包含群组监视数据

## 导入的模块

```python
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

import check_status
import local_store
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| check_status | summarize_group_watch, check_status, ensure_local_upgrade_ready, check_identity, _build_inbox_report_with_auto_e2ee, fetch_group_messages, load_e2ee_state | 被测试函数 |
| local_store | get_connection, ensure_schema, upsert_group, replace_group_members, store_message, append_relationship_event, upsert_contact, make_thread_id | 测试数据设置 |
| pytest | monkeypatch | 依赖注入和模拟 |
| asyncio | run | 运行异步测试 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_check_status_group_watch.py
├── check_status (被测试)
├── local_store (测试数据)
├── pytest (测试框架)
└── asyncio (异步运行)
```

## 测试覆盖

| 函数 | 测试场景 |
|------|---------|
| summarize_group_watch | 活跃群组指标报告 |
| check_status | 群组监视摘要包含 |

## 运行测试

```bash
pytest tests/test_check_status_group_watch.py -v
```
