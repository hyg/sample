#!/usr/bin/env python3
"""Debug: Generate and print the exact auth header for comparison."""

import json
import hashlib
import base64
import jcs
from pathlib import Path
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes

# Load credential
cred_path = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message" / "pythonagent.json"
cred = json.loads(cred_path.read_text())

print("=" * 80)
print("Python Auth Header Debug")
print("=" * 80)

# Load private key
private_key = load_pem_private_key(cred["private_key_pem"].encode("utf-8"), password=None)

# Generate auth data
nonce = "test-nonce-12345678"  # Fixed for comparison
timestamp = "2026-03-07T10:00:00Z"  # Fixed for comparison
service_domain = "awiki.ai"
did = cred["did"]

# Version 1.1 uses "aud" field
auth_data = {
    "nonce": nonce,
    "timestamp": timestamp,
    "aud": service_domain,
    "did": did
}

print(f"\nAuth data (v1.1 with 'aud' field):")
print(json.dumps(auth_data, indent=2))

# Canonicalize
canonical_json = jcs.canonicalize(auth_data)
print(f"\nCanonical JSON:")
print(canonical_json.decode('utf-8'))

# Hash
content_hash = hashlib.sha256(canonical_json).digest()
print(f"\nContent hash: {content_hash.hex()}")

# Sign
signature = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))
print(f"\nDER signature: {signature.hex()}")

# Encode as base64url
import base64
signature_b64url = base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")
print(f"\nSignature (base64url): {signature_b64url}")

# Build header
auth_header = f'DIDWba v="1.1", did="{did}", nonce="{nonce}", timestamp="{timestamp}", verification_method="key-1", signature="{signature_b64url}"'
print(f"\nAuthorization Header:")
print(auth_header)
