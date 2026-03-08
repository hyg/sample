#!/usr/bin/env python3
"""
Compare signature generation between Python and Node.js using the same private key.
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
cred_path = Path(r"D:\huangyg\git\awiki-agent-id-skill\nodejs-awiki\.credentials\nodeagentjwt2.json")
cred = json.loads(cred_path.read_text())

print("=" * 80)
print("Python Signature Generation (using Node.js private key)")
print("=" * 80)

# Load private key from PEM
private_key = serialization.load_pem_private_key(
    cred["private_key_pem"].encode("utf-8"),
    password=None
)

# Generate auth data (same as Node.js)
nonce = "1f0bdba63151aff86982c6a82a53f554"
timestamp = "2026-03-07T10:51:25Z"
service_domain = "awiki.ai"
did = cred["did"]

auth_data = {
    "nonce": nonce,
    "timestamp": timestamp,
    "aud": service_domain,
    "did": did
}

print(f"\nAuth data:")
print(json.dumps(auth_data, indent=2))

# Canonicalize
canonical_json = jcs.canonicalize(auth_data)
print(f"\nCanonical JSON:")
print(canonical_json.decode("utf-8"))

# Hash
content_hash = hashlib.sha256(canonical_json).digest()
print(f"\nContent hash:")
print(content_hash.hex())

# Sign
der_signature = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))
r, s = decode_dss_signature(der_signature)

print(f"\nSignature R: {r}")
print(f"Signature S: {s}")

# Check low-S
CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
print(f"\nS > CURVE_ORDER/2: {s > CURVE_ORDER // 2}")

# Encode as DER (without low-S normalization, matching Python behavior)
print(f"\nDER signature: {der_signature.hex()}")
print(f"DER signature length: {len(der_signature)} bytes")

# Encode as base64url
signature_b64url = base64.urlsafe_b64encode(der_signature).rstrip(b"=").decode("ascii")
print(f"\nSignature (base64url): {signature_b64url}")
print(f"Signature length: {len(signature_b64url)} chars")

# Build header
auth_header = f'DIDWba v="1.1", did="{did}", nonce="{nonce}", timestamp="{timestamp}", verification_method="key-1", signature="{signature_b64url}"'
print(f"\nAuthorization Header:")
print(auth_header)

print("\n" + "=" * 80)
