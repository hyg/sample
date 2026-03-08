#!/usr/bin/env python3
"""
Generate test vectors from new Python version for Node.js comparison.
"""

import json
import hashlib
import base64
import secrets
from datetime import datetime, timezone
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption
from anp.authentication import create_did_wba_document_with_key_binding

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 70)
print("Generating test vectors from new Python version")
print("=" * 70)

# Create DID identity using ANP
hostname = "awiki.ai"
path_prefix = ["user"]
proof_purpose = "authentication"
domain = "awiki.ai"
challenge = secrets.token_hex(16)

did_document, keys = create_did_wba_document_with_key_binding(
    hostname=hostname,
    path_prefix=path_prefix,
    proof_purpose=proof_purpose,
    domain=domain,
    challenge=challenge,
)

private_key_pem, public_key_pem = keys["key-1"]

# Extract private key bytes
from cryptography.hazmat.primitives.serialization import load_pem_private_key
private_key = load_pem_private_key(private_key_pem, password=None)
private_numbers = private_key.private_numbers()
private_bytes = private_numbers.private_value.to_bytes(32, 'big')

# Build test vector
test_vector = {
    "did": did_document["id"],
    "did_document": did_document,
    "private_key_pem": private_key_pem.decode('utf-8'),
    "public_key_pem": public_key_pem.decode('utf-8'),
    "private_key_hex": private_bytes.hex(),
    "proof": did_document["proof"],
    "proof_options": {
        "type": did_document["proof"]["type"],
        "created": did_document["proof"]["created"],
        "verificationMethod": did_document["proof"]["verificationMethod"],
        "proofPurpose": did_document["proof"]["proofPurpose"],
        "domain": did_document["proof"]["domain"],
        "challenge": did_document["proof"]["challenge"]
    }
}

# Calculate signing input for verification
import jcs

# Document without proof
doc_without_proof = {k: v for k, v in did_document.items() if k != "proof"}

# Proof options (without proofValue)
proof_options = {k: v for k, v in did_document["proof"].items() if k != "proofValue"}

# Compute hashes
doc_hash = hashlib.sha256(jcs.canonicalize(doc_without_proof)).digest()
options_hash = hashlib.sha256(jcs.canonicalize(proof_options)).digest()
to_be_signed = options_hash + doc_hash

test_vector["to_be_signed_hex"] = to_be_signed.hex()
test_vector["doc_hash_hex"] = doc_hash.hex()
test_vector["options_hash_hex"] = options_hash.hex()

# Save test vector
with open(OUTPUT_DIR / "new_python_test_vector.json", "w") as f:
    json.dump(test_vector, f, indent=2)

print(f"\nDID: {did_document['id']}")
print(f"Proof value: {did_document['proof']['proofValue']}")
print(f"ToBeSigned: {to_be_signed.hex()}")
print(f"\nTest vector saved to: {OUTPUT_DIR / 'new_python_test_vector.json'}")

# Try to register to verify it works
print("\n" + "=" * 70)
print("Testing registration with awiki.ai...")
print("=" * 70)

import httpx

try:
    with httpx.Client(timeout=30) as client:
        response = client.post('https://awiki.ai/user-service/did-auth/rpc', json={
            'jsonrpc': '2.0',
            'method': 'register',
            'params': {
                'did_document': did_document,
                'name': 'NewPythonTest',
                'is_agent': True
            },
            'id': 1
        })
    
    result = response.json()
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(result, indent=2)}")
    if 'error' in result:
        print(f"Registration failed: {result['error']['message']}")
    else:
        print(f"SUCCESS! DID: {result['result']['did']}")
        print(f"User ID: {result['result']['user_id']}")
except Exception as e:
    print(f"Error: {e}")
