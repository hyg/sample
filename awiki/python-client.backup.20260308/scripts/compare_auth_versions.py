#!/usr/bin/env python3
"""
Compare the original successful Python auth with the failed test.
"""

import json
import hashlib
import base64
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
import jcs

print("=" * 80)
print("Comparing Original vs Test Python Auth")
print("=" * 80)

# Load original successful credential (just created)
orig_cred_path = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message" / "default.json"
orig_cred = json.loads(orig_cred_path.read_text())

print(f"\n[1] Original (SUCCESSFUL) Credential")
print(f"DID: {orig_cred['did']}")
print(f"JWT: {orig_cred.get('jwt_token', 'N/A')[:50]}...")

# Load test credential (failed)
test_cred_path = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message" / "pythonagent.json"
test_cred = json.loads(test_cred_path.read_text())

print(f"\n[2] Test (FAILED) Credential")
print(f"DID: {test_cred['did']}")
print(f"JWT: {test_cred.get('jwt_token', 'N/A')[:50] if test_cred.get('jwt_token') else 'N/A'}...")

# Compare DID document structure
print(f"\n[3] DID Document Comparison")
print(f"    Original @context: {orig_cred['did_document']['@context']}")
print(f"    Test @context:     {test_cred['did_document']['@context']}")

print(f"\n    Original verificationMethod count: {len(orig_cred['did_document']['verificationMethod'])}")
print(f"    Test verificationMethod count:     {len(test_cred['did_document']['verificationMethod'])}")

# Check key-1 structure
orig_key1 = orig_cred['did_document']['verificationMethod'][0]
test_key1 = test_cred['did_document']['verificationMethod'][0]

print(f"\n[4] Key-1 Comparison")
print(f"    Original type: {orig_key1['type']}")
print(f"    Test type:     {test_key1['type']}")
print(f"    Original crv:  {orig_key1['publicKeyJwk']['crv']}")
print(f"    Test crv:      {test_key1['publicKeyJwk']['crv']}")
print(f"    Original kid:  {orig_key1['publicKeyJwk'].get('kid', 'N/A')}")
print(f"    Test kid:      {test_key1['publicKeyJwk'].get('kid', 'N/A')}")

# Generate auth header for both and compare
def generate_auth(cred):
    private_key = serialization.load_pem_private_key(
        cred["private_key_pem"].encode("utf-8"),
        password=None
    )
    
    nonce = "test-nonce-for-comparison"
    timestamp = "2026-03-07T12:00:00Z"
    did_domain = "awiki.ai"
    did = cred['did']
    
    auth_data = {
        "nonce": nonce,
        "timestamp": timestamp,
        "aud": did_domain,
        "did": did
    }
    
    canonical_json = jcs.canonicalize(auth_data)
    content_hash = hashlib.sha256(canonical_json).digest()
    der_signature = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))
    signature_b64url = base64.urlsafe_b64encode(der_signature).rstrip(b"=").decode("ascii")
    
    auth_header = f'DIDWba v="1.1", did="{did}", nonce="{nonce}", timestamp="{timestamp}", verification_method="key-1", signature="{signature_b64url}"'
    
    return {
        "auth_header": auth_header,
        "canonical_json": canonical_json.decode("utf-8"),
        "content_hash": content_hash.hex(),
        "signature_der": der_signature.hex(),
        "signature_b64url": signature_b64url
    }

print(f"\n[5] Auth Header Generation Test (same nonce/timestamp)")

orig_auth = generate_auth(orig_cred)
test_auth = generate_auth(test_cred)

print(f"\n    Original canonical JSON:")
print(f"    {orig_auth['canonical_json']}")
print(f"\n    Test canonical JSON:")
print(f"    {test_auth['canonical_json']}")

print(f"\n    Original content hash: {orig_auth['content_hash']}")
print(f"    Test content hash:     {test_auth['content_hash']}")

# Verify both signatures
print(f"\n[6] Signature Verification")

orig_public_key = serialization.load_pem_public_key(
    orig_cred["public_key_pem"].encode("utf-8")
)
test_public_key = serialization.load_pem_public_key(
    test_cred["public_key_pem"].encode("utf-8")
)

orig_sig_der = base64.urlsafe_b64decode(orig_auth['signature_b64url'] + "=" * (-len(orig_auth['signature_b64url']) % 4))
test_sig_der = base64.urlsafe_b64decode(test_auth['signature_b64url'] + "=" * (-len(test_auth['signature_b64url']) % 4))

orig_content_hash = bytes.fromhex(orig_auth['content_hash'])
test_content_hash = bytes.fromhex(test_auth['content_hash'])

try:
    orig_public_key.verify(orig_sig_der, orig_content_hash, ec.ECDSA(hashes.SHA256()))
    print(f"    Original signature: ✓ VALID")
except Exception as e:
    print(f"    Original signature: ✗ INVALID - {e}")

try:
    test_public_key.verify(test_sig_der, test_content_hash, ec.ECDSA(hashes.SHA256()))
    print(f"    Test signature:     ✓ VALID")
except Exception as e:
    print(f"    Test signature:     ✗ INVALID - {e}")

# Check PEM format
print(f"\n[7] PEM Format Comparison")
print(f"    Original private_key_pem starts with:")
print(f"    {orig_cred['private_key_pem'][:50]}...")
print(f"\n    Test private_key_pem starts with:")
print(f"    {test_cred['private_key_pem'][:50]}...")

print("\n" + "=" * 80)
