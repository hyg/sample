# service_manager.py 分析报告

## 文件概述
跨平台服务管理器：为 ws_listener 后台进程安装/卸载/启动/停止/状态。在 ws_listener.py CLI 和 OS 特定服务管理（launchd / systemd / Task Scheduler）之间提供抽象层。

## 类定义

### `ServiceManager` (抽象基类)
平台特定服务管理器的基类。

#### 抽象方法
- `install(credential: str, config_path: str | None, mode: str | None) -> None`: 安装并启动后台服务
- `uninstall() -> None`: 停止并移除后台服务
- `start() -> None`: 启动已安装的服务
- `stop() -> None`: 停止运行中的服务
- `status() -> dict[str, Any]`: 返回服务状态
- `log_dir() -> Path`: 返回平台特定日志目录
- `is_installed() -> bool`: 检查服务是否已安装

#### 具体方法
- `find_python() -> str`: 查找最佳 Python 解释器路径
- `_build_run_args(credential: str, config_path: str | None, mode: str | None) -> list[str]`: 构建 ws_listener.py run 的命令行参数
- `_ensure_log_dir() -> Path`: 创建并返回日志目录

### `MacOSServiceManager` (ServiceManager)
使用 launchd（LaunchAgent）的 macOS 服务管理器。

#### 属性
- `_agents_dir`: ~/Library/LaunchAgents
- `_plist_path`: plist 文件路径

#### 方法
- `_generate_plist(...) -> str`: 生成 launchd plist 配置
- `_launchctl(*args: str) -> subprocess.CompletedProcess`: 执行 launchctl 命令

### `LinuxServiceManager` (ServiceManager)
使用 systemd 用户单元的 Linux 服务管理器。

#### 属性
- `_unit_dir`: systemd 用户单元目录
- `_unit_path`: 单元文件路径
- `_UNIT_NAME`: "awiki-ws-listener.service"

#### 方法
- `_generate_unit(...) -> str`: 生成 systemd 单元配置
- `_systemctl(*args: str) -> subprocess.CompletedProcess`: 执行 systemctl 命令

### `WindowsServiceManager` (ServiceManager)
使用任务计划程序（schtasks）的 Windows 服务管理器。

#### 属性
- `_app_dir`: 应用程序目录
- `_bat_path`: 批处理文件路径
- `_TASK_NAME`: "awiki-ws-listener"

#### 方法
- `_generate_bat(...) -> str`: 生成批处理文件
- `is_installed() -> bool`: 检查任务是否存在

### 工厂函数

#### `get_service_manager() -> ServiceManager`
返回当前平台的适当 ServiceManager。

## 导入的模块

```python
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from utils.config import SDKConfig
from utils.logging_config import find_latest_log_file, get_log_dir, get_log_file_path
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils.config | SDKConfig | SDK 配置 |
| utils.logging_config | find_latest_log_file, get_log_dir, get_log_file_path | 日志路径 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| ws_listener.py | get_service_manager, ServiceManager | 服务生命周期管理 |

## 依赖关系图

```
service_manager.py
├── utils.config (SDKConfig)
└── utils.logging_config (日志路径)
    ↓
ws_listener.py
```

## 平台支持

| 平台 | 服务管理器 |
|------|-----------|
| macOS | launchd (LaunchAgent) |
| Linux | systemd (用户单元) |
| Windows | Task Scheduler (schtasks) |

## 导出接口

```python
__all__ = [
    "ServiceManager",
    "MacOSServiceManager",
    "LinuxServiceManager",
    "WindowsServiceManager",
    "get_service_manager",
]
```

## 使用说明

```python
# 获取平台特定管理器
from service_manager import get_service_manager
manager = get_service_manager()

# 安装服务
manager.install(credential="default", config_path=None, mode="smart")

# 检查状态
status = manager.status()

# 启动服务
manager.start()

# 停止服务
manager.stop()

# 卸载服务
manager.uninstall()
```
