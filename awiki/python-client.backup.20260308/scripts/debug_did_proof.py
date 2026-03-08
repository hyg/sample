#!/usr/bin/env python3
"""
Extract intermediate results for DID proof generation.
This helps debug the Node.js implementation by comparing each step.
"""

import json
import hashlib
import base64
import secrets
from datetime import datetime, timezone
from pathlib import Path

import jcs
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption, PublicFormat
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def encode_base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')

print("=" * 70)
print("DID Proof Generation - Step by Step")
print("=" * 70)

# Step 1: Generate secp256k1 key pair
print("\n[Step 1] Generate secp256k1 key pair")
private_key = ec.generate_private_key(ec.SECP256K1())
public_key = private_key.public_key()

numbers = public_key.public_numbers()
x_bytes = numbers.x.to_bytes((numbers.x.bit_length() + 7) // 8, 'big')
y_bytes = numbers.y.to_bytes((numbers.y.bit_length() + 7) // 8, 'big')

x_b64url = encode_base64url(x_bytes)
y_b64url = encode_base64url(y_bytes)

compressed = public_key.public_bytes(encoding=Encoding.X962, format=PublicFormat.CompressedPoint)
kid = encode_base64url(hashlib.sha256(compressed).digest())

print(f"  x (hex): {x_bytes.hex()}")
print(f"  y (hex): {y_bytes.hex()}")
print(f"  kid: {kid}")

# Step 2: Build DID document
print("\n[Step 2] Build DID document")
hostname = "awiki.ai"
path_prefix = ["user"]
unique_id = f"k1_{kid}"
did = f"did:wba:{hostname}:{':'.join(path_prefix)}:{unique_id}"

jwk = {
    "kty": "EC",
    "crv": "secp256k1",
    "x": x_b64url,
    "y": y_b64url,
    "kid": kid
}

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

print(f"  DID: {did}")
print(f"  DID Document (without proof):")
print(json.dumps(did_document, indent=2))

# Step 3: Create proof structure
print("\n[Step 3] Create proof structure")
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
    "proofValue": ""  # Empty for signing
}

print(f"  challenge: {challenge}")
print(f"  created: {created}")
print(f"  domain: {domain}")

# Step 4: Create document to sign (with empty proofValue)
print("\n[Step 4] Create document to sign")
doc_to_sign = dict(did_document)
doc_to_sign["proof"] = dict(proof)  # Copy proof with empty proofValue

print("  Document to sign (proofValue is empty):")
print(json.dumps(doc_to_sign, indent=2))

# Step 5: JCS Canonicalize
print("\n[Step 5] JCS Canonicalize")
canonical_json = jcs.canonicalize(doc_to_sign)
print(f"  Canonical JSON (bytes): {canonical_json}")
print(f"  Canonical JSON (length): {len(canonical_json)} bytes")

# Step 6: Calculate SHA-256 hash
print("\n[Step 6] Calculate SHA-256 hash")
content_hash = hashlib.sha256(canonical_json).digest()
print(f"  Content hash (hex): {content_hash.hex()}")

# Step 7: Sign with secp256k1
print("\n[Step 7] Sign with secp256k1")
signature_der = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))
print(f"  Signature DER (hex): {signature_der.hex()}")

# Parse DER to get R and S
r, s = decode_dss_signature(signature_der)
print(f"  R (hex): {r.to_bytes(32, 'big').hex()}")
print(f"  S (hex): {s.to_bytes(32, 'big').hex()}")

# Step 8: Low-S normalization (BIP 146)
print("\n[Step 8] Low-S normalization (BIP 146)")
CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
print(f"  Original S: {s}")
print(f"  CURVE_ORDER / 2: {CURVE_ORDER // 2}")

if s > CURVE_ORDER // 2:
    s = CURVE_ORDER - s
    print(f"  S was > CURVE_ORDER/2, normalized to: {s}")
else:
    print(f"  S <= CURVE_ORDER/2, no normalization needed")

r_bytes = r.to_bytes(32, 'big')
s_bytes = s.to_bytes(32, 'big')
signature_rs = r_bytes + s_bytes
signature_b64url = encode_base64url(signature_rs)

print(f"  Signature R||S (hex): {signature_rs.hex()}")
print(f"  Signature (base64url): {signature_b64url}")

# Step 9: Update proof with signature
print("\n[Step 9] Update proof with signature")
proof["proofValue"] = signature_b64url
did_document["proof"] = proof

print("  Final DID Document with proof:")
print(json.dumps(did_document, indent=2))

# Save all intermediate results
print("\n" + "=" * 70)
print("Saving intermediate results...")
print("=" * 70)

intermediate_results = {
    "step1_keypair": {
        "private_key_pem": private_key.private_bytes(
            encoding=Encoding.PEM,
            format=PrivateFormat.PKCS8,
            encryption_algorithm=NoEncryption()
        ).decode('utf-8'),
        "public_key_x_hex": x_bytes.hex(),
        "public_key_y_hex": y_bytes.hex(),
        "kid": kid
    },
    "step2_did_document": {
        "did": did,
        "document": did_document
    },
    "step3_proof_params": {
        "challenge": challenge,
        "created": created,
        "domain": domain,
        "verificationMethod": proof["verificationMethod"],
        "proofPurpose": proof["proofPurpose"],
        "type": proof["type"]
    },
    "step4_doc_to_sign": doc_to_sign,
    "step5_canonical_json": canonical_json.decode('utf-8'),
    "step6_content_hash_hex": content_hash.hex(),
    "step7_signature": {
        "der_hex": signature_der.hex(),
        "r_hex": r_bytes.hex(),
        "s_original_hex": s.to_bytes(32, 'big').hex() if s <= CURVE_ORDER // 2 else (CURVE_ORDER - s).to_bytes(32, 'big').hex(),
        "s_normalized_hex": s_bytes.hex()
    },
    "step8_low_s_normalization": {
        "curve_order_half": hex(CURVE_ORDER // 2),
        "original_s": str(int.from_bytes(decode_dss_signature(signature_der)[1].to_bytes(32, 'big'), 'big')),
        "normalized_s": str(s),
        "was_normalized": int.from_bytes(decode_dss_signature(signature_der)[1].to_bytes(32, 'big'), 'big') > CURVE_ORDER // 2
    },
    "step9_final_signature": {
        "rs_hex": signature_rs.hex(),
        "base64url": signature_b64url
    },
    "final_did_document": did_document
}

with open(OUTPUT_DIR / "did_proof_intermediate.json", "w") as f:
    json.dump(intermediate_results, f, indent=2)

print(f"\n[OK] All intermediate results saved to: {OUTPUT_DIR / 'did_proof_intermediate.json'}")

# Also save just the canonical JSON for easy comparison
with open(OUTPUT_DIR / "did_proof_canonical.txt", "w") as f:
    f.write(canonical_json.decode('utf-8'))

print(f"[OK] Canonical JSON saved to: {OUTPUT_DIR / 'did_proof_canonical.txt'}")

# Save the hash for comparison
with open(OUTPUT_DIR / "did_proof_hash.txt", "w") as f:
    f.write(content_hash.hex())

print(f"[OK] Content hash saved to: {OUTPUT_DIR / 'did_proof_hash.txt'}")

print("\n" + "=" * 70)
print("Done! Use these files to debug Node.js implementation.")
print("=" * 70)
