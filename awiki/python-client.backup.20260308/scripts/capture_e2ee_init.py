#!/usr/bin/env python3
"""Capture and display the actual e2ee_init packet sent to awiki.ai."""

import json
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from utils.config import SDKConfig
from credential_store import load_identity, create_authenticator
from utils.e2ee import E2eeClient
from utils.auth import generate_wba_auth_header
from utils.identity import DIDIdentity

# Target: NodeAgent3
TARGET_DID = "did:wba:awiki.ai:user:k1_136mytd3v6udtuW5ZsfyP7q1hD3iAEsZysJ8xI9nXsY"

print("=" * 80)
print("Python E2EE Init Packet Capture")
print("=" * 80)

# Load identity
cred = load_identity("pythonagent")
if cred is None:
    print("Error: Credential 'pythonagent' not found")
    sys.exit(1)

print(f"\nLocal DID: {cred['did']}")
print(f"Target DID: {TARGET_DID}")

# Create identity object
identity = DIDIdentity(
    did=cred["did"],
    did_document=cred["did_document"],
    private_key_pem=cred["private_key_pem"].encode("utf-8"),
    public_key_pem=cred["public_key_pem"].encode("utf-8"),
    e2ee_signing_private_pem=cred.get("e2ee_signing_private_pem", b"") or None,
    e2ee_agreement_private_pem=cred.get("e2ee_agreement_private_pem", b"") or None,
)

# Create E2EE client
e2ee_client = E2eeClient(
    local_did=cred["did"],
    signing_pem=cred.get("e2ee_signing_private_pem"),
    x25519_pem=cred.get("e2ee_agreement_private_pem"),
)

# Generate e2ee_init
async def capture_init():
    msg_type, content = await e2ee_client.initiate_handshake(TARGET_DID)
    return msg_type, content

msg_type, content = asyncio.run(capture_init())

print(f"\n[Packet 1: e2ee_init]")
print("-" * 80)

# Build the full RPC request
rpc_request = {
    "jsonrpc": "2.0",
    "method": "send",
    "params": {
        "sender_did": cred["did"],
        "receiver_did": TARGET_DID,
        "content": content,
        "type": msg_type
    },
    "id": 1
}

print("\nFull RPC Request:")
print(json.dumps(rpc_request, indent=2))

print("\n[Key Fields Analysis]")
print("-" * 80)
print(f"session_id: {content.get('session_id')}")
print(f"hpke_suite: {content.get('hpke_suite')}")
print(f"enc length: {len(content.get('enc', ''))} chars (base64)")
print(f"encrypted_seed length: {len(content.get('encrypted_seed', ''))} chars (base64)")
print(f"proof.proof_value length: {len(content.get('proof', {}).get('proof_value', ''))} chars (base64url)")

# Decode and show raw bytes
import base64
enc_bytes = base64.b64decode(content['enc'])
encrypted_seed_bytes = base64.b64decode(content['encrypted_seed'])
proof_value_bytes = base64.urlsafe_b64decode(content['proof']['proof_value'] + '=' * (-len(content['proof']['proof_value']) % 4))

print(f"\n[Raw Byte Lengths]")
print(f"enc (X25519 ephemeral public key): {len(enc_bytes)} bytes")
print(f"encrypted_seed (HPKE ciphertext): {len(encrypted_seed_bytes)} bytes")
print(f"proof_value (R||S signature): {len(proof_value_bytes)} bytes")

print("\n" + "=" * 80)
