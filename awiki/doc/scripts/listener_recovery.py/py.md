# scripts/listener_recovery.py 分析

## 文件信息

- **路径**: `python/scripts/listener_recovery.py`
- **用途**: 监听器运行时健康和自动恢复辅助工具

## 常量

```python
_MAX_AUTO_RESTART_FAILURES = 3
_STATE_FILE_NAME = "listener_recovery.json"
```

## 函数签名

### 内部函数

```python
def _state_path(config: SDKConfig | None = None) -> Path:
    """Return the persisted listener recovery state file path."""

def _default_state() -> dict[str, Any]:
    """Return the default on-disk state structure."""

def _normalize_entry(entry: dict[str, Any] | None) -> dict[str, Any]:
    """Normalize one credential entry loaded from disk."""

def _load_state(config: SDKConfig | None = None) -> dict[str, Any]:
    """Load the full persisted runtime state from disk."""

def _save_state(data: dict[str, Any], config: SDKConfig | None = None) -> None:
    """Persist the runtime state to disk."""

def _get_entry(state: dict[str, Any], credential_name: str) -> dict[str, Any]:
    """Get or create a credential entry in the state."""

def _format_timestamp(dt: datetime | None) -> str | None:
    """Format a datetime as ISO string."""

def _parse_timestamp(iso_str: str | None) -> datetime | None:
    """Parse an ISO string as datetime."""
```

### 公共函数

```python
def get_recovery_state(credential_name: str, config: SDKConfig | None = None) -> dict[str, Any]:
    """Get the recovery state for a credential."""

def save_recovery_state(credential_name: str, state: dict[str, Any], config: SDKConfig | None = None) -> None:
    """Save the recovery state for a credential."""

def note_listener_start_attempt(credential_name: str, config: SDKConfig | None = None) -> None:
    """Record a listener start attempt."""

def note_listener_start_result(
    credential_name: str,
    result: str,
    error: str | None = None,
    config: SDKConfig | None = None
) -> None:
    """Record the result of a listener start attempt."""

def should_auto_restart(credential_name: str, config: SDKConfig | None = None) -> bool:
    """Check if auto-restart should be attempted."""

def get_backoff_delay(credential_name: str, config: SDKConfig | None = None) -> int:
    """Get the backoff delay in seconds for restart attempts."""

def ensure_listener_runtime(
    credential_name: str,
    config: SDKConfig | None = None
) -> tuple[bool, dict[str, Any]]:
    """Ensure listener runtime is available, restarting if needed."""

def note_listener_healthy(credential_name: str, config: SDKConfig | None = None) -> None:
    """Mark the listener as healthy after successful operation."""

def reset_failure_count(credential_name: str, config: SDKConfig | None = None) -> None:
    """Reset the failure count for a credential."""
```

## 导入的模块

```python
from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from message_daemon import is_local_daemon_available
from utils.config import SDKConfig
```

## 依赖关系图

```
listener_recovery.py
├── message_daemon.py (is_local_daemon_available)
├── utils/config.py (SDKConfig)
├── json
├── logging
├── time
└── datetime
```

## 状态文件结构

```json
{
  "credentials": {
    "credential_name": {
      "consecutive_restart_failures": 0,
      "last_restart_attempt_at": "2024-01-01T00:00:00Z",
      "last_restart_result": "success",
      "last_error": null,
      "auto_restart_paused": false
    }
  }
}
```
