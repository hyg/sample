#!/usr/bin/env python3
"""
Side-by-side comparison of Python vs Node.js registration requests.
"""

import json
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"

print("=" * 80)
print("Python vs Node.js Registration Request - Side-by-Side Comparison")
print("=" * 80)

# Load both requests
with open(OUTPUT_DIR / "python_registration_request.json") as f:
    py_request = json.load(f)

with open(OUTPUT_DIR / "nodejs_registration_request.json") as f:
    node_request = json.load(f)

py_doc = py_request["params"]["did_document"]
node_doc = node_request["params"]["did_document"]

print("\n[1] @context Comparison")
print("-" * 40)
print(f"Python contexts:  {len(py_doc['@context'])}")
for ctx in py_doc['@context']:
    print(f"  - {ctx}")

print(f"\nNode.js contexts: {len(node_doc['@context'])}")
for ctx in node_doc['@context']:
    print(f"  - {ctx}")

contexts_match = py_doc['@context'] == node_doc['@context']
print(f"\nContexts match: {contexts_match}")

print("\n[2] verificationMethod Comparison")
print("-" * 40)

print(f"Python verification methods:  {len(py_doc['verificationMethod'])}")
for i, vm in enumerate(py_doc['verificationMethod']):
    print(f"  [{i}] {vm['id']}")
    print(f"      Type: {vm['type']}")
    if 'publicKeyJwk' in vm:
        print(f"      crv: {vm['publicKeyJwk']['crv']}")
        print(f"      x:   {vm['publicKeyJwk']['x']}")
        print(f"      y:   {vm['publicKeyJwk']['y']}")
    elif 'publicKeyMultibase' in vm:
        print(f"      multibase: {vm['publicKeyMultibase']}")

print(f"\nNode.js verification methods: {len(node_doc['verificationMethod'])}")
for i, vm in enumerate(node_doc['verificationMethod']):
    print(f"  [{i}] {vm['id']}")
    print(f"      Type: {vm['type']}")
    if 'publicKeyJwk' in vm:
        print(f"      crv: {vm['publicKeyJwk']['crv']}")
        print(f"      x:   {vm['publicKeyJwk']['x']}")
        print(f"      y:   {vm['publicKeyJwk']['y']}")
    elif 'publicKeyMultibase' in vm:
        print(f"      multibase: {vm['publicKeyMultibase']}")

print("\n[3] proof Comparison (CRITICAL)")
print("-" * 40)

py_proof = py_doc['proof']
node_proof = node_doc['proof']

print("Python proof:")
for k, v in py_proof.items():
    if k == 'proofValue':
        print(f"  {k}: {v[:50]}... (length: {len(v)})")
    else:
        print(f"  {k}: {v}")

print("\nNode.js proof:")
for k, v in node_proof.items():
    if k == 'proofValue':
        print(f"  {k}: {v[:50]}... (length: {len(v)})")
    else:
        print(f"  {k}: {v}")

print("\n[4] Proof Field-by-Field Comparison")
print("-" * 40)

for key in py_proof.keys():
    py_val = py_proof[key]
    node_val = node_proof[key]
    match = py_val == node_val
    status = "MATCH" if match else "DIFFER"
    print(f"{key:20s}: {status}")
    if not match:
        print(f"  Python:  {py_val}")
        print(f"  Node.js: {node_val}")

print("\n[5] proofValue Length")
print("-" * 40)
print(f"Python proofValue length:  {len(py_proof['proofValue'])} chars")
print(f"Node.js proofValue length: {len(node_proof['proofValue'])} chars")
print(f"Length match: {len(py_proof['proofValue']) == len(node_proof['proofValue'])}")

print("\n[6] keyAgreement Comparison")
print("-" * 40)
print(f"Python keyAgreement:  {py_doc.get('keyAgreement', [])}")
print(f"Node.js keyAgreement: {node_doc.get('keyAgreement', [])}")
print(f"Match: {py_doc.get('keyAgreement', []) == node_doc.get('keyAgreement', [])}")

print("\n" + "=" * 80)
print("Summary")
print("=" * 80)

# Check critical fields
critical_checks = {
    "contexts": py_doc['@context'] == node_doc['@context'],
    "num_verification_methods": len(py_doc['verificationMethod']) == len(node_doc['verificationMethod']),
    "proof_type": py_proof['type'] == node_proof['type'],
    "proof_purpose": py_proof['proofPurpose'] == node_proof['proofPurpose'],
    "proof_domain": py_proof['domain'] == node_proof['domain'],
    "proof_has_challenge": bool(py_proof.get('challenge')) == bool(node_proof.get('challenge')),
    "proofValue_length": len(py_proof['proofValue']) == len(node_proof['proofValue']),
    "keyAgreement": py_doc.get('keyAgreement', []) == node_doc.get('keyAgreement', []),
}

all_pass = True
for check, result in critical_checks.items():
    status = "PASS" if result else "FAIL"
    symbol = "[OK]" if result else "[!!]"
    print(f"{symbol} {check:30s}: {status}")
    if not result:
        all_pass = False

print("\n" + "=" * 80)
if all_pass:
    print("[OK] ALL CRITICAL FIELDS MATCH!")
    print("  The structures are identical. Differences in proofValue are expected")
    print("  due to ECDSA non-determinism (different k values produce different signatures).")
else:
    print("[!!] SOME CRITICAL FIELDS DIFFER!")
    print("  Check the differences above.")
print("=" * 80)

# Save comparison report
report = {
    "contexts_match": py_doc['@context'] == node_doc['@context'],
    "num_verification_methods_match": len(py_doc['verificationMethod']) == len(node_doc['verificationMethod']),
    "proof_fields": {
        key: {
            "python": py_proof[key],
            "nodejs": node_proof[key],
            "match": py_proof[key] == node_proof[key]
        }
        for key in py_proof.keys()
    },
    "keyAgreement_match": py_doc.get('keyAgreement', []) == node_doc.get('keyAgreement', []),
    "critical_checks": critical_checks,
    "all_pass": all_pass
}

with open(OUTPUT_DIR / "comparison_report.json", "w") as f:
    json.dump(report, f, indent=2)

print(f"\nFull comparison report saved to: {OUTPUT_DIR / 'comparison_report.json'}")
