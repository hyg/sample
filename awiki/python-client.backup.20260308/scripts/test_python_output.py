#!/usr/bin/env python3
"""Python test script to generate intermediate results for Node.js implementation."""

import json
import hashlib
import base64
import secrets
from datetime import datetime, timezone
from pathlib import Path
from cryptography.hazmat.primitives import hashes

# Test 1: Generate secp256k1 key pair and DID document
print("=" * 60)
print("Test 1: DID Document Generation")
print("=" * 60)

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, PublicFormat, NoEncryption

# Generate secp256k1 key pair
private_key = ec.generate_private_key(ec.SECP256K1())
public_key = private_key.public_key()

# Get key numbers for JWK
numbers = public_key.public_numbers()
print(f"\nPublic key numbers:")
print(f"  x (hex): {hex(numbers.x)}")
print(f"  y (hex): {hex(numbers.y)}")

# Encode to base64url
def encode_base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')

x_bytes = numbers.x.to_bytes((numbers.x.bit_length() + 7) // 8, 'big')
y_bytes = numbers.y.to_bytes((numbers.y.bit_length() + 7) // 8, 'big')

x_b64url = encode_base64url(x_bytes)
y_b64url = encode_base64url(y_bytes)

print(f"\nJWK components:")
print(f"  x (base64url): {x_b64url}")
print(f"  y (base64url): {y_b64url}")

# Get compressed public key for kid
compressed = public_key.public_bytes(encoding=Encoding.X962, format=PublicFormat.CompressedPoint)
kid = encode_base64url(hashlib.sha256(compressed).digest())
print(f"  kid: {kid}")

# Create JWK
jwk = {
    "kty": "EC",
    "crv": "secp256k1",
    "x": x_b64url,
    "y": y_b64url,
    "kid": kid
}
print(f"\nFull JWK:")
print(json.dumps(jwk, indent=2))

# Create DID document
hostname = "awiki.ai"
path_prefix = ["user"]
unique_id = f"k1_{kid}"
did = f"did:wba:{hostname}:{':'.join(path_prefix)}:{unique_id}"

print(f"\nDID: {did}")

did_document = {
    "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://w3id.org/security/suites/jws-2020/v1",
        "https://w3id.org/security/suites/secp256k1-2019/v1"
    ],
    "id": did,
    "verificationMethod": [{
        "id": f"{did}#key-1",
        "type": "EcdsaSecp256k1VerificationKey2019",
        "controller": did,
        "publicKeyJwk": jwk
    }],
    "authentication": [f"{did}#key-1"]
}

print(f"\nDID Document:")
print(json.dumps(did_document, indent=2, ensure_ascii=False))

# Save to file for Node.js comparison
output_dir = Path(__file__).parent / "tests" / "python_output"
output_dir.mkdir(parents=True, exist_ok=True)

with open(output_dir / "did_document.json", "w") as f:
    json.dump(did_document, f, indent=2)

# Save private key PEM
private_key_pem = private_key.private_bytes(
    encoding=Encoding.PEM,
    format=PrivateFormat.PKCS8,
    encryption_algorithm=NoEncryption()
).decode('utf-8')

with open(output_dir / "private_key.pem", "w") as f:
    f.write(private_key_pem)

print(f"\nPrivate key PEM (first 100 chars): {private_key_pem[:100]}...")

# Test 2: Generate signature for DID document proof
print("\n" + "=" * 60)
print("Test 2: DID Document Proof Signature")
print("=" * 60)

import jcs
import jcs

# Create proof
challenge = secrets.token_hex(16)
created = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
domain = "awiki.ai"

proof = {
    "type": "EcdsaSecp256k1Signature2019",
    "verificationMethod": f"{did}#key-1",
    "created": created,
    "proofPurpose": "authentication",
    "domain": domain,
    "challenge": challenge,
    "proofValue": ""
}

# Create document to sign (with empty proofValue)
doc_to_sign = dict(did_document)
doc_to_sign["proof"] = proof

# Canonicalize using JCS
canonical_json = jcs.canonicalize(doc_to_sign)
print(f"\nCanonical JSON (first 200 chars): {canonical_json[:200]}...")

# Calculate SHA-256 hash
content_hash = hashlib.sha256(canonical_json).digest()
print(f"Content hash (hex): {content_hash.hex()}")

# Sign with secp256k1
signature_der = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))
print(f"Signature DER (hex): {signature_der.hex()}")

# Convert DER to R|S format
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
r, s = decode_dss_signature(signature_der)

# Convert to bytes (32 bytes each, big-endian)
r_bytes = r.to_bytes(32, 'big')
s_bytes = s.to_bytes(32, 'big')

# Check for low-S (BIP 146)
CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
if s > CURVE_ORDER // 2:
    s = CURVE_ORDER - s
    s_bytes = s.to_bytes(32, 'big')
    print("Applied low-S normalization")

signature_rs = r_bytes + s_bytes
signature_b64url = encode_base64url(signature_rs)

print(f"Signature R|S (base64url): {signature_b64url}")

# Update proof with signature
proof["proofValue"] = signature_b64url
did_document["proof"] = proof

print(f"\nFull DID Document with Proof:")
print(json.dumps(did_document, indent=2, ensure_ascii=False))

with open(output_dir / "did_document_with_proof.json", "w") as f:
    json.dump(did_document, f, indent=2)

# Test 3: Generate WBA auth header
print("\n" + "=" * 60)
print("Test 3: WBA Authorization Header")
print("=" * 60)

nonce = secrets.token_hex(16)
timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
service_domain = "awiki.ai"

auth_data = {
    "nonce": nonce,
    "timestamp": timestamp,
    "service": service_domain,
    "did": did
}

auth_canonical = jcs.canonicalize(auth_data)
print(f"\nAuth data canonical: {auth_canonical}")

auth_hash = hashlib.sha256(auth_canonical).digest()
print(f"Auth hash (hex): {auth_hash.hex()}")

# Sign auth hash
auth_signature_der = private_key.sign(auth_hash, ec.ECDSA(hashes.SHA256()))
auth_r, auth_s = decode_dss_signature(auth_signature_der)

# Apply low-S normalization
if auth_s > CURVE_ORDER // 2:
    auth_s = CURVE_ORDER - auth_s

auth_r_bytes = auth_r.to_bytes(32, 'big')
auth_s_bytes = auth_s.to_bytes(32, 'big')
auth_signature_rs = auth_r_bytes + auth_s_bytes
auth_signature_b64url = encode_base64url(auth_signature_rs)

print(f"Auth signature (base64url): {auth_signature_b64url}")

# Build Authorization header
auth_header = (
    f'DIDWba did="{did}", '
    f'nonce="{nonce}", '
    f'timestamp="{timestamp}", '
    f'verification_method="key-1", '
    f'signature="{auth_signature_b64url}"'
)

print(f"\nAuthorization Header:")
print(auth_header)

with open(output_dir / "auth_header.txt", "w") as f:
    f.write(auth_header)

# Test 4: Generate E2EE keys (secp256r1 and X25519)
print("\n" + "=" * 60)
print("Test 4: E2EE Key Generation")
print("=" * 60)

# Generate secp256r1 (P-256) signing key
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey

signing_key_r1 = ec.generate_private_key(ec.SECP256R1())
signing_pub_r1 = signing_key_r1.public_key()

signing_private_pem = signing_key_r1.private_bytes(
    encoding=Encoding.PEM,
    format=PrivateFormat.PKCS8,
    encryption_algorithm=NoEncryption()
).decode('utf-8')

signing_public_pem = signing_pub_r1.public_bytes(
    encoding=Encoding.PEM,
    format=PublicFormat.SubjectPublicKeyInfo
).decode('utf-8')

print(f"\nsecp256r1 Signing Private Key PEM (first 100 chars): {signing_private_pem[:100]}...")
print(f"secp256r1 Signing Public Key PEM (first 100 chars): {signing_public_pem[:100]}...")

# Generate X25519 agreement key
x25519_private = X25519PrivateKey.generate()
x25519_public = x25519_private.public_key()

x25519_private_pem = x25519_private.private_bytes(
    encoding=Encoding.PEM,
    format=PrivateFormat.PKCS8,
    encryption_algorithm=NoEncryption()
).decode('utf-8')

x25519_public_pem = x25519_public.public_bytes(
    encoding=Encoding.PEM,
    format=PublicFormat.SubjectPublicKeyInfo
).decode('utf-8')

print(f"\nX25519 Agreement Private Key PEM (first 100 chars): {x25519_private_pem[:100]}...")
print(f"X25519 Agreement Public Key PEM (first 100 chars): {x25519_public_pem[:100]}...")

with open(output_dir / "e2ee_signing_private.pem", "w") as f:
    f.write(signing_private_pem)

with open(output_dir / "e2ee_signing_public.pem", "w") as f:
    f.write(signing_public_pem)

with open(output_dir / "e2ee_agreement_private.pem", "w") as f:
    f.write(x25519_private_pem)

with open(output_dir / "e2ee_agreement_public.pem", "w") as f:
    f.write(x25519_public_pem)

print(f"\n[OK] All test outputs saved to: {output_dir}")
print("\nFiles generated:")
for f in sorted(output_dir.glob("*")):
    print(f"  - {f.name}")
