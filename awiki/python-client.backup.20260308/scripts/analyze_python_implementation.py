#!/usr/bin/env python3
"""
Analyze Python implementation details for Node.js porting.
Records inputs/outputs for each function to create unit test baselines.
"""

import json
import hashlib
import base64
import secrets
from datetime import datetime, timezone
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec, utils
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
import jcs

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 80)
print("Python Implementation Analysis for Node.js Porting")
print("=" * 80)

# ============================================================================
# 1. w3c_proof.py - _b64url_encode / _b64url_decode
# ============================================================================
print("\n" + "=" * 80)
print("1. w3c_proof.py - Base64URL Encoding/Decoding")
print("=" * 80)

test_data = b"Hello, World! This is a test message for base64url encoding."
encoded = base64.urlsafe_b64encode(test_data).rstrip(b"=").decode("ascii")
decoded = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))

print(f"Input (bytes): {test_data}")
print(f"Encoded: {encoded}")
print(f"Decoded: {decoded}")
print(f"Round-trip match: {decoded == test_data}")

# Test with signature bytes (64 bytes R||S)
sig_bytes = secrets.token_bytes(64)
sig_encoded = base64.urlsafe_b64encode(sig_bytes).rstrip(b"=").decode("ascii")
sig_decoded = base64.urlsafe_b64decode(sig_encoded + "=" * (-len(sig_encoded) % 4))

print(f"\nSignature bytes (64): {sig_bytes.hex()}")
print(f"Signature encoded: {sig_encoded}")
print(f"Signature decoded match: {sig_decoded == sig_bytes}")

# Save test vector
b64_test = {
    "description": "Base64URL encoding/decoding",
    "input_hex": test_data.hex(),
    "encoded": encoded,
    "decoded_hex": decoded.hex(),
    "round_trip_match": decoded == test_data,
    "signature_input_hex": sig_bytes.hex(),
    "signature_encoded": sig_encoded,
    "signature_decoded_match": sig_decoded == sig_bytes
}

with open(OUTPUT_DIR / "b64url_test.json", "w") as f:
    json.dump(b64_test, f, indent=2)

# ============================================================================
# 2. w3c_proof.py - _canonicalize (JCS RFC 8785)
# ============================================================================
print("\n" + "=" * 80)
print("2. w3c_proof.py - JCS Canonicalization (RFC 8785)")
print("=" * 80)

test_obj = {
    "z": 1,
    "a": {
        "z": "last",
        "a": "first",
        "m": [3, 2, 1]
    },
    "m": [3, 2, 1],
    "proof": {
        "type": "EcdsaSecp256k1Signature2019",
        "proofValue": ""
    }
}

canonical = jcs.canonicalize(test_obj)
print(f"Input object keys order: {list(test_obj.keys())}")
print(f"Canonical JSON length: {len(canonical)} bytes")
print(f"Canonical JSON (first 200 chars): {canonical.decode('utf-8')[:200]}...")

# Save test vector
jcs_test = {
    "description": "JCS canonicalization",
    "input": test_obj,
    "canonical": canonical.decode('utf-8'),
    "canonical_hex": canonical.hex()
}

with open(OUTPUT_DIR / "jcs_canonical_test.json", "w") as f:
    json.dump(jcs_test, f, indent=2)

# ============================================================================
# 3. w3c_proof.py - _hash_bytes (SHA-256)
# ============================================================================
print("\n" + "=" * 80)
print("3. w3c_proof.py - SHA-256 Hash")
print("=" * 80)

hash_input = canonical
hash_output = hashlib.sha256(hash_input).digest()

print(f"Input length: {len(hash_input)} bytes")
print(f"Output (hex): {hash_output.hex()}")
print(f"Output length: {len(hash_output)} bytes (expected 32)")

hash_test = {
    "description": "SHA-256 hash",
    "input_hex": hash_input.hex(),
    "output_hex": hash_output.hex(),
    "output_length": len(hash_output)
}

with open(OUTPUT_DIR / "sha256_hash_test.json", "w") as f:
    json.dump(hash_test, f, indent=2)

# ============================================================================
# 4. w3c_proof.py - _compute_signing_input
# ============================================================================
print("\n" + "=" * 80)
print("4. w3c_proof.py - Compute Signing Input")
print("=" * 80)

# Create test document and proof options
test_doc = {
    "@context": ["https://www.w3.org/ns/did/v1"],
    "id": "did:wba:awiki.ai:user:k1_test",
    "verificationMethod": [{
        "id": "did:wba:awiki.ai:user:k1_test#key-1",
        "type": "EcdsaSecp256k1VerificationKey2019",
        "controller": "did:wba:awiki.ai:user:k1_test",
        "publicKeyJwk": {
            "kty": "EC",
            "crv": "secp256k1",
            "x": "test_x",
            "y": "test_y"
        }
    }],
    "authentication": ["did:wba:awiki.ai:user:k1_test#key-1"]
}

proof_options = {
    "type": "EcdsaSecp256k1Signature2019",
    "created": "2026-03-07T00:00:00Z",
    "verificationMethod": "did:wba:awiki.ai:user:k1_test#key-1",
    "proofPurpose": "authentication",
    "domain": "awiki.ai",
    "challenge": "test-challenge"
}

doc_hash = hashlib.sha256(jcs.canonicalize(test_doc)).digest()
options_hash = hashlib.sha256(jcs.canonicalize(proof_options)).digest()
to_be_signed = options_hash + doc_hash

print(f"Document hash: {doc_hash.hex()}")
print(f"Options hash: {options_hash.hex()}")
print(f"ToBeSigned (options_hash || doc_hash): {to_be_signed.hex()}")
print(f"ToBeSigned length: {len(to_be_signed)} bytes (expected 64)")

signing_input_test = {
    "description": "Compute signing input",
    "document": test_doc,
    "proof_options": proof_options,
    "doc_hash_hex": doc_hash.hex(),
    "options_hash_hex": options_hash.hex(),
    "to_be_signed_hex": to_be_signed.hex(),
    "to_be_signed_length": len(to_be_signed)
}

with open(OUTPUT_DIR / "signing_input_test.json", "w") as f:
    json.dump(signing_input_test, f, indent=2)

# ============================================================================
# 5. w3c_proof.py - _sign_secp256k1
# ============================================================================
print("\n" + "=" * 80)
print("5. w3c_proof.py - ECDSA secp256k1 Signing")
print("=" * 80)

# Generate key pair
private_key = ec.generate_private_key(ec.SECP256K1())
public_key = private_key.public_key()

# Get private key bytes
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)

# Extract raw private key bytes from PEM
from cryptography.hazmat.primitives.serialization import load_pem_private_key
loaded_key = load_pem_private_key(private_pem, password=None)
private_numbers = loaded_key.private_numbers()
private_bytes_raw = private_numbers.private_value.to_bytes(32, 'big')

print(f"Private key (hex): {private_bytes_raw.hex()}")

# Sign
der_sig = private_key.sign(to_be_signed, ec.ECDSA(hashes.SHA256()))
r, s = decode_dss_signature(der_sig)

# Convert to R||S format (32 bytes each)
r_bytes = r.to_bytes(32, byteorder="big")
s_bytes = s.to_bytes(32, byteorder="big")
rs_sig = r_bytes + s_bytes

print(f"DER signature: {der_sig.hex()}")
print(f"DER signature length: {len(der_sig)} bytes")
print(f"R||S signature: {rs_sig.hex()}")
print(f"R||S signature length: {len(rs_sig)} bytes (expected 64)")

# Check low-S normalization
CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
print(f"\nS value: {s}")
print(f"CURVE_ORDER/2: {CURVE_ORDER // 2}")
print(f"S > CURVE_ORDER/2: {s > CURVE_ORDER // 2}")

# Apply low-S normalization if needed
if s > CURVE_ORDER // 2:
    s_normalized = CURVE_ORDER - s
    s_normalized_bytes = s_normalized.to_bytes(32, 'big')
    rs_sig_normalized = r_bytes + s_normalized_bytes
    print(f"Normalized S: {s_normalized_bytes.hex()}")
    print(f"Normalized R||S: {rs_sig_normalized.hex()}")
else:
    rs_sig_normalized = rs_sig
    print("S is already low-S, no normalization needed")

# Encode as base64url
proof_value = base64.urlsafe_b64encode(rs_sig_normalized).rstrip(b"=").decode("ascii")
print(f"\nProof value (base64url): {proof_value}")
print(f"Proof value length: {len(proof_value)} chars (expected 86)")

sign_test = {
    "description": "ECDSA secp256k1 signing",
    "private_key_hex": private_bytes_raw.hex(),
    "public_key_x_hex": private_numbers.public_numbers.x.to_bytes(32, 'big').hex(),
    "public_key_y_hex": private_numbers.public_numbers.y.to_bytes(32, 'big').hex(),
    "to_be_signed_hex": to_be_signed.hex(),
    "der_signature_hex": der_sig.hex(),
    "rs_signature_hex": rs_sig.hex(),
    "rs_signature_normalized_hex": rs_sig_normalized.hex(),
    "proof_value": proof_value,
    "proof_value_length": len(proof_value),
    "s_was_normalized": s > CURVE_ORDER // 2
}

with open(OUTPUT_DIR / "sign_test.json", "w") as f:
    json.dump(sign_test, f, indent=2)

# ============================================================================
# 6. w3c_proof.py - _verify_secp256k1
# ============================================================================
print("\n" + "=" * 80)
print("6. w3c_proof.py - ECDSA secp256k1 Verification")
print("=" * 80)

# Verify with cryptography
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature

# Convert R||S back to DER
r_verify = int.from_bytes(rs_sig_normalized[:32], 'big')
s_verify = int.from_bytes(rs_sig_normalized[32:], 'big')
der_sig_verify = encode_dss_signature(r_verify, s_verify)

print(f"R||S signature: {rs_sig_normalized.hex()}")
print(f"DER signature for verification: {der_sig_verify.hex()}")

try:
    public_key.verify(der_sig_verify, to_be_signed, ec.ECDSA(hashes.SHA256()))
    print("Verification: VALID")
    verify_result = True
except Exception as e:
    print(f"Verification: INVALID - {e}")
    verify_result = False

verify_test = {
    "description": "ECDSA secp256k1 verification",
    "public_key_x_hex": private_numbers.public_numbers.x.to_bytes(32, 'big').hex(),
    "public_key_y_hex": private_numbers.public_numbers.y.to_bytes(32, 'big').hex(),
    "to_be_signed_hex": to_be_signed.hex(),
    "rs_signature_hex": rs_sig_normalized.hex(),
    "der_signature_hex": der_sig_verify.hex(),
    "verification_result": verify_result
}

with open(OUTPUT_DIR / "verify_test.json", "w") as f:
    json.dump(verify_test, f, indent=2)

# ============================================================================
# 7. w3c_proof.py - generate_w3c_proof (complete flow)
# ============================================================================
print("\n" + "=" * 80)
print("7. w3c_proof.py - Complete generate_w3c_proof Flow")
print("=" * 80)

# Create a complete test document
complete_doc = {
    "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://w3id.org/security/suites/jws-2020/v1",
        "https://w3id.org/security/suites/secp256k1-2019/v1"
    ],
    "id": "did:wba:awiki.ai:user:k1_testcomplete",
    "verificationMethod": [{
        "id": "did:wba:awiki.ai:user:k1_testcomplete#key-1",
        "type": "EcdsaSecp256k1VerificationKey2019",
        "controller": "did:wba:awiki.ai:user:k1_testcomplete",
        "publicKeyJwk": {
            "kty": "EC",
            "crv": "secp256k1",
            "x": "test_x_base64url",
            "y": "test_y_base64url",
            "kid": "test_kid"
        }
    }],
    "authentication": ["did:wba:awiki.ai:user:k1_testcomplete#key-1"]
}

# Generate proof with fixed values for reproducibility
fixed_created = "2026-03-07T00:00:00Z"
fixed_challenge = "fixed-challenge-12345"
fixed_domain = "awiki.ai"
verification_method = "did:wba:awiki.ai:user:k1_testcomplete#key-1"
proof_purpose = "authentication"

# Build proof options (without proofValue)
proof_opts = {
    "type": "EcdsaSecp256k1Signature2019",
    "created": fixed_created,
    "verificationMethod": verification_method,
    "proofPurpose": proof_purpose,
    "domain": fixed_domain,
    "challenge": fixed_challenge
}

# Document without proof
doc_without_proof = {k: v for k, v in complete_doc.items() if k != "proof"}

# Compute signing input
doc_hash_complete = hashlib.sha256(jcs.canonicalize(doc_without_proof)).digest()
options_hash_complete = hashlib.sha256(jcs.canonicalize(proof_opts)).digest()
to_be_signed_complete = options_hash_complete + doc_hash_complete

# Sign
der_sig_complete = private_key.sign(to_be_signed_complete, ec.ECDSA(hashes.SHA256()))
r_complete, s_complete = decode_dss_signature(der_sig_complete)

# Low-S normalization
if s_complete > CURVE_ORDER // 2:
    s_complete = CURVE_ORDER - s_complete

r_bytes_complete = r_complete.to_bytes(32, byteorder="big")
s_bytes_complete = s_complete.to_bytes(32, byteorder="big")
rs_sig_complete = r_bytes_complete + s_bytes_complete

# Encode as base64url
proof_value_complete = base64.urlsafe_b64encode(rs_sig_complete).rstrip(b"=").decode("ascii")

# Build complete proof
complete_proof = {
    **proof_opts,
    "proofValue": proof_value_complete
}

# Build signed document
signed_doc = {**complete_doc, "proof": complete_proof}

print(f"Document ID: {complete_doc['id']}")
print(f"Created: {fixed_created}")
print(f"Challenge: {fixed_challenge}")
print(f"ToBeSigned: {to_be_signed_complete.hex()}")
print(f"Proof value: {proof_value_complete}")

# Verify
r_verify_complete = int.from_bytes(rs_sig_complete[:32], 'big')
s_verify_complete = int.from_bytes(rs_sig_complete[32:], 'big')
der_sig_verify_complete = encode_dss_signature(r_verify_complete, s_verify_complete)

try:
    public_key.verify(der_sig_verify_complete, to_be_signed_complete, ec.ECDSA(hashes.SHA256()))
    print("Proof verification: VALID")
    proof_verify_result = True
except Exception as e:
    print(f"Proof verification: INVALID - {e}")
    proof_verify_result = False

complete_test = {
    "description": "Complete generate_w3c_proof flow",
    "document": complete_doc,
    "proof_options": proof_opts,
    "to_be_signed_hex": to_be_signed_complete.hex(),
    "proof_value": proof_value_complete,
    "signed_document": signed_doc,
    "verification_result": proof_verify_result
}

with open(OUTPUT_DIR / "complete_proof_test.json", "w") as f:
    json.dump(complete_test, f, indent=2)

# ============================================================================
# Summary
# ============================================================================
print("\n" + "=" * 80)
print("Summary - Test Vectors Generated")
print("=" * 80)

test_files = [
    "b64url_test.json",
    "jcs_canonical_test.json",
    "sha256_hash_test.json",
    "signing_input_test.json",
    "sign_test.json",
    "verify_test.json",
    "complete_proof_test.json"
]

for f in test_files:
    print(f"  - {f}")

print(f"\nAll test vectors saved to: {OUTPUT_DIR}")
