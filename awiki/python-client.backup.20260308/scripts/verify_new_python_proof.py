#!/usr/bin/env python3
"""
Verify Python proof using anp.proof module.
"""

import json
from cryptography.hazmat.primitives.asymmetric import ec
from pathlib import Path
from anp.proof import verify_w3c_proof

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
data = json.load(open(OUTPUT_DIR / "new_python_test_vector.json"))

print('=== Verifying Python Proof with anp.proof ===\n')

# Build public key from JWK
jwk = data['did_document']['verificationMethod'][0]['publicKeyJwk']

import base64
def base64url_decode(data):
    padding = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

x = base64url_decode(jwk['x'])
y = base64url_decode(jwk['y'])
pub_bytes = b'\x04' + x + y

pub_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_bytes)

# Verify
is_valid = verify_w3c_proof(data['did_document'], pub_key)
print(f'Proof valid: {is_valid}')

# Also manually verify
import hashlib
import jcs
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature

doc_without_proof = {k: v for k, v in data['did_document'].items() if k != 'proof'}
proof_options = {k: v for k, v in data['proof'].items() if k != 'proofValue'}

doc_hash = hashlib.sha256(jcs.canonicalize(doc_without_proof)).digest()
options_hash = hashlib.sha256(jcs.canonicalize(proof_options)).digest()
to_be_signed = options_hash + doc_hash

print(f'\nToBeSigned: {to_be_signed.hex()}')
print(f'Match: {to_be_signed.hex() == data["to_be_signed_hex"]}')

# Decode signature
sig_bytes = base64url_decode(data['proof']['proofValue'])
print(f'\nSignature: {sig_bytes.hex()}')

# Verify manually
r = int.from_bytes(sig_bytes[:32], 'big')
s = int.from_bytes(sig_bytes[32:], 'big')
der_sig = encode_dss_signature(r, s)

from cryptography.hazmat.primitives import hashes
try:
    pub_key.verify(der_sig, to_be_signed, ec.ECDSA(hashes.SHA256()))
    print('Manual verification: VALID')
except Exception as e:
    print(f'Manual verification: INVALID - {e}')

# Check S value
CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
print(f'\nS > CURVE_ORDER/2: {s > CURVE_ORDER // 2}')
print(f'S value: {s}')
if s > CURVE_ORDER // 2:
    normalized_s = CURVE_ORDER - s
    print(f'Normalized S: {normalized_s}')
