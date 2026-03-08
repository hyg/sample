#!/usr/bin/env python3
"""
Generate detailed test vectors for each step of W3C proof generation.
This allows Node.js implementation to verify each step matches Python.
"""

import json
import hashlib
import base64
from datetime import datetime, timezone
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec, utils
from cryptography.hazmat.primitives import hashes, serialization
import jcs

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 80)
print("W3C Proof Step-by-Step Test Vector Generation")
print("=" * 80)

# Test document (same as Python's example)
test_document = {
    "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://w3id.org/security/suites/jws-2020/v1",
        "https://w3id.org/security/suites/secp256k1-2019/v1"
    ],
    "id": "did:wba:awiki.ai:user:k1_test123",
    "verificationMethod": [{
        "id": "did:wba:awiki.ai:user:k1_test123#key-1",
        "type": "EcdsaSecp256k1VerificationKey2019",
        "controller": "did:wba:awiki.ai:user:k1_test123",
        "publicKeyJwk": {
            "kty": "EC",
            "crv": "secp256k1",
            "x": "WC0xMjM0NTY3ODkwYWJjZGVm",
            "y": "YWJjZGVmMTIzNDU2Nzg5MA"
        }
    }],
    "authentication": ["did:wba:awiki.ai:user:k1_test123#key-1"]
}

# Proof options
proof_options = {
    "type": "EcdsaSecp256k1Signature2019",
    "created": "2026-03-07T00:00:00Z",
    "verificationMethod": "did:wba:awiki.ai:user:k1_test123#key-1",
    "proofPurpose": "authentication",
    "domain": "awiki.ai",
    "challenge": "test-challenge-12345"
}

# Generate key pair
private_key = ec.generate_private_key(ec.SECP256K1())
public_key = private_key.public_key()

# Extract private key bytes
from cryptography.hazmat.primitives.serialization import load_pem_private_key
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)
loaded_key = load_pem_private_key(private_pem, password=None)
private_numbers = loaded_key.private_numbers()
private_bytes_hex = private_numbers.private_value.to_bytes(32, 'big').hex()
public_x_hex = private_numbers.public_numbers.x.to_bytes(32, 'big').hex()
public_y_hex = private_numbers.public_numbers.y.to_bytes(32, 'big').hex()

print("\n[Step 1] JCS Canonicalization")
print("-" * 40)

# Canonicalize document (without proof)
doc_without_proof = {k: v for k, v in test_document.items() if k != "proof"}
doc_canonical = jcs.canonicalize(doc_without_proof)
print(f"Document canonical (first 100 chars): {doc_canonical.decode('utf-8')[:100]}...")
print(f"Document canonical length: {len(doc_canonical)} bytes")

# Canonicalize proof options
options_canonical = jcs.canonicalize(proof_options)
print(f"Options canonical: {options_canonical.decode('utf-8')}")
print(f"Options canonical length: {len(options_canonical)} bytes")

print("\n[Step 2] SHA-256 Hashing")
print("-" * 40)

doc_hash = hashlib.sha256(doc_canonical).digest()
options_hash = hashlib.sha256(options_canonical).digest()

print(f"Document hash: {doc_hash.hex()}")
print(f"Options hash: {options_hash.hex()}")

print("\n[Step 3] Compute Signing Input")
print("-" * 40)

# toBeSigned = options_hash || doc_hash (64 bytes)
to_be_signed = options_hash + doc_hash
print(f"toBeSigned: {to_be_signed.hex()}")
print(f"toBeSigned length: {len(to_be_signed)} bytes")

print("\n[Step 4] ECDSA secp256k1 Signing")
print("-" * 40)

# Python signs toBeSigned with SHA256 (double hash)
der_sig = private_key.sign(to_be_signed, ec.ECDSA(hashes.SHA256()))
print(f"DER signature: {der_sig.hex()}")
print(f"DER signature length: {len(der_sig)} bytes")

# Decode DER to R, S
r, s = utils.decode_dss_signature(der_sig)
print(f"R (int): {r}")
print(f"S (int): {s}")

# Convert to 32-byte big-endian
r_bytes = r.to_bytes(32, byteorder="big")
s_bytes = s.to_bytes(32, byteorder="big")
rs_sig = r_bytes + s_bytes

print(f"R (hex): {r_bytes.hex()}")
print(f"S (hex): {s_bytes.hex()}")
print(f"R||S signature: {rs_sig.hex()}")
print(f"R||S length: {len(rs_sig)} bytes")

# Check low-S normalization
CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
print(f"\nS > CURVE_ORDER/2: {s > CURVE_ORDER // 2}")
if s > CURVE_ORDER // 2:
    s_normalized = CURVE_ORDER - s
    s_normalized_bytes = s_normalized.to_bytes(32, 'big')
    rs_sig_normalized = r_bytes + s_normalized_bytes
    print(f"Normalized S: {s_normalized_bytes.hex()}")
    print(f"Normalized R||S: {rs_sig_normalized.hex()}")
else:
    rs_sig_normalized = rs_sig
    print("S is already low-S, no normalization needed")

print("\n[Step 5] Base64URL Encoding")
print("-" * 40)

proof_value = base64.urlsafe_b64encode(rs_sig_normalized).rstrip(b"=").decode("ascii")
print(f"proofValue: {proof_value}")
print(f"proofValue length: {len(proof_value)} chars (expected 86)")

print("\n[Step 6] Build Complete Proof")
print("-" * 40)

proof = dict(proof_options)
proof["proofValue"] = proof_value

print("Complete proof:")
print(json.dumps(proof, indent=2))

print("\n[Step 7] Verification Test")
print("-" * 40)

# Reconstruct toBeSigned for verification
reconstructed_to_be_signed = options_hash + doc_hash

# Decode signature
decoded_sig = base64.urlsafe_b64decode(proof_value + "=" * (-len(proof_value) % 4))

# Verify (double hash)
try:
    r_verify = int.from_bytes(decoded_sig[:32], "big")
    s_verify = int.from_bytes(decoded_sig[32:], "big")
    der_sig_verify = utils.encode_dss_signature(r_verify, s_verify)
    public_key.verify(der_sig_verify, reconstructed_to_be_signed, ec.ECDSA(hashes.SHA256()))
    print("Verification: VALID [OK]")
    verification_result = True
except Exception as e:
    print(f"Verification: INVALID [FAIL] - {e}")
    verification_result = False

# Save all test vectors
test_vectors = {
    "description": "W3C Proof step-by-step test vectors",
    "input": {
        "document": test_document,
        "proof_options": proof_options
    },
    "step1_canonicalization": {
        "doc_canonical": doc_canonical.decode('utf-8'),
        "doc_canonical_hex": doc_canonical.hex(),
        "doc_canonical_length": len(doc_canonical),
        "options_canonical": options_canonical.decode('utf-8'),
        "options_canonical_hex": options_canonical.hex(),
        "options_canonical_length": len(options_canonical)
    },
    "step2_hashing": {
        "doc_hash_hex": doc_hash.hex(),
        "options_hash_hex": options_hash.hex()
    },
    "step3_signing_input": {
        "to_be_signed_hex": to_be_signed.hex(),
        "to_be_signed_length": len(to_be_signed)
    },
    "step4_signing": {
        "private_key_hex": private_bytes_hex,
        "public_key_x_hex": public_x_hex,
        "public_key_y_hex": public_y_hex,
        "der_signature_hex": der_sig.hex(),
        "r_hex": r_bytes.hex(),
        "s_hex": s_bytes.hex(),
        "rs_signature_hex": rs_sig.hex(),
        "rs_signature_normalized_hex": rs_sig_normalized.hex(),
        "s_was_normalized": s > CURVE_ORDER // 2
    },
    "step5_base64url": {
        "proof_value": proof_value,
        "proof_value_length": len(proof_value)
    },
    "step6_complete_proof": {
        "proof": proof
    },
    "step7_verification": {
        "result": verification_result
    }
}

with open(OUTPUT_DIR / "w3c_proof_step_by_step.json", "w") as f:
    json.dump(test_vectors, f, indent=2)

print(f"\n{'=' * 80}")
print(f"All test vectors saved to: {OUTPUT_DIR / 'w3c_proof_step_by_step.json'}")
print(f"{'=' * 80}")
