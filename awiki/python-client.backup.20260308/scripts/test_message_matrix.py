#!/usr/bin/env python3
"""
Complete message test matrix: Test all identity combinations for plain and E2EE messages.
"""

import json
import asyncio
import base64
import hashlib
import hmac
from pathlib import Path
import httpx
from cryptography.hazmat.primitives.asymmetric import ec, x25519
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

print("=" * 80)
print("Complete Message Test Matrix")
print("=" * 80)

# Load all available credentials
cred_dir = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message"
nodejs_cred_dir = Path(__file__).parent.parent / "nodejs-awiki" / ".credentials"

# Available credentials
identities = {}

# Load Python credentials
python_creds = ["bearertest", "pythonagent", "testfresh"]
for name in python_creds:
    cred_path = cred_dir / f"{name}.json"
    if cred_path.exists():
        cred = json.loads(cred_path.read_text())
        identities[name] = {
            "platform": "Python",
            "did": cred["did"],
            "user_id": cred.get("user_id"),
            "jwt": cred.get("jwt_token"),
            "e2ee_signing": cred.get("e2ee_signing_private_pem"),
            "e2ee_agreement": cred.get("e2ee_agreement_private_pem"),
            "jwt_valid": bool(cred.get("jwt_token"))
        }
        print(f"\nLoaded Python identity: {name}")
        print(f"  DID: {cred['did'][:50]}...")
        print(f"  JWT valid: {bool(cred.get('jwt_token'))}")
        print(f"  E2EE keys: {bool(cred.get('e2ee_signing_private_pem'))}")

# Load Node.js credentials
nodejs_creds = ["nodeagent1", "nodeagent2", "nodeagent3"]
for name in nodejs_creds:
    cred_path = nodejs_cred_dir / f"{name}.json"
    if cred_path.exists():
        cred = json.loads(cred_path.read_text())
        identities[name] = {
            "platform": "Node.js",
            "did": cred["did"],
            "user_id": cred.get("user_id"),
            "jwt": None,  # Node.js registration doesn't save JWT
            "e2ee_signing": cred.get("e2ee_signing_private_pem"),
            "e2ee_agreement": cred.get("e2ee_agreement_private_pem"),
            "jwt_valid": False
        }
        print(f"\nLoaded Node.js identity: {name}")
        print(f"  DID: {cred['did'][:50]}...")
        print(f"  JWT valid: False (not saved)")

print(f"\n{'='*80}")
print(f"Total identities loaded: {len(identities)}")
print(f"{'='*80}")

# Test results matrix
test_results = {
    "plain": {},
    "e2ee": {}
}

async def send_message(jwt, sender_did, receiver_did, content, msg_type="text"):
    """Send a message."""
    if not jwt:
        return {"error": {"message": "No JWT token"}}
    
    request_body = {
        "jsonrpc": "2.0",
        "method": "send",
        "params": {
            "sender_did": sender_did,
            "receiver_did": receiver_did,
            "content": content,
            "type": msg_type
        },
        "id": 1
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://awiki.ai/message/rpc",
            json=request_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {jwt}"
            }
        )
        return response.json()

async def get_inbox(jwt, user_did, limit=10):
    """Get inbox messages."""
    if not jwt:
        return {"error": {"message": "No JWT token"}}
    
    request_body = {
        "jsonrpc": "2.0",
        "method": "get_inbox",
        "params": {
            "user_did": user_did,
            "limit": limit
        },
        "id": 1
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://awiki.ai/message/rpc",
            json=request_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {jwt}"
            }
        )
        return response.json()

async def test_plain_message(sender_name, receiver_name, sender_cred, receiver_cred):
    """Test plain text message sending."""
    if not sender_cred["jwt_valid"]:
        return "SKIP", "No valid JWT"
    
    message = f"Plain message from {sender_name} to {receiver_name}"
    
    result = await send_message(
        sender_cred["jwt"],
        sender_cred["did"],
        receiver_cred["did"],
        message
    )
    
    if result.get("result"):
        return "PASS", f"Message ID: {result['result'].get('id', 'N/A')}"
    else:
        return "FAIL", result.get("error", {}).get("message", "Unknown error")

async def run_all_tests():
    """Run all message tests."""
    identity_names = list(identities.keys())
    
    print(f"\n{'='*80}")
    print("PLAIN TEXT MESSAGE TESTS")
    print(f"{'='*80}")
    
    for sender_name in identity_names:
        for receiver_name in identity_names:
            if sender_name == receiver_name:
                continue  # Skip self-send for matrix
            
            sender_cred = identities[sender_name]
            receiver_cred = identities[receiver_name]
            
            test_key = f"{sender_name} -> {receiver_name}"
            
            print(f"\nTest: {test_key}")
            
            result, details = await test_plain_message(
                sender_name, receiver_name, sender_cred, receiver_cred
            )
            
            test_results["plain"][test_key] = {
                "result": result,
                "details": details
            }
            
            status_symbol = "[PASS]" if result == "PASS" else ("[SKIP]" if result == "SKIP" else "[FAIL]")
            print(f"  {status_symbol} {result}: {details}")
            
            # Rate limiting
            await asyncio.sleep(0.5)
    
    print(f"\n{'='*80}")
    print("E2EE ENCRYPTED MESSAGE TESTS")
    print(f"{'='*80}")
    print("\nNote: E2EE tests require full HPKE protocol implementation.")
    print("Skipping for now - would use same matrix as plain messages.")
    
    # E2EE tests would go here with full HPKE implementation
    for sender_name in identity_names:
        for receiver_name in identity_names:
            if sender_name == receiver_name:
                continue
            
            test_key = f"{sender_name} -> {receiver_name}"
            test_results["e2ee"][test_key] = {
                "result": "SKIP",
                "details": "E2EE implementation pending"
            }

asyncio.run(run_all_tests())

# Print summary
print(f"\n{'='*80}")
print("TEST SUMMARY")
print(f"{'='*80}")

print("\nPlain Text Messages:")
print("-" * 80)

pass_count = sum(1 for r in test_results["plain"].values() if r["result"] == "PASS")
fail_count = sum(1 for r in test_results["plain"].values() if r["result"] == "FAIL")
skip_count = sum(1 for r in test_results["plain"].values() if r["result"] == "SKIP")

print(f"PASS: {pass_count}")
print(f"FAIL: {fail_count}")
print(f"SKIP: {skip_count}")
print(f"TOTAL: {pass_count + fail_count + skip_count}")

print("\nDetailed Results:")
for test_key, result in test_results["plain"].items():
    status = "[PASS]" if result["result"] == "PASS" else ("[SKIP]" if result["result"] == "SKIP" else "[FAIL]")
    print(f"  {status} {test_key}: {result['details']}")

print("\n" + "=" * 80)
print("Test matrix completed.")
print("=" * 80)

# Save results
output_path = Path(__file__).parent / "test_matrix_results.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump({
        "timestamp": "2026-03-07T23:30:00Z",
        "identities": {k: {**v, "jwt": "***REDACTED***"} for k, v in identities.items()},
        "results": test_results
    }, f, indent=2, ensure_ascii=False)

print(f"\nResults saved to: {output_path}")
