#!/usr/bin/env python3
"""Debug: Check if Python signature needs low-S normalization."""

import json
import hashlib
import base64
import jcs
from pathlib import Path
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

# Load credential
cred_path = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message" / "pythonagent.json"
cred = json.loads(cred_path.read_text())

# Load private key
private_key = load_pem_private_key(cred["private_key_pem"].encode("utf-8"), password=None)

# Generate auth data
nonce = "test-nonce-12345678"
timestamp = "2026-03-07T10:00:00Z"
service_domain = "awiki.ai"
did = cred["did"]

auth_data = {
    "nonce": nonce,
    "timestamp": timestamp,
    "aud": service_domain,
    "did": did
}

# Canonicalize and hash
canonical_json = jcs.canonicalize(auth_data)
content_hash = hashlib.sha256(canonical_json).digest()

# Sign
der_signature = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))

# Decode to get R and S
r, s = decode_dss_signature(der_signature)

print("=" * 80)
print("Python Signature Analysis")
print("=" * 80)

print(f"\nR: {r}")
print(f"S: {s}")

# Check low-S
CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
print(f"\nCURVE_ORDER/2: {CURVE_ORDER // 2}")
print(f"S > CURVE_ORDER/2: {s > CURVE_ORDER // 2}")

if s > CURVE_ORDER // 2:
    print("\nS is HIGH-S (needs normalization)")
    s_normalized = CURVE_ORDER - s
    print(f"Normalized S: {s_normalized}")
else:
    print("\nS is already low-S (no normalization needed)")

# Encode as DER
print(f"\nOriginal DER signature: {der_signature.hex()}")
print(f"DER signature length: {len(der_signature)} bytes")

# Encode as base64url
signature_b64url = base64.urlsafe_b64encode(der_signature).rstrip(b"=").decode("ascii")
print(f"\nSignature (base64url): {signature_b64url}")
print(f"Signature length: {len(signature_b64url)} chars")
