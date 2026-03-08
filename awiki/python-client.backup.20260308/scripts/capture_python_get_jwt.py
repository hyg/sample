#!/usr/bin/env python3
"""
Capture exact input/output of get_jwt_via_wba() for comparison with Node.js.
"""

import json
import asyncio
import base64
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
import jcs
import httpx

print("=" * 80)
print("Python get_jwt_via_wba() - Input/Output Capture")
print("=" * 80)

# Load credential
cred_dir = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message"
cred_path = cred_dir / "bearertest.json"
cred = json.loads(cred_path.read_text())

did = cred["did"]
did_doc = cred["did_document"]
private_key_pem = cred["private_key_pem"]

# Load private key
private_key = serialization.load_pem_private_key(private_key_pem.encode("utf-8"), password=None)
public_key = private_key.public_key()

# Get public key numbers
numbers = public_key.public_numbers()
pub_x_b64 = base64.urlsafe_b64encode(numbers.x.to_bytes(32, 'big')).rstrip(b'=').decode('ascii')
pub_y_b64 = base64.urlsafe_b64encode(numbers.y.to_bytes(32, 'big')).rstrip(b'=').decode('ascii')

print(f"\n[Input Parameters]")
print(f"userServiceUrl: https://awiki.ai")
print(f"did: {did}")
print(f"did_document: (see DID Document section below)")
print(f"private_key: (see Public Key section below)")
print(f"domain: awiki.ai")

print(f"\n[DID Document]")
print(f"ID: {did_doc['id']}")
print(f"Verification Methods: {len(did_doc.get('verificationMethod', []))}")
for vm in did_doc.get('verificationMethod', []):
    print(f"  - {vm['id']} ({vm['type']})")

print(f"\n[Public Key (key-1)]")
print(f"x (base64url): {pub_x_b64}")
print(f"y (base64url): {pub_y_b64}")

# Generate auth header (same as generate_wba_auth_header)
print(f"\n[Auth Header Generation]")

from anp.authentication import generate_auth_header

def _secp256k1_sign_callback(private_key):
    def _callback(content, vm_fragment):
        return private_key.sign(content, ec.ECDSA(hashes.SHA256()))
    return _callback

# We need to capture the exact auth header that will be sent
# generate_auth_header generates a new nonce and timestamp each time
auth_header = generate_auth_header(
    did_document=did_doc,
    service_domain="awiki.ai",
    sign_callback=_secp256k1_sign_callback(private_key),
    version="1.1"
)

print(f"Generated Authorization Header:")
print(f"  {auth_header}")

# Parse auth header to show components
import re
parts = dict(re.findall(r'(\w+)="([^"]+)"', auth_header))
print(f"\nHeader Components:")
print(f"  v: {parts.get('v', 'N/A')}")
print(f"  did: {parts.get('did', 'N/A')[:50]}...")
print(f"  nonce: {parts.get('nonce', 'N/A')}")
print(f"  timestamp: {parts.get('timestamp', 'N/A')}")
print(f"  verification_method: {parts.get('verification_method', 'N/A')}")
print(f"  signature: {parts.get('signature', 'N/A')[:50]}...")

# Send verify request
print(f"\n{'='*80}")
print(f"HTTP Request (verify)")
print(f"{'='*80}")

async def verify():
    request_body = {
        "jsonrpc": "2.0",
        "method": "verify",
        "params": {
            "authorization": auth_header,
            "domain": "awiki.ai"
        },
        "id": 1
    }
    
    print(f"\nRequest:")
    print(f"  URL: https://awiki.ai/user-service/did-auth/rpc")
    print(f"  Method: POST")
    print(f"  Headers:")
    print(f"    Content-Type: application/json")
    print(f"  Body:")
    print(f"    {json.dumps(request_body, indent=6)}")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://awiki.ai/user-service/did-auth/rpc",
            json=request_body,
            headers={"Content-Type": "application/json"}
        )
    
    print(f"\nResponse:")
    print(f"  Status: {response.status_code}")
    print(f"  Headers:")
    for k, v in response.headers.items():
        if k.lower() in ('content-type', 'content-length', 'server', 'date'):
            print(f"    {k}: {v}")
    
    result = response.json()
    print(f"  Body:")
    print(f"    {json.dumps(result, indent=6)}")
    
    # Parse JWT if successful
    if result.get("result") and result["result"].get("access_token"):
        jwt = result["result"]["access_token"]
        print(f"\n[JWT Token]")
        print(f"  Token: {jwt[:80]}...")
        
        # Parse JWT
        parts = jwt.split('.')
        if len(parts) == 3:
            import json as json_module
            header_padded = parts[0] + '=' * (-len(parts[0]) % 4)
            payload_padded = parts[1] + '=' * (-len(parts[1]) % 4)
            
            header = json_module.loads(base64.urlsafe_b64decode(header_padded))
            payload = json_module.loads(base64.urlsafe_b64decode(payload_padded))
            
            print(f"\n  JWT Header:")
            for k, v in header.items():
                print(f"    {k}: {v}")
            
            print(f"\n  JWT Payload:")
            for k, v in payload.items():
                if isinstance(v, (int, float)) and k in ('iat', 'exp'):
                    dt = datetime.fromtimestamp(v, tz=timezone.utc)
                    print(f"    {k}: {v} ({dt.isoformat()})")
                else:
                    print(f"    {k}: {v}")
    
    # Save complete log
    log_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "function": "get_jwt_via_wba",
        "input": {
            "userServiceUrl": "https://awiki.ai",
            "did": did,
            "did_document": did_doc,
            "private_key": {
                "type": "secp256k1",
                "public_key_x_b64": pub_x_b64,
                "public_key_y_b64": pub_y_b64
            },
            "domain": "awiki.ai"
        },
        "auth_header_generation": {
            "version": "1.1",
            "domain_field": "aud",
            "generated_header": auth_header,
            "parsed_components": parts
        },
        "http_request": {
            "url": "https://awiki.ai/user-service/did-auth/rpc",
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": request_body
        },
        "http_response": {
            "status_code": response.status_code,
            "headers": {k: v for k, v in response.headers.items()},
            "body": result
        },
        "output": {
            "success": bool(result.get("result") and result["result"].get("access_token")),
            "access_token": result["result"].get("access_token") if result.get("result") else None,
            "error": result.get("error")
        }
    }
    
    log_path = Path(__file__).parent / "python_get_jwt_log.json"
    with open(log_path, 'w', encoding='utf-8') as f:
        json.dump(log_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n[LOG SAVED]")
    print(f"Complete log saved to: {log_path}")
    
    return result

result = asyncio.run(verify())

print(f"\n{'='*80}")
print(f"[Output]")
print(f"{'='*80}")

if result.get("result") and result["result"].get("access_token"):
    print(f"Return Value: {result['result']['access_token'][:80]}...")
    print(f"Status: SUCCESS")
else:
    print(f"Return Value: None (exception raised)")
    print(f"Error: {result.get('error', {}).get('message', 'Unknown error')}")
    print(f"Status: FAILED")

print(f"{'='*80}")
