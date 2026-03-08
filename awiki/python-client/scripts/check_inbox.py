"""Check inbox, view chat history, mark messages as read.

Usage:
    # View inbox
    uv run python scripts/check_inbox.py

    # Limit result count
    uv run python scripts/check_inbox.py --limit 5

    # View chat history with a specific DID
    uv run python scripts/check_inbox.py --history "did:wba:localhost:user:abc123"

    # Mark messages as read
    uv run python scripts/check_inbox.py --mark-read msg_id_1 msg_id_2

[INPUT]: SDK (RPC calls), credential_store (load identity credentials), local_store,
         E2EE runtime helpers and outbox tracking
[OUTPUT]: Inbox message list / chat history / mark-read result, with immediate
          private E2EE protocol processing and plaintext decryption when possible
[POS]: Message receiving and processing script

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updating
"""

import argparse
import asyncio
import json
import logging
import sys
from typing import Any

from utils import (
    SDKConfig,
    E2eeClient,
    create_molt_message_client,
    authenticated_rpc_call,
    resolve_to_did,
)

logger = logging.getLogger(__name__)
from credential_store import create_authenticator, load_identity
from e2ee_outbox import record_remote_failure
from e2ee_store import load_e2ee_state, save_e2ee_state
from utils.e2ee import (
    SUPPORTED_E2EE_VERSION,
    build_e2ee_error_content,
    build_e2ee_error_message,
)
import local_store


MESSAGE_RPC = "/message/rpc"
_E2EE_MSG_TYPES = {"e2ee_init", "e2ee_ack", "e2ee_msg", "e2ee_rekey", "e2ee_error"}
_E2EE_SESSION_SETUP_TYPES = {"e2ee_init", "e2ee_rekey"}
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


def _load_or_create_e2ee_client(local_did: str, credential_name: str) -> E2eeClient:
    """Load persisted E2EE state or create a fresh client."""
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


async def _send_msg(http_client, sender_did, receiver_did, msg_type, content, *, auth, credential_name="default"):
    """Send an E2EE protocol/error message."""
    if isinstance(content, dict):
        content = json.dumps(content)
    return await authenticated_rpc_call(
        http_client,
        MESSAGE_RPC,
        "send",
        params={
            "sender_did": sender_did,
            "receiver_did": receiver_did,
            "content": content,
            "type": msg_type,
        },
        auth=auth,
        credential_name=credential_name,
    )


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


async def _auto_process_e2ee_messages(
    messages: list[dict[str, Any]],
    *,
    local_did: str,
    auth: Any,
    credential_name: str,
) -> tuple[list[dict[str, Any]], list[str], E2eeClient]:
    """Immediately process E2EE protocol messages and decrypt plaintext when possible."""
    e2ee_client = _load_or_create_e2ee_client(local_did, credential_name)
    processed_ids: list[str] = []
    rendered_messages: list[dict[str, Any]] = []

    async with create_molt_message_client(SDKConfig()) as client:
        for msg in messages:
            msg_type = msg.get("type", "")
            sender_did = msg.get("sender_did", "")
            if msg_type not in _E2EE_MSG_TYPES:
                rendered_messages.append(msg)
                continue

            try:
                content = json.loads(msg.get("content", ""))
            except (TypeError, json.JSONDecodeError):
                rendered_messages.append(msg)
                continue

            if msg_type == "e2ee_msg":
                if sender_did == local_did:
                    rendered = _render_local_outgoing_e2ee_message(
                        credential_name,
                        msg,
                    )
                    rendered_messages.append(rendered or msg)
                    continue
                try:
                    original_type, plaintext = e2ee_client.decrypt_message(content)
                    rendered = dict(msg)
                    rendered["type"] = original_type
                    rendered["content"] = plaintext
                    rendered["_e2ee"] = True
                    rendered_messages.append(rendered)
                    processed_ids.append(msg["id"])
                except Exception as exc:
                    error_code, retry_hint = _classify_decrypt_error(exc)
                    error_content = build_e2ee_error_content(
                        error_code=error_code,
                        session_id=content.get("session_id"),
                        failed_msg_id=msg.get("id"),
                        failed_server_seq=msg.get("server_seq"),
                        retry_hint=retry_hint,
                        required_e2ee_version=SUPPORTED_E2EE_VERSION if error_code == "unsupported_version" else None,
                        message=build_e2ee_error_message(
                            error_code,
                            required_e2ee_version=SUPPORTED_E2EE_VERSION if error_code == "unsupported_version" else None,
                            detail=str(exc),
                        ),
                    )
                    await _send_msg(
                        client, local_did, sender_did, "e2ee_error", error_content,
                        auth=auth, credential_name=credential_name,
                    )
                continue

            if msg_type == "e2ee_error":
                if sender_did == local_did:
                    continue
                record_remote_failure(
                    credential_name=credential_name,
                    peer_did=sender_did,
                    content=content,
                )

            if sender_did == local_did:
                continue

            responses = await e2ee_client.process_e2ee_message(msg_type, content)
            for resp_type, resp_content in responses:
                await _send_msg(
                    client, local_did, sender_did, resp_type, resp_content,
                    auth=auth, credential_name=credential_name,
                )

            if msg_type in _E2EE_SESSION_SETUP_TYPES:
                if e2ee_client.has_session_id(content.get("session_id")):
                    processed_ids.append(msg["id"])
            else:
                processed_ids.append(msg["id"])

    save_e2ee_state(e2ee_client.export_state(), credential_name)
    return rendered_messages, processed_ids, e2ee_client


def _render_local_outgoing_e2ee_message(
    credential_name: str,
    message: dict[str, Any],
) -> dict[str, Any] | None:
    """Replace an outgoing encrypted history item with local plaintext when available."""
    msg_id = message.get("id") or message.get("msg_id")
    if not msg_id:
        return None
    try:
        conn = local_store.get_connection()
        local_store.ensure_schema(conn)
        stored = local_store.get_message_by_id(
            conn,
            msg_id=msg_id,
            credential_name=credential_name,
        )
        conn.close()
    except Exception:
        logger.debug("Failed to load local plaintext for outgoing E2EE message", exc_info=True)
        return None

    if stored is None or not stored.get("is_e2ee"):
        return None

    rendered = dict(message)
    rendered["type"] = stored.get("content_type", message.get("type"))
    rendered["content"] = stored.get("content", message.get("content"))
    rendered["_e2ee"] = True
    return rendered


async def check_inbox(credential_name: str = "default", limit: int = 20) -> None:
    """View inbox and immediately process private E2EE messages when possible."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, data = auth_result
    async with create_molt_message_client(config) as client:
        inbox = await authenticated_rpc_call(
            client,
            MESSAGE_RPC,
            "get_inbox",
            params={"user_did": data["did"], "limit": limit},
            auth=auth,
            credential_name=credential_name,
        )

        # Store fetched messages locally (offline backfill)
        _store_inbox_messages(credential_name, data["did"], inbox)

        messages = inbox.get("messages", [])
        messages.sort(key=_message_sort_key)
        rendered_messages, processed_ids, _ = await _auto_process_e2ee_messages(
            messages,
            local_did=data["did"],
            auth=auth,
            credential_name=credential_name,
        )
        inbox["messages"] = rendered_messages
        inbox["total"] = len(rendered_messages)

        if processed_ids:
            await authenticated_rpc_call(
                client,
                MESSAGE_RPC,
                "mark_read",
                params={"user_did": data["did"], "message_ids": processed_ids},
                auth=auth,
                credential_name=credential_name,
            )

        print(json.dumps(inbox, indent=2, ensure_ascii=False))


async def get_history(
    peer_did: str,
    credential_name: str = "default",
    limit: int = 50,
) -> None:
    """View chat history with a specific DID and immediately render E2EE plaintext when possible."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, data = auth_result
    async with create_molt_message_client(config) as client:
        history = await authenticated_rpc_call(
            client,
            MESSAGE_RPC,
            "get_history",
            params={
                "user_did": data["did"],
                "peer_did": peer_did,
                "limit": limit,
            },
            auth=auth,
            credential_name=credential_name,
        )

        # Store fetched messages locally (offline backfill)
        _store_history_messages(credential_name, data["did"], peer_did, history)

        messages = history.get("messages", [])
        messages.sort(key=_message_sort_key)
        rendered_messages, _, _ = await _auto_process_e2ee_messages(
            messages,
            local_did=data["did"],
            auth=auth,
            credential_name=credential_name,
        )
        history["messages"] = rendered_messages
        history["total"] = len(rendered_messages)

        print(json.dumps(history, indent=2, ensure_ascii=False))


async def mark_read(
    message_ids: list[str],
    credential_name: str = "default",
) -> None:
    """Mark messages as read."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, data = auth_result
    async with create_molt_message_client(config) as client:
        result = await authenticated_rpc_call(
            client,
            MESSAGE_RPC,
            "mark_read",
            params={
                "user_did": data["did"],
                "message_ids": message_ids,
            },
            auth=auth,
            credential_name=credential_name,
        )
        print("Marked as read successfully:")
        print(json.dumps(result, indent=2, ensure_ascii=False))


def _store_inbox_messages(
    credential_name: str, my_did: str, inbox: Any,
) -> None:
    """Store inbox messages locally (best-effort, non-critical)."""
    try:
        messages = inbox if isinstance(inbox, list) else inbox.get("messages", [])
        if not messages:
            return
        conn = local_store.get_connection()
        local_store.ensure_schema(conn)
        batch = []
        for msg in messages:
            sender_did = msg.get("sender_did", "")
            batch.append({
                "msg_id": msg.get("id", msg.get("msg_id", "")),
                "thread_id": local_store.make_thread_id(
                    my_did, peer_did=sender_did, group_id=msg.get("group_id"),
                ),
                "direction": 0,
                "sender_did": sender_did,
                "receiver_did": msg.get("receiver_did"),
                "group_id": msg.get("group_id"),
                "group_did": msg.get("group_did"),
                "content_type": msg.get("type", "text"),
                "content": str(msg.get("content", "")),
                "server_seq": msg.get("server_seq"),
                "sent_at": msg.get("sent_at") or msg.get("created_at"),
                "sender_name": msg.get("sender_name"),
            })
        local_store.store_messages_batch(conn, batch, credential_name=credential_name)
        # Record senders in contacts
        seen_dids: set[str] = set()
        for msg in messages:
            s = msg.get("sender_did", "")
            if s and s not in seen_dids:
                seen_dids.add(s)
                local_store.upsert_contact(
                    conn, did=s, name=msg.get("sender_name"),
                )
        conn.close()
    except Exception:
        logger.debug("Failed to store inbox messages locally", exc_info=True)


def _store_history_messages(
    credential_name: str, my_did: str, peer_did: str, history: Any,
) -> None:
    """Store chat history messages locally (best-effort, non-critical)."""
    try:
        messages = history if isinstance(history, list) else history.get("messages", [])
        if not messages:
            return
        conn = local_store.get_connection()
        local_store.ensure_schema(conn)
        batch = []
        for msg in messages:
            sender_did = msg.get("sender_did", "")
            is_outgoing = sender_did == my_did
            batch.append({
                "msg_id": msg.get("id", msg.get("msg_id", "")),
                "thread_id": local_store.make_thread_id(
                    my_did, peer_did=peer_did, group_id=msg.get("group_id"),
                ),
                "direction": 1 if is_outgoing else 0,
                "sender_did": sender_did,
                "receiver_did": msg.get("receiver_did"),
                "group_id": msg.get("group_id"),
                "group_did": msg.get("group_did"),
                "content_type": msg.get("type", "text"),
                "content": str(msg.get("content", "")),
                "server_seq": msg.get("server_seq"),
                "sent_at": msg.get("sent_at") or msg.get("created_at"),
                "sender_name": msg.get("sender_name"),
            })
        local_store.store_messages_batch(conn, batch, credential_name=credential_name)
        # Record senders in contacts
        seen_dids: set[str] = set()
        for msg in messages:
            s = msg.get("sender_did", "")
            if s and s not in seen_dids:
                seen_dids.add(s)
                local_store.upsert_contact(
                    conn, did=s, name=msg.get("sender_name"),
                )
        conn.close()
    except Exception:
        logger.debug("Failed to store history messages locally", exc_info=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Check inbox and manage messages")
    parser.add_argument("--history", type=str, help="View chat history with a specific DID or handle")
    parser.add_argument("--mark-read", nargs="+", type=str,
                        help="Mark specified message IDs as read")
    parser.add_argument("--limit", type=int, default=20,
                        help="Result count limit (default: 20)")
    parser.add_argument("--credential", type=str, default="default",
                        help="Credential name (default: default)")

    args = parser.parse_args()

    if args.mark_read:
        asyncio.run(mark_read(args.mark_read, args.credential))
    elif args.history:
        peer_did = asyncio.run(resolve_to_did(args.history))
        asyncio.run(get_history(peer_did, args.credential, args.limit))
    else:
        asyncio.run(check_inbox(args.credential, args.limit))


if __name__ == "__main__":
    main()
