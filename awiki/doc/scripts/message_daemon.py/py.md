# scripts/message_daemon.py 分析

## 文件信息

- **路径**: `python/scripts/message_daemon.py`
- **用途**: 本地消息传输守护进程（localhost TCP）

## 常量和类

```python
DEFAULT_LOCAL_DAEMON_HOST = "127.0.0.1"
DEFAULT_LOCAL_DAEMON_PORT = 18790
_REQUEST_TIMEOUT_SECONDS = 20.0

@dataclass(frozen=True, slots=True)
class LocalDaemonSettings:
    """Resolved local daemon connection settings."""
    host: str
    port: int
    token: str
```

## 函数签名

```python
def load_local_daemon_settings(config: SDKConfig | None = None) -> LocalDaemonSettings:
    """Load local daemon settings from settings.json."""

async def call_local_daemon(
    method: str,
    params: dict[str, Any] | None = None,
    *,
    credential_name: str = "default",
    config: SDKConfig | None = None,
    timeout: float = _REQUEST_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """Call one local daemon RPC method and return its result."""

class LocalMessageDaemon:
    """Local message transport daemon over localhost TCP."""
    
    def __init__(
        self,
        host: str = DEFAULT_LOCAL_DAEMON_HOST,
        port: int = DEFAULT_LOCAL_DAEMON_PORT,
        token: str = "",
    ):
        """Initialize the local daemon server."""
    
    async def start(self) -> None:
        """Start the local daemon server."""
    
    async def stop(self) -> None:
        """Stop the local daemon server."""
    
    async def handle_client(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        """Handle a single client connection."""

def is_local_daemon_available(config: SDKConfig | None = None) -> bool:
    """Check if the local daemon is available and running."""

async def probe_local_daemon(
    host: str | None = None,
    port: int | None = None,
    timeout: float = 5.0,
) -> bool:
    """Probe the local daemon to check if it's running."""
```

## 导入的模块

```python
from __future__ import annotations

import asyncio
import json
import socket
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from utils.config import SDKConfig
```

## 依赖关系图

```
message_daemon.py
└── utils/config.py (SDKConfig)
```

## 协议格式

### 请求格式
```json
{
  "token": "awiki_local_xxx",
  "method": "message_rpc_call",
  "params": {...},
  "credential_name": "default"
}
```

### 响应格式
```json
{
  "ok": true,
  "result": {...}
}
```
