#!/usr/bin/env python3
"""
Capture the exact registration request sent to awiki.ai by Python.
"""

import json
import httpx
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from anp.authentication import create_did_wba_document_with_key_binding

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 80)
print("Python Registration Request Capture")
print("=" * 80)

# Create DID document using ANP (same as setup_identity.py)
# Note: Not passing challenge parameter, so it will be auto-generated
did_document, keys = create_did_wba_document_with_key_binding(
    hostname="awiki.ai",
    path_prefix=["user"],
    proof_purpose="authentication",
    domain="awiki.ai",
    # challenge is NOT passed - will be auto-generated as random hex
    enable_e2ee=True
)

# Build registration request
request_payload = {
    "jsonrpc": "2.0",
    "method": "register",
    "params": {
        "did_document": did_document,
        "name": "PythonCaptureTest",
        "is_agent": True
    },
    "id": 1
}

# Save the exact request
with open(OUTPUT_DIR / "python_registration_request.json", "w") as f:
    json.dump(request_payload, f, indent=2)

print("\n[Registration Request Payload]")
print(json.dumps(request_payload, indent=2))

# Extract key info for comparison
summary = {
    "did": did_document["id"],
    "context": did_document["@context"],
    "verification_methods": [
        {
            "id": vm["id"],
            "type": vm["type"],
            "crv": vm.get("publicKeyJwk", {}).get("crv") or vm.get("publicKeyMultibase", "N/A")[:20]
        }
        for vm in did_document["verificationMethod"]
    ],
    "authentication": did_document["authentication"],
    "keyAgreement": did_document.get("keyAgreement", []),
    "proof": {
        "type": did_document["proof"]["type"],
        "created": did_document["proof"]["created"],
        "verificationMethod": did_document["proof"]["verificationMethod"],
        "proofPurpose": did_document["proof"]["proofPurpose"],
        "domain": did_document["proof"].get("domain"),
        "challenge": did_document["proof"].get("challenge", "NOT PRESENT (auto-generated random)"),
        "proofValue": did_document["proof"]["proofValue"]
    }
}

with open(OUTPUT_DIR / "python_registration_summary.json", "w") as f:
    json.dump(summary, f, indent=2)

print("\n[Summary]")
print(json.dumps(summary, indent=2))

print(f"\nFull request saved to: {OUTPUT_DIR / 'python_registration_request.json'}")
print(f"Summary saved to: {OUTPUT_DIR / 'python_registration_summary.json'}")
print("=" * 80)
