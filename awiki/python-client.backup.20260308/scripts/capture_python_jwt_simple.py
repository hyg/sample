#!/usr/bin/env python3
"""
Capture the EXACT HTTP request sent to awiki.ai for JWT verification.
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
print("Python: JWT Verification Request to awiki.ai")
print("=" * 80)

# Load identity
cred_path = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message" / "pythonagent.json"
cred = json.loads(cred_path.read_text())

print(f"\n[1] Identity Info")
print(f"DID: {cred['did']}")

# Load private key
private_key = serialization.load_pem_private_key(
    cred["private_key_pem"].encode("utf-8"),
    password=None
)

# Generate auth header
service_url = "https://awiki.ai"
did_domain = "awiki.ai"

import secrets
from datetime import datetime, timezone

nonce = secrets.token_hex(16)
timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
did = cred['did']

# Version 1.1 uses "aud" field
auth_data = {
    "nonce": nonce,
    "timestamp": timestamp,
    "aud": did_domain,
    "did": did
}

# JCS canonicalize
canonical_json = jcs.canonicalize(auth_data)

# SHA-256 hash
content_hash = hashlib.sha256(canonical_json).digest()

# Sign
der_signature = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))

# Encode as base64url
signature_b64url = base64.urlsafe_b64encode(der_signature).rstrip(b"=").decode("ascii")

# Build auth header
auth_header = f'DIDWba v="1.1", did="{did}", nonce="{nonce}", timestamp="{timestamp}", verification_method="key-1", signature="{signature_b64url}"'

print(f"\n[2] Authorization Header:")
print(auth_header)

# Build request body
request_body = {
    "jsonrpc": "2.0",
    "method": "verify",
    "params": {
        "authorization": auth_header,
        "domain": did_domain
    },
    "id": 1
}

print(f"\n[3] Complete HTTP Request:")
print("-" * 80)
print(f"POST {service_url}/user-service/did-auth/rpc HTTP/1.1")
print(f"Host: awiki.ai")
print(f"Content-Type: application/json")
print(f"")
print(json.dumps(request_body, indent=2))
print("-" * 80)

# Send request
print(f"\n[4] Sending request to awiki.ai...")

async def send_request():
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{service_url}/user-service/did-auth/rpc",
            json=request_body,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\n[5] HTTP Response:")
        print("-" * 80)
        print(f"HTTP/1.1 {response.status_code}")
        print(f"")
        print(json.dumps(response.json(), indent=2))
        print("-" * 80)
        
        # Save to file
        output = {
            "request": {
                "method": "POST",
                "url": f"{service_url}/user-service/did-auth/rpc",
                "headers": {"Content-Type": "application/json"},
                "body": request_body,
                "auth_header": auth_header,
                "auth_data_signed": auth_data,
                "canonical_json": canonical_json.decode("utf-8"),
                "content_hash": content_hash.hex(),
                "signature_der": der_signature.hex(),
                "signature_b64url": signature_b64url
            },
            "response": {
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": response.json()
            }
        }
        
        output_path = Path(__file__).parent / "scripts" / "tests" / "python_output" / "python_jwt_request.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        
        print(f"\n[6] Request/Response saved to: {output_path}")
        
        if response.json().get("result"):
            print(f"\n✓ JWT verification SUCCESS")
            jwt_token = response.json()["result"].get("access_token", "")
            print(f"JWT Token: {jwt_token[:50]}...")
        else:
            print(f"\n✗ JWT verification FAILED")
            error = response.json().get("error", {})
            print(f"Error: {error.get('message')}")

asyncio.run(send_request())

print("\n" + "=" * 80)
