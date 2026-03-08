#!/usr/bin/env python3
"""
Verify Python's signature using the same method as Node.js
"""

import hashlib
import base64
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
import json
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
results = json.load(open(OUTPUT_DIR / "did_proof_intermediate.json"))

def decode_base64url(s):
    import base64
    padding = '=' * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + padding)

print("=== Python Signature Verification ===\n")

# Get values
content_hash = bytes.fromhex(results['step6_content_hash_hex'])
signature = decode_base64url(results['step9_final_signature']['base64url'])

print("Content hash:", results['step6_content_hash_hex'])
print("Signature:", results['step9_final_signature']['base64url'])
print("Signature (hex):", signature.hex())

# Get public key
x = bytes.fromhex(results['step1_keypair']['public_key_x_hex'])
y = bytes.fromhex(results['step1_keypair']['public_key_y_hex'])
pub_bytes = b'\x04' + x + y

print("\nPublic key (uncompressed):", pub_bytes.hex())

# Import public key using from_encoded_point
public_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_bytes)

print("\n=== Verification ===")

# Convert R||S to DER
r = int.from_bytes(signature[:32], 'big')
s = int.from_bytes(signature[32:], 'big')

# DER encode
def encode_der(r, s):
    r_bytes = r.to_bytes((r.bit_length() + 7) // 8, 'big')
    s_bytes = s.to_bytes((s.bit_length() + 7) // 8, 'big')
    
    # Add leading zero if high bit set
    if r_bytes[0] & 0x80:
        r_bytes = b'\x00' + r_bytes
    if s_bytes[0] & 0x80:
        s_bytes = b'\x00' + s_bytes
    
    der = bytes([0x30, len(r_bytes) + len(s_bytes) + 4, 0x02, len(r_bytes)]) + r_bytes
    der += bytes([0x02, len(s_bytes)]) + s_bytes
    return der

der_sig = encode_der(r, s)
print("DER signature:", der_sig.hex())

try:
    public_key.verify(der_sig, content_hash, ec.ECDSA(hashes.SHA256()))
    print("Python signature verification: VALID [OK]")
except Exception as e:
    print(f"Python signature verification: INVALID [FAIL]")
    print(f"Error: {e}")

# Also verify using raw point
print("\n=== Direct secp256k1 verification ===")
from ecdsa import Verifier, SECP256k1

# Convert signature from R||S to DER for ecdsa library
r_bytes = signature[:32]
s_bytes = signature[32:]

# ecdsa library expects DER or raw R||S
try:
    vk = Verifier.from_string(pub_bytes, hashfunc=hashlib.sha256, curve=SECP256k1)
    # ecdsa uses different signature format
    valid = vk.verify_digest(content_hash, signature)
    print(f"ecdsa verification: {'VALID ✓' if valid else 'INVALID ✗'}")
except Exception as e:
    print(f"ecdsa verification error: {e}")
