#!/usr/bin/env python3
"""
Debug signature verification with cryptography library.
"""

import json
import base64
import hashlib
import jcs
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
data = json.load(open(OUTPUT_DIR / "new_python_test_vector.json"))

print('=== Debug Signature Verification ===\n')

# Build public key from JWK
jwk = data['did_document']['verificationMethod'][0]['publicKeyJwk']

def base64url_decode(s):
    padding = '=' * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + padding)

x = base64url_decode(jwk['x'])
y = base64url_decode(jwk['y'])
pub_bytes = b'\x04' + x + y

pub_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_bytes)

print('Public key (hex):', pub_bytes.hex())

# Build document without proof
doc_without_proof = {k: v for k, v in data['did_document'].items() if k != 'proof'}

# Compute toBeSigned
proof_options = {k: v for k, v in data['proof'].items() if k != 'proofValue'}
doc_hash = hashlib.sha256(jcs.canonicalize(doc_without_proof)).digest()
options_hash = hashlib.sha256(jcs.canonicalize(proof_options)).digest()
to_be_signed = options_hash + doc_hash

print('\nToBeSigned:', to_be_signed.hex())
print('Match:', to_be_signed.hex() == data['to_be_signed_hex'])

# Decode Python signature
sig_bytes = base64url_decode(data['proof']['proofValue'])
print('\nPython signature:', sig_bytes.hex())

# Verify with cryptography
r = int.from_bytes(sig_bytes[:32], 'big')
s = int.from_bytes(sig_bytes[32:], 'big')
der_sig = encode_dss_signature(r, s)

print('\nDER signature:', der_sig.hex())

try:
    pub_key.verify(der_sig, to_be_signed, ec.ECDSA(hashes.SHA256()))
    print('cryptography verification: VALID')
except Exception as e:
    print(f'cryptography verification: INVALID - {e}')

# Check S value
CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
print(f'\nS > CURVE_ORDER/2: {s > CURVE_ORDER // 2}')

# Try with normalized S
if s > CURVE_ORDER // 2:
    s = CURVE_ORDER - s
    normalized_der_sig = encode_dss_signature(r, s)
    try:
        pub_key.verify(normalized_der_sig, to_be_signed, ec.ECDSA(hashes.SHA256()))
        print('Normalized cryptography verification: VALID')
    except Exception as e:
        print(f'Normalized cryptography verification: INVALID - {e}')

# Also test with noble-curves style verification (direct R||S)
print('\n=== Testing with different verification methods ===')

# Method 1: cryptography with DER
print('Method 1 (cryptography DER):', end=' ')
try:
    pub_key.verify(der_sig, to_be_signed, ec.ECDSA(hashes.SHA256()))
    print('VALID')
except:
    print('INVALID')

# Method 2: Check if toBeSigned is correct
print('Method 2 (check toBeSigned):', end=' ')
print('Python toBeSigned:', data['to_be_signed_hex'])
print('Calculated toBeSigned:', to_be_signed.hex())
