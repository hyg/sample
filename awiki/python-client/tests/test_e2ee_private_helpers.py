"""Unit tests for private E2EE helper behavior.

Tests private-chat specific error mapping and inbox ordering helpers without
network access or persistent credentials.
"""

from __future__ import annotations

import sys
from pathlib import Path

_scripts_dir = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(_scripts_dir))

import e2ee_messaging
import e2ee_handler
import check_inbox
from utils import e2ee as e2ee_utils


class TestDecryptErrorClassification:
    """Private decrypt errors should map to stable codes and retry hints."""

    def test_handler_classifies_session_not_found(self):
        assert e2ee_handler.E2eeHandler._classify_error(
            RuntimeError("Cannot find session for session_id=abc")
        ) == ("session_not_found", "rekey_then_resend")

    def test_cli_classifies_invalid_seq(self):
        assert e2ee_messaging._classify_decrypt_error(
            RuntimeError("Invalid seq: 8")
        ) == ("invalid_seq", "rekey_then_resend")

    def test_cli_classifies_generic_failure(self):
        assert e2ee_messaging._classify_decrypt_error(
            RuntimeError("ciphertext authentication failed")
        ) == ("decryption_failed", "resend")

    def test_cli_classifies_unsupported_version(self):
        assert e2ee_messaging._classify_decrypt_error(
            RuntimeError("unsupported_version: missing e2ee_version (required 1.1)")
        ) == ("unsupported_version", "drop")


class TestProtocolErrorClassification:
    """Protocol proof failures should map to sender-visible errors."""

    def test_protocol_classifies_proof_expired(self):
        assert e2ee_utils._classify_protocol_error(
            ValueError("e2ee_init proof verification failed: proof_expired")
        ) == ("proof_expired", "resend")

    def test_protocol_classifies_proof_from_future(self):
        assert e2ee_utils._classify_protocol_error(
            ValueError("e2ee_init proof verification failed: proof_from_future")
        ) == ("proof_from_future", "drop")

    def test_protocol_classifies_unsupported_version(self):
        assert e2ee_utils._classify_protocol_error(
            ValueError("unsupported_version: missing e2ee_version (required 1.1)")
        ) == ("unsupported_version", "drop")


class TestErrorMessageText:
    """Human-readable e2ee_error text should stay stable and consistent."""

    def test_upgrade_message_is_consistent(self):
        message = e2ee_utils.build_e2ee_error_message(
            "unsupported_version",
            required_e2ee_version="1.1",
        )
        assert "upgrade" in message.lower()
        assert "1.1" in message


class TestInboxSortKey:
    """Inbox sorting should prioritize server_seq within the sender stream."""

    def test_message_sort_key_prefers_server_seq(self):
        messages = [
            {
                "sender_did": "did:a",
                "server_seq": 9,
                "created_at": "2026-03-07T12:31:00Z",
                "type": "e2ee_msg",
            },
            {
                "sender_did": "did:a",
                "server_seq": 8,
                "created_at": "2026-03-07T12:32:00Z",
                "type": "e2ee_init",
            },
        ]

        messages.sort(key=e2ee_messaging._message_sort_key)

        assert messages[0]["server_seq"] == 8
        assert messages[1]["server_seq"] == 9


class TestOutgoingHistoryRender:
    """Outgoing encrypted history items should be replaceable with local plaintext."""

    def test_render_outgoing_message_without_local_copy_returns_none(self):
        rendered = check_inbox._render_local_outgoing_e2ee_message(
            "default",
            {"id": "missing"},
        )
        assert rendered is None
