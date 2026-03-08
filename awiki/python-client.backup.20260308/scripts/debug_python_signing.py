#!/usr/bin/env python3
"""
Debug Python signing input.
"""

import json
import hashlib
import jcs
from pathlib import Path

data = json.load(open('scripts/tests/python_output/did_proof_intermediate.json'))

print('=== Python Signing Input ===\n')

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

# Compute hashes
options_canonical = jcs.canonicalize(proof_options)
doc_canonical = jcs.canonicalize(doc_without_proof)

print('Proof options canonical:')
print(options_canonical.decode('utf-8'))
print()
print('Document canonical:')
print(doc_canonical.decode('utf-8')[:200], '...')
print()

options_hash = hashlib.sha256(options_canonical).digest()
doc_hash = hashlib.sha256(doc_canonical).digest()

print('Options hash:', options_hash.hex())
print('Doc hash:', doc_hash.hex())

toBeSigned = options_hash + doc_hash
print('\nToBeSigned:', toBeSigned.hex())

# Compare with Node.js output
node_tobe = '17ceb3f12984132dfe376c1109e95e065fc70e3528d176c1f3938c0502ae9ff654a58ada05ee24d1056287bcfe17257b8367637b23fce6d5d3d15048845d3d8e'
print('\nNode.js ToBeSigned:', node_tobe)
print('Match:', toBeSigned.hex() == node_tobe)
