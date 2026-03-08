#!/usr/bin/env python3
"""
Test JWT verification with multiple fresh DIDs to check if repeated verification causes issues.
"""

import json
import asyncio
import hashlib
import base64
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
import jcs
import httpx
import secrets
from datetime import datetime, timezone

print("=" * 80)
print("Test: Multiple Fresh DIDs JWT Verification")
print("=" * 80)

async def test_did_verification(test_name):
    """Create a fresh DID, register it, then test JWT verification."""
    print(f"\n{'='*80}")
    print(f"[{test_name}]")
    print('-' * 80)
    
    # Generate fresh key pair
    private_key = ec.generate_private_key(ec.SECP256K1())
    public_key = public_key = private_key.public_key()
    
    # Get key bytes
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    # Calculate fingerprint for DID
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
    compressed = public_key.public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    fingerprint = hashlib.sha256(compressed).digest()
    fingerprint_b64 = base64.urlsafe_b64encode(fingerprint).rstrip(b'=').decode('ascii')
    
    did = f"did:wba:awiki.ai:user:k1_{fingerprint_b64}"
    print(f"DID: {did}")
    
    # Build DID document
    numbers = public_key.public_numbers()
    x = numbers.x.to_bytes(32, 'big')
    y = numbers.y.to_bytes(32, 'big')
    x_b64 = base64.urlsafe_b64encode(x).rstrip(b'=').decode('ascii')
    y_b64 = base64.urlsafe_b64encode(y).rstrip(b'=').decode('ascii')
    
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
            "publicKeyJwk": {
                "kty": "EC",
                "crv": "secp256k1",
                "x": x_b64,
                "y": y_b64
            }
        }],
        "authentication": [f"{did}#key-1"]
    }
    
    # STEP 1: Register the DID
    print(f"\nStep 1: Register DID...")
    
    register_body = {
        "jsonrpc": "2.0",
        "method": "register",
        "params": {
            "did_document": did_document,
            "name": f"TestUser_{test_name.replace(' ', '_')}",
            "is_agent": False
        },
        "id": 1
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        reg_response = await client.post(
            "https://awiki.ai/user-service/did-auth/rpc",
            json=register_body,
            headers={"Content-Type": "application/json"}
        )
        
        reg_result = reg_response.json()
        
        if reg_result.get("result"):
            print(f"Registration: SUCCESS")
            print(f"User ID: {reg_result['result'].get('user_id', 'N/A')}")
        else:
            reg_error = reg_result.get("error", {})
            print(f"Registration: FAILED")
            print(f"Error: {reg_error.get('message', 'Unknown error')}")
            return False
    
    # STEP 2: Verify and get JWT
    print(f"\nStep 2: Verify and get JWT...")
    
    # Generate auth data
    nonce = secrets.token_hex(16)
    timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    
    auth_data = {
        "nonce": nonce,
        "timestamp": timestamp,
        "aud": "awiki.ai",
        "did": did
    }
    
    # JCS canonicalize
    canonical_json = jcs.canonicalize(auth_data)
    
    # SHA-256 hash
    content_hash = hashlib.sha256(canonical_json).digest()
    
    # Sign
    der_signature = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))
    signature_b64url = base64.urlsafe_b64encode(der_signature).rstrip(b'=').decode('ascii')
    
    # Build auth header
    auth_header = f'DIDWba v="1.1", did="{did}", nonce="{nonce}", timestamp="{timestamp}", verification_method="key-1", signature="{signature_b64url}"'
    
    print(f"Timestamp: {timestamp}")
    print(f"Signature: {signature_b64url[:50]}...")
    
    # Send verify request
    request_body = {
        "jsonrpc": "2.0",
        "method": "verify",
        "params": {
            "authorization": auth_header,
            "domain": "awiki.ai"
        },
        "id": 1
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://awiki.ai/user-service/did-auth/rpc",
            json=request_body,
            headers={"Content-Type": "application/json"}
        )
        
        result = response.json()
        
        if result.get("result"):
            print(f"Result: SUCCESS")
            print(f"JWT Token: {result['result'].get('access_token', '')[:50]}...")
            return True
        else:
            error = result.get("error", {})
            print(f"Result: FAILED")
            print(f"Error: {error.get('message', 'Unknown error')}")
            return False

async def main():
    results = []
    
    # Test with 3 different fresh DIDs
    for i in range(1, 4):
        success = await test_did_verification(f"Test {i}/3 - Fresh DID")
        results.append(success)
        
        # Wait between tests
        if i < 3:
            print(f"\nWaiting 2 seconds before next test...")
            await asyncio.sleep(2)
    
    # Summary
    print(f"\n{'='*80}")
    print("SUMMARY")
    print('='*80)
    
    for i, success in enumerate(results, 1):
        status = "SUCCESS" if success else "FAILED"
        print(f"Test {i}: {status}")
    
    success_count = sum(results)
    print(f"\nTotal: {success_count}/{len(results)} successful")
    
    if success_count == 0:
        print("\nWARNING: All tests failed - Issue is NOT related to repeated DID verification")
    elif success_count > 0:
        print(f"\nSome tests succeeded - Need further investigation")

asyncio.run(main())
