#!/usr/bin/env python3
"""
Generate DID document using Python for comparison with Node.js output.
"""

import json
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from anp.authentication import create_did_wba_document_with_key_binding

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 80)
print("Python DID Document Generation")
print("=" * 80)

# Create DID document using ANP
did_document, keys = create_did_wba_document_with_key_binding(
    hostname="awiki.ai",
    path_prefix=["user"],
    proof_purpose="authentication",
    domain="awiki.ai",
    enable_e2ee=True
)

print("\n[Python DID Document]")
print(json.dumps(did_document, indent=2))

# Save for comparison
with open(OUTPUT_DIR / "python_did.json", "w") as f:
    json.dump(did_document, f, indent=2)

print(f"\nSaved to {OUTPUT_DIR / 'python_did.json'}")
print("=" * 80)
