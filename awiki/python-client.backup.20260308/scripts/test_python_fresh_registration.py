#!/usr/bin/env python3
"""
Test registration with fresh Python-generated DID document.
"""

import json
import httpx
import hashlib
import base64
import secrets
from datetime import datetime, timezone
from pathlib import Path
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
import jcs

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
results = json.load(open(OUTPUT_DIR / "did_proof_intermediate.json"))

# Load private key
priv_key = load_pem_private_key(results['step1_keypair']['private_key_pem'].encode(), password=None)

# Get document without proof
doc_without_proof = {k: v for k, v in results['step4_doc_to_sign'].items() if k != 'proof'}

# Create new proof with fresh timestamp
created = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
challenge = secrets.token_hex(16)

proof = {
    "type": "EcdsaSecp256k1Signature2019",
    "created": created,
    "verificationMethod": results['step3_proof_params']['verificationMethod'],
    "proofPurpose": "authentication",
    "domain": "awiki.ai",
    "challenge": challenge,
    "proofValue": ""
}

# Create document with empty proofValue for signing
doc_for_signing = {**doc_without_proof, "proof": {**proof, "proofValue": ""}}

# Canonicalize and hash
canonical = jcs.canonicalize(doc_for_signing)
content_hash = hashlib.sha256(canonical).digest()

# Sign
der_sig = priv_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))
r, s = decode_dss_signature(der_sig)

# Low-S normalization
CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
if s > CURVE_ORDER // 2:
    s = CURVE_ORDER - s

r_bytes = r.to_bytes(32, 'big')
s_bytes = s.to_bytes(32, 'big')
signature = r_bytes + s_bytes

# Base64url encode
proof_value = base64.urlsafe_b64encode(signature).rstrip(b'=').decode('ascii')

# Build final document
proof["proofValue"] = proof_value
final_doc = {**doc_without_proof, "proof": proof}

print(f"DID: {final_doc['id']}")
print(f"Timestamp: {created}")
print(f"Challenge: {challenge}")
print(f"Proof: {proof_value[:50]}...")

# Register
try:
    with httpx.Client(timeout=30) as client:
        response = client.post('https://awiki.ai/user-service/did-auth/rpc', json={
            'jsonrpc': '2.0',
            'method': 'register',
            'params': {
                'did_document': final_doc,
                'name': 'PythonTestFresh',
                'is_agent': True
            },
            'id': 1
        })
    
    result = response.json()
    with open('test_result_fresh.json', 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"\nStatus: {response.status_code}")
    if 'error' in result:
        print(f"Error: {result['error']['message']}")
    else:
        print(f"SUCCESS: {result['result']['did']}")
        print(f"User ID: {result['result']['user_id']}")
        
except Exception as e:
    with open('test_result_fresh.json', 'w') as f:
        json.dump({'error': str(e)}, f, indent=2)
    print(f"Exception: {e}")
