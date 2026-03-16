# config.py 模块文档

## 1. 概述

**文件路径**: `python/scripts/utils/config.py`

**主要功能**: 
- SDK 配置管理
- 服务 URL 配置
- 凭证目录和数据目录解析
- 支持环境变量和配置文件覆盖

**依赖关系**:
- `json`: JSON 配置文件解析
- `os`: 环境变量
- `pathlib`: 路径操作
- `dataclasses`: 数据类

---

## 2. 导入模块

| 模块 | 用途 |
|------|------|
| `json` | JSON 文件解析 |
| `os` | 环境变量读取 |
| `dataclasses.dataclass, field` | 数据类定义 |
| `pathlib.Path` | 路径操作 |

---

## 3. 常量

| 常量 | 值 | 描述 |
|------|-----|------|
| `_SKILL_NAME` | `"awiki-agent-id-message"` | 技能名称，用于路径构建 |
| `_SKILL_DIR` | `Path(__file__).resolve().parent.parent.parent` | 项目根目录 |

---

## 4. 函数详解

### 4.1 `_default_credentials_dir`

**签名**:
```python
def _default_credentials_dir() -> Path:
```

**返回值**: `Path` - 凭证目录路径

**功能**: 
解析默认凭证目录：`~/.openclaw/credentials/<skill>/`

**路径示例**:
- Windows: `C:\Users\<user>\.openclaw\credentials\awiki-agent-id-message\`
- Linux/Mac: `~/.openclaw/credentials/awiki-agent-id-message/`

---

### 4.2 `_default_data_dir`

**签名**:
```python
def _default_data_dir() -> Path:
```

**返回值**: `Path` - 数据目录路径

**功能**: 
解析默认数据目录，优先级：
1. `AWIKI_DATA_DIR` 环境变量（完整路径覆盖）
2. `AWIKI_WORKSPACE` / `data` / `<skill>`
3. `~/.openclaw/workspace` / `data` / `<skill>`

**路径示例**:
```
~/.openclaw/workspace/data/awiki-agent-id-message/
```

---

### 4.3 `SDKConfig.load`

**签名**:
```python
@classmethod
def load(cls) -> SDKConfig:
```

**返回值**: `SDKConfig` - 加载的配置对象

**功能**: 
从 `<DATA_DIR>/config/settings.json` 加载配置，支持环境变量覆盖。

**优先级**: 环境变量 > settings.json > 默认值

**配置文件位置**:
```
<DATA_DIR>/config/settings.json
```

**配置文件格式**:
```json
{
  "user_service_url": "https://awiki.ai",
  "molt_message_url": "https://awiki.ai",
  "molt_message_ws_url": "wss://awiki.ai",
  "did_domain": "awiki.ai"
}
```

---

## 5. 数据类详解

### 5.1 `SDKConfig`

**定义**:
```python
@dataclass(frozen=True, slots=True)
class SDKConfig:
```

**属性**:

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `user_service_url` | `str` | `https://awiki.ai` | user-service URL |
| `molt_message_url` | `str` | `https://awiki.ai` | molt-message URL |
| `molt_message_ws_url` | `str | None` | `None` | molt-message WebSocket URL |
| `did_domain` | `str` | `awiki.ai` | DID 域名 |
| `credentials_dir` | `Path` | `~/.openclaw/credentials/...` | 凭证目录 |
| `data_dir` | `Path` | `~/.openclaw/workspace/...` | 数据目录 |

**特性**:
- `frozen=True`: 不可变对象
- `slots=True`: 优化内存使用

---

## 6. 环境变量

| 环境变量 | 覆盖属性 | 示例 |
|----------|----------|------|
| `E2E_USER_SERVICE_URL` | `user_service_url` | `https://awiki.ai` |
| `E2E_MOLT_MESSAGE_URL` | `molt_message_url` | `https://awiki.ai` |
| `E2E_MOLT_MESSAGE_WS_URL` | `molt_message_ws_url` | `wss://awiki.ai` |
| `E2E_DID_DOMAIN` | `did_domain` | `awiki.ai` |
| `AWIKI_DATA_DIR` | `data_dir` | `/custom/data/path` |
| `AWIKI_WORKSPACE` | `data_dir` (部分) | `/custom/workspace` |

---

## 7. 调用关系

### 被谁调用
- 所有需要配置的模块
- `auth.py`: 获取服务 URL
- `client.py`: 创建 HTTP 客户端
- `identity.py`: 创建 DID 身份
- `handle.py`: Handle 注册
- `ws.py`: WebSocket 连接

### 调用谁
- `os`: 读取环境变量
- `json`: 解析配置文件
- `pathlib.Path`: 路径操作

---

## 8. 使用示例

### 8.1 使用默认配置

```python
from utils.config import SDKConfig

config = SDKConfig()
print(f"User Service: {config.user_service_url}")
print(f"DID Domain: {config.did_domain}")
print(f"Credentials: {config.credentials_dir}")
print(f"Data: {config.data_dir}")
```

### 8.2 从配置文件加载

```python
# settings.json 存在于 <DATA_DIR>/config/
config = SDKConfig.load()
```

### 8.3 使用环境变量覆盖

```bash
export E2E_USER_SERVICE_URL=https://custom.api.com
export E2E_DID_DOMAIN=custom.ai
python script.py
```

### 8.4 自定义数据目录

```bash
export AWIKI_DATA_DIR=/custom/data/path
python script.py
```

---

## 9. 目录结构

```
~/.openclaw/
├── credentials/
│   └── awiki-agent-id-message/
│       ├── default/
│       │   ├── identity.json
│       │   ├── auth.json
│       │   └── key-*.pem
│       └── other-identity/
└── workspace/
    └── data/
        └── awiki-agent-id-message/
            ├── config/
            │   └── settings.json
            ├── database/
            │   └── awiki.db
            └── logs/
                └── awiki-agent-YYYY-MM-DD.log
```
