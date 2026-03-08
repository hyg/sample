#!/usr/bin/env python3
"""
Final debug: Compare exact toBeSigned and signature between Python and Node.js.
"""

import json
import hashlib
import jcs
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from utils.identity import create_identity

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 80)
print("Python Final Debug - toBeSigned and Signature")
print("=" * 80)

# Create identity
identity = create_identity(
    hostname="awiki.ai",
    path_prefix=["user"],
    proof_purpose="authentication",
    domain="awiki.ai",
)

did_document = identity.did_document
proof = did_document['proof']

print(f"\nDID: {did_document['id']}")
print(f"Challenge: {proof.get('challenge', 'NOT PRESENT')}")

# Reconstruct toBeSigned
doc_without_proof = {k: v for k, v in did_document.items() if k != 'proof'}

proof_options = {
    "type": proof['type'],
    "created": proof['created'],
    "verificationMethod": proof['verificationMethod'],
    "proofPurpose": proof['proofPurpose'],
}
if 'domain' in proof:
    proof_options['domain'] = proof['domain']
if 'challenge' in proof:
    proof_options['challenge'] = proof['challenge']

doc_canonical = jcs.canonicalize(doc_without_proof)
options_canonical = jcs.canonicalize(proof_options)

doc_hash = hashlib.sha256(doc_canonical).digest()
options_hash = hashlib.sha256(options_canonical).digest()
to_be_signed = options_hash + doc_hash

print(f"\ntoBeSigned:")
print(f"  options_hash: {options_hash.hex()}")
print(f"  doc_hash:     {doc_hash.hex()}")
print(f"  Combined:     {to_be_signed.hex()}")

# Save for comparison
debug_info = {
    "did": did_document['id'],
    "challenge": proof.get('challenge'),
    "proof_value": proof['proofValue'],
    "proof_options": proof_options,
    "doc_canonical": doc_canonical.decode('utf-8'),
    "options_canonical": options_canonical.decode('utf-8'),
    "doc_hash_hex": doc_hash.hex(),
    "options_hash_hex": options_hash.hex(),
    "to_be_signed_hex": to_be_signed.hex()
}

with open(OUTPUT_DIR / "python_final_debug.json", "w") as f:
    json.dump(debug_info, f, indent=2)

print(f"\nDebug info saved to: {OUTPUT_DIR / 'python_final_debug.json'}")
print("=" * 80)
