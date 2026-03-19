"""Unit tests for setup_identity CLI load behavior.

[INPUT]: setup_identity load helper with monkeypatched credential/auth/RPC dependencies
[OUTPUT]: Regression coverage for automatic JWT bootstrap and legacy fallback messaging
[POS]: CLI unit tests for identity loading and verification behavior

[PROTOCOL]:
1. Update this header when logic changes
2. Check the containing folder's CLAUDE.md after updates
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any

import pytest

_scripts_dir = Path(__file__).resolve().parent.parent / "scripts"
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))

import setup_identity  # noqa: E402


class _DummyAsyncClient:
    """Minimal async context manager used by mocked RPC calls."""

    async def __aenter__(self) -> "_DummyAsyncClient":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        del exc_type, exc, tb


def test_load_saved_identity_bootstraps_missing_jwt(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Loading should auto-issue and persist a JWT when one is missing."""
    credential_data = {
        "did": "did:alice",
        "unique_id": "k1_alice",
        "user_id": "user-1",
        "name": "Alice",
        "created_at": "2026-03-11T10:00:00Z",
        "jwt_token": None,
    }

    async def _fake_authenticated_rpc_call(
        client,
        endpoint: str,
        method: str,
        params: dict[str, Any] | None = None,
        request_id: int | str = 1,
        *,
        auth: Any,
        credential_name: str,
    ) -> dict[str, Any]:
        del client, endpoint, method, params, request_id, auth, credential_name
        credential_data["jwt_token"] = "jwt-new"
        return {"did": "did:alice", "name": "Alice"}

    monkeypatch.setattr(
        setup_identity, "load_identity", lambda credential_name: dict(credential_data)
    )
    monkeypatch.setattr(
        setup_identity, "create_authenticator", lambda credential_name, config: (
            object(),
            dict(credential_data),
        )
    )
    monkeypatch.setattr(
        setup_identity, "create_user_service_client", lambda config: _DummyAsyncClient()
    )
    monkeypatch.setattr(
        setup_identity, "authenticated_rpc_call", _fake_authenticated_rpc_call
    )

    asyncio.run(setup_identity.load_saved_identity("alice"))

    output = capsys.readouterr().out
    assert "JWT bootstrap succeeded and was saved automatically." in output
    assert "DID: did:alice" in output
    assert credential_data["jwt_token"] == "jwt-new"


def test_load_saved_identity_without_jwt_or_auth_files_requests_recreation(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Legacy credentials without JWT or DID auth files should ask for recreation."""
    credential_data = {
        "did": "did:alice",
        "unique_id": "k1_alice",
        "user_id": "user-1",
        "name": "Alice",
        "created_at": "2026-03-11T10:00:00Z",
        "jwt_token": None,
    }

    monkeypatch.setattr(
        setup_identity, "load_identity", lambda credential_name: dict(credential_data)
    )
    monkeypatch.setattr(
        setup_identity,
        "create_authenticator",
        lambda credential_name, config: None,
    )

    asyncio.run(setup_identity.load_saved_identity("alice"))

    output = capsys.readouterr().out
    assert "No JWT token is saved and DID auth files are missing." in output
    assert (
        'uv run python scripts/setup_identity.py --name "Alice" --credential alice'
        in output
    )
