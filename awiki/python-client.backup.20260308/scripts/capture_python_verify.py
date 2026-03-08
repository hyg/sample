#!/usr/bin/env python3
"""
Capture Python's successful verify request for comparison with Node.js.
This will help identify the exact signature format expected by the server.
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
print("Python Verify Request Capture")
print("=" * 80)

# Load credential
cred_dir = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message"
cred_path = cred_dir / "bearertest.json"
cred = json.loads(cred_path.read_text())

did = cred["did"]
private_key_pem = cred["private_key_pem"]

# Load private key
private_key = serialization.load_pem_private_key(private_key_pem.encode("utf-8"), password=None)
public_key = private_key.public_key()

# Get public key numbers
numbers = public_key.public_numbers()
pub_x = numbers.x.to_bytes(32, 'big')
pub_y = numbers.y.to_bytes(32, 'big')
pub_x_b64 = base64.urlsafe_b64encode(pub_x).rstrip(b'=').decode('ascii')
pub_y_b64 = base64.urlsafe_b64encode(pub_y).rstrip(b'=').decode('ascii')

print(f"\n[Identity]")
print(f"DID: {did}")
print(f"Public Key X (base64url): {pub_x_b64}")
print(f"Public Key Y (base64url): {pub_y_b64}")

# Check DID Document
did_doc = cred.get("did_document", {})
print(f"\n[DID Document]")
print(f"ID: {did_doc.get('id', 'N/A')}")

for vm in did_doc.get("verificationMethod", []):
    vm_id = vm.get('id', 'N/A')
    vm_type = vm.get('type', 'N/A')
    print(f"\n  Verification Method: {vm_id}")
    print(f"    Type: {vm_type}")
    if 'publicKeyJwk' in vm:
        jwk = vm['publicKeyJwk']
        doc_x = jwk.get('x', 'N/A')
        doc_y = jwk.get('y', 'N/A')
        kid = jwk.get('kid', 'N/A')
        print(f"    kid: {kid}")
        print(f"    x: {doc_x}")
        print(f"    y: {doc_y}")
        
        # Check if matches
        if vm_id.endswith('#key-1'):
            print(f"\n  [MATCH CHECK] key-1:")
            print(f"    Current X: {pub_x_b64}")
            print(f"    Doc X:     {doc_x}")
            print(f"    X Match:   {pub_x_b64 == doc_x}")
            print(f"    Current Y: {pub_y_b64}")
            print(f"    Doc Y:     {doc_y}")
            print(f"    Y Match:   {pub_y_b64 == doc_y}")

# Generate signature
print(f"\n[Signature Generation]")

nonce = base64.urlsafe_b64encode(hashlib.sha256(datetime.now().isoformat().encode()).digest()).decode('ascii')[:32]
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

# Sign with ECDSA
der_signature = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))
print(f"\nSignature (DER hex): {der_signature.hex()}")
print(f"Signature Length: {len(der_signature)} bytes")

# Decode DER to R, S
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
r, s = decode_dss_signature(der_signature)
print(f"\nR: {r}")
print(f"S: {s}")

# Convert to R||S (64 bytes)
rs_sig = r.to_bytes(32, 'big') + s.to_bytes(32, 'big')
print(f"\nR||S (hex): {rs_sig.hex()}")
print(f"R||S Length: {len(rs_sig)} bytes")

# Base64URL encode DER signature
signature_b64url = base64.urlsafe_b64encode(der_signature).rstrip(b'=').decode('ascii')
print(f"\nSignature (Base64URL of DER): {signature_b64url}")

# Build Authorization header
auth_header = f'DIDWba v="1.1", did="{did}", nonce="{nonce}", timestamp="{timestamp}", verification_method="key-1", signature="{signature_b64url}"'
print(f"\nAuthorization Header:")
print(auth_header)

# Send verify request
print(f"\n{'='*80}")
print(f"VERIFY REQUEST")
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
    
    print(f"\nRequest Body:")
    print(json.dumps(request_body, indent=2))
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://awiki.ai/user-service/did-auth/rpc",
            json=request_body,
            headers={"Content-Type": "application/json"}
        )
    
    print(f"\n{'='*80}")
    print(f"VERIFY RESPONSE")
    print(f"{'='*80}")
    print(f"\nStatus Code: {response.status_code}")
    print(f"\nResponse Headers:")
    for k, v in response.headers.items():
        print(f"  {k}: {v}")
    
    print(f"\nResponse Body:")
    result = response.json()
    print(json.dumps(result, indent=2))
    
    # Parse JWT if successful
    if result.get("result") and result["result"].get("access_token"):
        jwt = result["result"]["access_token"]
        print(f"\n{'='*80}")
        print(f"JWT TOKEN ANALYSIS")
        print(f"{'='*80}")
        print(f"\nJWT: {jwt[:80]}...")
        
        # Parse JWT
        parts = jwt.split('.')
        if len(parts) == 3:
            header_padded = parts[0] + '=' * (-len(parts[0]) % 4)
            payload_padded = parts[1] + '=' * (-len(parts[1]) % 4)
            
            import json as json_module
            header = json_module.loads(base64.urlsafe_b64decode(header_padded))
            payload = json_module.loads(base64.urlsafe_b64decode(payload_padded))
            
            print(f"\nJWT Header:")
            for k, v in header.items():
                print(f"  {k}: {v}")
            
            print(f"\nJWT Payload:")
            for k, v in payload.items():
                if isinstance(v, (int, float)) and k in ('iat', 'exp'):
                    dt = datetime.fromtimestamp(v, tz=timezone.utc)
                    print(f"  {k}: {v} ({dt.isoformat()})")
                else:
                    print(f"  {k}: {v}")
    
    # Save complete log
    log_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "identity": {
            "did": did,
            "public_key_x_b64": pub_x_b64,
            "public_key_y_b64": pub_y_b64
        },
        "did_document": {
            "id": did_doc.get('id', 'N/A'),
            "verification_methods": did_doc.get("verificationMethod", [])
        },
        "signature_generation": {
            "auth_data": auth_data,
            "canonical_json": canonical_json.decode('utf-8'),
            "content_hash": content_hash.hex(),
            "signature_der_hex": der_signature.hex(),
            "signature_der_length": len(der_signature),
            "r": str(r),
            "s": str(s),
            "rs_sig_hex": rs_sig.hex(),
            "signature_b64url": signature_b64url,
            "authorization_header": auth_header
        },
        "http_request": {
            "url": "https://awiki.ai/user-service/did-auth/rpc",
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": request_body
        },
        "http_response": {
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "body": result
        }
    }
    
    log_path = Path(__file__).parent / "python_verify_log.json"
    with open(log_path, 'w', encoding='utf-8') as f:
        json.dump(log_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n[LOG SAVED]")
    print(f"Complete log saved to: {log_path}")
    
    return result

result = asyncio.run(verify())

print(f"\n{'='*80}")
if result.get("result") and result["result"].get("access_token"):
    print("[SUCCESS] Python verify succeeded!")
    print("Use this log to compare with Node.js implementation.")
else:
    print("[FAILED] Python verify also failed!")
    print("This suggests a server-side issue or credential problem.")
print(f"{'='*80}")
