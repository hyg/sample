"""Tests for check_status inbox surfacing and automatic E2EE delivery.

[INPUT]: check_status inbox helpers with monkeypatched RPC/auth/E2EE dependencies
[OUTPUT]: Regression coverage for plaintext delivery, handshake summaries, and
          auto-E2EE metrics in check_status.py
[POS]: Unit tests for user-visible inbox reporting in the unified status CLI

[PROTOCOL]:
1. Update this header when logic changes
2. Check the containing folder's CLAUDE.md after updates
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any

import pytest

_scripts_dir = Path(__file__).resolve().parent.parent / "scripts"
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))

import check_status  # noqa: E402


class _DummyAsyncClient:
    """Minimal async context manager used by mocked RPC calls."""

    async def __aenter__(self) -> "_DummyAsyncClient":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        del exc_type, exc, tb


class _FakeE2eeClient:
    """Small E2EE client stub for inbox processing tests."""

    def __init__(self) -> None:
        self.process_calls: list[tuple[str, dict[str, Any]]] = []
        self.decrypt_calls: list[dict[str, Any]] = []

    async def process_e2ee_message(
        self,
        msg_type: str,
        content: dict[str, Any],
    ) -> list[tuple[str, dict[str, Any]]]:
        self.process_calls.append((msg_type, content))
        return [("e2ee_ack", {"session_id": content.get("session_id")})]

    def has_session_id(self, session_id: str | None) -> bool:
        return session_id == "sess-1"

    def decrypt_message(self, content: dict[str, Any]) -> tuple[str, str]:
        self.decrypt_calls.append(content)
        return "text", "Secret hello"

    def export_state(self) -> dict[str, Any]:
        return {"sessions": [{"session_id": "sess-1"}]}


def test_summarize_inbox_hides_protocol_messages_from_user_output(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Summary mode should keep protocol messages hidden from user output."""

    async def _fake_authenticated_rpc_call(
        client,
        endpoint: str,
        method: str,
        params: dict[str, Any],
        *,
        auth: Any,
        credential_name: str,
    ) -> dict[str, Any]:
        del client, endpoint, params, auth, credential_name
        assert method == "get_inbox"
        return {
            "messages": [
                {
                    "id": "init-1",
                    "type": "e2ee_init",
                    "sender_did": "did:bob",
                    "content": json.dumps({"session_id": "sess-1"}),
                    "created_at": "2026-03-11T09:00:00Z",
                },
                {
                    "id": "plain-1",
                    "type": "text",
                    "sender_did": "did:carol",
                    "content": "Hello",
                    "created_at": "2026-03-11T09:05:00Z",
                },
            ]
        }

    monkeypatch.setattr(
        check_status, "create_authenticator", lambda credential_name, config: (
            object(),
            {"did": "did:alice"},
        )
    )
    monkeypatch.setattr(
        check_status, "create_molt_message_client", lambda config: _DummyAsyncClient()
    )
    monkeypatch.setattr(
        check_status, "authenticated_rpc_call", _fake_authenticated_rpc_call
    )

    report = asyncio.run(check_status.summarize_inbox("alice"))

    assert report["status"] == "ok"
    assert report["total"] == 1
    assert report["messages"] == [
        {
            "id": "plain-1",
            "type": "text",
            "sender_did": "did:carol",
            "content": "Hello",
            "created_at": "2026-03-11T09:05:00Z",
        }
    ]


def test_check_identity_bootstraps_missing_jwt_via_did_auth(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Identity status should stay OK when a missing JWT is re-issued automatically."""
    credential_data = {
        "did": "did:alice",
        "name": "Alice",
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

    monkeypatch.setattr(check_status, "load_identity", lambda credential_name: dict(credential_data))
    monkeypatch.setattr(
        check_status, "create_authenticator", lambda credential_name, config: (
            object(),
            dict(credential_data),
        )
    )
    monkeypatch.setattr(
        check_status, "create_user_service_client", lambda config: _DummyAsyncClient()
    )
    monkeypatch.setattr(
        check_status, "authenticated_rpc_call", _fake_authenticated_rpc_call
    )

    result = asyncio.run(check_status.check_identity("alice"))

    assert result["status"] == "ok"
    assert result["jwt_valid"] is True
    assert result["jwt_refreshed"] is True
    assert credential_data["jwt_token"] == "jwt-new"


def test_auto_e2ee_builds_plaintext_inbox_report(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Auto-E2EE mode should surface decrypted plaintext and mark handled items read."""
    fake_client = _FakeE2eeClient()
    sent_calls: list[tuple[str, dict[str, Any]]] = []
    marked_read: list[str] = []

    async def _fake_authenticated_rpc_call(
        client,
        endpoint: str,
        method: str,
        params: dict[str, Any],
        *,
        auth: Any,
        credential_name: str,
    ) -> dict[str, Any]:
        del client, endpoint, auth, credential_name
        if method == "get_inbox":
            return {
                "messages": [
                    {
                        "id": "init-1",
                        "type": "e2ee_init",
                        "sender_did": "did:bob",
                        "content": json.dumps(
                            {"session_id": "sess-1", "sender_did": "did:bob"}
                        ),
                        "created_at": "2026-03-11T09:00:00Z",
                    },
                    {
                        "id": "cipher-1",
                        "type": "e2ee_msg",
                        "sender_did": "did:bob",
                        "content": json.dumps({"session_id": "sess-1"}),
                        "created_at": "2026-03-11T09:02:00Z",
                    },
                    {
                        "id": "plain-1",
                        "type": "text",
                        "sender_did": "did:carol",
                        "content": "Hello",
                        "created_at": "2026-03-11T09:01:00Z",
                    },
                ]
            }
        if method == "send":
            sent_calls.append((params["type"], json.loads(params["content"])))
            return {"id": "resp-1"}
        if method == "mark_read":
            marked_read.extend(params["message_ids"])
            return {"ok": True}
        raise AssertionError(f"Unexpected RPC method: {method}")

    monkeypatch.setattr(
        check_status, "create_authenticator", lambda credential_name, config: (
            object(),
            {"did": "did:alice"},
        )
    )
    monkeypatch.setattr(
        check_status, "create_molt_message_client", lambda config: _DummyAsyncClient()
    )
    monkeypatch.setattr(
        check_status, "authenticated_rpc_call", _fake_authenticated_rpc_call
    )
    monkeypatch.setattr(
        check_status,
        "_load_or_create_e2ee_client",
        lambda local_did, credential_name: fake_client,
    )
    monkeypatch.setattr(
        check_status, "_save_e2ee_client", lambda client, credential_name: None
    )

    inbox_report = asyncio.run(check_status._build_inbox_report_with_auto_e2ee("alice"))

    assert inbox_report["status"] == "ok"
    assert inbox_report["total"] == 2
    assert inbox_report["by_type"] == {"text": 2}
    assert inbox_report["text_messages"] == 2
    assert inbox_report["messages"][0]["content"] == "Secret hello"
    assert inbox_report["messages"][0]["is_e2ee"] is True
    assert inbox_report["messages"][0]["e2ee_notice"] == (
        "This is an encrypted message."
    )
    assert inbox_report["messages"][1]["content"] == "Hello"

    assert marked_read == ["init-1", "cipher-1"]
    assert sent_calls == [("e2ee_ack", {"session_id": "sess-1"})]


def test_check_status_uses_auto_e2ee_inbox_report(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unified status should attach auto-decrypted inbox content."""
    monkeypatch.setattr(
        check_status,
        "ensure_local_upgrade_ready",
        lambda credential_name: {
            "status": "ready",
            "credential_ready": True,
            "database_ready": True,
            "performed": [],
            "credential_layout": {"credential_ready": True, "status": "ready"},
            "local_database": {"status": "ready"},
        },
    )

    async def _fake_check_identity(credential_name: str) -> dict[str, Any]:
        del credential_name
        return {
            "status": "ok",
            "did": "did:alice",
            "name": "Alice",
            "jwt_valid": True,
        }

    async def _fake_auto_inbox(
        credential_name: str,
    ) -> dict[str, Any]:
        assert credential_name == "alice"
        return {
            "status": "ok",
            "total": 1,
            "by_type": {"text": 1},
            "text_messages": 1,
            "text_by_sender": {"did:bob": {"count": 1, "latest": "2026-03-11T09:00:00Z"}},
            "messages": [{"id": "cipher-1", "content": "Secret hello", "is_e2ee": True}],
        }

    monkeypatch.setattr(check_status, "check_identity", _fake_check_identity)
    monkeypatch.setattr(
        check_status,
        "summarize_group_watch",
        lambda owner_did: {"status": "ok", "active_groups": 0, "groups": []},
    )
    monkeypatch.setattr(
        check_status,
        "_build_inbox_report_with_auto_e2ee",
        _fake_auto_inbox,
    )
    monkeypatch.setattr(check_status, "load_e2ee_state", lambda credential_name: None)

    report = asyncio.run(check_status.check_status("alice"))

    assert report["inbox"]["messages"][0]["content"] == "Secret hello"
    assert report["inbox"]["messages"][0]["is_e2ee"] is True
    assert "e2ee_auto" not in report
