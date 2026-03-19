# scripts/utils/logging_config.py 分析

## 文件信息

- **路径**: `python/scripts/utils/logging_config.py`
- **用途**: 应用日志配置 (每日轮转文件)

## 常量

```python
LOG_FILE_PREFIX = "awiki-agent"
MAX_RETENTION_DAYS = 15          # 保留 15 天
MAX_TOTAL_SIZE_BYTES = 15 * 1024 * 1024  # 总大小限制 15MB
```

## 蒸馏数据

### 测试输入

| 函数 | 输入 | 场景 |
|------|------|------|
| get_log_dir | {} | 获取日志目录（使用默认配置） |
| get_log_dir | {config: SDKConfig()} | 获取日志目录（使用 SDKConfig） |
| configure_logging | {} | 配置默认日志 |

### 测试输出

| 函数 | 输出 | 验证点 |
|------|------|--------|
| get_log_dir | {log_dir: "C:\\Users\\...\\logs"} | 目录路径正确，包含 skill 名称 |
| configure_logging | {success: True, handlers: N} | 日志配置成功，处理器已添加 |

### 蒸馏输出

蒸馏数据已保存到 `py.json`，包含：
- `get_log_dir()` 的输入输出
- `configure_logging()` 的测试结果
- 常量定义（LOG_FILE_PREFIX, MAX_RETENTION_DAYS, MAX_TOTAL_SIZE_BYTES）
- DailyRetentionFileHandler 类信息

### 蒸馏脚本

`distill.py` 已保存到同路径下。

## 类定义

### DailyRetentionFileHandler

```python
class DailyRetentionFileHandler(logging.Handler):
    """每日日志文件处理器，带保留策略
    
    参数:
        log_dir: 日志目录
        prefix: 文件名前缀
        max_retention_days: 最大保留天数
        max_total_size_bytes: 最大总大小
        cleanup_interval_seconds: 清理间隔
        encoding: 文件编码
        clock: 时间函数 (用于测试)
    """
    
    @property
    def current_path(self) -> Path:
        """返回当前活动日志文件路径"""
    
    def emit(self, record: logging.LogRecord) -> None:
        """输出日志记录到活动文件"""
    
    def flush(self) -> None:
        """刷新文件流"""
    
    def close(self) -> None:
        """关闭文件流"""
```

## 函数签名

### get_log_dir()

```python
def get_log_dir(config: SDKConfig | None = None) -> Path:
    """返回 <DATA_DIR>/logs 目录"""
```

### get_log_file_path()

```python
def get_log_file_path(
    log_dir: Path | None = None,
    *,
    now: datetime | None = None,
    prefix: str = LOG_FILE_PREFIX,
) -> Path:
    """返回指定日期的日志文件路径
    
    格式：{prefix}-{YYYY-MM-DD}.log
    """
```

### find_latest_log_file()

```python
def find_latest_log_file(
    log_dir: Path | None = None,
    *,
    prefix: str = LOG_FILE_PREFIX,
) -> Path | None:
    """返回最新的管理日志文件"""
```

### cleanup_log_files()

```python
def cleanup_log_files(
    log_dir: Path | None = None,
    *,
    now: datetime | None = None,
    prefix: str = LOG_FILE_PREFIX,
    max_retention_days: int = MAX_RETENTION_DAYS,
    max_total_size_bytes: int = MAX_TOTAL_SIZE_BYTES,
) -> list[Path]:
    """删除过期或超大的日志文件
    
    清理策略:
    1. 删除超过保留窗口的文件
    2. 如果总大小仍超限，删除最旧文件直到满足限制
    
    返回:
        已删除文件路径列表
    """
```

### configure_logging()

```python
def configure_logging(
    *,
    level: int = logging.INFO,
    console_level: int | None = logging.INFO,
    force: bool = False,
    config: SDKConfig | None = None,
    prefix: str = LOG_FILE_PREFIX,
    mirror_stdio: bool = False,  # 镜像 stdout/stderr 到日志
) -> Path:
    """配置根日志记录器
    
    功能:
    - 每日轮转文件处理器
    - 可选控制台输出
    - 可选 stdout/stderr 镜像
    - 安装全局异常钩子
    
    返回:
        当前日志文件路径
    """
```

## 内部类

### _TeeToLogger

```python
class _TeeToLogger(io.TextIOBase):
    """将写入镜像到原始流和文件日志记录器"""
    
    def __init__(
        self,
        original_stream: TextIO,
        logger: logging.Logger,
        level: int,
    ) -> None:
        """初始化镜像器"""
    
    def write(self, s: str) -> int:
        """写入并镜像到日志"""
```

## 导入的模块

```python
import io
import logging
import sys
import threading
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Callable, TextIO
from utils.config import SDKConfig
```

## 日志文件命名

```
awiki-agent-2026-03-19.log
awiki-agent-2026-03-20.log
...
```

## 清理策略

```python
def cleanup_log_files(...):
    # 1. 删除过期文件
    keep_after = current.date() - timedelta(days=max_retention_days - 1)
    for path in managed_files:
        if file_date < keep_after:
            path.unlink()
    
    # 2. 删除最旧文件直到满足大小限制
    while total_size > max_total_size_bytes and len(files) > 1:
        oldest_file = files.pop(0)
        oldest_file.unlink()
```

## 日志格式

```python
_DEFAULT_FORMAT = "%(asctime)s [%(levelname)s %(name)s: %(message)s"
_DEFAULT_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
```

## 输出示例

```
2026-03-19 10:00:00 [INFO] ws_listener: WebSocket connected successfully
2026-03-19 10:00:01 [DEBUG] credential_store: Loaded credential name=default
2026-03-19 10:00:02 [WARNING] e2ee_handler: E2EE initialization failed
```

## 被调用关系

| 调用文件 | 调用内容 |
|----------|----------|
| `utils/__init__.py` | 导出所有公共函数 |
| `scripts/check_inbox.py` | `configure_logging` |
| `scripts/check_status.py` | `configure_logging` |
| `scripts/send_message.py` | `configure_logging` |
| `scripts/ws_listener.py` | `configure_logging`, `get_log_dir`, `find_latest_log_file` |
| `scripts/setup_identity.py` | `configure_logging` |
| `scripts/register_handle.py` | `configure_logging` |
| `scripts/recover_handle.py` | `configure_logging` |
| `scripts/manage_*.py` | `configure_logging` |
| `scripts/service_manager.py` | `get_log_dir`, `get_log_file_path`, `find_latest_log_file` |
| `tests/test_logging_config.py` | `DailyRetentionFileHandler`, `cleanup_log_files`, `configure_logging` |

## stdout/stderr 镜像

```python
# 当 mirror_stdio=True 时
sys.stdout = _TeeToLogger(sys.__stdout__, stdio_logger, logging.INFO)
sys.stderr = _TeeToLogger(sys.__stderr__, stdio_logger, logging.ERROR)

# print() 输出会同时写入终端和日志文件
print("Hello")  # → 终端 + 日志文件
```

## 异常钩子

```python
def _install_exception_hooks():
    """安装进程级异常钩子"""
    sys.excepthook = _log_unhandled_exception
    threading.excepthook = _log_unhandled_thread_exception
```
