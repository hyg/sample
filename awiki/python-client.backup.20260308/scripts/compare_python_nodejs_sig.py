#!/usr/bin/env python3
"""
Compare Python registration signature with Node.js verification signature.
"""

import json
import hashlib
import base64
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
import jcs

print("=" * 80)
print("Compare Python vs Node.js Signature Generation")
print("=" * 80)

# Load TestFresh credential
cred_path = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message" / "testfresh.json"
cred = json.loads(cred_path.read_text())

print(f"\n[1] Load Credential")
print("-" * 80)
print(f"DID: {cred['did']}")

# Load private key
private_key = serialization.load_pem_private_key(
    cred["private_key_pem"].encode("utf-8"),
    password=None
)

# Use same nonce and timestamp as Node.js test
nonce = "32aa8fc14a085be56417e42d47a8a795"
timestamp = "2026-03-07T13:38:25Z"

print(f"\n[2] Auth Data (same as Node.js)")
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

# Sign (Python way - DER format)
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

# Compare with Node.js output
print("\n[8] Comparison with Node.js")
print("-" * 80)

nodejs_sig = "mlaCUNDEP2CyVz8TSE-cwQu4Dfb6qDHgb_lQwlIuamBimEti6zNUwikjgrR-i_e0iU3BY7axh_6qEVkVkTf_3w"
print(f"Python signature:  {signature_b64url}")
print(f"Node.js signature: {nodejs_sig}")
print(f"Match: {signature_b64url == nodejs_sig}")

# Decode both and compare raw bytes
python_sig_bytes = base64.urlsafe_b64decode(signature_b64url + "=" * (-len(signature_b64url) % 4))
nodejs_sig_bytes = base64.urlsafe_b64decode(nodejs_sig + "=" * (-len(nodejs_sig) % 4))

print(f"\nPython signature bytes:  {python_sig_bytes.hex()}")
print(f"Node.js signature bytes: {nodejs_sig_bytes.hex()}")
print(f"Bytes match: {python_sig_bytes == nodejs_sig_bytes}")

print("\n" + "=" * 80)
