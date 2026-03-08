#!/usr/bin/env python3
"""
Debug: Check what the register response actually contains.
"""

import json
import asyncio
import hashlib
import base64
from pathlib import Path
from datetime import datetime, timezone
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
import jcs
import httpx

print("=" * 80)
print("Debug: Register Response Analysis")
print("=" * 80)

# Load credential to get private key
cred_dir = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message"
cred_path = cred_dir / "bearertest.json"
cred = json.loads(cred_path.read_text())

# We'll create a fresh DID for this test
private_key = ec.generate_private_key(ec.SECP256K1())
public_key = private_key.public_key()

# Get key bytes
numbers = public_key.public_numbers()
x = numbers.x.to_bytes(32, 'big')
y = numbers.y.to_bytes(32, 'big')
x_b64 = base64.urlsafe_b64encode(x).rstrip(b'=').decode('ascii')
y_b64 = base64.urlsafe_b64encode(y).rstrip(b'=').decode('ascii')

# Calculate fingerprint
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
compressed = public_key.public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
fingerprint = hashlib.sha256(compressed).digest()
fingerprint_b64 = base64.urlsafe_b64encode(fingerprint).rstrip(b'=').decode('ascii')

did = f"did:wba:awiki.ai:user:k1_{fingerprint_b64}"

print(f"\n[New Identity]")
print(f"DID: {did}")
print(f"Public Key X: {x_b64}")
print(f"Public Key Y: {y_b64}")

# Build DID Document
did_document = {
    "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://w3id.org/security/suites/jws-2020/v1",
        "https://w3id.org/security/suites/secp256k1-2019/v1"
    ],
    "id": did,
    "verificationMethod": [{
        "id": f"{did}#key-1",
        "type": "EcdsaSecp256k1VerificationKey2019",
        "controller": did,
        "publicKeyJwk": {
            "kty": "EC",
            "crv": "secp256k1",
            "x": x_b64,
            "y": y_b64
        }
    }],
    "authentication": [f"{did}#key-1"]
}

# Generate proof
nonce = hashlib.sha256(datetime.now().isoformat().encode()).hexdigest()[:32]
timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

proof_options = {
    "type": "EcdsaSecp256k1Signature2019",
    "created": timestamp,
    "verificationMethod": f"{did}#key-1",
    "proofPurpose": "authentication",
    "domain": "awiki.ai",
    "challenge": nonce
}

doc_without_proof = {k: v for k, v in did_document.items() if k != "proof"}
doc_hash = hashlib.sha256(jcs.canonicalize(doc_without_proof)).digest()
options_hash = hashlib.sha256(jcs.canonicalize(proof_options)).digest()
to_be_signed = options_hash + doc_hash

der_signature = private_key.sign(to_be_signed, ec.ECDSA(hashes.SHA256()))
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
r, s = decode_dss_signature(der_signature)
rs_sig = r.to_bytes(32, 'big') + s.to_bytes(32, 'big')
proof_value = base64.urlsafe_b64encode(rs_sig).rstrip(b'=').decode('ascii')

proof = dict(proof_options)
proof["proofValue"] = proof_value

did_document["proof"] = proof

print(f"\n[DID Document with Proof]")
print(f"Proof Type: {proof['type']}")
print(f"Proof Value: {proof_value[:50]}...")

# Send register request
async def register():
    print(f"\n{'='*80}")
    print(f"REGISTER REQUEST")
    print(f"{'='*80}")
    
    request_body = {
        "jsonrpc": "2.0",
        "method": "register",
        "params": {
            "did_document": did_document,
            "name": "DebugTest",
            "is_agent": True
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
    print(f"REGISTER RESPONSE")
    print(f"{'='*80}")
    print(f"\nStatus Code: {response.status_code}")
    print(f"\nResponse Headers:")
    for k, v in response.headers.items():
        print(f"  {k}: {v}")
    
    print(f"\nResponse Body:")
    result = response.json()
    print(json.dumps(result, indent=2))
    
    # Analyze response
    print(f"\n{'='*80}")
    print(f"RESPONSE ANALYSIS")
    print(f"{'='*80}")
    
    if result.get("result"):
        res = result["result"]
        print(f"\n[SUCCESS] Registration successful")
        print(f"  did: {res.get('did', 'N/A')}")
        print(f"  user_id: {res.get('user_id', 'N/A')}")
        print(f"  access_token (JWT): {'PRESENT' if res.get('access_token') else 'NOT PRESENT'}")
        
        if res.get('access_token'):
            jwt = res['access_token']
            print(f"  JWT: {jwt[:50]}...")
            
            # Parse JWT
            parts = jwt.split('.')
            if len(parts) == 3:
                import json as json_module
                header_padded = parts[0] + '=' * (-len(parts[0]) % 4)
                payload_padded = parts[1] + '=' * (-len(parts[1]) % 4)
                
                header = json_module.loads(base64.urlsafe_b64decode(header_padded))
                payload = json_module.loads(base64.urlsafe_b64decode(payload_padded))
                
                print(f"\n  JWT Header:")
                print(f"    alg: {header.get('alg', 'N/A')}")
                print(f"    kid: {header.get('kid', 'N/A')}")
                print(f"    typ: {header.get('typ', 'N/A')}")
                
                print(f"\n  JWT Payload:")
                for k, v in payload.items():
                    print(f"    {k}: {v}")
        else:
            print(f"\n[NOTE] access_token NOT in response")
            print(f"This means JWT must be obtained separately via 'verify' method")
    else:
        print(f"\n[FAILED] Registration failed")
        print(f"Error: {result.get('error', {}).get('message', 'Unknown error')}")
    
    # Save complete log
    log_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request": {
            "did": did,
            "body": request_body
        },
        "response": {
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "body": result
        },
        "analysis": {
            "registration_success": bool(result.get("result")),
            "jwt_included": bool(result.get("result", {}).get("access_token")) if result.get("result") else False
        }
    }
    
    log_path = Path(__file__).parent / "register_response_log.json"
    with open(log_path, 'w', encoding='utf-8') as f:
        json.dump(log_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n[LOG SAVED]")
    print(f"Complete log saved to: {log_path}")

asyncio.run(register())

print(f"\n{'='*80}")
