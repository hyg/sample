#!/usr/bin/env python3
"""
Debug: Check what makes the original Python version succeed.
"""

import json
from pathlib import Path

# Load the successfully created credential
cred_path = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message" / "default.json"
cred = json.loads(cred_path.read_text())

print("=" * 80)
print("Successfully Created Python Credential Analysis")
print("=" * 80)

print(f"\n[1] Basic Info")
print(f"DID: {cred['did']}")
print(f"unique_id: {cred['unique_id']}")
print(f"user_id: {cred['user_id']}")
print(f"JWT: {cred.get('jwt_token', 'N/A')[:80]}...")

print(f"\n[2] DID Document")
print(f"ID: {cred['did_document']['id']}")
print(f"key-1 kid: {cred['did_document']['verificationMethod'][0]['publicKeyJwk'].get('kid', 'N/A')}")

# Check if kid matches unique_id suffix
unique_id_suffix = cred['unique_id'].replace('k1_', '')
kid = cred['did_document']['verificationMethod'][0]['publicKeyJwk'].get('kid', '')
print(f"\n[3] Kid vs Unique ID Check")
print(f"unique_id suffix: {unique_id_suffix}")
print(f"kid:              {kid}")
print(f"Match: {unique_id_suffix == kid}")

# Check public key JWK
jwk = cred['did_document']['verificationMethod'][0]['publicKeyJwk']
print(f"\n[4] Public Key JWK")
print(f"kty: {jwk['kty']}")
print(f"crv: {jwk['crv']}")
print(f"x:   {jwk['x']}")
print(f"y:   {jwk['y']}")
print(f"kid: {jwk.get('kid', 'N/A')}")

# Check private key PEM format
pem = cred['private_key_pem']
print(f"\n[5] Private Key PEM")
print(f"Header: {pem.split(chr(10))[0]}")
print(f"Length: {len(pem)} chars")

print("\n" + "=" * 80)
