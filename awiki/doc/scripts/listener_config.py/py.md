# listener_config.py 分析报告

## 文件概述
WebSocket 监听器配置：webhook 端点 + 路由规则 + 路由模式 + E2EE 透明处理。

## 数据类

### `RoutingRules`
消息路由规则。控制消息如何分类为 agent（高优先级）或 wake（低优先级）模式。

#### 属性
- `whitelist_dids`: 白名单 DID（总是 agent 模式）
- `private_always_agent`: 私有消息是否总是 agent 模式
- `command_prefix`: 命令前缀（默认 "/"）
- `keywords`: 触发 agent 模式的关键词
- `bot_names`: 机器人名称
- `blacklist_dids`: 黑名单 DID（直接丢弃）

### `ListenerConfig`
WebSocket 监听器配置。

#### 属性
- `mode`: 路由模式（agent-all / smart / wake-all）
- `agent_webhook_url`: Agent webhook URL
- `wake_webhook_url`: Wake webhook URL
- `webhook_token`: Webhook 令牌
- `agent_hook_name`: Agent webhook 的 name 字段
- `routing`: 路由规则
- `ignore_types`: 忽略的 E2EE 消息类型
- `e2ee_save_interval`: E2EE 状态保存间隔（秒）
- `e2ee_decrypt_fail_action`: 解密失败动作
- `reconnect_base_delay`: 重连基础延迟
- `reconnect_max_delay`: 重连最大延迟
- `heartbeat_interval`: 心跳间隔

#### 方法

##### `__post_init__() -> None`
验证配置值。

##### `classmethod load(config_path: str | None = None, mode_override: str | None = None) -> ListenerConfig`
从 JSON 文件 + settings.json + 环境变量加载配置。

## 导入的模块

```python
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

from utils.config import SDKConfig
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| utils.config | SDKConfig | SDK 配置（用于 settings.json 路径） |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| ws_listener.py | ListenerConfig, ROUTING_MODES, RoutingRules | 监听器配置加载 |

## 依赖关系图

```
listener_config.py
└── utils.config (SDKConfig)
    ↓
ws_listener.py
```

## 常量定义

```python
ROUTING_MODES = ("agent-all", "smart", "wake-all")
```

## 配置优先级

1. CLI --mode 参数
2. 环境变量（LISTENER_MODE, LISTENER_AGENT_WEBHOOK_URL, 等）
3. 配置文件
4. settings.json
5. 默认值

## 导出接口

```python
__all__ = ["ListenerConfig", "ROUTING_MODES", "RoutingRules"]
```

## 使用说明

```python
# 加载默认配置
from listener_config import ListenerConfig
cfg = ListenerConfig.load()

# 从文件加载
cfg = ListenerConfig.load("config.json")

# 覆盖模式
cfg = ListenerConfig.load(mode_override="agent-all")

# 环境变量覆盖
# export LISTENER_MODE=agent-all
# export LISTENER_AGENT_WEBHOOK_URL=http://127.0.0.1:18789/hooks/agent
```
