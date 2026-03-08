#!/usr/bin/env python3
"""
Generate auth header using Python with the SAME private key as Node.js.
"""

import json
import hashlib
import base64
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
import jcs

# Load Node.js credential
cred_path = Path(r"D:\huangyg\git\awiki-agent-id-skill\nodejs-awiki\.credentials\nodeagentfinal.json")
cred = json.loads(cred_path.read_text())

print("=" * 80)
print("Python Signature Generation (using Node.js private key)")
print("=" * 80)

# Load private key from PEM
private_key = serialization.load_pem_private_key(
    cred["private_key_pem"].encode("utf-8"),
    password=None
)

# Get public key for verification
public_key = private_key.public_key()

# Generate auth data (same as Node.js test)
nonce = "9fd0ab6d5e0849d9e229b52e9722e940"
timestamp = "2026-03-07T10:58:04Z"
service_domain = "awiki.ai"
did = cred["did"]

auth_data = {
    "nonce": nonce,
    "timestamp": timestamp,
    "aud": service_domain,
    "did": did
}

print(f"\n[1] Auth Data:")
print(json.dumps(auth_data, indent=2))

# Canonicalize using JCS
canonical_json = jcs.canonicalize(auth_data)
print(f"\n[2] Canonical JSON:")
print(canonical_json.decode("utf-8"))

# Hash
content_hash = hashlib.sha256(canonical_json).digest()
print(f"\n[3] Content Hash:")
print(content_hash.hex())

# Sign
der_signature = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))
r, s = decode_dss_signature(der_signature)

print(f"\n[4] Signature (DER):")
print(der_signature.hex())
print(f"DER length: {len(der_signature)} bytes")

print(f"\n[5] Signature (R, S):")
print(f"R: {r}")
print(f"S: {s}")

# Check low-S
CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
print(f"\n[6] Low-S Check:")
print(f"S > CURVE_ORDER/2: {s > CURVE_ORDER // 2}")

# Encode as base64url
signature_b64url = base64.urlsafe_b64encode(der_signature).rstrip(b"=").decode("ascii")
print(f"\n[7] Signature (base64url):")
print(signature_b64url)
print(f"Length: {len(signature_b64url)} chars")

# Build header
auth_header = f'DIDWba v="1.1", did="{did}", nonce="{nonce}", timestamp="{timestamp}", verification_method="key-1", signature="{signature_b64url}"'
print(f"\n[8] Authorization Header:")
print(auth_header)

# Verify signature (test)
print(f"\n[9] Signature Verification Test:")
try:
    public_key.verify(der_signature, content_hash, ec.ECDSA(hashes.SHA256()))
    print("✓ Signature verification: PASSED")
except Exception as e:
    print(f"✗ Signature verification: FAILED - {e}")

print("\n" + "=" * 80)

# Compare with Node.js signature
nodejs_signature = "MEQCIAc0HpIOYa7QUYx1k64u-_jpJHM8setkAr9Rln7sOuF8AiAH32WtEEI7CPeWUaEfpYT5pfSb7le10WmWSW9pwLUX-Q"
print(f"\n[10] Comparison with Node.js:")
print(f"Python signature:   {signature_b64url}")
print(f"Node.js signature:  {nodejs_signature}")
print(f"Match: {signature_b64url == nodejs_signature}")
