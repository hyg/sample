# test_auth_update.py 分析报告

## 文件概述
DID 文档更新身份验证助手的单元测试。

## 测试函数

### `test_update_did_document_uses_body_access_token(monkeypatch)`
测试 body access_token 应该按原样返回。

### `test_update_did_document_uses_authorization_header_fallback(monkeypatch)`
测试当 body 省略 access_token 时，Authorization 响应头应该填充 access_token。

### `test_update_did_document_raises_json_rpc_error(monkeypatch)`
测试 JSON-RPC 错误应该抛出 JsonRpcError。

## 导入的模块

```python
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import httpx
import pytest

from utils.auth import update_did_document
from utils.identity import DIDIdentity
from utils.rpc import JsonRpcError
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils.auth | update_did_document | 被测试函数 |
| utils.identity | DIDIdentity | 测试身份构建 |
| utils.rpc | JsonRpcError | 错误断言 |
| httpx | AsyncClient, MockTransport | HTTP 模拟 |
| pytest | monkeypatch | 依赖注入和模拟 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_auth_update.py
├── utils.auth (被测试)
├── utils.identity (测试辅助)
├── utils.rpc (错误断言)
├── httpx (HTTP 模拟)
└── pytest (测试框架)
```

## 测试覆盖

| 函数 | 测试场景 |
|------|---------|
| update_did_document | body access_token 返回 |
| update_did_document | Authorization 头回退 |
| update_did_document | JSON-RPC 错误抛出 |

## 运行测试

```bash
pytest tests/test_auth_update.py -v
```
