#!/usr/bin/env python3
"""
Complete request/response logging with full context.
Captures HTTP headers, timestamps, signature details, and JWT structure.
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
print("Complete Request/Response Logging")
print("=" * 80)

# Load credential
cred_dir = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message"
cred_path = cred_dir / "bearertest.json"
cred = json.loads(cred_path.read_text())

did = cred["did"]
jwt = cred["jwt_token"]
private_key_pem = cred["private_key_pem"]

# Parse private key
private_key = serialization.load_pem_private_key(private_key_pem.encode("utf-8"), password=None)
public_key = private_key.public_key()

# Extract public key numbers
numbers = public_key.public_numbers()
pub_x_hex = numbers.x.to_bytes(32, 'big').hex()
pub_y_hex = numbers.y.to_bytes(32, 'big').hex()

print(f"\n[Identity Information]")
print(f"DID: {did}")
print(f"Public Key X (hex): {pub_x_hex}")
print(f"Public Key Y (hex): {pub_y_hex}")

# Parse JWT
def parse_jwt(token):
    """Parse JWT and return header, payload, signature."""
    parts = token.split('.')
    if len(parts) != 3:
        return None, None, None
    
    # Add padding
    header_padded = parts[0] + '=' * (-len(parts[0]) % 4)
    payload_padded = parts[1] + '=' * (-len(parts[1]) % 4)
    
    header_json = base64.urlsafe_b64decode(header_padded)
    payload_json = base64.urlsafe_b64decode(payload_padded)
    
    return json.loads(header_json), json.loads(payload_json), parts[2]

jwt_header, jwt_payload, jwt_sig = parse_jwt(jwt)

print(f"\n[JWT Token Structure]")
print(f"Header: {json.dumps(jwt_header, indent=2)}")
print(f"Payload: {json.dumps(jwt_payload, indent=2)}")
print(f"Signature (base64url): {jwt_sig[:50]}...")

# Check JWT expiration
if 'exp' in jwt_payload:
    exp_time = datetime.fromtimestamp(jwt_payload['exp'], tz=timezone.utc)
    iat_time = datetime.fromtimestamp(jwt_payload['iat'], tz=timezone.utc)
    now = datetime.now(timezone.utc)
    
    print(f"\n[JWT Timeline]")
    print(f"Issued at:  {iat_time.isoformat()}")
    print(f"Expires at: {exp_time.isoformat()}")
    print(f"Current:    {now.isoformat()}")
    print(f"TTL:        {exp_time.timestamp() - iat_time.timestamp():.0f} seconds ({(exp_time.timestamp() - iat_time.timestamp()) / 60:.1f} minutes)")
    print(f"Remaining:  {exp_time.timestamp() - now.timestamp():.0f} seconds ({(exp_time.timestamp() - now.timestamp()) / 60:.1f} minutes)")
    
    if now > exp_time:
        print(f"Status:     EXPIRED")
    else:
        print(f"Status:     VALID")

# Generate signature for verification
print(f"\n[Signature Generation Details]")

nonce = "test-nonce-" + datetime.now().strftime("%Y%m%d%H%M%S")
timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

auth_data = {
    "nonce": nonce,
    "timestamp": timestamp,
    "aud": "awiki.ai",
    "did": did
}

print(f"Auth Data: {json.dumps(auth_data, indent=2)}")

# JCS canonicalize
canonical_json = jcs.canonicalize(auth_data)
print(f"\nCanonical JSON: {canonical_json.decode('utf-8')}")

# SHA-256 hash
content_hash = hashlib.sha256(canonical_json).digest()
print(f"\nContent Hash: {content_hash.hex()}")

# Sign
der_signature = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))
print(f"\nSignature (DER hex): {der_signature.hex()}")
print(f"Signature Length: {len(der_signature)} bytes")

# Decode DER to R, S
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
r, s = decode_dss_signature(der_signature)
print(f"\nR: {r}")
print(f"S: {s}")
print(f"R (hex): {r.to_bytes(32, 'big').hex()}")
print(f"S (hex): {s.to_bytes(32, 'big').hex()}")

# Base64URL encode
signature_b64url = base64.urlsafe_b64encode(der_signature).rstrip(b'=').decode("ascii")
print(f"\nSignature (Base64URL): {signature_b64url}")

# Build auth header
auth_header = f'DIDWba v="1.1", did="{did}", nonce="{nonce}", timestamp="{timestamp}", verification_method="key-1", signature="{signature_b64url}"'
print(f"\nAuthorization Header:")
print(auth_header)

# Check DID Document
print(f"\n[DID Document Analysis]")
did_doc = cred["did_document"]
print(f"DID Document ID: {did_doc['id']}")
print(f"Verification Methods: {len(did_doc.get('verificationMethod', []))}")

for i, vm in enumerate(did_doc.get('verificationMethod', []), 1):
    print(f"\n  [{i}] {vm['id']}")
    print(f"      Type: {vm['type']}")
    if 'publicKeyJwk' in vm:
        jwk = vm['publicKeyJwk']
        print(f"      crv: {jwk.get('crv', 'N/A')}")
        print(f"      x: {jwk.get('x', 'N/A')[:50]}...")
        print(f"      y: {jwk.get('y', 'N/A')[:50]}...")
        print(f"      kid: {jwk.get('kid', 'N/A')}")

# Check if key-1 exists
key1_found = False
for vm in did_doc.get('verificationMethod', []):
    if vm['id'].endswith('#key-1'):
        key1_found = True
        print(f"\n[PUBLIC KEY MATCH]")
        print(f"verification_method='key-1' matches: {vm['id']}")
        
        # Compare public keys
        if 'publicKeyJwk' in vm:
            jwk_x = vm['publicKeyJwk'].get('x')
            jwk_y = vm['publicKeyJwk'].get('y')
            
            # Convert current public key to base64url
            current_x = base64.urlsafe_b64encode(numbers.x.to_bytes(32, 'big')).rstrip(b'=').decode('ascii')
            current_y = base64.urlsafe_b64encode(numbers.y.to_bytes(32, 'big')).rstrip(b'=').decode('ascii')
            
            print(f"\nDID Document X: {jwk_x[:50]}...")
            print(f"Current Key X:  {current_x[:50]}...")
            print(f"X Match: {jwk_x == current_x}")
            
            print(f"\nDID Document Y: {jwk_y[:50]}...")
            print(f"Current Key Y:  {current_y[:50]}...")
            print(f"Y Match: {jwk_y == current_y}")

if not key1_found:
    print(f"\n[WARNING] verification_method='key-1' not found in DID Document!")

# Send request with full logging
print(f"\n{'='*80}")
print(f"HTTP Request/Response Log")
print(f"{'='*80}")

async def send_with_logging():
    request_body = {
        "jsonrpc": "2.0",
        "method": "get_me",
        "params": {},
        "id": 1
    }
    
    request_headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt}"
    }
    
    print(f"\n[Request]")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print(f"URL: https://awiki.ai/user-service/did-auth/rpc")
    print(f"Method: POST")
    print(f"\nHeaders:")
    for k, v in request_headers.items():
        if 'Authorization' in k:
            print(f"  {k}: {v[:50]}...")
        else:
            print(f"  {k}: {v}")
    
    print(f"\nBody:")
    print(json.dumps(request_body, indent=2))
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://awiki.ai/user-service/did-auth/rpc",
            json=request_body,
            headers=request_headers
        )
    
    print(f"\n[Response]")
    print(f"Status Code: {response.status_code}")
    print(f"\nHeaders:")
    for k, v in response.headers.items():
        print(f"  {k}: {v}")
    
    print(f"\nBody:")
    print(json.dumps(response.json(), indent=2))
    
    # Save complete log
    log_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "identity": {
            "did": did,
            "public_key_x_hex": pub_x_hex,
            "public_key_y_hex": pub_y_hex
        },
        "jwt": {
            "header": jwt_header,
            "payload": jwt_payload,
            "signature": jwt_sig,
            "issued_at": datetime.fromtimestamp(jwt_payload.get('iat', 0), tz=timezone.utc).isoformat() if 'iat' in jwt_payload else None,
            "expires_at": datetime.fromtimestamp(jwt_payload.get('exp', 0), tz=timezone.utc).isoformat() if 'exp' in jwt_payload else None,
            "status": "EXPIRED" if datetime.now(timezone.utc) > datetime.fromtimestamp(jwt_payload.get('exp', 0), tz=timezone.utc) else "VALID"
        },
        "did_document": {
            "id": did_doc['id'],
            "verification_methods": did_doc.get('verificationMethod', []),
            "key_1_found": key1_found
        },
        "signature_generation": {
            "auth_data": auth_data,
            "canonical_json": canonical_json.decode('utf-8'),
            "content_hash": content_hash.hex(),
            "signature_der_hex": der_signature.hex(),
            "r": str(r),
            "s": str(s),
            "authorization_header": auth_header
        },
        "http_request": {
            "url": "https://awiki.ai/user-service/did-auth/rpc",
            "method": "POST",
            "headers": request_headers,
            "body": request_body
        },
        "http_response": {
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "body": response.json()
        }
    }
    
    log_path = Path(__file__).parent / "complete_request_log.json"
    with open(log_path, 'w', encoding='utf-8') as f:
        json.dump(log_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n[LOG SAVED]")
    print(f"Complete log saved to: {log_path}")

asyncio.run(send_with_logging())

print(f"\n{'='*80}")
print(f"Logging completed")
print(f"{'='*80}")
