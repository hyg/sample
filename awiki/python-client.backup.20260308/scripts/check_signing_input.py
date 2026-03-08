#!/usr/bin/env python3
"""
Verify Python's signing input calculation.
"""

import json
import hashlib
import jcs
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
results = json.load(open(OUTPUT_DIR / "did_proof_intermediate.json"))

print("=== Python Signing Input Analysis ===\n")

# Get values from Python results
doc_to_sign = results['step4_doc_to_sign']
proof_options = {
    "type": results['step3_proof_params']['type'],
    "created": results['step3_proof_params']['created'],
    "verificationMethod": results['step3_proof_params']['verificationMethod'],
    "proofPurpose": results['step3_proof_params']['proofPurpose'],
    "domain": results['step3_proof_params']['domain'],
    "challenge": results['step3_proof_params']['challenge']
}

# Remove proof from document
doc_without_proof = {k: v for k, v in doc_to_sign.items() if k != 'proof'}

# Compute hashes
doc_canonical = jcs.canonicalize(doc_without_proof)
options_canonical = jcs.canonicalize(proof_options)

print("Document canonical:", doc_canonical[:100], "...")
print("Options canonical:", options_canonical[:100], "...")

doc_hash = hashlib.sha256(doc_canonical).digest()
options_hash = hashlib.sha256(options_canonical).digest()

print("\nDocument hash:", doc_hash.hex())
print("Options hash:", options_hash.hex())

# Try both orderings
toBeSigned_v1 = options_hash + doc_hash  # Python's _compute_signing_input
toBeSigned_v2 = doc_hash + options_hash  # Alternative

print("\n=== Signing Input Order ===")
print("options_hash + doc_hash:", toBeSigned_v1.hex())
print("doc_hash + options_hash:", toBeSigned_v2.hex())

# Get private key
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_pem_private_key

priv_key = load_pem_private_key(results['step1_keypair']['private_key_pem'].encode(), password=None)

# Sign with both orderings
sig_v1 = priv_key.sign(toBeSigned_v1, ec.ECDSA(hashes.SHA256()))
sig_v2 = priv_key.sign(toBeSigned_v2, ec.ECDSA(hashes.SHA256()))

print("\n=== Signature Comparison ===")
print("Signature with v1 (options+doc):", sig_v1.hex())
print("Signature with v2 (doc+options):", sig_v2.hex())

# Compare with Python's actual signature
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

# Python's DER signature from step 7
py_der = bytes.fromhex(results['step7_signature']['der_hex'])
print("Python DER signature:", py_der.hex())

# Check which one matches
print("\n=== Match Check ===")
print("v1 matches Python:", sig_v1 == py_der)
print("v2 matches Python:", sig_v2 == py_der)

# Also check the hash that was actually signed
content_hash = results['step6_content_hash_hex']
print("\nPython content hash:", content_hash)
print("doc_hash:", doc_hash.hex())
print("options_hash:", options_hash.hex())
print("doc_hash matches content_hash:", doc_hash.hex() == content_hash)
