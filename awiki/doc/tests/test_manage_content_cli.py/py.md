# test_manage_content_cli.py 分析报告

## 文件概述
manage_content CLI 错误渲染的单元测试。为结构化 JsonRpcError 和通用错误输出提供回归覆盖。内容页面管理失败的 CLI 单元测试。

## 测试函数

### `test_main_renders_jsonrpc_error_as_structured_json(monkeypatch, capsys)`
测试当 JSON-RPC 错误发生时 CLI 应返回结构化 JSON。

测试内容：
- 模拟 create_page 抛出 JsonRpcError
- 运行 CLI
- 验证输出为结构化 JSON

预期输出：
```json
{
  "status": "error",
  "error_type": "jsonrpc",
  "code": -32001,
  "message": "Slug already exists",
  "data": {"slug": "dup"}
}
```

### `test_main_renders_generic_error_as_structured_json(monkeypatch, capsys)`
测试 CLI 也应为意外失败返回结构化 JSON。

测试内容：
- 模拟 list_pages 抛出 RuntimeError
- 运行 CLI
- 验证输出为结构化 JSON

预期输出：
```json
{
  "status": "error",
  "error_type": "RuntimeError",
  "message": "boom"
}
```

## 导入的模块

```python
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

import manage_content
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| manage_content | configure_logging, create_page, list_pages, JsonRpcError, main | 被测试函数 |
| pytest | monkeypatch, CaptureFixture | 依赖注入和输出捕获 |
| json | loads | JSON 解析 |
| sys | argv | CLI 参数模拟 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_manage_content_cli.py
├── manage_content (被测试)
├── pytest (测试框架)
├── json (JSON 解析)
└── sys (CLI 参数)
```

## 测试覆盖

| 功能 | 测试场景 |
|------|---------|
| JSON-RPC 错误 | 结构化 JSON 输出 |
| 通用错误 | 结构化 JSON 输出 |

## 运行测试

```bash
pytest tests/test_manage_content_cli.py -v
```
