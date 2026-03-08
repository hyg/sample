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
[OUTPUT]: E2EE operation results with failure-aware inbox processing, sender-facing
          e2ee_error notifications, and state persistence
[POS]: End-to-end encrypted messaging script, integrates state persistence for cross-process E2EE communication (HPKE scheme)

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
from typing import Any

from utils import SDKConfig, E2eeClient, create_molt_message_client, authenticated_rpc_call, resolve_to_did
from utils.e2ee import (
    SUPPORTED_E2EE_VERSION,
    build_e2ee_error_content,
    build_e2ee_error_message,
)
from credential_store import create_authenticator, load_identity
from e2ee_store import save_e2ee_state, load_e2ee_state
from e2ee_outbox import (
    begin_send_attempt,
    get_record,
    list_failed_records,
    mark_dropped,
    record_local_failure,
    mark_send_success,
    record_remote_failure,
)


MESSAGE_RPC = "/message/rpc"

# E2EE related message types
_E2EE_MSG_TYPES = {"e2ee_init", "e2ee_ack", "e2ee_msg", "e2ee_rekey", "e2ee_error"}
_E2EE_SESSION_SETUP_TYPES = {"e2ee_init", "e2ee_rekey"}

# E2EE message type protocol order
_E2EE_TYPE_ORDER = {"e2ee_init": 0, "e2ee_ack": 1, "e2ee_rekey": 2, "e2ee_msg": 3, "e2ee_error": 4}


def _message_sort_key(message: dict[str, Any]) -> tuple[Any, ...]:
    """Build a stable inbox ordering key with server_seq priority inside a sender stream."""
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


def _classify_decrypt_error(exc: BaseException) -> tuple[str, str]:
    """Map decryption failures to e2ee_error code and retry hint."""
    msg = str(exc).lower()
    if "unsupported_version" in msg:
        return "unsupported_version", "drop"
    if "session" in msg and "not found" in msg:
        return "session_not_found", "rekey_then_resend"
    if "expired" in msg:
        return "session_expired", "rekey_then_resend"
    if "seq" in msg or "sequence" in msg:
        return "invalid_seq", "rekey_then_resend"
    return "decryption_failed", "resend"


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


async def _send_msg(
    client,
    sender_did,
    receiver_did,
    msg_type,
    content,
    *,
    auth,
    credential_name="default",
    client_msg_id: str | None = None,
):
    """Send a message (E2EE or plain)."""
    if isinstance(content, dict):
        content = json.dumps(content)
    if client_msg_id is None:
        client_msg_id = str(uuid.uuid4())
    return await authenticated_rpc_call(
        client, MESSAGE_RPC, "send",
        params={
            "sender_did": sender_did,
            "receiver_did": receiver_did,
            "content": content,
            "type": msg_type,
            "client_msg_id": client_msg_id,
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
    original_type: str = "text",
    outbox_id: str | None = None,
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

        enc_type, enc_content = e2ee_client.encrypt_message(peer_did, plaintext, original_type)
        session_id = enc_content.get("session_id")
        outbox_id = begin_send_attempt(
            peer_did=peer_did,
            plaintext=plaintext,
            original_type=original_type,
            credential_name=credential_name,
            session_id=session_id,
            outbox_id=outbox_id,
        )
        send_client_msg_id = str(uuid.uuid4())
        try:
            send_result = await _send_msg(
                client,
                data["did"],
                peer_did,
                enc_type,
                enc_content,
                auth=auth,
                credential_name=credential_name,
                client_msg_id=send_client_msg_id,
            )
        except Exception as exc:
            record_local_failure(
                outbox_id=outbox_id,
                credential_name=credential_name,
                error_code="send_request_failed",
                retry_hint="resend",
                metadata=json.dumps({"error": str(exc)}, ensure_ascii=False),
            )
            print(f"Encrypted message send failed; outbox_id={outbox_id}")
            raise

        mark_send_success(
            outbox_id=outbox_id,
            credential_name=credential_name,
            local_did=data["did"],
            peer_did=peer_did,
            plaintext=plaintext,
            original_type=original_type,
            session_id=session_id,
            sent_msg_id=send_result.get("id"),
            sent_server_seq=send_result.get("server_seq"),
            sent_at=send_result.get("sent_at"),
            client_msg_id=send_client_msg_id,
        )

    # Save state (send_seq incremented)
    _save_e2ee_client(e2ee_client, credential_name)

    print("Encrypted message sent")
    print(f"  Plaintext: {plaintext}")
    print(f"  Receiver : {peer_did}")
    print(f"  Outbox ID: {outbox_id}")


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

        # Sort by sender stream + server_seq, fallback to created_at.
        messages.sort(key=_message_sort_key)

        e2ee_client: E2eeClient | None = None

        # Try to restore existing E2EE client from disk
        e2ee_client = _load_or_create_e2ee_client(data["did"], credential_name)
        processed_ids = []

        for msg in messages:
            msg_type = msg["type"]
            sender_did = msg.get("sender_did", "?")
            processed_ok = False

            if msg_type in _E2EE_MSG_TYPES:
                content = json.loads(msg["content"])

                if msg_type == "e2ee_msg":
                    try:
                        original_type, plaintext = e2ee_client.decrypt_message(content)
                        print(f"  [{msg_type}] Decrypted message: [{original_type}] {plaintext}")
                        processed_ok = True
                    except Exception as e:
                        print(f"  [{msg_type}] Decryption failed: {e}")
                        error_code, retry_hint = _classify_decrypt_error(e)
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
                                detail=str(e),
                            ),
                        )
                        await _send_msg(
                            client, data["did"], sender_did, "e2ee_error", error_content,
                            auth=auth, credential_name=credential_name,
                        )
                        print(
                            f"    -> Sent e2ee_error "
                            f"(failed_msg_id={msg.get('id')}, retry_hint={retry_hint})"
                        )
                else:
                    if msg_type == "e2ee_error":
                        matched_outbox_id = record_remote_failure(
                            credential_name=credential_name,
                            peer_did=sender_did,
                            content=content,
                        )
                        if matched_outbox_id:
                            print(
                                f"  [{msg_type}] Matched failed local outbox: "
                                f"{matched_outbox_id}"
                            )
                    responses = await e2ee_client.process_e2ee_message(msg_type, content)
                    session_ready = True
                    terminal_error_notified = any(
                        resp_type == "e2ee_error" for resp_type, _ in responses
                    )
                    if msg_type in _E2EE_SESSION_SETUP_TYPES:
                        session_ready = e2ee_client.has_session_id(content.get("session_id"))
                    if session_ready:
                        print(
                            f"  [{msg_type}] Processed protocol message, generated "
                            f"{len(responses)} response(s)"
                        )
                        processed_ok = True
                    elif terminal_error_notified:
                        print(
                            f"  [{msg_type}] Protocol message failed terminally; "
                            "sender notified via e2ee_error"
                        )
                        processed_ok = True
                    else:
                        print(
                            f"  [{msg_type}] Protocol message did not activate a session; "
                            "left unread for inspection"
                        )
                    for resp_type, resp_content in responses:
                        await _send_msg(
                            client, data["did"], peer_did, resp_type, resp_content,
                            auth=auth, credential_name=credential_name,
                        )
                        print(f"    -> Sent {resp_type}")
            else:
                print(f"  [{msg_type}] From {sender_did[:40]}...: {msg['content']}")
                processed_ok = True

            if processed_ok:
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
    group.add_argument("--list-failed", action="store_true",
                       help="List failed local E2EE outbox records")
    group.add_argument("--retry", type=str,
                       help="Retry a failed local E2EE outbox record by outbox_id")
    group.add_argument("--drop", type=str,
                       help="Mark a failed local E2EE outbox record as dropped")

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
    elif args.list_failed:
        records = list_failed_records(args.credential)
        print(json.dumps(records, indent=2, ensure_ascii=False))
    elif args.retry:
        record = get_record(args.retry, args.credential)
        if record is None:
            parser.error(f"Outbox record '{args.retry}' not found")
        asyncio.run(
            send_encrypted(
                record["peer_did"],
                record["plaintext"],
                args.credential,
                original_type=record.get("original_type") or "text",
                outbox_id=record["outbox_id"],
            )
        )
    elif args.drop:
        mark_dropped(args.drop, args.credential)
        print(f"Dropped outbox record: {args.drop}")


if __name__ == "__main__":
    main()
