#!/usr/bin/env python3
"""
Verify using Python's anp.proof module.
"""

import json
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from anp.proof import verify_w3c_proof
from pathlib import Path

data = json.load(open('scripts/tests/python_output/did_proof_intermediate.json'))

print('=== Using anp.proof.verify_w3c_proof ===\n')

# Build public key from x, y
x = int(data['step1_keypair']['public_key_x_hex'], 16)
y = int(data['step1_keypair']['public_key_y_hex'], 16)
pub_bytes = b'\x04' + x.to_bytes(32, 'big') + y.to_bytes(32, 'big')
pub_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_bytes)

# Use final_did_document which has the proof
doc = data['final_did_document']

print('DID:', doc['id'])
print('Proof value:', doc['proof']['proofValue'][:50] + '...')

# Verify
is_valid = verify_w3c_proof(doc, pub_key)
print('\nVerification result:', 'VALID' if is_valid else 'INVALID')
