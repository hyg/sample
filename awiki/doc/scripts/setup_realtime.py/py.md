# scripts/setup_realtime.py 分析

## 文件信息

- **路径**: `python/scripts/setup_realtime.py`
- **用途**: 一键设置消息传输模式和实时交付

## 常量

```python
_TOKEN_PLACEHOLDER = "<run: echo awiki_$(openssl rand -hex 32)>"
_OPENCLAW_GATEWAY_PORT = 18789
```

## 函数签名

### 内部辅助函数

```python
def _generate_token() -> str:
    """Generate a secure webhook token with awiki_ prefix."""

def _generate_local_daemon_token() -> str:
    """Generate a secure token for localhost daemon requests."""

def _is_placeholder_token(token: str) -> bool:
    """Check if a token is a template placeholder rather than a real value."""

def _openclaw_config_path() -> Path:
    """Return the path to OpenClaw's config file."""

def _load_json(path: Path) -> dict[str, Any]:
    """Load a JSON file, returning empty dict if missing or invalid."""

def _save_json(path: Path, data: dict[str, Any], secure: bool = False) -> None:
    """Save a JSON file, creating parent directories as needed."""

def _resolve_token(settings_data: dict[str, Any], openclaw_data: dict[str, Any]) -> str:
    """Resolve the webhook token: reuse existing or generate new."""

def _configure_openclaw_hooks(
    openclaw_data: dict[str, Any],
    webhook_url: str,
    token: str,
) -> dict[str, Any]:
    """Configure OpenClaw hooks for message delivery."""

def _configure_settings_listener(
    settings_data: dict[str, Any],
    token: str,
    gateway_port: int,
) -> dict[str, Any]:
    """Configure listener settings in settings.json."""

def _configure_message_transport(
    settings_data: dict[str, Any],
    receive_mode: str,
    daemon_host: str,
    daemon_port: int,
    daemon_token: str,
) -> dict[str, Any]:
    """Configure message transport settings."""

def _write_heartbeat_checklist(config: SDKConfig) -> None:
    """Write the HEARTBEAT.md checklist file."""
```

### 公共函数

```python
def setup_realtime(
    receive_mode: str,
    credential_name: str = "default",
    config: SDKConfig | None = None,
) -> dict[str, Any]:
    """Setup realtime message delivery configuration."""

def remove_realtime(
    config: SDKConfig | None = None,
) -> dict[str, Any]:
    """Remove realtime message delivery configuration."""

def main() -> None:
    """CLI entry point."""
```

## 导入的模块

```python
from __future__ import annotations

import argparse
import json
import logging
import os
import secrets
import sys
from pathlib import Path
from typing import Any

_scripts_dir = os.path.dirname(os.path.abspath(__file__))
if _scripts_dir not in sys.path:
    sys.path.insert(0, _scripts_dir)

from message_daemon import DEFAULT_LOCAL_DAEMON_HOST, DEFAULT_LOCAL_DAEMON_PORT
from message_transport import RECEIVE_MODE_HTTP, RECEIVE_MODE_WEBSOCKET, write_receive_mode
from service_manager import get_service_manager
from utils.config import SDKConfig
from utils.logging_config import configure_logging
```

## 依赖关系图

```
setup_realtime.py
├── message_daemon.py (DEFAULT_LOCAL_DAEMON_HOST, DEFAULT_LOCAL_DAEMON_PORT)
├── message_transport.py (RECEIVE_MODE_HTTP, RECEIVE_MODE_WEBSOCKET, write_receive_mode)
├── service_manager.py (get_service_manager)
├── utils/config.py (SDKConfig)
└── utils/logging_config.py (configure_logging)
```

## CLI 参数

| 参数 | 必需 | 说明 |
|------|------|------|
| `--receive-mode` | 是 | 消息接收模式（http 或 websocket） |
| `--credential` | 否 | 凭证名称（默认：default） |
| `--remove` | 否 | 移除实时配置 |
