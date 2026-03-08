#!/usr/bin/env python3
"""Debug: Generate and print the exact auth header for comparison."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from utils.auth import generate_wba_auth_header
from utils.credential_store import load_identity
from utils.config import SDKConfig

# Load identity
cred = load_identity("pythonagent")
if cred is None:
    print("Error: Credential 'pythonagent' not found")
    sys.exit(1)

print("=" * 80)
print("Python Auth Header Debug")
print("=" * 80)

# Create identity object
from utils.identity import DIDIdentity
identity = DIDIdentity(
    did=cred["did"],
    did_document=cred["did_document"],
    private_key_pem=cred["private_key_pem"].encode("utf-8"),
    public_key_pem=cred["public_key_pem"].encode("utf-8"),
    e2ee_signing_private_pem=cred.get("e2ee_signing_private_pem", "").encode("utf-8") if cred.get("e2ee_signing_private_pem") else None,
    e2ee_agreement_private_pem=cred.get("e2ee_agreement_private_pem", "").encode("utf-8") if cred.get("e2ee_agreement_private_pem") else None,
)

# Generate auth header
auth_header = generate_wba_auth_header(identity, "awiki.ai")

print(f"\nAuthorization Header:")
print(auth_header)

# Parse and show what was signed
import jcs
import hashlib
import secrets

# The auth header format: DIDWba v="1.1", did="...", nonce="...", timestamp="...", verification_method="...", signature="..."
parts = auth_header.replace('DIDWba ', '').split(', ')
auth_dict = {}
for part in parts:
    key, value = part.split('="', 1)
    auth_dict[key] = value.rstrip('"')

print(f"\nParsed Auth Header:")
for k, v in auth_dict.items():
    print(f"  {k}: {v}")

# Reconstruct what was signed
import re
version = auth_dict.get('v', '1.0')
version_float = float(version)
domain_field = "aud" if version_float >= 1.1 else "service"

data_to_sign = {
    "nonce": auth_dict['nonce'],
    "timestamp": auth_dict['timestamp'],
    domain_field: auth_dict.get('aud') or auth_dict.get('service'),
    "did": auth_dict['did']
}

print(f"\nData to sign (using '{domain_field}' field):")
print(json.dumps(data_to_sign, indent=2))

canonical_json = jcs.canonicalize(data_to_sign)
print(f"\nCanonical JSON:")
print(canonical_json.decode('utf-8'))

content_hash = hashlib.sha256(canonical_json).digest()
print(f"\nContent hash: {content_hash.hex()}")
