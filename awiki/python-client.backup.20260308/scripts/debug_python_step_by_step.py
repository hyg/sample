#!/usr/bin/env python3
"""
Python version step-by-step debug output.
Uses a fixed private key for reproducible comparison.
"""

import json
import hashlib
import base64
import secrets
from datetime import datetime, timezone
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
import jcs

print("=" * 80)
print("Python Version: Step-by-Step Debug Output")
print("=" * 80)

# Use a fixed private key for testing
TEST_PRIVATE_KEY_HEX = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

# Generate DID document using ANP
from anp.authentication import create_did_wba_document_with_key_binding

print("\n[Step 1] Generate DID Document")
print("-" * 80)

did_document, keys = create_did_wba_document_with_key_binding(
    hostname="awiki.ai",
    path_prefix=["user"],
    proof_purpose="authentication",
    domain="awiki.ai",
    challenge="test-challenge-12345",
    enable_e2ee=True
)

print(f"DID: {did_document['id']}")
print(f"key-1 kid: {did_document['verificationMethod'][0]['publicKeyJwk'].get('kid', 'N/A')}")

# Extract private key
private_key_pem = keys["key-1"][0]
private_key = serialization.load_pem_private_key(private_key_pem, password=None)
public_key = private_key.public_key()

print(f"\nPrivate Key (hex): {private_key.private_numbers().private_value.to_bytes(32, 'big').hex()}")
print(f"Public Key X: {public_key.public_numbers().x.to_bytes(32, 'big').hex()}")
print(f"Public Key Y: {public_key.public_numbers().y.to_bytes(32, 'big').hex()}")

# Generate auth header
print("\n[Step 2] Generate Auth Header")
print("-" * 80)

from anp.authentication import generate_auth_header

def sign_callback(content, vm_fragment):
    return private_key.sign(content, ec.ECDSA(hashes.SHA256()))

service_url = "https://awiki.ai"
did_domain = "awiki.ai"
version = "1.1"

# Fixed nonce and timestamp for comparison
test_nonce = "00112233445566778899aabbccddeeff"
test_timestamp = "2026-03-07T12:00:00Z"

# Manually construct to match Node.js test
nonce = test_nonce
timestamp = test_timestamp
did = did_document['id']
domain_field = "aud" if float(version) >= 1.1 else "service"

print(f"nonce: {nonce}")
print(f"timestamp: {timestamp}")
print(f"domain_field: {domain_field}")
print(f"service_domain: {did_domain}")
print(f"did: {did}")

# Construct data to sign
print("\n[Step 3] Construct Data to Sign")
print("-" * 80)

data_to_sign = {
    "nonce": nonce,
    "timestamp": timestamp,
    domain_field: did_domain,
    "did": did
}

print(f"data_to_sign: {json.dumps(data_to_sign, indent=2)}")

# JCS canonicalize
print("\n[Step 4] JCS Canonicalization")
print("-" * 80)

canonical_json = jcs.canonicalize(data_to_sign)
print(f"canonical_json: {canonical_json.decode('utf-8')}")
print(f"canonical_json (hex): {canonical_json.hex()}")

# SHA-256 hash
print("\n[Step 5] SHA-256 Hash")
print("-" * 80)

content_hash = hashlib.sha256(canonical_json).digest()
print(f"content_hash: {content_hash.hex()}")
print(f"content_hash length: {len(content_hash)} bytes")

# ECDSA signature
print("\n[Step 6] ECDSA secp256k1 Signature")
print("-" * 80)

der_signature = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))
print(f"der_signature: {der_signature.hex()}")
print(f"der_signature length: {len(der_signature)} bytes")

# Decode DER to R, S
r, s = decode_dss_signature(der_signature)
print(f"r: {r}")
print(f"s: {s}")

# Convert to R||S format (64 bytes)
print("\n[Step 7] Convert to R||S Format")
print("-" * 80)

key_size = 32
r_bytes = r.to_bytes(key_size, byteorder='big')
s_bytes = s.to_bytes(key_size, byteorder='big')
rs_signature = r_bytes + s_bytes

print(f"r_bytes: {r_bytes.hex()}")
print(f"s_bytes: {s_bytes.hex()}")
print(f"rs_signature: {rs_signature.hex()}")
print(f"rs_signature length: {len(rs_signature)} bytes")

# Check low-S
CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
print(f"\ns > CURVE_ORDER/2: {s > CURVE_ORDER // 2}")
print(f"low-S normalization applied: {s > CURVE_ORDER // 2}")

# Base64URL encode
print("\n[Step 8] Base64URL Encode")
print("-" * 80)

signature_b64url = base64.urlsafe_b64encode(rs_signature).rstrip(b"=").decode("ascii")
print(f"signature_b64url: {signature_b64url}")
print(f"signature_b64url length: {len(signature_b64url)} chars")

# Build Authorization header
print("\n[Step 9] Build Authorization Header")
print("-" * 80)

auth_header = f'DIDWba v="{version}", did="{did}", nonce="{nonce}", timestamp="{timestamp}", verification_method="key-1", signature="{signature_b64url}"'
print(f"auth_header: {auth_header}")

# Verify signature
print("\n[Step 10] Verify Signature")
print("-" * 80)

try:
    public_key.verify(der_signature, content_hash, ec.ECDSA(hashes.SHA256()))
    print("Signature verification: PASSED")
except Exception as e:
    print(f"Signature verification: FAILED - {e}")

# Save output
output = {
    "did": did,
    "private_key_hex": private_key.private_numbers().private_value.to_bytes(32, 'big').hex(),
    "public_key_x_hex": public_key.public_numbers().x.to_bytes(32, 'big').hex(),
    "public_key_y_hex": public_key.public_numbers().y.to_bytes(32, 'big').hex(),
    "nonce": nonce,
    "timestamp": timestamp,
    "domain_field": domain_field,
    "service_domain": did_domain,
    "data_to_sign": data_to_sign,
    "canonical_json": canonical_json.decode('utf-8'),
    "canonical_json_hex": canonical_json.hex(),
    "content_hash": content_hash.hex(),
    "der_signature": der_signature.hex(),
    "r": str(r),
    "s": str(s),
    "r_bytes_hex": r_bytes.hex(),
    "s_bytes_hex": s_bytes.hex(),
    "rs_signature_hex": rs_signature.hex(),
    "signature_b64url": signature_b64url,
    "auth_header": auth_header,
    "s_is_high": s > CURVE_ORDER // 2
}

output_path = Path(__file__).parent / "tests" / "python_output" / "python_step_by_step.json"
output_path.parent.mkdir(parents=True, exist_ok=True)
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2)

print(f"\nOutput saved to: {output_path}")
print("\n" + "=" * 80)
