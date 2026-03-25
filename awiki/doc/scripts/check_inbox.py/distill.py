#!/usr/bin/env python
"""Distill script for check_inbox.py - records input/output as golden standard.

This script captures the essential structure and interfaces of check_inbox.py
for documentation and testing purposes.
"""

import json
import sys
from typing import Any

# =============================================================================
# Constants (from check_inbox.py)
# =============================================================================

MESSAGE_RPC = "/message/rpc"
GROUP_RPC = "/group/rpc"
_E2EE_MSG_TYPES = {"e2ee_init", "e2ee_ack", "e2ee_msg", "e2ee_rekey", "e2ee_error"}
_E2EE_SESSION_SETUP_TYPES = {"e2ee_init", "e2ee_rekey"}
_E2EE_TYPE_ORDER = {"e2ee_init": 0, "e2ee_ack": 1, "e2ee_rekey": 2, "e2ee_msg": 3, "e2ee_error": 4}
_E2EE_USER_NOTICE = "This is an encrypted message."
_MESSAGE_SCOPES = {"all", "direct", "group"}

# =============================================================================
# Helper Functions (signatures only for distillation)
# =============================================================================


def _message_time_value(message: dict[str, Any]) -> str:
    """Return a sortable timestamp string for one message."""
    timestamp = message.get("sent_at") or message.get("created_at")
    return timestamp if isinstance(timestamp, str) else ""


def _message_sort_key(message: dict[str, Any]) -> tuple[Any, ...]:
    """Build a stable E2EE inbox ordering key with server_seq priority inside a sender stream."""
    sender_did_raw = message.get("sender_did")
    sender_did = sender_did_raw if isinstance(sender_did_raw, str) else ""
    server_seq = message.get("server_seq")
    has_server_seq = 0 if isinstance(server_seq, int) else 1
    server_seq_value = server_seq if isinstance(server_seq, int) else 0
    return (
        sender_did,
        has_server_seq,
        server_seq_value,
        _message_time_value(message),
        _E2EE_TYPE_ORDER.get(message.get("type"), 99),
    )


def _decorate_user_visible_e2ee_message(
    message: dict[str, Any],
    *,
    original_type: str,
    plaintext: str,
) -> dict[str, Any]:
    """Decorate a decrypted E2EE message for user-facing output."""
    rendered = dict(message)
    rendered["type"] = original_type
    rendered["content"] = plaintext
    rendered["_e2ee"] = True
    rendered["_e2ee_notice"] = _E2EE_USER_NOTICE
    rendered.pop("title", None)
    return rendered


def _strip_hidden_user_fields(message: dict[str, Any]) -> dict[str, Any]:
    """Remove fields intentionally hidden from user-facing output."""
    rendered = dict(message)
    rendered.pop("title", None)
    return rendered


def _filter_messages_by_scope(
    messages: list[dict[str, Any]],
    scope: str,
) -> list[dict[str, Any]]:
    """Filter mixed inbox messages by the requested scope."""
    if scope not in _MESSAGE_SCOPES or scope == "all":
        return messages
    if scope == "group":
        return [msg for msg in messages if msg.get("group_id")]
    return [msg for msg in messages if not msg.get("group_id")]


def _parse_group_history_target(target: str) -> str | None:
    """Parse a group-prefixed history target into a group ID."""
    prefix = "group:"
    if not isinstance(target, str) or not target.startswith(prefix):
        return None
    group_id = target[len(prefix):].strip()
    return group_id or None


def _classify_decrypt_error(exc: BaseException) -> tuple[str, str]:
    """Map decryption failures to e2ee_error code and retry hint."""
    msg = str(exc).lower()
    if "unsupported_version" in msg:
        return "unsupported_version", "drop"
    if "session" in msg and ("not found" in msg or "find session" in msg):
        return "session_not_found", "rekey_then_resend"
    if "expired" in msg:
        return "session_expired", "rekey_then_resend"
    if "seq" in msg or "sequence" in msg:
        return "invalid_seq", "rekey_then_resend"
    return "decryption_failed", "resend"


# =============================================================================
# Main Interfaces (documented for distillation)
# =============================================================================

"""
Main Functions (from check_inbox.py):

1. async check_inbox(credential_name: str = "default", limit: int = 20, scope: str = "all") -> None
   - View inbox and immediately process private E2EE messages when possible
   - Input: credential_name, limit, scope
   - Output: JSON inbox with messages, total count, scope

2. async get_history(peer_did: str, credential_name: str = "default", limit: int = 50) -> None
   - View chat history with a specific DID and render E2EE plaintext when possible
   - Input: peer_did, credential_name, limit
   - Output: JSON history with messages, total count

3. async get_group_history(group_id: str, credential_name: str = "default", limit: int = 50, since_seq: int | None = None) -> None
   - View one discovery group's message history
   - Input: group_id, credential_name, limit, since_seq
   - Output: JSON group history with messages, total count, cursor info

4. async mark_read(message_ids: list[str], credential_name: str = "default") -> None
   - Mark messages as read
   - Input: message_ids, credential_name
   - Output: JSON result of mark_read operation
"""

# =============================================================================
# Dependencies (from check_inbox.py)
# =============================================================================

DEPENDENCIES = {
    "utils": [
        "SDKConfig",
        "E2eeClient",
        "create_molt_message_client",
        "create_user_service_client",
        "authenticated_rpc_call",
        "resolve_to_did",
    ],
    "utils.logging_config": ["configure_logging"],
    "credential_store": ["create_authenticator", "load_identity"],
    "e2ee_outbox": ["record_remote_failure"],
    "e2ee_store": ["load_e2ee_state", "save_e2ee_state"],
    "utils.e2ee": [
        "SUPPORTED_E2EE_VERSION",
        "build_e2ee_error_content",
        "build_e2ee_error_message",
    ],
    "local_store": [
        "get_connection",
        "ensure_schema",
        "store_messages_batch",
        "upsert_group",
        "sync_group_member_from_system_event",
        "upsert_contact",
        "make_thread_id",
        "get_message_by_id",
    ],
    "manage_group": ["_persist_group_messages"],
}

# =============================================================================
# Distillation Output
# =============================================================================


def main() -> None:
    """Run distillation and output golden standard."""
    output = {
        "source_file": "python/scripts/check_inbox.py",
        "documentation": "doc/scripts/check_inbox.py/py.md",
        "constants": {
            "MESSAGE_RPC": MESSAGE_RPC,
            "GROUP_RPC": GROUP_RPC,
            "_E2EE_MSG_TYPES": sorted(_E2EE_MSG_TYPES),
            "_E2EE_SESSION_SETUP_TYPES": sorted(_E2EE_SESSION_SETUP_TYPES),
            "_E2EE_TYPE_ORDER": _E2EE_TYPE_ORDER,
            "_MESSAGE_SCOPES": sorted(_MESSAGE_SCOPES),
        },
        "helper_functions": [
            "_message_time_value",
            "_message_sort_key",
            "_decorate_user_visible_e2ee_message",
            "_strip_hidden_user_fields",
            "_filter_messages_by_scope",
            "_parse_group_history_target",
            "_classify_decrypt_error",
        ],
        "main_interfaces": [
            "check_inbox",
            "get_history",
            "get_group_history",
            "mark_read",
        ],
        "dependencies": DEPENDENCIES,
        "usage_examples": [
            "uv run python scripts/check_inbox.py",
            "uv run python scripts/check_inbox.py --limit 5",
            'uv run python scripts/check_inbox.py --history "did:wba:localhost:user:abc123"',
            "uv run python scripts/check_inbox.py --scope group",
            "uv run python scripts/check_inbox.py --group-id grp_123 --limit 50",
            "uv run python scripts/check_inbox.py --mark-read msg_id_1 msg_id_2",
        ],
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()

# =============================================================================
# 附录：补充场景测�?- 空收件箱、分页测�?
# =============================================================================

def test_check_inbox_empty(credential_name='default', limit=20):
    """测试空收件箱场景"""
    input_data = {'scenario': 'check_inbox_empty', 'credential_name': credential_name, 'limit': limit}
    output_data = {'messages': None, 'total': None, 'is_empty': False, 'error': None}
    try:
        from check_inbox import check_inbox
        result = check_inbox(credential_name=credential_name, limit=limit)
        output_data['messages'] = result if result else []
        output_data['total'] = len(result) if result else 0
        output_data['is_empty'] = output_data['total'] == 0
        return {'input': input_data, 'output': output_data, 'success': True}
    except Exception as e:
        output_data['error'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': False}

def test_check_inbox_pagination(credential_name='default', limit=10):
    """测试大量消息分页"""
    input_data = {'scenario': 'check_inbox_pagination', 'credential_name': credential_name, 'limit': limit}
    output_data = {'messages': None, 'total': None, 'has_more': False, 'error': None}
    try:
        from check_inbox import check_inbox
        result = check_inbox(credential_name=credential_name, limit=limit)
        output_data['messages'] = result if result else []
        output_data['total'] = len(result) if result else 0
        output_data['has_more'] = output_data['total'] == limit
        return {'input': input_data, 'output': output_data, 'success': True}
    except Exception as e:
        output_data['error'] = str(e)
        return {'input': input_data, 'output': output_data, 'success': False}
