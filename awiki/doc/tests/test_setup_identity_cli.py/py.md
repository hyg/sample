# test_setup_identity_cli.py 分析报告

## 文件概述
setup_identity CLI load 行为的单元测试。为自动 JWT 引导和遗留回退消息提供回归覆盖。身份加载和验证行为的 CLI 单元测试。

## 测试类

### `_DummyAsyncClient`
用于模拟 RPC 调用的最小异步上下文管理器。

## 测试函数

### `test_load_saved_identity_bootstraps_missing_jwt(monkeypatch, capsys)`
测试加载应在 JWT 缺失时自动颁发并持久化 JWT。

测试内容：
- 模拟凭证数据 jwt_token=None
- 模拟 authenticated_rpc_call 设置 jwt_token
- 运行 load_saved_identity
- 验证输出包含 "JWT bootstrap succeeded"
- 验证 credential_data["jwt_token"] 已更新

### `test_load_saved_identity_without_jwt_or_auth_files_requests_recreation(monkeypatch, capsys)`
测试不带 JWT 或 DID 认证文件的遗留凭证应请求重新创建。

测试内容：
- 模拟凭证数据 jwt_token=None
- 模拟 create_authenticator 返回 None
- 运行 load_saved_identity
- 验证输出包含 "No JWT token is saved and DID auth files are missing."
- 验证输出包含重新创建命令

## 导入的模块

```python
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any

import pytest

import setup_identity
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| setup_identity | load_saved_identity, load_identity, create_authenticator, create_user_service_client, authenticated_rpc_call | 被测试函数 |
| pytest | monkeypatch, CaptureFixture | 依赖注入和输出捕获 |
| asyncio | run | 异步运行 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_setup_identity_cli.py
├── setup_identity (被测试)
├── pytest (测试框架)
└── asyncio (异步运行)
```

## 测试覆盖

| 功能 | 测试场景 |
|------|---------|
| JWT 引导 | 缺失 JWT 自动颁发 |
| 遗留凭证 | 请求重新创建 |

## 输出验证

| 测试 | 预期输出 |
|------|---------|
| JWT 引导 | "JWT bootstrap succeeded and was saved automatically." |
| 遗留凭证 | "No JWT token is saved and DID auth files are missing." |

## 运行测试

```bash
pytest tests/test_setup_identity_cli.py -v
```
