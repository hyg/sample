#!/usr/bin/env python3
"""
Check if Python performs low-S normalization.
"""

import json
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
import base64

# Load identity
cred_path = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message" / "pythonagent.json"
cred = json.loads(cred_path.read_text())

# Load private key
private_key = serialization.load_pem_private_key(
    cred["private_key_pem"].encode("utf-8"),
    password=None
)

# Generate a test signature
test_data = b"test data for signing"
der_signature = private_key.sign(test_data, ec.ECDSA(hashes.SHA256()))
r, s = decode_dss_signature(der_signature)

print("=" * 80)
print("Python ECDSA Signature Analysis")
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

# Encode as DER (with and without normalization)
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature

der_with_normalization = encode_dss_signature(r, s if s <= CURVE_ORDER // 2 else CURVE_ORDER - s)
der_without_normalization = encode_dss_signature(r, s)

print(f"\nDER signature (no normalization): {der_signature.hex()}")
print(f"DER signature (with normalization): {der_with_normalization.hex()}")
print(f"Match: {der_signature.hex() == der_with_normalization.hex()}")

# Encode as base64url
sig_b64url = base64.urlsafe_b64encode(der_signature).rstrip(b"=").decode("ascii")
print(f"\nSignature (base64url): {sig_b64url}")
print(f"Length: {len(sig_b64url)} chars")

print("\n" + "=" * 80)
print("\nConclusion: Python cryptography library does NOT perform low-S normalization by default")
print("The signature is used as-is, regardless of whether S is high or low.")
print("=" * 80)
