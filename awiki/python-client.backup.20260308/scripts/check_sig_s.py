#!/usr/bin/env python3
import json
import base64
from pathlib import Path

data = json.load(open('scripts/tests/python_output/did_proof_intermediate.json'))

sig_b64 = data['step9_final_signature']['base64url']
padding = '=' * (-len(sig_b64) % 4)
sig_bytes = base64.urlsafe_b64decode(sig_b64 + padding)

print('Signature (hex):', sig_bytes.hex())
print('Signature length:', len(sig_bytes), 'bytes')

r = int.from_bytes(sig_bytes[:32], 'big')
s = int.from_bytes(sig_bytes[32:], 'big')

CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
print('S > CURVE_ORDER/2:', s > CURVE_ORDER // 2)
print('S value:', s)
print('Normalized S:', CURVE_ORDER - s if s > CURVE_ORDER // 2 else s)
