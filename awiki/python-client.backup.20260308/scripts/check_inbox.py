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

[INPUT]: SDK (RPC calls), credential_store (load identity credentials), local_store (local persistence)
[OUTPUT]: Inbox message list / chat history / mark-read result
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
from pathlib import Path
from typing import Any

from utils import SDKConfig, create_molt_message_client, authenticated_rpc_call, resolve_to_did

logger = logging.getLogger(__name__)
from credential_store import create_authenticator
import local_store


MESSAGE_RPC = "/message/rpc"


async def check_inbox(credential_name: str = "default", limit: int = 20) -> None:
    """View inbox."""
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

        print(json.dumps(inbox, indent=2, ensure_ascii=False))


async def get_history(
    peer_did: str,
    credential_name: str = "default",
    limit: int = 50,
) -> None:
    """View chat history with a specific DID."""
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
