# scripts/utils/config.py 分析

## 文件信息

- **路径**: `python/scripts/utils/config.py`
- **用途**: SDK 配置管理，集中管理服务 URL、域名、凭证目录和数据目录

## 类定义

### SDKConfig

```python
@dataclass(frozen=True, slots=True)
class SDKConfig:
    """awiki 系统服务配置"""
    
    user_service_url: str = "https://awiki.ai"
    molt_message_url: str = "https://awiki.ai"
    molt_message_ws_url: str | None = None
    did_domain: str = "awiki.ai"
    credentials_dir: Path = <动态计算>
    data_dir: Path = <动态计算>
```

**属性**:
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `user_service_url` | str | https://awiki.ai | 用户服务 URL |
| `molt_message_url` | str | https://awiki.ai | 消息服务 URL |
| `molt_message_ws_url` | str\|None | None | WebSocket 服务 URL |
| `did_domain` | str | awiki.ai | DID 域名 |
| `credentials_dir` | Path | ~/.openclaw/credentials/awiki-agent-id-message | 凭证存储目录 |
| `data_dir` | Path | ~/.openclaw/workspace/data/awiki-agent-id-message | 数据目录 |

## 函数签名

### _default_credentials_dir()

```python
def _default_credentials_dir() -> Path:
    """解析凭证目录：~/.openclaw/credentials/<skill>/"""
```

### _default_data_dir()

```python
def _default_data_dir() -> Path:
    """解析数据目录
    
    优先级:
    1. AWIKI_DATA_DIR 环境变量 (直接覆盖)
    2. AWIKI_WORKSPACE/data/<skill>
    3. ~/.openclaw/workspace/data/<skill>
    """
```

### SDKConfig.load()

```python
@classmethod
def load(cls) -> SDKConfig:
    """从 <DATA_DIR>/config/settings.json 加载配置，支持环境变量覆盖
    
    优先级：环境变量 > settings.json > 默认值
    """
```

## 导入的模块

```python
import json
import os
from dataclasses import dataclass, field
from pathlib import Path
```

## 环境变量

| 变量名 | 用途 |
|--------|------|
| `AWIKI_DATA_DIR` | 数据目录覆盖 |
| `AWIKI_WORKSPACE` | 工作空间目录 |
| `E2E_USER_SERVICE_URL` | 用户服务 URL |
| `E2E_MOLT_MESSAGE_URL` | 消息服务 URL |
| `E2E_MOLT_MESSAGE_WS_URL` | WebSocket URL |
| `E2E_DID_DOMAIN` | DID 域名 |

## 蒸馏数据

### 测试输入

| 函数 | 输入 | 场景 |
|------|------|------|
| SDKConfig.load | {} | 加载默认配置（环境变量或默认值） |

### 测试输出

| 函数 | 输出 | 验证点 |
|------|------|--------|
| SDKConfig.load | {user_service_url, molt_message_url, molt_message_ws_url, did_domain, credentials_dir, data_dir} | 所有属性都有正确值 |

### 蒸馏输出

蒸馏数据已保存到 `py.json`，包含：
- `SDKConfig.load()` 的输入输出
- 类属性和方法列表
- 环境变量配置

### 蒸馏脚本

`distill.py` 已保存到同路径下。

## 被调用关系

| 调用文件 | 调用方式 |
|----------|----------|
| `utils/client.py` | `SDKConfig()` 获取服务 URL |
| `utils/logging_config.py` | `SDKConfig()` 获取日志目录 |
| `credential_layout.py` | `SDKConfig()` 获取凭证目录 |
| `local_store.py` | `SDKConfig()` 获取数据库路径 |
| `scripts/*.py` | `SDKConfig()` 获取服务配置 |

## 配置加载流程

```
1. 读取默认 credentials_dir 和 data_dir
2. 检查 settings.json 是否存在
3. 从文件加载配置
4. 用环境变量覆盖
5. 返回 SDKConfig 实例
```
