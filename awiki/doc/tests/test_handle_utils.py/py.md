# test_handle_utils.py 分析报告

## 文件概述
handle.py 中 normalize_phone() 的单元测试。为号码格式化逻辑提供完整测试覆盖。客户端 SDK 手机号处理的单元测试。

## 测试类

### `TestNormalizePhone`
normalize_phone() 手机号格式化测试。

#### 测试方法

##### `test_chinese_local_numbers(raw, expected)`
测试中国本地号码应自动加 +86 前缀。

参数化测试用例：
- "13800138000" → "+8613800138000"
- "15912345678" → "+8615912345678"
- "19999999999" → "+8619999999999"

##### `test_international_format_unchanged(phone)`
测试已有国际格式的号码应保持不变。

参数化测试用例：
- "+8613800138000"
- "+14155552671"
- "+447911123456"
- "+81312345678"
- "+85212345678"

##### `test_strips_whitespace()`
测试应自动去除前后空格。

##### `test_invalid_phone_raises(phone)`
测试无效号码应抛出 ValueError。

参数化测试用例：
- "12345" (太短)
- "abc" (非数字)
- "+abc" (+ 后非数字)
- "" (空字符串)
- "+1234" (国际格式但太短)
- "99999999999" (11 位但不是 1[3-9] 开头)

## 导入的模块

```python
from __future__ import annotations

import sys
from pathlib import Path

import pytest

from utils.handle import normalize_phone
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils.handle | normalize_phone | 被测试函数 |
| pytest | mark.parametrize, raises | 参数化测试和异常断言 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_handle_utils.py
└── utils.handle (被测试)
    ↓
pytest (测试框架)
```

## 测试覆盖

| 功能 | 测试场景 |
|------|---------|
| 中国本地号码 | 自动加 +86 前缀 |
| 国际格式 | 保持不变 |
| 空格处理 | 自动 strip |
| 无效号码 | 抛出 ValueError |

## 运行测试

```bash
pytest tests/test_handle_utils.py -v
```
