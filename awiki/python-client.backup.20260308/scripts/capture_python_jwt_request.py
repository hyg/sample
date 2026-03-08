#!/usr/bin/env python3
"""
Capture the EXACT HTTP request sent to awiki.ai for JWT verification.
"""

import json
import asyncio
import sys
from pathlib import Path
import httpx

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / "scripts"))

from scripts.utils.credential_store import load_identity
from scripts.utils.config import SDKConfig
from scripts.utils.auth import generate_wba_auth_header
from scripts.utils.identity import DIDIdentity
from cryptography.hazmat.primitives.serialization import load_pem_private_key

print("=" * 80)
print("Python: Capturing JWT Verification Request to awiki.ai")
print("=" * 80)

# Load identity
cred = load_identity("pythonagent")
if cred is None:
    print("Error: Credential 'pythonagent' not found")
    sys.exit(1)

print(f"\n[1] Identity Info")
print(f"DID: {cred['did']}")

# Create identity object
identity = DIDIdentity(
    did=cred["did"],
    did_document=cred["did_document"],
    private_key_pem=cred["private_key_pem"].encode("utf-8"),
    public_key_pem=cred["public_key_pem"].encode("utf-8"),
    e2ee_signing_private_pem=cred.get("e2ee_signing_private_pem", b"") or None,
    e2ee_agreement_private_pem=cred.get("e2ee_agreement_private_pem", b"") or None,
)

# Generate auth header
config = SDKConfig()
service_url = config.user_service_url
did_domain = config.did_domain

print(f"\n[2] Service URL: {service_url}")
print(f"    DID Domain: {did_domain}")

auth_header = generate_wba_auth_header(identity, did_domain)

print(f"\n[3] Authorization Header:")
print(auth_header)

# Build the complete HTTP request
request_body = {
    "jsonrpc": "2.0",
    "method": "verify",
    "params": {
        "authorization": auth_header,
        "domain": did_domain
    },
    "id": 1
}

print(f"\n[4] Complete HTTP Request:")
print("-" * 80)
print(f"POST {service_url}/user-service/did-auth/rpc HTTP/1.1")
print(f"Host: awiki.ai")
print(f"Content-Type: application/json")
print(f"Content-Length: {len(json.dumps(request_body))}")
print(f"")
print(json.dumps(request_body, indent=2))
print("-" * 80)

# Send the actual request
print(f"\n[5] Sending request to awiki.ai...")

async def send_request():
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{service_url}/user-service/did-auth/rpc",
            json=request_body,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Python-anp/1.0"
            }
        )
        
        print(f"\n[6] HTTP Response:")
        print("-" * 80)
        print(f"HTTP/1.1 {response.status_code}")
        for key, value in response.headers.items():
            print(f"{key}: {value}")
        print(f"")
        print(json.dumps(response.json(), indent=2))
        print("-" * 80)
        
        # Save to file
        output = {
            "request": {
                "method": "POST",
                "url": f"{service_url}/user-service/did-auth/rpc",
                "headers": {
                    "Content-Type": "application/json",
                    "User-Agent": "Python-anp/1.0"
                },
                "body": request_body
            },
            "response": {
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": response.json()
            },
            "auth_header": auth_header,
            "did": cred["did"]
        }
        
        output_path = Path(__file__).parent / "scripts" / "tests" / "python_output" / "python_jwt_request.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        
        print(f"\n[7] Request/Response saved to: {output_path}")
        
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
