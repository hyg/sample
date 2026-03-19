# test_search_users.py 分析报告

## 文件概述
search_users 模块的单元测试。验证参数构造、错误处理和 JSON 输出。用户搜索 CLI 单元测试。

## 测试类

### `TestSearchUsersParams`
验证搜索参数构造和 CLI 行为。

#### 测试方法

##### `test_search_builds_correct_params(tmp_path)`
测试 search_users() 应调用 authenticated_rpc_call 带 type=keyword。

验证：
- endpoint: /search/rpc
- method: search.users
- params: {"type": "keyword", "q": "alice"}

##### `test_missing_credential_exits()`
测试当凭证不可用时应以代码 1 退出。

验证抛出 SystemExit(1)。

##### `test_output_is_valid_json(capsys)`
测试输出应为有效格式化 JSON。

验证：
- 输出可解析为 JSON
- 包含预期结果字段

## 导入的模块

```python
from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import search_users
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| search_users | search_users, create_authenticator, create_user_service_client, authenticated_rpc_call | 被测试函数 |
| unittest.mock | AsyncMock, MagicMock, patch | 模拟对象 |
| pytest | mark.asyncio, CaptureFixture | 异步测试和输出捕获 |
| json | loads | JSON 解析 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_search_users.py
├── search_users (被测试)
├── unittest.mock (模拟)
├── pytest (测试框架)
└── json (JSON 解析)
```

## 测试覆盖

| 功能 | 测试场景 |
|------|---------|
| 参数构造 | type=keyword, q 参数 |
| 错误处理 | 凭证缺失退出 |
| JSON 输出 | 有效格式化 JSON |

## 运行测试

```bash
pytest tests/test_search_users.py -v
```
