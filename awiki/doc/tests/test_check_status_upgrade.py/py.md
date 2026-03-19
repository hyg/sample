# test_check_status_upgrade.py 分析报告

## 文件概述
check_status 本地升级编排的测试。为 check_status.py 暴露的本地技能升级流程提供单元测试。

## 测试函数

### `test_ensure_local_upgrade_ready_reports_performed_migrations(monkeypatch)`
测试升级助手应该总结凭证/数据库迁移工作。

测试内容：
- 模拟凭证存储就绪（已迁移）
- 模拟数据库就绪（已迁移）
- 验证执行列表包含 credential_layout 和 local_database

### `test_check_status_stops_when_upgrade_cannot_prepare_credentials(monkeypatch)`
测试当本地升级使凭证不可用时，统一状态应该提前返回。

测试内容：
- 模拟升级错误状态
- 验证身份状态返回 storage_migration_required
- 验证收件箱和群组监视状态返回 skipped

## 导入的模块

```python
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

import check_status
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| check_status | ensure_local_upgrade_ready, check_status | 被测试函数 |
| pytest | monkeypatch | 依赖注入和模拟 |
| asyncio | run | 运行异步测试 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_check_status_upgrade.py
├── check_status (被测试)
├── pytest (测试框架)
└── asyncio (异步运行)
```

## 测试覆盖

| 函数 | 测试场景 |
|------|---------|
| ensure_local_upgrade_ready | 执行的迁移报告 |
| check_status | 升级失败时提前停止 |

## 运行测试

```bash
pytest tests/test_check_status_upgrade.py -v
```
