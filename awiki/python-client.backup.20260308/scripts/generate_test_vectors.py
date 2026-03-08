#!/usr/bin/env python3
"""
Generate test vectors for Node.js implementation comparison.
Run this script to generate expected outputs, then compare with Node.js test results.
"""

import json
import hashlib
import base64
import secrets
from datetime import datetime, timezone
from pathlib import Path
import jcs
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, utils
from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, PublicFormat, NoEncryption

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def encode_base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')

def decode_base64url(s: str) -> bytes:
    padding = '=' * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + padding)

# ============================================================
# Test 1: DID Document Generation
# ============================================================
print("=" * 60)
print("Test 1: DID Document Generation")
print("=" * 60)

# Generate secp256k1 key pair
private_key = ec.generate_private_key(ec.SECP256K1())
public_key = private_key.public_key()

numbers = public_key.public_numbers()
x_bytes = numbers.x.to_bytes((numbers.x.bit_length() + 7) // 8, 'big')
y_bytes = numbers.y.to_bytes((numbers.y.bit_length() + 7) // 8, 'big')

x_b64url = encode_base64url(x_bytes)
y_b64url = encode_base64url(y_bytes)

compressed = public_key.public_bytes(encoding=Encoding.X962, format=PublicFormat.CompressedPoint)
kid = encode_base64url(hashlib.sha256(compressed).digest())

jwk = {
    "kty": "EC",
    "crv": "secp256k1",
    "x": x_b64url,
    "y": y_b64url,
    "kid": kid
}

hostname = "awiki.ai"
path_prefix = ["user"]
unique_id = f"k1_{kid}"
did = f"did:wba:{hostname}:{':'.join(path_prefix)}:{unique_id}"

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

# Save test vector
test_vector_1 = {
    "did": did,
    "kid": kid,
    "jwk": jwk,
    "did_document": did_document,
    "private_key_pem": private_key.private_bytes(
        encoding=Encoding.PEM,
        format=PrivateFormat.PKCS8,
        encryption_algorithm=NoEncryption()
    ).decode('utf-8'),
    "public_key_pem": public_key.public_bytes(
        encoding=Encoding.PEM,
        format=PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
}

with open(OUTPUT_DIR / "test_vector_1_did_document.json", "w") as f:
    json.dump(test_vector_1, f, indent=2)

print(f"DID: {did}")
print(f"kid: {kid}")
print(f"Saved to: {OUTPUT_DIR / 'test_vector_1_did_document.json'}")

# ============================================================
# Test 2: DID Document Proof Signature
# ============================================================
print("\n" + "=" * 60)
print("Test 2: DID Document Proof Signature")
print("=" * 60)

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

doc_to_sign = dict(did_document)
doc_to_sign["proof"] = proof

canonical_json = jcs.canonicalize(doc_to_sign)
content_hash = hashlib.sha256(canonical_json).digest()

signature_der = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))
r, s = utils.decode_dss_signature(signature_der)

# Low-S normalization (BIP 146)
CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
if s > CURVE_ORDER // 2:
    s = CURVE_ORDER - s

r_bytes = r.to_bytes(32, 'big')
s_bytes = s.to_bytes(32, 'big')
signature_rs = r_bytes + s_bytes
signature_b64url = encode_base64url(signature_rs)

proof["proofValue"] = signature_b64url
did_document["proof"] = proof

test_vector_2 = {
    "doc_to_sign_canonical": canonical_json.decode('utf-8'),
    "content_hash_hex": content_hash.hex(),
    "signature_der_hex": signature_der.hex(),
    "signature_r_hex": r_bytes.hex(),
    "signature_s_hex": s_bytes.hex(),
    "signature_b64url": signature_b64url,
    "signed_document": did_document
}

with open(OUTPUT_DIR / "test_vector_2_proof_signature.json", "w") as f:
    json.dump(test_vector_2, f, indent=2)

print(f"Content hash: {content_hash.hex()}")
print(f"Signature (base64url): {signature_b64url}")
print(f"Saved to: {OUTPUT_DIR / 'test_vector_2_proof_signature.json'}")

# ============================================================
# Test 3: WBA Authorization Header
# ============================================================
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
auth_hash = hashlib.sha256(auth_canonical).digest()

auth_signature_der = private_key.sign(auth_hash, ec.ECDSA(hashes.SHA256()))
auth_r, auth_s = utils.decode_dss_signature(auth_signature_der)

if auth_s > CURVE_ORDER // 2:
    auth_s = CURVE_ORDER - auth_s

auth_r_bytes = auth_r.to_bytes(32, 'big')
auth_s_bytes = auth_s.to_bytes(32, 'big')
auth_signature_rs = auth_r_bytes + auth_s_bytes
auth_signature_b64url = encode_base64url(auth_signature_rs)

auth_header = (
    f'DIDWba did="{did}", '
    f'nonce="{nonce}", '
    f'timestamp="{timestamp}", '
    f'verification_method="key-1", '
    f'signature="{auth_signature_b64url}"'
)

test_vector_3 = {
    "auth_data_canonical": auth_canonical.decode('utf-8'),
    "auth_hash_hex": auth_hash.hex(),
    "auth_signature_b64url": auth_signature_b64url,
    "auth_header": auth_header
}

with open(OUTPUT_DIR / "test_vector_3_auth_header.json", "w") as f:
    json.dump(test_vector_3, f, indent=2)

print(f"Auth header: {auth_header}")
print(f"Saved to: {OUTPUT_DIR / 'test_vector_3_auth_header.json'}")

# ============================================================
# Test 4: E2EE Key Generation
# ============================================================
print("\n" + "=" * 60)
print("Test 4: E2EE Key Generation")
print("=" * 60)

from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey

# Generate secp256r1 (P-256) signing key
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

test_vector_4 = {
    "signing_private_pem": signing_private_pem,
    "signing_public_pem": signing_public_pem,
    "agreement_private_pem": x25519_private_pem,
    "agreement_public_pem": x25519_public_pem
}

with open(OUTPUT_DIR / "test_vector_4_e2ee_keys.json", "w") as f:
    json.dump(test_vector_4, f, indent=2)

print(f"secp256r1 signing key generated")
print(f"X25519 agreement key generated")
print(f"Saved to: {OUTPUT_DIR / 'test_vector_4_e2ee_keys.json'}")

# ============================================================
# Test 5: HPKE Encryption/Decryption
# ============================================================
print("\n" + "=" * 60)
print("Test 5: HPKE Encryption/Decryption")
print("=" * 60)

from anp.e2e_encryption_hpke.hpke import hpke_seal, hpke_open

recipient_sk = x25519_private
recipient_pk = x25519_public

plaintext = b"Hello, E2EE World!"
aad = b"test-session-id"
info = b""

# Seal
enc, ciphertext = hpke_seal(recipient_pk, plaintext, aad=aad, info=info)
print(f"HPKE enc (base64): {base64.b64encode(enc).decode()}")
print(f"HPKE ciphertext (base64): {base64.b64encode(ciphertext).decode()}")

# Open
decrypted = hpke_open(recipient_sk, enc, ciphertext, aad=aad, info=info)
print(f"Decrypted: {decrypted.decode()}")

test_vector_5 = {
    "plaintext": plaintext.decode(),
    "aad": aad.decode(),
    "enc_b64": base64.b64encode(enc).decode(),
    "ciphertext_b64": base64.b64encode(ciphertext).decode(),
    "decrypted": decrypted.decode()
}

with open(OUTPUT_DIR / "test_vector_5_hpke.json", "w") as f:
    json.dump(test_vector_5, f, indent=2)

print(f"Saved to: {OUTPUT_DIR / 'test_vector_5_hpke.json'}")

# ============================================================
# Test 6: Chain Ratchet Key Derivation
# ============================================================
print("\n" + "=" * 60)
print("Test 6: Chain Ratchet Key Derivation")
print("=" * 60)

from anp.e2e_encryption_hpke.ratchet import derive_chain_keys, derive_message_key

root_seed = secrets.token_bytes(32)
init_ck, resp_ck = derive_chain_keys(root_seed)

print(f"root_seed (hex): {root_seed.hex()}")
print(f"init_chain_key (hex): {init_ck.hex()}")
print(f"resp_chain_key (hex): {resp_ck.hex()}")

# Derive message keys for seq 0, 1, 2
for seq in range(3):
    enc_key, nonce, new_ck = derive_message_key(init_ck, seq)
    init_ck = new_ck
    print(f"seq={seq}: enc_key={enc_key.hex()[:32]}..., nonce={nonce.hex()[:24]}...")

test_vector_6 = {
    "root_seed_hex": root_seed.hex(),
    "init_chain_key_hex": init_ck.hex(),
    "resp_chain_key_hex": resp_ck.hex()
}

with open(OUTPUT_DIR / "test_vector_6_ratchet.json", "w") as f:
    json.dump(test_vector_6, f, indent=2)

print(f"Saved to: {OUTPUT_DIR / 'test_vector_6_ratchet.json'}")

print("\n" + "=" * 60)
print(f"All test vectors saved to: {OUTPUT_DIR}")
print("=" * 60)
