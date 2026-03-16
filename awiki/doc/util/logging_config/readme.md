# logging_config.py 模块文档

## 1. 概述

**文件路径**: `python/scripts/utils/logging_config.py`

**主要功能**: 
- 应用日志配置
- 每日轮转文件处理器
- 日志保留策略（15 天/15MB）
- stdout/stderr 镜像到日志文件

**依赖关系**:
- `logging`: Python 标准日志模块
- `io`: 流操作
- `threading`: 线程安全
- `datetime`: 日期时间处理
- 本地模块：`config`

---

## 2. 导入模块

| 模块 | 用途 |
|------|------|
| `io.TextIOBase` | 文本流基类 |
| `logging` | 日志记录 |
| `sys` | 系统标准流 |
| `threading` | 线程锁 |
| `datetime.date, datetime.datetime, timedelta` | 日期时间 |
| `pathlib.Path` | 路径操作 |
| `typing.Callable, TextIO` | 类型注解 |
| `utils.config.SDKConfig` | SDK 配置 |

---

## 3. 常量

| 常量 | 值 | 描述 |
|------|-----|------|
| `LOG_FILE_PREFIX` | `"awiki-agent"` | 日志文件前缀 |
| `MAX_RETENTION_DAYS` | `15` | 最大保留天数 |
| `MAX_TOTAL_SIZE_BYTES` | `15 * 1024 * 1024` | 最大总大小（15MB） |
| `_DEFAULT_FORMAT` | `"%(asctime)s [%(levelname)s %(name)s: %(message)s"` | 默认日志格式 |
| `_DEFAULT_DATE_FORMAT` | `"%Y-%m-%d %H:%M:%S"` | 默认时间格式 |
| `_FILE_HANDLER_NAME` | `"awiki_daily_file_handler"` | 文件处理器名称 |
| `_CONSOLE_HANDLER_NAME` | `"awiki_console_handler"` | 控制台处理器名称 |
| `_STDIO_LOGGER_NAME` | `"awiki_stdio"` | 标准流日志器名称 |

---

## 4. 函数详解

### 4.1 `get_log_dir`

**签名**:
```python
def get_log_dir(config: SDKConfig | None = None) -> Path:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `config` | `SDKConfig` | `None` | SDK 配置 |

**返回值**: `Path` - 日志目录路径

**功能**: 
返回 `<DATA_DIR>/logs` 目录，如果不存在则创建。

**路径示例**:
```
~/.openclaw/workspace/data/awiki-agent-id-message/logs/
```

---

### 4.2 `get_log_file_path`

**签名**:
```python
def get_log_file_path(
    log_dir: Path | None = None,
    *,
    now: datetime | None = None,
    prefix: str = LOG_FILE_PREFIX,
) -> Path:
```

**返回值**: `Path` - 日志文件路径

**功能**: 
返回指定日期的日志文件路径。

**文件名格式**:
```
awiki-agent-YYYY-MM-DD.log
```

**示例**:
```
awiki-agent-2026-03-16.log
```

---

### 4.3 `find_latest_log_file`

**签名**:
```python
def find_latest_log_file(
    log_dir: Path | None = None,
    *,
    prefix: str = LOG_FILE_PREFIX,
) -> Path | None:
```

**返回值**: `Path | None` - 最新的日志文件

**功能**: 
返回最新的管理日志文件（如果存在）。

---

### 4.4 `cleanup_log_files`

**签名**:
```python
def cleanup_log_files(
    log_dir: Path | None = None,
    *,
    now: datetime | None = None,
    prefix: str = LOG_FILE_PREFIX,
    max_retention_days: int = MAX_RETENTION_DAYS,
    max_total_size_bytes: int = MAX_TOTAL_SIZE_BYTES,
) -> list[Path]:
```

**返回值**: `list[Path]` - 已删除的文件列表

**功能**: 
删除过期或超大的日志文件。

**清理策略**:
1. 删除超过保留天数的文件
2. 如果总大小超过限制，删除最旧的文件（保留最新的一个）

---

### 4.5 `_extract_log_date`

**签名**:
```python
def _extract_log_date(path: Path, prefix: str) -> date | None:
```

**功能**: 
从文件名解析日志日期。

---

### 4.6 `_list_managed_log_files`

**签名**:
```python
def _list_managed_log_files(
    log_dir: Path,
    *,
    prefix: str = LOG_FILE_PREFIX,
) -> list[Path]:
```

**功能**: 
列出所有管理的日志文件（按日期排序）。

---

## 5. 类详解

### 5.1 `DailyRetentionFileHandler`

**定义**:
```python
class DailyRetentionFileHandler(logging.Handler):
    """写入每日日志文件并应用保留策略。"""
```

**初始化参数**:
```python
def __init__(
    self,
    *,
    log_dir: Path | None = None,
    prefix: str = LOG_FILE_PREFIX,
    max_retention_days: int = MAX_RETENTION_DAYS,
    max_total_size_bytes: int = MAX_TOTAL_SIZE_BYTES,
    cleanup_interval_seconds: int = 60,
    encoding: str = "utf-8",
    clock: Clock | None = None,
) -> None:
```

**属性**:
| 属性 | 类型 | 描述 |
|------|------|------|
| `current_path` | `Path` | 当前日志文件路径 |
| `terminator` | `str` | 行终止符（`\n`） |

**方法**:

| 方法 | 功能 |
|------|------|
| `emit(record)` | 写入日志记录 |
| `flush()` | 刷新缓冲区 |
| `close()` | 关闭文件流 |

**特性**:
- 自动按日期轮转文件
- 定期运行清理（默认 60 秒间隔）
- 线程安全

---

### 5.2 `_TeeToLogger`

**定义**:
```python
class _TeeToLogger(io.TextIOBase):
    """将写入内容镜像到日志文件。"""
```

**功能**: 
包装 stdout/stderr，将写入内容同时发送到原始流和日志文件。

**用途**: 捕获 `print()` 输出到日志文件。

---

### 5.3 `configure_logging`

**签名**:
```python
def configure_logging(
    *,
    level: int = logging.INFO,
    console_level: int | None = logging.INFO,
    force: bool = False,
    config: SDKConfig | None = None,
    prefix: str = LOG_FILE_PREFIX,
    mirror_stdio: bool = False,
) -> Path:
```

**参数**:
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `level` | `int` | `logging.INFO` | 文件日志级别 |
| `console_level` | `int` | `logging.INFO` | 控制台日志级别 |
| `force` | `bool` | `False` | 强制重新配置 |
| `config` | `SDKConfig` | `None` | SDK 配置 |
| `prefix` | `str` | `LOG_FILE_PREFIX` | 日志文件前缀 |
| `mirror_stdio` | `bool` | `False` | 镜像标准流 |

**返回值**: `Path` - 当前日志文件路径

**功能**: 
配置根日志记录器：
1. 添加每日文件处理器
2. 添加控制台处理器（可选）
3. 安装异常钩子
4. 镜像 stdout/stderr（可选）

**调用位置**: 所有 CLI 脚本和监听器

---

## 6. 日志目录结构

```
<DATA_DIR>/logs/
├── awiki-agent-2026-03-14.log
├── awiki-agent-2026-03-15.log
└── awiki-agent-2026-03-16.log  # 当前日志
```

---

## 7. 调用关系

### 被谁调用
- 所有 CLI 脚本
- `ws_listener.py`: WebSocket 监听器
- `service_manager.py`: 服务管理器

### 调用谁
- `utils.config`: 获取数据目录
- `logging`: 日志记录
- `datetime`: 日期处理

---

## 8. 使用示例

### 8.1 基本日志配置

```python
from utils.logging_config import configure_logging
import logging

# 配置日志
log_file = configure_logging(
    level=logging.DEBUG,
    console_level=logging.INFO,
)

print(f"Logging to: {log_file}")

# 使用日志
logger = logging.getLogger(__name__)
logger.info("Application started")
logger.debug("Debug information")
```

### 8.2 镜像标准输出

```python
# 配置镜像 stdout/stderr
configure_logging(mirror_stdio=True)

# print() 输出会同时写入日志文件
print("This will be logged")
```

### 8.3 手动清理日志

```python
from utils.logging_config import cleanup_log_files, get_log_dir

deleted = cleanup_log_files(
    max_retention_days=7,  # 只保留 7 天
    max_total_size_bytes=5 * 1024 * 1024,  # 最大 5MB
)
print(f"Deleted {len(deleted)} files")
```

### 8.4 查找最新日志

```python
from utils.logging_config import find_latest_log_file

latest = find_latest_log_file()
if latest:
    print(f"Latest log: {latest}")
```

---

## 9. 日志格式

**默认格式**:
```
2026-03-16 00:00:00 [INFO] __main__: Application started
2026-03-16 00:00:01 [DEBUG] utils.auth: Registering DID...
2026-03-16 00:00:02 [ERROR] utils.rpc: JSON-RPC error -32600: Invalid Request
```

**格式组成**:
- `%(asctime)s`: 时间戳
- `%(levelname)s`: 日志级别
- `%(name)s`: 日志器名称
- `%(message)s`: 日志消息

---

## 10. 日志级别

| 级别 | 值 | 用途 |
|------|-----|------|
| `DEBUG` | 10 | 调试信息 |
| `INFO` | 20 | 一般信息 |
| `WARNING` | 30 | 警告信息 |
| `ERROR` | 40 | 错误信息 |
| `CRITICAL` | 50 | 严重错误 |

---

## 11. 异常钩子

`configure_logging()` 自动安装全局异常钩子：

```python
# 未捕获的异常会自动记录到日志
def _log_unhandled_exception(exc_type, exc_value, exc_traceback):
    logging.getLogger(__name__).critical(
        "Unhandled exception",
        exc_info=(exc_type, exc_value, exc_traceback),
    )
```

**效果**: 程序崩溃时的堆栈跟踪会自动写入日志文件。

---

## 12. 最佳实践

1. **启动时配置**: 在脚本开始时调用 `configure_logging()`
2. **使用模块日志器**: `logger = logging.getLogger(__name__)`
3. **合理设置级别**: 生产环境用 INFO，调试用 DEBUG
4. **定期清理**: 使用 `cleanup_log_files()` 防止磁盘占用过多
5. **镜像标准流**: 启用 `mirror_stdio=True` 捕获所有输出
