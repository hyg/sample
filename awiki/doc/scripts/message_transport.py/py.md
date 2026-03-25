# scripts/message_transport.py 分析

## 文件信息

- **路径**: `python/scripts/message_transport.py`
- **用途**: 消息传输选择和 RPC 辅助工具

## 常量

```python
MESSAGE_RPC = "/message/rpc"
RECEIVE_MODE_HTTP = "http"
RECEIVE_MODE_WEBSOCKET = "websocket"
_VALID_RECEIVE_MODES = {RECEIVE_MODE_HTTP, RECEIVE_MODE_WEBSOCKET}
_WEBSOCKET_FALLBACK_ERROR_MARKERS = (...)
```

## 函数签名

```python
def load_receive_mode(config: SDKConfig | None = None) -> str:
    """Load the configured message receive mode."""

def is_websocket_mode(config: SDKConfig | None = None) -> bool:
    """Return whether the message domain is configured to use WebSocket mode."""

async def http_message_rpc_call(
    method: str,
    params: dict[str, Any] | None = None,
    *,
    credential_name: str = "default",
    config: SDKConfig | None = None,
) -> dict[str, Any]:
    """Call one message RPC method over HTTP JSON-RPC."""

async def message_rpc_call(
    method: str,
    params: dict[str, Any] | None = None,
    *,
    credential_name: str = "default",
    config: SDKConfig | None = None,
) -> dict[str, Any]:
    """Call one message RPC method using the configured transport."""

def write_receive_mode(mode: str, config: SDKConfig | None = None) -> None:
    """Persist the receive mode to settings.json."""

def is_websocket_fallback_error(error_message: str) -> bool:
    """Check if an error message indicates WebSocket fallback."""
```

## 导入的模块

```python
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from credential_store import create_authenticator
from listener_recovery import ensure_listener_runtime, note_listener_healthy
from message_daemon import call_local_daemon, load_local_daemon_settings
from utils.client import create_molt_message_client
from utils.config import SDKConfig
from utils.rpc import authenticated_rpc_call
```

## 依赖关系图

```
message_transport.py
├── credential_store.py (create_authenticator)
├── listener_recovery.py (ensure_listener_runtime, note_listener_healthy)
├── message_daemon.py (call_local_daemon, load_local_daemon_settings)
├── utils/client.py (create_molt_message_client)
├── utils/config.py (SDKConfig)
└── utils/rpc.py (authenticated_rpc_call)
```
