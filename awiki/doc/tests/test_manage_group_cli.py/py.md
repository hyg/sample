# test_manage_group_cli.py 分析报告

## 文件概述
发现群组 CLI 行为的单元测试。为加入参数处理、JSON-RPC 渲染和 fetch-doc 回退提供回归覆盖。发现群组 CLI 单元测试。

## 测试类

### `TestManageGroupCli`
测试发现群组 CLI 解析和错误处理。

#### 测试方法

##### `test_join_rejects_group_id_with_guidance(monkeypatch, capsys)`
测试 join 拒绝带指导的 group_id。

验证错误消息包含 "can only be joined with the global 6-digit join-code"。

##### `test_create_dispatches_with_group_name_alias(monkeypatch)`
测试 create 带 group_name 别名分派。

验证 --group-name 参数正确传递给 create_group。

##### `test_join_dispatches_with_join_code_only(monkeypatch)`
测试 join 仅带 join_code 分派。

验证 --join-code 参数正确传递。

##### `test_join_accepts_legacy_passcode_alias(monkeypatch)`
测试 join 接受遗留 passcode 别名。

验证 --passcode 作为 --join-code 的别名工作。

##### `test_jsonrpc_error_is_rendered_as_json(monkeypatch, capsys)`
测试 JSON-RPC 错误渲染为 JSON。

验证错误输出包含 "error_type": "jsonrpc"。

##### `test_fetch_doc_retries_with_x_handle_after_connect_error(monkeypatch, capsys)`
测试 fetch_doc 在连接错误后用 X-Handle 重试。

验证：
- 第一次调用无头
- 第二次调用带 X-Handle 头
- 输出包含文档内容

##### `test_create_group_persists_local_snapshot(monkeypatch, tmp_path)`
测试 create_group 持久化本地快照。

验证群组数据写入本地数据库。

##### `test_post_message_persists_outgoing_local_message(monkeypatch, tmp_path)`
测试 post_message 持久化 outgoing 本地消息。

验证消息数据写入本地数据库。

##### `test_list_messages_backfills_local_history(monkeypatch, tmp_path)`
测试 list_messages 回填本地历史。

验证：
- 消息写入本地数据库
- 系统事件元数据正确
- 群组成员同步
- 群组状态更新

##### `test_list_members_replaces_local_member_snapshot(monkeypatch, tmp_path)`
测试 list_members 替换本地成员快照。

验证成员数据写入本地数据库。

## 导入的模块

```python
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import httpx
import pytest

import manage_group as manage_group_cli
import local_store
from utils.rpc import JsonRpcError
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| manage_group | configure_logging, create_group, join_group, get_group, fetch_doc, post_message, list_messages, get_group_members, _get_identity_data_or_exit, _authenticated_group_call | 被测试函数 |
| local_store | get_connection, execute_sql | 本地存储验证 |
| utils.rpc | JsonRpcError | 错误模拟 |
| httpx | ConnectError, Request, Response | HTTP 模拟 |
| pytest | monkeypatch, CaptureFixture | 依赖注入和输出捕获 |
| asyncio | run | 异步运行 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_manage_group_cli.py
├── manage_group (被测试)
├── local_store (验证)
├── utils.rpc (错误)
├── httpx (HTTP 模拟)
├── pytest (测试框架)
└── asyncio (异步运行)
```

## 测试覆盖

| 功能 | 测试场景 |
|------|---------|
| join 参数 | group_id 拒绝、join_code、passcode 别名 |
| create 分派 | group_name 别名 |
| 错误处理 | JSON-RPC 渲染 |
| fetch_doc | X-Handle 回退 |
| 本地持久化 | 群组创建、消息发布、历史回填、成员列表 |

## 运行测试

```bash
pytest tests/test_manage_group_cli.py -v
```
