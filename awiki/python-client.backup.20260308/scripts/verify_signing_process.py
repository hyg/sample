#!/usr/bin/env python3
"""
Verify Python's exact signing process.
"""

import json
import hashlib
import jcs
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
results = json.load(open(OUTPUT_DIR / "did_proof_intermediate.json"))

print("=== Python Signing Process Verification ===\n")

# Get the canonical JSON from step 5
canonical_json = results['step5_canonical_json']
content_hash = results['step6_content_hash_hex']

# Verify the hash
computed_hash = hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()
print("Canonical JSON (first 200 chars):", canonical_json[:200])
print("\nPython content hash:", content_hash)
print("Computed hash:", computed_hash)
print("Match:", computed_hash == content_hash)

# So the content_hash is just the hash of the canonical JSON!
# Not options_hash + doc_hash

print("\n=== Conclusion ===")
print("Python signs: hash(canonicalize(doc_with_proof_but_empty_proofValue))")
print("NOT: hash(canonicalize(options)) + hash(canonicalize(doc))")

# Let's verify this is the same as the doc_to_sign
doc_to_sign = results['step4_doc_to_sign']
doc_canonical = jcs.canonicalize(doc_to_sign)
print("\ndoc_to_sign canonical == step5_canonical:", doc_canonical == canonical_json.encode('utf-8'))
