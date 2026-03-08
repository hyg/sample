#!/usr/bin/env python3
"""
Capture the exact auth header sent by Python version.
"""

import json
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / "scripts"))

from utils.credential_store import load_identity
from utils.auth import generate_wba_auth_header
from utils.identity import DIDIdentity
from utils.config import SDKConfig

print("=" * 80)
print("Python Auth Header Capture")
print("=" * 80)

# Load identity
cred = load_identity("pythonagent")
if cred is None:
    print("Error: Credential 'pythonagent' not found")
    sys.exit(1)

print(f"\n[1] Identity Info")
print(f"DID: {cred['did']}")

# Create identity object
identity = DIDIdentity(
    did=cred["did"],
    did_document=cred["did_document"],
    private_key_pem=cred["private_key_pem"].encode("utf-8"),
    public_key_pem=cred["public_key_pem"].encode("utf-8"),
    e2ee_signing_private_pem=cred.get("e2ee_signing_private_pem", b"") or None,
    e2ee_agreement_private_pem=cred.get("e2ee_agreement_private_pem", b"") or None,
)

# Generate auth header
config = SDKConfig()
service_url = config.user_service_url

print(f"\n[2] Service URL: {service_url}")
print(f"    DID Domain: {config.did_domain}")

auth_header = generate_wba_auth_header(identity, config.did_domain)

print(f"\n[3] Authorization Header:")
print(auth_header)

# Parse header components
print(f"\n[4] Header Components:")
parts = auth_header.replace('DIDWba ', '').split(', ')
for part in parts:
    key, value = part.split('="', 1)
    print(f"    {key}: {value.rstrip('\"')}")

# Show what was signed
print(f"\n[5] What Was Signed:")

import jcs
import hashlib

# Reconstruct the signed data
nonce_match = [p for p in parts if p.startswith('nonce=')][0]
nonce = nonce_match.split('="')[1].rstrip('"')
timestamp_match = [p for p in parts if p.startswith('timestamp=')][0]
timestamp = timestamp_match.split('="')[1].rstrip('"')
did_match = [p for p in parts if p.startswith('did=')][0]
did = did_match.split('="')[1].rstrip('"')

# Check if aud or service field
aud_match = [p for p in parts if p.startswith('aud=') or p.startswith('service=')]
if aud_match:
    aud_field = aud_match[0].split('=')[0]
    aud = aud_match[0].split('="')[1].rstrip('"')
else:
    aud_field = "aud"
    aud = config.did_domain

auth_data = {
    "nonce": nonce,
    "timestamp": timestamp,
    aud_field: aud,
    "did": did
}

print(f"    Signed data (before JCS):")
print(f"    {json.dumps(auth_data, indent=6)}")

canonical_json = jcs.canonicalize(auth_data)
print(f"\n    Canonical JSON:")
print(f"    {canonical_json.decode('utf-8')}")

content_hash = hashlib.sha256(canonical_json).digest()
print(f"\n    Content Hash:")
print(f"    {content_hash.hex()}")

print("\n" + "=" * 80)
print("\n[6] Key Observations:")
print(f"    - aud field used: {aud_field}")
print(f"    - aud value: {aud}")
print(f"    - DID domain: {config.did_domain}")
print(f"    - Service URL: {service_url}")
print(f"    - aud == did_domain: {aud == config.did_domain}")
print(f"    - aud == service_url: {aud == service_url}")

print("\n" + "=" * 80)
