# test_check_status_inbox.py 分析报告

## 文件概述
check_status 收件箱呈现和自动 E2EE 传递的测试。为统一状态 CLI 中的用户可见收件箱报告提供单元测试。

## 测试类

### `_DummyAsyncClient`
用于模拟 RPC 调用的最小异步上下文管理器。

### `_FakeE2eeClient`
用于收件箱处理测试的小型 E2EE 客户端存根。

## 测试函数

### `test_summarize_inbox_hides_protocol_messages_from_user_output(monkeypatch)`
测试摘要模式应该保持协议消息对用户输出隐藏。

### `test_check_identity_bootstraps_missing_jwt_via_did_auth(monkeypatch)`
测试当缺失 JWT 自动重新颁发时，身份状态应该保持 OK。

### `test_auto_e2ee_builds_plaintext_inbox_report(monkeypatch)`
测试自动 E2EE 模式应该呈现解密明文并标记已处理项为已读。

### `test_check_status_uses_auto_e2ee_inbox_report(monkeypatch)`
测试统一状态应该附加自动解密收件箱内容。

## 导入的模块

```python
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any

import pytest

import check_status
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| check_status | summarize_inbox, check_identity, _build_inbox_report_with_auto_e2ee, check_status, create_authenticator, create_molt_message_client, authenticated_rpc_call, load_identity, load_e2ee_state | 被测试函数 |
| pytest | monkeypatch | 依赖注入和模拟 |
| asyncio | run | 运行异步测试 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_check_status_inbox.py
├── check_status (被测试)
├── pytest (测试框架)
└── asyncio (异步运行)
```

## 测试覆盖

| 函数 | 测试场景 |
|------|---------|
| summarize_inbox | 协议消息隐藏 |
| check_identity | JWT 引导缺失令牌 |
| _build_inbox_report_with_auto_e2ee | 明文收件箱报告 |
| check_status | 自动 E2EE 收件箱使用 |

## 运行测试

```bash
pytest tests/test_check_status_inbox.py -v
```
