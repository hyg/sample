#!/usr/bin/env python3
"""
Test JWT verification using Python with the same PythonAgent credential.
"""

import json
import asyncio
import hashlib
import base64
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
import jcs
import httpx

print("=" * 80)
print("Python: Test JWT Verification with PythonAgent Credential")
print("=" * 80)

# Load credential
cred_path = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message" / "pythonagent.json"
cred = json.loads(cred_path.read_text())

print(f"\n[1] Load Credential")
print("-" * 80)
print(f"DID: {cred['did']}")

# Load private key
private_key = serialization.load_pem_private_key(
    cred["private_key_pem"].encode("utf-8"),
    password=None
)

# Generate auth data
import secrets
from datetime import datetime, timezone

nonce = secrets.token_hex(16)
timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

print(f"\n[2] Generate Auth Data")
print("-" * 80)
print(f"Nonce: {nonce}")
print(f"Timestamp: {timestamp}")

auth_data = {
    "nonce": nonce,
    "timestamp": timestamp,
    "aud": "awiki.ai",
    "did": cred['did']
}

# JCS canonicalize
canonical_json = jcs.canonicalize(auth_data)
print(f"\n[3] Canonical JSON")
print("-" * 80)
print(canonical_json.decode('utf-8'))

# SHA-256 hash
content_hash = hashlib.sha256(canonical_json).digest()
print(f"\n[4] Content Hash")
print("-" * 80)
print(content_hash.hex())

# Sign
der_signature = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))
print(f"\n[5] Signature (DER)")
print("-" * 80)
print(der_signature.hex())

# Encode as base64url
signature_b64url = base64.urlsafe_b64encode(der_signature).rstrip(b"=").decode("ascii")
print(f"\n[6] Signature (Base64URL)")
print("-" * 80)
print(signature_b64url)

# Build auth header
auth_header = f'DIDWba v="1.1", did="{cred["did"]}", nonce="{nonce}", timestamp="{timestamp}", verification_method="key-1", signature="{signature_b64url}"'
print(f"\n[7] Authorization Header")
print("-" * 80)
print(auth_header)

# Send request
print(f"\n[8] Sending request to awiki.ai...")

async def test_jwt():
    request_body = {
        "jsonrpc": "2.0",
        "method": "verify",
        "params": {
            "authorization": auth_header,
            "domain": "awiki.ai"
        },
        "id": 1
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://awiki.ai/user-service/did-auth/rpc",
            json=request_body,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\n[9] Response")
        print("-" * 80)
        print(json.dumps(response.json(), indent=2))
        
        if response.json().get("result"):
            print("\n✓ JWT verification SUCCESS")
            token = response.json()["result"].get("access_token", "")
            print(f"JWT Token: {token[:80]}...")
        else:
            print("\n✗ JWT verification FAILED")
            error = response.json().get("error", {})
            print(f"Error: {error.get('message')}")

asyncio.run(test_jwt())

print("\n" + "=" * 80)
