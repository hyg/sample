#!/usr/bin/env python3
"""
Test complete message flow: send and receive with same identity.
"""

import json
import asyncio
from pathlib import Path
import httpx

print("=" * 80)
print("Python: Complete Message Flow Test (Self-Send)")
print("=" * 80)

# Load credential
cred_dir = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message"
cred_path = cred_dir / "bearertest.json"
cred = json.loads(cred_path.read_text())

did = cred["did"]
jwt = cred["jwt_token"]

print(f"\nIdentity: {did}")
print(f"JWT: {jwt[:50]}...")

async def send_message(jwt, sender_did, receiver_did, content, msg_type="text"):
    """Send a message."""
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

async def main():
    # Test 1: Send message to self
    print("\n" + "-" * 80)
    print("Test 1: Send message to self")
    print("-" * 80)
    
    test_message = f"Self-test message at {asyncio.get_event_loop().time()}"
    print(f"Message: {test_message}")
    
    send_result = await send_message(jwt, did, did, test_message)
    
    if send_result.get("result"):
        print("Send: SUCCESS")
        print(f"Message ID: {send_result['result'].get('id', 'N/A')}")
        print(f"Server Seq: {send_result['result'].get('server_seq', 'N/A')}")
    else:
        print("Send: FAILED")
        print(f"Error: {send_result.get('error', {}).get('message', 'Unknown error')}")
        return
    
    # Wait for message delivery
    await asyncio.sleep(2)
    
    # Test 2: Get inbox
    print("\n" + "-" * 80)
    print("Test 2: Get inbox")
    print("-" * 80)
    
    inbox_result = await get_inbox(jwt, did)
    
    if inbox_result.get("result"):
        print("Get Inbox: SUCCESS")
        messages = inbox_result["result"].get("messages", [])
        print(f"Total messages: {len(messages)}")
        
        # Find our test message
        test_msg = None
        for msg in messages:
            if test_message in msg.get("content", ""):
                test_msg = msg
                break
        
        if test_msg:
            print("\n[PASS] Test message found in inbox!")
            print(f"  ID: {test_msg.get('id', 'N/A')}")
            print(f"  Type: {test_msg.get('type', 'N/A')}")
            print(f"  From: {test_msg.get('sender_did', 'N/A')}")
            print(f"  To: {test_msg.get('receiver_did', 'N/A')}")
            print(f"  Content: {test_msg.get('content', 'N/A')}")
            print(f"  Server Seq: {test_msg.get('server_seq', 'N/A')}")
            print(f"  Is Read: {test_msg.get('is_read', 'N/A')}")
            print(f"  Created: {test_msg.get('created_at', 'N/A')}")
        else:
            print("\n✗ Test message not found in inbox")
            print("Latest messages:")
            for msg in messages[:5]:
                print(f"  [{msg.get('type', 'N/A')}] {msg.get('content', 'N/A')[:60]}...")
    else:
        print("Get Inbox: FAILED")
        print(f"Error: {inbox_result.get('error', {}).get('message', 'Unknown error')}")
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    if send_result.get("result") and inbox_result.get("result"):
        print("[PASS] Complete message flow test PASSED")
        print("  - Message sent successfully")
        print("  - Message received successfully")
    else:
        print("[FAIL] Complete message flow test FAILED")
        if not send_result.get("result"):
            print("  - Send failed")
        if not inbox_result.get("result"):
            print("  - Receive failed")

asyncio.run(main())
