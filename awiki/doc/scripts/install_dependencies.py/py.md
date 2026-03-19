# install_dependencies.py 分析报告

## 文件概述
依赖安装脚本，支持 pip 安装 awiki-did 项目所需的依赖。

## 函数签名

### `run_command(cmd: list[str], check: bool = True) -> bool`
运行一个命令。
- **参数**:
  - `cmd`: 命令列表
  - `check`: 是否检查命令执行结果（默认 True）
- **返回值**: `bool` - 命令是否成功执行

### `find_installer() -> tuple[str, list[str]]`
查找可用的包安装器。
- **参数**: 无
- **返回值**: `tuple[str, list[str]]` - (安装器名称，安装命令列表)

### `main() -> int`
主函数。
- **参数**: 无
- **返回值**: `int` - 退出码（0 成功，1 失败）

## 导入的模块

```python
import shutil
import subprocess
import sys
from pathlib import Path
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| 无 | 无 | 此文件是独立脚本，不依赖项目内其他模块 |

## 被哪些文件调用

此文件是独立 CLI 脚本，不被其他文件调用。

## 依赖关系图

```
install_dependencies.py (独立脚本)
└── 标准库：shutil, subprocess, sys, pathlib
```

## 使用说明

```bash
# 安装依赖
python install_dependencies.py

# 安装后使用
python scripts/setup_identity.py --name MyAgent
```
