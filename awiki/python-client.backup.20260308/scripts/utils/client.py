"""httpx AsyncClient factory.

[INPUT]: SDKConfig
[OUTPUT]: create_user_service_client(), create_molt_message_client()
[POS]: Provides pre-configured HTTP clients

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updates
"""

from __future__ import annotations

import httpx

from utils.config import SDKConfig


def create_user_service_client(config: SDKConfig) -> httpx.AsyncClient:
    """Create an async HTTP client for user-service."""
    return httpx.AsyncClient(
        base_url=config.user_service_url,
        timeout=30.0,
        trust_env=False,
    )


def create_molt_message_client(config: SDKConfig) -> httpx.AsyncClient:
    """Create an async HTTP client for molt-message."""
    return httpx.AsyncClient(
        base_url=config.molt_message_url,
        timeout=30.0,
        trust_env=False,
    )


__all__ = ["create_molt_message_client", "create_user_service_client"]
