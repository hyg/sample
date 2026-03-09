"""Unified status check: identity verification + inbox categorized summary + E2EE auto-processing.

Usage:
    python scripts/check_status.py                     # Status check with E2EE auto-processing
    python scripts/check_status.py --no-auto-e2ee      # Disable E2EE auto-processing
    python scripts/check_status.py --credential alice   # Specify credential

[INPUT]: SDK (RPC calls, E2eeClient), credential_store (authenticator factory),
         e2ee_store, credential_migration, database_migration, logging_config
[OUTPUT]: Structured JSON status report (identity + inbox + e2ee_auto + e2ee_sessions),
          with inbox refreshed after optional auto-processing
[POS]: Unified status check entry point for Agent session startup and heartbeat calls
       with default-on, server_seq-aware E2EE auto-processing (HPKE E2EE scheme)

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updating
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from utils import (
    SDKConfig,
    E2eeClient,
    create_user_service_client,
    create_molt_message_client,
    authenticated_rpc_call,
)
from utils.logging_config import configure_logging
from credential_migration import ensure_credential_storage_ready
from database_migration import ensure_local_database_ready
from credential_store import load_identity, create_authenticator
from e2ee_store import load_e2ee_state, save_e2ee_state
from e2ee_outbox import record_remote_failure


MESSAGE_RPC = "/message/rpc"
AUTH_RPC = "/user-service/did-auth/rpc"
logger = logging.getLogger(__name__)

# E2EE protocol message types
_E2EE_HANDSHAKE_TYPES = {"e2ee_init", "e2ee_ack", "e2ee_rekey", "e2ee_error"}
_E2EE_SESSION_SETUP_TYPES = {"e2ee_init", "e2ee_rekey"}
_E2EE_MSG_TYPES = {"e2ee_init", "e2ee_ack", "e2ee_msg", "e2ee_rekey", "e2ee_error"}
_E2EE_TYPE_ORDER = {"e2ee_init": 0, "e2ee_ack": 1, "e2ee_rekey": 2, "e2ee_msg": 3, "e2ee_error": 4}


def _message_sort_key(message: dict[str, Any]) -> tuple[Any, ...]:
    """Build a stable E2EE inbox ordering key with server_seq priority inside a sender stream."""
    sender_did = message.get("sender_did", "")
    server_seq = message.get("server_seq")
    has_server_seq = 0 if isinstance(server_seq, int) else 1
    server_seq_value = server_seq if isinstance(server_seq, int) else 0
    return (
        sender_did,
        has_server_seq,
        server_seq_value,
        message.get("created_at", ""),
        _E2EE_TYPE_ORDER.get(message.get("type"), 99),
    )


def _is_user_visible_message_type(msg_type: str) -> bool:
    """Return whether a message type should be exposed to end users."""
    return msg_type not in _E2EE_MSG_TYPES


# ---------- E2EE helpers ----------

def _load_or_create_e2ee_client(
    local_did: str, credential_name: str
) -> E2eeClient:
    """Load existing E2EE client state from disk, or create a new client if absent."""
    # Load E2EE keys from credential
    cred = load_identity(credential_name)
    signing_pem: str | None = None
    x25519_pem: str | None = None
    if cred is not None:
        signing_pem = cred.get("e2ee_signing_private_pem")
        x25519_pem = cred.get("e2ee_agreement_private_pem")

    state = load_e2ee_state(credential_name)
    if state is not None and state.get("local_did") == local_did:
        if signing_pem is not None:
            state["signing_pem"] = signing_pem
        if x25519_pem is not None:
            state["x25519_pem"] = x25519_pem
        return E2eeClient.from_state(state)

    return E2eeClient(local_did, signing_pem=signing_pem, x25519_pem=x25519_pem)


def _save_e2ee_client(client: E2eeClient, credential_name: str) -> None:
    """Save E2EE client state to disk."""
    save_e2ee_state(client.export_state(), credential_name)


async def _send_msg(http_client, sender_did, receiver_did, msg_type, content, *, auth, credential_name="default"):
    """Send a message (E2EE or plain)."""
    if isinstance(content, dict):
        content = json.dumps(content)
    return await authenticated_rpc_call(
        http_client, MESSAGE_RPC, "send",
        params={
            "sender_did": sender_did,
            "receiver_did": receiver_did,
            "content": content,
            "type": msg_type,
        },
        auth=auth,
        credential_name=credential_name,
    )


# ---------- Core functions ----------

async def check_identity(credential_name: str = "default") -> dict[str, Any]:
    """Check identity status; automatically refresh expired JWT."""
    data = load_identity(credential_name)
    if data is None:
        return {"status": "no_identity", "did": None, "name": None, "jwt_valid": False}

    result: dict[str, Any] = {
        "status": "ok",
        "did": data["did"],
        "name": data.get("name"),
        "jwt_valid": False,
    }

    if not data.get("jwt_token"):
        result["status"] = "no_jwt"
        return result

    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        result["status"] = "no_did_document"
        result["error"] = "Credential missing DID document; please recreate identity"
        return result

    auth, _ = auth_result
    old_token = data["jwt_token"]

    try:
        async with create_user_service_client(config) as client:
            await authenticated_rpc_call(
                client, AUTH_RPC, "get_me",
                auth=auth, credential_name=credential_name,
            )
            result["jwt_valid"] = True
            # Check if token was refreshed (authenticated_rpc_call auto-persists new JWT)
            refreshed_data = load_identity(credential_name)
            if refreshed_data and refreshed_data.get("jwt_token") != old_token:
                result["jwt_refreshed"] = True
    except Exception as e:
        result["status"] = "jwt_refresh_failed"
        result["error"] = str(e)

    return result


async def summarize_inbox(
    credential_name: str = "default",
) -> dict[str, Any]:
    """Fetch inbox and compute categorized statistics."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        return {"status": "no_identity", "total": 0}

    auth, data = auth_result
    try:
        async with create_molt_message_client(config) as client:
            inbox = await authenticated_rpc_call(
                client, MESSAGE_RPC, "get_inbox",
                params={"user_did": data["did"], "limit": 50},
                auth=auth, credential_name=credential_name,
            )
    except Exception as e:
        return {"status": "error", "error": str(e), "total": 0}

    messages = inbox.get("messages", [])

    # Count only user-visible messages. Protocol and encrypted transport
    # messages are internal and should not be surfaced directly to users.
    by_type: dict[str, int] = {}
    text_by_sender: dict[str, dict[str, Any]] = {}
    text_count = 0
    visible_total = 0

    for msg in messages:
        msg_type = msg.get("type", "unknown")
        if not _is_user_visible_message_type(msg_type):
            continue

        visible_total += 1
        sender_did = msg.get("sender_did", "unknown")
        created_at = msg.get("created_at", "")

        by_type[msg_type] = by_type.get(msg_type, 0) + 1

        if msg_type == "text":
            text_count += 1
            if sender_did not in text_by_sender:
                text_by_sender[sender_did] = {"count": 0, "latest": ""}
            text_by_sender[sender_did]["count"] += 1
            if created_at > text_by_sender[sender_did]["latest"]:
                text_by_sender[sender_did]["latest"] = created_at

    return {
        "status": "ok",
        "total": visible_total,
        "by_type": by_type,
        "text_messages": text_count,
        "text_by_sender": text_by_sender,
    }


async def auto_process_e2ee(
    credential_name: str = "default",
) -> dict[str, Any]:
    """Automatically process E2EE protocol messages (init/rekey/error) in inbox."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        return {"status": "no_identity", "processed": 0, "details": []}

    auth, data = auth_result
    try:
        async with create_molt_message_client(config) as client:
            # Get inbox
            inbox = await authenticated_rpc_call(
                client, MESSAGE_RPC, "get_inbox",
                params={"user_did": data["did"], "limit": 50},
                auth=auth, credential_name=credential_name,
            )
            messages = inbox.get("messages", [])

            # Filter E2EE protocol messages (excluding encrypted messages themselves)
            e2ee_msgs = [
                m for m in messages
                if m.get("type") in _E2EE_HANDSHAKE_TYPES
            ]

            if not e2ee_msgs:
                return {"status": "ok"}

            # Sort by sender stream + server_seq, fallback to created_at.
            e2ee_msgs.sort(key=_message_sort_key)

            e2ee_client = _load_or_create_e2ee_client(data["did"], credential_name)
            processed_ids: list[str] = []

            for msg in e2ee_msgs:
                msg_type = msg["type"]
                sender_did = msg.get("sender_did", "")
                content = json.loads(msg["content"]) if isinstance(msg.get("content"), str) else msg.get("content", {})

                try:
                    if msg_type == "e2ee_error":
                        record_remote_failure(
                            credential_name=credential_name,
                            peer_did=sender_did,
                            content=content,
                        )
                    responses = await e2ee_client.process_e2ee_message(msg_type, content)
                    session_ready = True
                    terminal_error_notified = any(
                        resp_type == "e2ee_error" for resp_type, _ in responses
                    )
                    if msg_type in _E2EE_SESSION_SETUP_TYPES:
                        session_ready = e2ee_client.has_session_id(content.get("session_id"))
                    # Route responses to sender_did
                    for resp_type, resp_content in responses:
                        await _send_msg(
                            client, data["did"], sender_did, resp_type, resp_content,
                            auth=auth, credential_name=credential_name,
                        )

                    if session_ready:
                        processed_ids.append(msg["id"])
                    elif terminal_error_notified:
                        processed_ids.append(msg["id"])
                except Exception as e:
                    logger.warning(
                        "E2EE auto-processing failed type=%s sender=%s error=%s",
                        msg_type,
                        sender_did,
                        e,
                    )

            # Mark processed messages as read
            if processed_ids:
                await authenticated_rpc_call(
                    client, MESSAGE_RPC, "mark_read",
                    params={"user_did": data["did"], "message_ids": processed_ids},
                    auth=auth, credential_name=credential_name,
                )

            # Save E2EE state
            _save_e2ee_client(e2ee_client, credential_name)

            return {
                "status": "ok",
            }

    except Exception as e:
        return {"status": "error", "error": str(e)}


async def check_status(
    credential_name: str = "default",
    auto_e2ee: bool = True,
) -> dict[str, Any]:
    """Unified status check orchestrator."""
    report: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    report["credential_layout"] = ensure_credential_storage_ready(credential_name)
    if not report["credential_layout"]["credential_ready"]:
        report["identity"] = {
            "status": "storage_migration_required",
            "did": None,
            "name": None,
            "jwt_valid": False,
            "error": "Credential storage migration failed or is incomplete",
        }
        report["inbox"] = {"status": "skipped", "total": 0}
        report["e2ee_sessions"] = {"active": 0}
        return report

    report["local_database"] = ensure_local_database_ready()
    if report["local_database"]["status"] == "error":
        report["identity"] = {
            "status": "local_database_migration_failed",
            "did": None,
            "name": None,
            "jwt_valid": False,
            "error": "Local database migration failed",
        }
        report["inbox"] = {"status": "skipped", "total": 0}
        report["e2ee_sessions"] = {"active": 0}
        return report

    # 1. Identity check
    report["identity"] = await check_identity(credential_name)

    # Return early if identity does not exist
    if report["identity"]["status"] == "no_identity":
        report["inbox"] = {"status": "skipped", "total": 0}
        report["e2ee_sessions"] = {"active": 0}
        return report

    # 2. Inbox summary
    report["inbox"] = await summarize_inbox(credential_name)

    # 3. E2EE auto-processing (optional)
    if auto_e2ee:
        report["e2ee_auto"] = await auto_process_e2ee(credential_name)
        # Refresh inbox so the report reflects the post-processing state.
        report["inbox"] = await summarize_inbox(credential_name)

    # 4. E2EE session status
    e2ee_state = load_e2ee_state(credential_name)
    if e2ee_state is not None:
        sessions = e2ee_state.get("sessions", [])
        active_count = len(sessions)
        report["e2ee_sessions"] = {"active": active_count}
    else:
        report["e2ee_sessions"] = {"active": 0}

    return report


def main() -> None:
    configure_logging(console_level=None, mirror_stdio=True)

    parser = argparse.ArgumentParser(description="Unified status check")
    parser.add_argument(
        "--no-auto-e2ee", action="store_true",
        help="Disable automatic processing of E2EE protocol messages in inbox",
    )
    parser.add_argument(
        "--credential", type=str, default="default",
        help="Credential name (default: default)",
    )
    args = parser.parse_args()
    logging.getLogger(__name__).info(
        "check_status CLI started credential=%s auto_e2ee=%s",
        args.credential,
        not args.no_auto_e2ee,
    )

    report = asyncio.run(check_status(args.credential, not args.no_auto_e2ee))
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
