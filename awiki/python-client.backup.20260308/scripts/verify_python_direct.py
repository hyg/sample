#!/usr/bin/env python3
"""
Verify Python signature directly.
"""

import json
import hashlib
import jcs
import base64
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from pathlib import Path

data = json.load(open('scripts/tests/python_output/did_proof_intermediate.json'))

print('=== Python Signature Verification ===\n')

# Build public key from x, y
x = int(data['step1_keypair']['public_key_x_hex'], 16)
y = int(data['step1_keypair']['public_key_y_hex'], 16)
pub_bytes = b'\x04' + x.to_bytes(32, 'big') + y.to_bytes(32, 'big')
pub_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_bytes)

# Build proof options
proof_options = {
    "type": data['step3_proof_params']['type'],
    "created": data['step3_proof_params']['created'],
    "verificationMethod": data['step3_proof_params']['verificationMethod'],
    "proofPurpose": data['step3_proof_params']['proofPurpose'],
}
if data['step3_proof_params']['domain']:
    proof_options['domain'] = data['step3_proof_params']['domain']
if data['step3_proof_params']['challenge']:
    proof_options['challenge'] = data['step3_proof_params']['challenge']

# Document without proof
doc_without_proof = {k: v for k, v in data['step4_doc_to_sign'].items() if k != 'proof'}

# Compute signing input
options_canonical = jcs.canonicalize(proof_options)
doc_canonical = jcs.canonicalize(doc_without_proof)
options_hash = hashlib.sha256(options_canonical).digest()
doc_hash = hashlib.sha256(doc_canonical).digest()
toBeSigned = options_hash + doc_hash

print('ToBeSigned:', toBeSigned.hex())

# Decode signature
sig_b64 = data['step9_final_signature']['base64url']
padding = '=' * (-len(sig_b64) % 4)
sig_bytes = base64.urlsafe_b64decode(sig_b64 + padding)

print('Signature:', sig_bytes.hex())

# Verify
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
r = int.from_bytes(sig_bytes[:32], 'big')
s = int.from_bytes(sig_bytes[32:], 'big')
der_sig = encode_dss_signature(r, s)

print('DER signature:', der_sig.hex())

try:
    from cryptography.hazmat.primitives import hashes
    pub_key.verify(der_sig, toBeSigned, ec.ECDSA(hashes.SHA256()))
    print('\nVerification: VALID')
except Exception as e:
    print(f'\nVerification: INVALID - {e}')
