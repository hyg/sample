# test_sanitize_otp.py 分析报告

## 文件概述
handle 实用程序中 OTP 代码清理的单元测试。测试 _sanitize_otp 函数的各种输入场景和集成行为。

## 参数化测试

### `test_sanitize_otp(raw, expected)`
测试 _sanitize_otp 清理各种空白字符。

参数化测试用例：
| raw | expected |
|-----|----------|
| "123456" | "123456" |
| "123 456" | "123456" |
| "12 34 56" | "123456" |
| " 123456 " | "123456" |
| "123\n456" | "123456" |
| "123\t456" | "123456" |
| "123\r\n456" | "123456" |
| " 1 2 3\n4 5 6 " | "123456" |

## 辅助函数

### `_make_identity(did) -> DIDIdentity`
创建最小 DID 身份。

### `_patch_handle_deps(monkeypatch, recorded)`
模拟 create_identity 和 rpc_call 使 register/recover 离线运行。

## 集成测试

### `test_register_handle_sanitizes_otp(monkeypatch)`
测试 register_handle() 应在 API 调用前去除 OTP 空白。

验证 recorded payload 的 otp_code 为 "123456"（输入 "123 456"）。

### `test_recover_handle_sanitizes_otp(monkeypatch)`
测试 recover_handle() 应在 API 调用前去除 OTP 空白。

验证 recorded payload 的 otp_code 为 "123456"（输入 "12\n34\t56"）。

## 导入的模块

```python
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

from utils import handle as handle_utils
from utils.config import SDKConfig
from utils.identity import DIDIdentity
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils.handle | _sanitize_otp, register_handle, recover_handle | 被测试函数 |
| utils.config | SDKConfig | SDK 配置 |
| utils.identity | DIDIdentity | 身份构建 |
| pytest | mark.parametrize, monkeypatch | 参数化测试和依赖注入 |
| asyncio | run | 异步运行 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_sanitize_otp.py
├── utils.handle (被测试)
├── utils.config (SDKConfig)
├── utils.identity (DIDIdentity)
├── pytest (测试框架)
└── asyncio (异步运行)
```

## 测试覆盖

| 功能 | 测试场景 |
|------|---------|
| _sanitize_otp | 空格、换行、制表符、CRLF、混合空白 |
| register_handle | OTP 清理集成 |
| recover_handle | OTP 清理集成 |

## 运行测试

```bash
pytest tests/test_sanitize_otp.py -v
```
