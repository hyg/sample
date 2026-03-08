"""E2EE end-to-end encrypted messaging (HPKE scheme, with cross-process state persistence).

Usage:
    # Initiate an E2EE session (one-step initialization, session immediately ACTIVE)
    uv run python scripts/e2ee_messaging.py --handshake "did:wba:awiki.ai:user:abc123"

    # Send an encrypted message (requires initialization first)
    uv run python scripts/e2ee_messaging.py --send "did:wba:awiki.ai:user:abc123" --content "secret message"

    # Process E2EE messages in inbox (auto-handle init + decrypt)
    uv run python scripts/e2ee_messaging.py --process --peer "did:wba:awiki.ai:user:abc123"

Supported workflows:
1. Alice: --handshake <Bob's DID>       -> Initiate session (one-step init, immediately ACTIVE)
2. Bob:   --process --peer <Alice's DID> -> Process inbox (receive e2ee_init, session directly ACTIVE)
3. Alice: --send <Bob's DID> --content "secret" -> Send encrypted message
4. Bob:   --process --peer <Alice's DID> -> Restore session from disk, decrypt message

[INPUT]: SDK (E2eeClient, RPC calls), credential_store (load identity credentials), e2ee_store (E2EE state persistence)
[OUTPUT]: E2EE operation results
[POS]: End-to-end encrypted messaging script, integrates state persistence for cross-process E2EE communication (HPKE scheme)

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updating
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

from utils import SDKConfig, E2eeClient, create_molt_message_client, authenticated_rpc_call, resolve_to_did
from credential_store import create_authenticator, load_identity
from e2ee_store import save_e2ee_state, load_e2ee_state


MESSAGE_RPC = "/message/rpc"

# E2EE related message types
_E2EE_MSG_TYPES = {"e2ee_init", "e2ee_msg", "e2ee_rekey", "e2ee_error"}

# E2EE message type protocol order
_E2EE_TYPE_ORDER = {"e2ee_init": 0, "e2ee_rekey": 1, "e2ee_msg": 2, "e2ee_error": 3}


def _load_or_create_e2ee_client(
    local_did: str, credential_name: str
) -> E2eeClient:
    """Load existing E2EE client state from disk, or create a new client if absent.

    Loads E2EE keys (signing_pem + x25519_pem) from credential.
    """
    # Load E2EE keys from credential
    cred = load_identity(credential_name)
    signing_pem: str | None = None
    x25519_pem: str | None = None
    if cred is not None:
        signing_pem = cred.get("e2ee_signing_private_pem")
        x25519_pem = cred.get("e2ee_agreement_private_pem")

    if signing_pem is None or x25519_pem is None:
        print("Warning: Credential missing E2EE keys (key-2/key-3); please recreate identity to enable HPKE E2EE")

    state = load_e2ee_state(credential_name)
    if state is not None and state.get("local_did") == local_did:
        # Override state keys with credential keys (ensure latest keys are used)
        if signing_pem is not None:
            state["signing_pem"] = signing_pem
        if x25519_pem is not None:
            state["x25519_pem"] = x25519_pem
        client = E2eeClient.from_state(state)
        return client

    return E2eeClient(local_did, signing_pem=signing_pem, x25519_pem=x25519_pem)


def _save_e2ee_client(client: E2eeClient, credential_name: str) -> None:
    """Save E2EE client state to disk."""
    state = client.export_state()
    save_e2ee_state(state, credential_name)


async def _send_msg(client, sender_did, receiver_did, msg_type, content, *, auth, credential_name="default"):
    """Send a message (E2EE or plain)."""
    if isinstance(content, dict):
        content = json.dumps(content)
    return await authenticated_rpc_call(
        client, MESSAGE_RPC, "send",
        params={
            "sender_did": sender_did,
            "receiver_did": receiver_did,
            "content": content,
            "type": msg_type,
        },
        auth=auth,
        credential_name=credential_name,
    )


async def initiate_handshake(
    peer_did: str,
    credential_name: str = "default",
) -> None:
    """Initiate an E2EE session (one-step initialization)."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, data = auth_result
    e2ee_client = _load_or_create_e2ee_client(data["did"], credential_name)
    msg_type, content = await e2ee_client.initiate_handshake(peer_did)

    async with create_molt_message_client(config) as client:
        await _send_msg(client, data["did"], peer_did, msg_type, content,
                        auth=auth, credential_name=credential_name)

    _save_e2ee_client(e2ee_client, credential_name)

    print(f"E2EE session established (one-step initialization)")
    print(f"  session_id: {content.get('session_id')}")
    print(f"  peer_did  : {peer_did}")
    print("Session is ACTIVE; you can send encrypted messages now")


async def send_encrypted(
    peer_did: str,
    plaintext: str,
    credential_name: str = "default",
) -> None:
    """Send an encrypted message."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, data = auth_result
    e2ee_client = _load_or_create_e2ee_client(data["did"], credential_name)

    # Auto-handshake if session is missing or expired
    init_msgs = await e2ee_client.ensure_active_session(peer_did)

    async with create_molt_message_client(config) as client:
        for init_type, init_content in init_msgs:
            await _send_msg(client, data["did"], peer_did, init_type, init_content,
                            auth=auth, credential_name=credential_name)
            print(f"Session expired/missing, auto re-handshake sent to {peer_did}")

        enc_type, enc_content = e2ee_client.encrypt_message(peer_did, plaintext)
        await _send_msg(client, data["did"], peer_did, enc_type, enc_content,
                        auth=auth, credential_name=credential_name)

    # Save state (send_seq incremented)
    _save_e2ee_client(e2ee_client, credential_name)

    print("Encrypted message sent")
    print(f"  Plaintext: {plaintext}")
    print(f"  Receiver : {peer_did}")


async def process_inbox(
    peer_did: str,
    credential_name: str = "default",
) -> None:
    """Process E2EE messages in inbox."""
    config = SDKConfig()
    auth_result = create_authenticator(credential_name, config)
    if auth_result is None:
        print(f"Credential '{credential_name}' unavailable; please create an identity first")
        sys.exit(1)

    auth, data = auth_result
    async with create_molt_message_client(config) as client:
        # Get inbox
        inbox = await authenticated_rpc_call(
            client, MESSAGE_RPC, "get_inbox",
            params={"user_did": data["did"], "limit": 50},
            auth=auth, credential_name=credential_name,
        )
        messages = inbox.get("messages", [])
        if not messages:
            print("Inbox is empty")
            return

        # Sort by time and protocol order
        messages.sort(key=lambda m: (
            m.get("created_at", ""),
            _E2EE_TYPE_ORDER.get(m.get("type"), 99),
        ))

        e2ee_client: E2eeClient | None = None

        # Try to restore existing E2EE client from disk
        e2ee_client = _load_or_create_e2ee_client(data["did"], credential_name)
        processed_ids = []

        for msg in messages:
            msg_type = msg["type"]
            sender_did = msg.get("sender_did", "?")

            if msg_type in _E2EE_MSG_TYPES:
                content = json.loads(msg["content"])

                if msg_type == "e2ee_msg":
                    try:
                        original_type, plaintext = e2ee_client.decrypt_message(content)
                        print(f"  [{msg_type}] Decrypted message: [{original_type}] {plaintext}")
                    except RuntimeError as e:
                        print(f"  [{msg_type}] Decryption failed: {e}")
                else:
                    responses = await e2ee_client.process_e2ee_message(msg_type, content)
                    print(f"  [{msg_type}] Processed protocol message, generated {len(responses)} response(s)")
                    for resp_type, resp_content in responses:
                        await _send_msg(
                            client, data["did"], peer_did, resp_type, resp_content,
                            auth=auth, credential_name=credential_name,
                        )
                        print(f"    -> Sent {resp_type}")
            else:
                print(f"  [{msg_type}] From {sender_did[:40]}...: {msg['content']}")

            processed_ids.append(msg["id"])

        # Mark as read
        if processed_ids:
            await authenticated_rpc_call(
                client, MESSAGE_RPC, "mark_read",
                params={"user_did": data["did"], "message_ids": processed_ids},
                auth=auth, credential_name=credential_name,
            )
            print(f"\nMarked {len(processed_ids)} message(s) as read")

        if e2ee_client and e2ee_client.has_active_session(peer_did):
            print(f"\nE2EE session status: ACTIVE (with {peer_did})")

        # Save E2EE client state to disk
        if e2ee_client is not None:
            _save_e2ee_client(e2ee_client, credential_name)


def main() -> None:
    parser = argparse.ArgumentParser(description="E2EE end-to-end encrypted messaging (HPKE scheme)")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--handshake", type=str, help="Initiate E2EE session with a specific DID or handle")
    group.add_argument("--send", type=str, help="Send encrypted message to a specific DID or handle")
    group.add_argument("--process", action="store_true",
                       help="Process E2EE messages in inbox")

    parser.add_argument("--content", type=str, help="Message content (required with --send)")
    parser.add_argument("--peer", type=str,
                        help="Peer DID or handle (required with --process)")
    parser.add_argument("--credential", type=str, default="default",
                        help="Credential name (default: default)")

    args = parser.parse_args()

    if args.handshake:
        peer_did = asyncio.run(resolve_to_did(args.handshake))
        asyncio.run(initiate_handshake(peer_did, args.credential))
    elif args.send:
        if not args.content:
            parser.error("Sending encrypted message requires --content")
        peer_did = asyncio.run(resolve_to_did(args.send))
        asyncio.run(send_encrypted(peer_did, args.content, args.credential))
    elif args.process:
        if not args.peer:
            parser.error("Processing inbox requires --peer")
        peer_did = asyncio.run(resolve_to_did(args.peer))
        asyncio.run(process_inbox(peer_did, args.credential))


if __name__ == "__main__":
    main()
