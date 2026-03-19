# test_logging_config.py 分析报告

## 文件概述
共享日志配置模块的单元测试。测试日志目录、清理和每日轮转处理程序。

## 辅助类

### `_MutableClock`
用于处理器测试的简单可变时钟。

## 辅助函数

### `_write_log_file(log_dir, day, content) -> Path`
创建具有确定性内容的托管日志文件。

## 测试函数

### `test_get_log_dir_uses_data_dir(tmp_path, monkeypatch)`
测试日志文件应位于 <DATA_DIR>/logs 下。

### `test_cleanup_log_files_removes_expired_days(tmp_path)`
测试早于保留窗口的文件应被移除。

测试内容：
- 创建 17 天的日志文件
- 运行清理（保留 15 天）
- 验证最旧的 2 个文件被删除

### `test_cleanup_log_files_enforces_total_size_limit(tmp_path)`
测试大小清理应首先删除最旧文件。

测试内容：
- 创建 3 个日志文件（每个 5 字节）
- 运行清理（最大 10 字节）
- 验证最旧文件被删除

### `test_daily_retention_file_handler_writes_one_file_per_day(tmp_path)`
测试处理器应在日期变化时轮转到新文件。

测试内容：
- 使用可变时钟
- 写入第一天日志
- 更改时钟到第二天
- 写入第二天日志
- 验证两个文件存在

### `test_configure_logging_mirrors_print_to_daily_log(tmp_path)`
测试 configure_logging 应将 stdout 打印镜像到每日日志文件。

测试内容：
- 运行子进程脚本
- 调用 configure_logging(mirror_stdio=True)
- 执行 print
- 验证输出在日志文件中

## 导入的模块

```python
from __future__ import annotations

import logging
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from utils.logging_config import (
    DailyRetentionFileHandler,
    cleanup_log_files,
    get_log_dir,
)
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils.logging_config | DailyRetentionFileHandler, cleanup_log_files, get_log_dir | 被测试函数 |
| logging | Logger, Formatter | 日志记录 |
| subprocess | run | 子进程执行 |
| datetime | datetime, timedelta, timezone | 时间处理 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| pytest | 测试发现 | 运行测试 |

## 依赖关系图

```
test_logging_config.py
├── utils.logging_config (被测试)
├── logging (日志记录)
├── subprocess (子进程)
└── datetime (时间处理)
```

## 测试覆盖

| 功能 | 测试场景 |
|------|---------|
| get_log_dir | 使用 DATA_DIR |
| cleanup_log_files | 过期文件移除、大小限制 |
| DailyRetentionFileHandler | 每日轮转 |
| configure_logging | stdout 镜像到日志 |

## 运行测试

```bash
pytest tests/test_logging_config.py -v
```
