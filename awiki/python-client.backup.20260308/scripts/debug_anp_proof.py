#!/usr/bin/env python3
"""
Debug: Compare exact proof generation using scripts/utils/identity.py (real flow).
"""

import json
import sys
from pathlib import Path

# Add scripts folder to path
sys.path.insert(0, str(Path(__file__).parent))

from utils.identity import create_identity

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 80)
print("Python Proof Generation Debug (Real Flow)")
print("=" * 80)

# Create identity using the real flow (same as setup_identity.py)
identity = create_identity(
    hostname="awiki.ai",
    path_prefix=["user"],
    proof_purpose="authentication",
    domain="awiki.ai",
)

did_document = identity.did_document

print(f"\nDID: {did_document['id']}")
print(f"\nProof fields:")
for k, v in did_document['proof'].items():
    if k == 'proofValue':
        print(f"  {k}: {v[:50]}... (length: {len(v)})")
    else:
        print(f"  {k}: {v}")

print(f"\nChallenge present: {'challenge' in did_document['proof']}")
if 'challenge' in did_document['proof']:
    print(f"Challenge value: {did_document['proof']['challenge']}")
    print(f"Challenge length: {len(did_document['proof']['challenge'])} chars")
