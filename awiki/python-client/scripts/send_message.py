"""Send a message to a specified DID.

Usage:
    # Send a text message
    uv run python scripts/send_message.py --to "did:wba:localhost:user:abc123" --content "Hello!"

    # Specify message type
    uv run python scripts/send_message.py --to "did:wba:localhost:user:abc123" --content "hello" --type text

[INPUT]: SDK (RPC calls), credential_store (load identity credentials), local_store (local persistence)
[OUTPUT]: Send result (with server_seq and client_msg_id)
[POS]: Message sending script, auto-generates client_msg_id for idempotent delivery

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updating
"""

import argparse
import asyncio
import json
import sys
import uuid
from pathlib import Path

from utils import SDKConfig, create_molt_message_client, authenticated_rpc_call, resolve_to_did
from credential_store import create_authenticator
import local_store


MESSAGE_RPC = "/message/rpc"


async def send_message(
    receiver: str,
    content: str,
    msg_type: str = "text",
    credential_name: str = "default",
) -> None:
    """Send a message to a specified DID or handle."""
    config = SDKConfig()
    receiver_did = await resolve_to_did(receiver, config)
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, data = auth_result
    async with create_molt_message_client(config) as client:
        result = await authenticated_rpc_call(
            client,
            MESSAGE_RPC,
            "send",
            params={
                "sender_did": data["did"],
                "receiver_did": receiver_did,
                "content": content,
                "type": msg_type,
                "client_msg_id": str(uuid.uuid4()),
            },
            auth=auth,
            credential_name=credential_name,
        )

        # Store sent message locally
        try:
            conn = local_store.get_connection()
            local_store.ensure_schema(conn)
            local_store.store_message(
                conn,
                msg_id=result.get("id", str(uuid.uuid4())),
                thread_id=local_store.make_thread_id(
                    data["did"], peer_did=receiver_did,
                ),
                direction=1,
                sender_did=data["did"],
                receiver_did=receiver_did,
                content_type=msg_type,
                content=content,
                server_seq=result.get("server_seq"),
                sent_at=result.get("sent_at"),
                credential_name=credential_name,
            )
            # Record receiver in contacts
            contact_fields = {}
            if receiver != receiver_did:
                contact_fields["handle"] = receiver
            local_store.upsert_contact(conn, did=receiver_did, **contact_fields)
            conn.close()
        except Exception:
            pass  # Non-critical: don't fail the send on local storage errors

        print("Message sent successfully:")
        print(json.dumps(result, indent=2, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description="Send DID message")
    parser.add_argument("--to", required=True, type=str, help="Receiver DID or handle")
    parser.add_argument("--content", required=True, type=str, help="Message content")
    parser.add_argument("--type", type=str, default="text",
                        help="Message type (default: text)")
    parser.add_argument("--credential", type=str, default="default",
                        help="Credential name (default: default)")

    args = parser.parse_args()
    asyncio.run(send_message(args.to, args.content, args.type, args.credential))


if __name__ == "__main__":
    main()
