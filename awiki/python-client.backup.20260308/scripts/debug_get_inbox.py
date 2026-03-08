#!/usr/bin/env python3
"""
Debug get_inbox interface.
"""

import json
import asyncio
from pathlib import Path
import httpx

print("=" * 80)
print("Debug: get_inbox Interface")
print("=" * 80)

# Load credential
cred_dir = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message"
cred_path = cred_dir / "bearertest.json"
cred = json.loads(cred_path.read_text())

did = cred["did"]
jwt = cred["jwt_token"]

print(f"\nDID: {did}")
print(f"JWT: {jwt[:50]}...")

async def test_get_inbox():
    """Test get_inbox with different parameters."""
    
    # Test 1: Standard get_inbox
    print("\n" + "-" * 80)
    print("Test 1: Standard get_inbox")
    print("-" * 80)
    
    request_body = {
        "jsonrpc": "2.0",
        "method": "get_inbox",
        "params": {
            "user_did": did,
            "limit": 10
        },
        "id": 1
    }
    
    print(f"Request: {json.dumps(request_body, indent=2)}")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://awiki.ai/message/rpc",
            json=request_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {jwt}"
            }
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print(f"\nResponse Body:")
        print(json.dumps(response.json(), indent=2))
    
    # Test 2: get_inbox without user_did (let server infer from JWT)
    print("\n" + "-" * 80)
    print("Test 2: get_inbox without user_did")
    print("-" * 80)
    
    request_body = {
        "jsonrpc": "2.0",
        "method": "get_inbox",
        "params": {
            "limit": 10
        },
        "id": 1
    }
    
    print(f"Request: {json.dumps(request_body, indent=2)}")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://awiki.ai/message/rpc",
            json=request_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {jwt}"
            }
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"\nResponse Body:")
        print(json.dumps(response.json(), indent=2))
    
    # Test 3: get_inbox with minimal params
    print("\n" + "-" * 80)
    print("Test 3: get_inbox with empty params")
    print("-" * 80)
    
    request_body = {
        "jsonrpc": "2.0",
        "method": "get_inbox",
        "params": {},
        "id": 1
    }
    
    print(f"Request: {json.dumps(request_body, indent=2)}")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://awiki.ai/message/rpc",
            json=request_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {jwt}"
            }
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"\nResponse Body:")
        print(json.dumps(response.json(), indent=2))
    
    # Test 4: get_me (to verify JWT is valid)
    print("\n" + "-" * 80)
    print("Test 4: get_me (verify JWT)")
    print("-" * 80)
    
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
                "Authorization": f"Bearer {jwt}"
            }
        )
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"\nResponse Body:")
        print(json.dumps(response.json(), indent=2))

asyncio.run(test_get_inbox())

print("\n" + "=" * 80)
