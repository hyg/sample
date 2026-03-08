#!/usr/bin/env python3
"""
Generate HPKE test vectors for Node.js implementation comparison.
This script generates test vectors using the Python anp library,
which can be used to verify the Node.js hpke-js implementation.
"""

import json
import base64
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey

from anp.e2e_encryption_hpke.hpke import hpke_seal, hpke_open
from anp.e2e_encryption_hpke.ratchet import (
    derive_chain_keys,
    derive_message_key,
    derive_group_message_key,
    determine_direction,
    assign_chain_keys
)

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 60)
print("HPKE Test Vector Generation")
print("=" * 60)

# ============================================================
# Test 1: HPKE Seal/Open with known keys
# ============================================================
print("\nTest 1: HPKE Seal/Open with known seed")

# Generate deterministic key pair from seed
import hashlib
seed = b"test-seed-for-hpke-key-generation-01"

# Derive private key from seed (for reproducibility)
sk_bytes = hashlib.sha256(seed).digest()
recipient_sk = X25519PrivateKey.from_private_bytes(sk_bytes)
recipient_pk = recipient_sk.public_key()

plaintext = b"Hello, HPKE World!"
aad = b"test-session-id"
info = b"test-info"

# Seal
enc, ciphertext = hpke_seal(recipient_pk, plaintext, aad=aad, info=info)

# Open (verify)
decrypted = hpke_open(recipient_sk, enc, ciphertext, aad=aad, info=info)

assert decrypted == plaintext, "Decryption failed!"

test_vector_1 = {
    "description": "HPKE Seal/Open basic test",
    "recipient_private_key_hex": sk_bytes.hex(),
    "recipient_public_key_hex": recipient_pk.public_bytes_raw().hex(),
    "plaintext": plaintext.decode(),
    "aad": aad.decode(),
    "info": info.decode(),
    "enc_hex": enc.hex(),
    "ciphertext_hex": ciphertext.hex(),
    "decrypted": decrypted.decode()
}

with open(OUTPUT_DIR / "hpke_test_1.json", "w") as f:
    json.dump(test_vector_1, f, indent=2)

print(f"  Plaintext: {plaintext.decode()}")
print(f"  enc (hex): {enc.hex()}")
print(f"  ciphertext (hex): {ciphertext.hex()}")
print(f"  Decrypted: {decrypted.decode()}")
print(f"  Saved to: {OUTPUT_DIR / 'hpke_test_1.json'}")

# ============================================================
# Test 2: HPKE with different AAD values
# ============================================================
print("\nTest 2: HPKE with different AAD values")

aad_values = [b"", b"session-123", b"custom-aad-data"]
results = []

for aad in aad_values:
    enc, ct = hpke_seal(recipient_pk, plaintext, aad=aad, info=info)
    decrypted = hpke_open(recipient_sk, enc, ct, aad=aad, info=info)
    
    results.append({
        "aad": aad.decode() if aad else "",
        "enc_hex": enc.hex(),
        "ciphertext_hex": ct.hex(),
        "decrypted": decrypted.decode()
    })
    
    print(f"  AAD: '{aad.decode() if aad else '(empty)'}' -> OK")

test_vector_2 = {
    "description": "HPKE with different AAD values",
    "recipient_public_key_hex": recipient_pk.public_bytes_raw().hex(),
    "plaintext": plaintext.decode(),
    "info": info.decode(),
    "results": results
}

with open(OUTPUT_DIR / "hpke_test_2_aad.json", "w") as f:
    json.dump(test_vector_2, f, indent=2)

print(f"  Saved to: {OUTPUT_DIR / 'hpke_test_2_aad.json'}")

# ============================================================
# Test 3: Chain Key Derivation
# ============================================================
print("\nTest 3: Chain Key Derivation")

root_seed = hashlib.sha256(b"root-seed-for-chain-keys").digest()
init_ck, resp_ck = derive_chain_keys(root_seed)

print(f"  root_seed (hex): {root_seed.hex()}")
print(f"  init_chain_key (hex): {init_ck.hex()}")
print(f"  resp_chain_key (hex): {resp_ck.hex()}")

test_vector_3 = {
    "description": "Chain key derivation from root seed",
    "root_seed_hex": root_seed.hex(),
    "init_chain_key_hex": init_ck.hex(),
    "resp_chain_key_hex": resp_ck.hex()
}

with open(OUTPUT_DIR / "ratchet_test_1_chain_keys.json", "w") as f:
    json.dump(test_vector_3, f, indent=2)

print(f"  Saved to: {OUTPUT_DIR / 'ratchet_test_1_chain_keys.json'}")

# ============================================================
# Test 4: Message Key Derivation (seq 0, 1, 2)
# ============================================================
print("\nTest 4: Message Key Derivation")

chain_key = init_ck
message_keys = []

for seq in range(3):
    enc_key, nonce, new_ck = derive_message_key(chain_key, seq)
    
    message_keys.append({
        "seq": seq,
        "enc_key_hex": enc_key.hex(),
        "nonce_hex": nonce.hex(),
        "new_chain_key_hex": new_ck.hex()
    })
    
    print(f"  seq={seq}: enc_key={enc_key.hex()[:32]}..., nonce={nonce.hex()[:24]}...")
    
    chain_key = new_ck

test_vector_4 = {
    "description": "Message key derivation with ratcheting",
    "initial_chain_key_hex": init_ck.hex(),
    "message_keys": message_keys
}

with open(OUTPUT_DIR / "ratchet_test_2_message_keys.json", "w") as f:
    json.dump(test_vector_4, f, indent=2)

print(f"  Saved to: {OUTPUT_DIR / 'ratchet_test_2_message_keys.json'}")

# ============================================================
# Test 5: Group Message Key Derivation
# ============================================================
print("\nTest 5: Group Message Key Derivation")

group_chain_key = resp_ck
group_message_keys = []

for seq in range(3):
    enc_key, nonce, new_ck = derive_group_message_key(group_chain_key, seq)
    
    group_message_keys.append({
        "seq": seq,
        "enc_key_hex": enc_key.hex(),
        "nonce_hex": nonce.hex()
    })
    
    print(f"  seq={seq}: enc_key={enc_key.hex()[:32]}..., nonce={nonce.hex()[:24]}...")

test_vector_5 = {
    "description": "Group message key derivation",
    "initial_chain_key_hex": group_chain_key.hex(),
    "message_keys": group_message_keys
}

with open(OUTPUT_DIR / "ratchet_test_3_group_keys.json", "w") as f:
    json.dump(test_vector_5, f, indent=2)

print(f"  Saved to: {OUTPUT_DIR / 'ratchet_test_3_group_keys.json'}")

# ============================================================
# Test 6: Direction Determination
# ============================================================
print("\nTest 6: Direction Determination")

test_dids = [
    ("did:wba:awiki.ai:user:alice", "did:wba:awiki.ai:user:bob"),
    ("did:wba:awiki.ai:user:bob", "did:wba:awiki.ai:user:alice"),
    ("did:wba:awiki.ai:user:charlie", "did:wba:awiki.ai:user:alpha"),
]

direction_results = []
for local_did, peer_did in test_dids:
    is_initiator = determine_direction(local_did, peer_did)
    direction_results.append({
        "local_did": local_did,
        "peer_did": peer_did,
        "is_initiator": is_initiator
    })
    print(f"  {local_did[-8:]} vs {peer_did[-8:]} -> is_initiator={is_initiator}")

test_vector_6 = {
    "description": "Direction determination by DID lexicographic order",
    "results": direction_results
}

with open(OUTPUT_DIR / "ratchet_test_4_direction.json", "w") as f:
    json.dump(test_vector_6, f, indent=2)

print(f"  Saved to: {OUTPUT_DIR / 'ratchet_test_4_direction.json'}")

# ============================================================
# Test 7: Full HPKE Round-trip with Ratchet
# ============================================================
print("\nTest 7: Full HPKE Round-trip with Ratchet")

# Generate key pair
sender_sk = X25519PrivateKey.generate()
sender_pk = sender_sk.public_key()

receiver_sk = X25519PrivateKey.generate()
receiver_pk = receiver_sk.public_key()

# Simulate message exchange
messages = ["First message", "Second message", "Third message"]
exchange_log = []

# Sender encrypts
for seq, msg in enumerate(messages):
    enc, ct = hpke_seal(receiver_pk, msg.encode(), aad=b"session", info=b"")
    decrypted = hpke_open(receiver_sk, enc, ct, aad=b"session", info=b"")
    
    exchange_log.append({
        "seq": seq,
        "plaintext": msg,
        "enc_hex": enc.hex(),
        "ciphertext_hex": ct.hex(),
        "decrypted": decrypted.decode()
    })
    
    print(f"  seq={seq}: '{msg}' -> encrypted -> decrypted OK")

test_vector_7 = {
    "description": "Full HPKE round-trip with multiple messages",
    "sender_public_key_hex": sender_pk.public_bytes_raw().hex(),
    "receiver_public_key_hex": receiver_pk.public_bytes_raw().hex(),
    "aad": "session",
    "info": "",
    "exchange_log": exchange_log
}

with open(OUTPUT_DIR / "hpke_test_3_roundtrip.json", "w") as f:
    json.dump(test_vector_7, f, indent=2)

print(f"  Saved to: {OUTPUT_DIR / 'hpke_test_3_roundtrip.json'}")

print("\n" + "=" * 60)
print(f"All test vectors saved to: {OUTPUT_DIR}")
print("=" * 60)

# Print summary
print("\nGenerated test vectors:")
for f in sorted(OUTPUT_DIR.glob("*.json")):
    if f.name.startswith("hpke_") or f.name.startswith("ratchet_"):
        print(f"  - {f.name}")
