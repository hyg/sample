#!/usr/bin/env python3
"""
Test the three hypotheses for JWT verification failure.
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
print("Test: Three Hypotheses for JWT Verification Failure")
print("=" * 80)

async def test_hypothesis_1():
    """
    Hypothesis 1: Authentication Mode Switch
    After registration, server expects Bearer JWT, not DID WBA signature.
    
    Test: Register a fresh DID, immediately use the returned JWT for subsequent requests.
    """
    print(f"\n{'='*80}")
    print("[Hypothesis 1: Authentication Mode Switch]")
    print('-' * 80)
    
    # Generate fresh key pair
    private_key = ec.generate_private_key(ec.SECP256K1())
    public_key = private_key.public_key()
    
    # Calculate fingerprint for DID
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
    compressed = public_key.public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    fingerprint = hashlib.sha256(compressed).digest()
    fingerprint_b64 = base64.urlsafe_b64encode(fingerprint).rstrip(b'=').decode('ascii')
    
    did = f"did:wba:awiki.ai:user:k1_{fingerprint_b64}"
    print(f"DID: {did}")
    
    # Build DID document with proof (using ANP library would be ideal, but simplified here)
    # For this test, we'll use the existing pythonagent credential
    
    # Actually, let's use the existing registered credential
    cred_path = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message" / "testfresh.json"
    if not cred_path.exists():
        print("Skipping: testfresh credential not found")
        return None
    
    cred = json.loads(cred_path.read_text())
    did = cred['did']
    jwt_token = cred.get('jwt_token')
    
    print(f"Testing with existing credential: {did}")
    print(f"Has JWT token: {bool(jwt_token)}")
    
    if not jwt_token:
        print("Skipping: No JWT token in credential")
        return None
    
    # Test: Use Bearer JWT for authentication instead of DID WBA
    print("\nTest: Using Bearer JWT for authentication...")
    
    request_body = {
        "jsonrpc": "2.0",
        "method": "get_me",  # Try a simple method
        "params": {},
        "id": 1
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://awiki.ai/user-service/did-auth/rpc",
            json=request_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {jwt_token}"
            }
        )
        
        result = response.json()
        
        if result.get("result"):
            print(f"Result: SUCCESS with Bearer JWT")
            print(f"Response: {json.dumps(result['result'], indent=2)}")
            return True
        else:
            error = result.get("error", {})
            print(f"Result: FAILED")
            print(f"Error: {error.get('message', 'Unknown error')}")
            return False

async def test_hypothesis_2():
    """
    Hypothesis 2: Replay Prevention Mechanism
    Server rejects repeated nonces or timestamps outside narrow window.
    
    Test: Send multiple requests with DIFFERENT nonces and fresh timestamps.
    """
    print(f"\n{'='*80}")
    print("[Hypothesis 2: Replay Prevention Mechanism]")
    print('-' * 80)
    
    # Load credential
    cred_path = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message" / "testfresh.json"
    if not cred_path.exists():
        print("Skipping: testfresh credential not found")
        return None
    
    cred = json.loads(cred_path.read_text())
    did = cred['did']
    private_key = serialization.load_pem_private_key(cred["private_key_pem"].encode("utf-8"), password=None)
    
    print(f"Testing with: {did}")
    
    # Test 3 times with DIFFERENT nonces and fresh timestamps
    results = []
    for i in range(3):
        print(f"\nAttempt {i+1}/3...")
        
        # Generate FRESH nonce and timestamp
        nonce = secrets.token_hex(16)
        timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        
        auth_data = {
            "nonce": nonce,
            "timestamp": timestamp,
            "aud": "awiki.ai",
            "did": did
        }
        
        canonical_json = jcs.canonicalize(auth_data)
        content_hash = hashlib.sha256(canonical_json).digest()
        der_signature = private_key.sign(content_hash, ec.ECDSA(hashes.SHA256()))
        signature_b64url = base64.urlsafe_b64encode(der_signature).rstrip(b'=').decode('ascii')
        
        auth_header = f'DIDWba v="1.1", did="{did}", nonce="{nonce}", timestamp="{timestamp}", verification_method="key-1", signature="{signature_b64url}"'
        
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
                print(f"  Result: SUCCESS")
                results.append(True)
            else:
                error = result.get("error", {})
                error_msg = error.get('message', 'Unknown error')
                print(f"  Result: FAILED - {error_msg}")
                results.append(False)
        
        # Wait 1 second between attempts
        if i < 2:
            await asyncio.sleep(1)
    
    success_count = sum(results)
    print(f"\nSummary: {success_count}/3 successful")
    
    if success_count > 0:
        print("Hypothesis 2 PARTIALLY CONFIRMED: Some attempts succeeded with fresh nonces")
        return True
    else:
        print("Hypothesis 2 NOT CONFIRMED: All attempts failed even with fresh nonces")
        return False

async def test_hypothesis_3():
    """
    Hypothesis 3: Credential State/Permission Issue
    Server may require DID activation or permission sync after registration.
    
    Test: Check if there's an activation endpoint or status endpoint.
    """
    print(f"\n{'='*80}")
    print("[Hypothesis 3: Credential State/Permission Issue]")
    print('-' * 80)
    
    # Load credential
    cred_path = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message" / "testfresh.json"
    if not cred_path.exists():
        print("Skipping: testfresh credential not found")
        return None
    
    cred = json.loads(cred_path.read_text())
    did = cred['did']
    user_id = cred.get('user_id')
    jwt_token = cred.get('jwt_token')
    
    print(f"DID: {did}")
    print(f"User ID: {user_id}")
    print(f"Has JWT: {bool(jwt_token)}")
    
    # Try to get user info using JWT
    if jwt_token:
        print("\nTest: Getting user info with JWT...")
        
        request_body = {
            "jsonrpc": "2.0",
            "method": "get_me",
            "params": {},
            "id": 1
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://awiki.ai/user-service/did-auth/rpc",
                json=request_body,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {jwt_token}"
                }
            )
            
            result = response.json()
            
            if result.get("result"):
                print(f"Result: SUCCESS")
                user_info = result['result']
                print(f"User info: {json.dumps(user_info, indent=2)}")
                
                # Check if user is "active" or has any status field
                if isinstance(user_info, dict):
                    status_fields = [k for k in user_info.keys() if 'status' in k.lower() or 'active' in k.lower()]
                    if status_fields:
                        print(f"Status fields found: {status_fields}")
                        for field in status_fields:
                            print(f"  {field}: {user_info[field]}")
                return True
            else:
                error = result.get("error", {})
                print(f"Result: FAILED - {error.get('message', 'Unknown error')}")
                return False
    else:
        print("Skipping: No JWT token available")
        return None

async def main():
    print("\nStarting hypothesis tests...\n")
    
    # Test each hypothesis
    h1_result = await test_hypothesis_1()
    h2_result = await test_hypothesis_2()
    h3_result = await test_hypothesis_3()
    
    # Summary
    print(f"\n{'='*80}")
    print("SUMMARY")
    print('='*80)
    
    print(f"\nHypothesis 1 (Auth Mode Switch):")
    if h1_result is True:
        print("  Status: CONFIRMED - Bearer JWT works for subsequent requests")
    elif h1_result is False:
        print("  Status: NOT CONFIRMED - Bearer JWT also failed")
    else:
        print("  Status: SKIPPED - Could not test")
    
    print(f"\nHypothesis 2 (Replay Prevention):")
    if h2_result is True:
        print("  Status: PARTIALLY CONFIRMED - Some requests succeeded with fresh nonces")
    else:
        print("  Status: NOT CONFIRMED - All requests failed even with fresh nonces")
    
    print(f"\nHypothesis 3 (Credential State):")
    if h3_result is True:
        print("  Status: PARTIALLY CONFIRMED - JWT authentication works for get_me")
    elif h3_result is False:
        print("  Status: NOT CONFIRMED - JWT authentication failed")
    else:
        print("  Status: SKIPPED - Could not test")
    
    print(f"\n{'='*80}")
    print("CONCLUSION")
    print('='*80)
    
    if h1_result is True:
        print("\nMost likely cause: Authentication Mode Switch")
        print("After registration, use Bearer JWT for subsequent requests, not DID WBA signature.")
    elif h2_result is True:
        print("\nMost likely cause: Replay Prevention with strict nonce/timestamp requirements")
    elif h3_result is True:
        print("\nMost likely cause: Credential State issue - JWT works but DID WBA signature doesn't")
    else:
        print("\nUnable to determine root cause. All hypotheses returned negative results.")
        print("May need to contact awiki.ai support for clarification.")

asyncio.run(main())
