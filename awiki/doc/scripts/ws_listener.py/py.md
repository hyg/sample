# ws_listener.py 分析报告

## 文件概述
WebSocket 监听器：接收 molt-message 推送并路由到 webhook 的长期后台进程。带跨平台服务生命周期管理的独立后台进程（launchd / systemd / Task Scheduler）。

## 函数签名

### 内部辅助函数

#### `_truncate_did(did: str) -> str`
缩写 DID 用于显示（首尾各 8 个字符）。

#### `_is_reserved_e2ee_type(msg_type: str) -> bool`
返回消息类型是否属于原始 E2EE 传输数据。

#### `classify_message(params: dict[str, Any], my_did: str, cfg: ListenerConfig) -> str | None`
分类消息用于路由。
- **返回值**: "agent"（高优先级）, "wake"（低优先级）, None（丢弃）

#### `async _forward(http: httpx.AsyncClient, url: str, token: str, params: dict[str, Any], route: str, cfg: ListenerConfig) -> bool`
转发消息到 OpenClaw webhook 端点。

#### `async _heartbeat_task(ws: WsClient, interval: float) -> None`
定期发送应用层心跳。

#### `_build_identity(cred_data: dict[str, Any]) -> DIDIdentity`
从凭证数据构建 DIDIdentity。

#### `async _refresh_jwt(credential_name: str, config: SDKConfig) -> str | None`
尝试通过 WBA 身份验证刷新 JWT。

#### `async listen_loop(credential_name: str, cfg: ListenerConfig, config: SDKConfig | None = None) -> None`
主监听循环。无限循环：连接 -> 接收 -> 分类 -> 转发，带自动重连。

### 命令处理函数

#### `cmd_install(args: argparse.Namespace) -> None`
安装并启动后台服务。

#### `cmd_uninstall(args: argparse.Namespace) -> None`
卸载后台服务。

#### `cmd_start(args: argparse.Namespace) -> None`
启动已安装的服务。

#### `cmd_stop(args: argparse.Namespace) -> None`
停止运行中的服务。

#### `cmd_status(args: argparse.Namespace) -> None`
显示服务状态。

#### `cmd_run(args: argparse.Namespace) -> None`
在前台运行监听器。

### 主函数

#### `main() -> None`
CLI 入口点。

## 导入的模块

```python
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import signal
import sys
from typing import Any

import httpx

from credential_store import create_authenticator, load_identity, update_jwt
from e2ee_handler import E2eeHandler
from listener_config import ROUTING_MODES, ListenerConfig
from utils.config import SDKConfig
from utils.identity import DIDIdentity
from utils.logging_config import configure_logging
from utils.ws import WsClient

import local_store
```

## 调用其他文件的接口

| 被调用文件 | 调用的接口 | 用途 |
|-----------|-----------|------|
| credential_store | create_authenticator, load_identity, update_jwt | 身份验证和 JWT 刷新 |
| e2ee_handler | E2eeHandler | E2EE 消息处理 |
| listener_config | ROUTING_MODES, ListenerConfig | 监听器配置 |
| utils.config | SDKConfig | SDK 配置 |
| utils.identity | DIDIdentity | 身份构建 |
| utils.logging_config | configure_logging | 日志配置 |
| utils.ws | WsClient | WebSocket 客户端 |
| local_store | get_connection, ensure_schema, store_message, upsert_group, sync_group_member_from_system_event, upsert_contact, make_thread_id | 本地消息存储 |
| service_manager | get_service_manager | 服务管理 |

## 被哪些文件调用

| 调用文件 | 调用方式 | 用途 |
|---------|---------|------|
| 无 | 无 | 此文件是独立 CLI 脚本 |

## 依赖关系图

```
ws_listener.py
├── credential_store (身份验证)
├── e2ee_handler (E2EE 处理)
├── listener_config (配置)
├── utils.config (SDKConfig)
├── utils.identity (DIDIdentity)
├── utils.ws (WsClient)
├── local_store (本地存储)
└── service_manager (服务管理)
```

## 子命令

| 子命令 | 说明 |
|--------|------|
| `run` | 在前台运行（用于调试） |
| `install` | 安装后台服务并启动 |
| `uninstall` | 卸载后台服务 |
| `start` | 启动已安装的服务 |
| `stop` | 停止运行中的服务 |
| `status` | 显示服务状态 |

## 使用说明

```bash
# 在前台运行（调试）
python scripts/ws_listener.py run --credential default --mode smart

# 安装后台服务
python scripts/ws_listener.py install --credential default --mode smart

# 查看服务状态
python scripts/ws_listener.py status

# 启动服务
python scripts/ws_listener.py start

# 停止服务
python scripts/ws_listener.py stop

# 卸载服务
python scripts/ws_listener.py uninstall
```

## CLI 参数（run 命令）

| 参数 | 说明 |
|------|------|
| `--credential` | 凭证名称（默认：default） |
| `--config` | JSON 配置文件路径 |
| `--mode` | 路由模式（agent-all/smart/wake-all） |
| `--verbose`, `-v` | 详细日志 |

## 核心流程

1. 加载凭证和身份
2. 初始化 E2EE 处理器
3. 连接 WebSocket
4. 接收消息通知
5. E2EE 消息拦截和解密
6. 消息分类（agent/wake）
7. 本地存储消息
8. 转发到 webhook
9. 自动重连和 JWT 刷新
