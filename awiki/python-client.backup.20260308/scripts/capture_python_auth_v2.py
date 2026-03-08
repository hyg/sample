#!/usr/bin/env python3
"""
Capture the exact auth header sent by Python version.
"""

import json
import hashlib
import base64
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
import jcs

print("=" * 80)
print("Python Auth Header Capture")
print("=" * 80)

# Load identity
cred_path = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message" / "pythonagent.json"
cred = json.loads(cred_path.read_text())

print(f"\n[1] Identity Info")
print(f"DID: {cred['did']}")

# Load private key
private_key = serialization.load_pem_private_key(
    cred["private_key_pem"].encode("utf-8"),
    password=None
)

# Generate auth header using the same method as Python SDK
from anp.authentication import generate_auth_header

def sign_callback(content, vm_fragment):
    return private_key.sign(content, ec.ECDSA(hashes.SHA256()))

service_url = "https://awiki.ai"
did_domain = "awiki.ai"

auth_header = generate_auth_header(
    did_document=cred["did_document"],
    service_domain=did_domain,
    sign_callback=sign_callback,
    version="1.1"
)

print(f"\n[2] Service URL: {service_url}")
print(f"    DID Domain: {did_domain}")

print(f"\n[3] Authorization Header:")
print(auth_header)

# Parse header components
print(f"\n[4] Header Components:")
parts = auth_header.replace('DIDWba ', '').split(', ')
for part in parts:
    print(f"    {part}")

# Extract specific fields
def extract_field(header, field_name):
    import re
    match = re.search(f'{field_name}="([^"]+)"', header)
    return match.group(1) if match else None

v = extract_field(auth_header, 'v')
nonce = extract_field(auth_header, 'nonce')
timestamp = extract_field(auth_header, 'timestamp')
verification_method = extract_field(auth_header, 'verification_method')
signature = extract_field(auth_header, 'signature')

# Check for aud or service field
aud = extract_field(auth_header, 'aud')
service = extract_field(auth_header, 'service')

print(f"\n[5] Field Values:")
print(f"    v: {v}")
print(f"    nonce: {nonce}")
print(f"    timestamp: {timestamp}")
print(f"    verification_method: {verification_method}")
print(f"    aud: {aud}")
print(f"    service: {service}")
print(f"    signature: {signature[:50]}...")

# Reconstruct what was signed
print(f"\n[6] What Was Signed:")

if aud:
    aud_field = "aud"
    aud_value = aud
elif service:
    aud_field = "service"
    aud_value = service
else:
    aud_field = "aud"
    aud_value = did_domain

auth_data = {
    "nonce": nonce,
    "timestamp": timestamp,
    aud_field: aud_value,
    "did": cred['did']
}

print(f"    Signed data (before JCS):")
print(f"    {json.dumps(auth_data, indent=6)}")

canonical_json = jcs.canonicalize(auth_data)
print(f"\n    Canonical JSON:")
print(f"    {canonical_json.decode('utf-8')}")

content_hash = hashlib.sha256(canonical_json).digest()
print(f"\n    Content Hash:")
print(f"    {content_hash.hex()}")

# Verify signature
der_signature = base64.urlsafe_b64decode(signature + "=" * (-len(signature) % 4))
public_key = private_key.public_key()

try:
    public_key.verify(der_signature, content_hash, ec.ECDSA(hashes.SHA256()))
    print(f"\n[7] Signature Verification: ✓ PASSED")
except Exception as e:
    print(f"\n[7] Signature Verification: ✗ FAILED - {e}")

print("\n" + "=" * 80)
print("\n[8] Key Observations:")
print(f"    - aud field used: {aud_field}")
print(f"    - aud value: {aud_value}")
print(f"    - DID domain: {did_domain}")
print(f"    - Service URL: {service_url}")
print(f"    - aud == did_domain: {aud_value == did_domain}")
print(f"    - aud == service_url: {aud_value == service_url}")

print("\n" + "=" * 80)
