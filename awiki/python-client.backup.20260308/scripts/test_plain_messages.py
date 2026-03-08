#!/usr/bin/env python3
"""
Test plain text message sending between identities.
"""

import json
import asyncio
from pathlib import Path
import httpx

print("=" * 80)
print("Python: Plain Text Message Test")
print("=" * 80)

# Load credentials
cred_dir = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message"

# Use bearertest (fresh JWT) and pythonagent
sender_cred_path = cred_dir / "bearertest.json"
receiver_cred_path = cred_dir / "pythonagent.json"

sender_cred = json.loads(sender_cred_path.read_text())
receiver_cred = json.loads(receiver_cred_path.read_text())

sender_did = sender_cred["did"]
sender_jwt = sender_cred["jwt_token"]
receiver_did = receiver_cred["did"]

print(f"\nSender: {sender_did}")
print(f"Receiver: {receiver_did}")
print(f"Sender JWT: {sender_jwt[:50]}...")

async def send_message(sender_jwt, sender_did, receiver_did, content):
    """Send a plain text message."""
    request_body = {
        "jsonrpc": "2.0",
        "method": "send",
        "params": {
            "sender_did": sender_did,
            "receiver_did": receiver_did,
            "content": content,
            "type": "text"
        },
        "id": 1
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://awiki.ai/message/rpc",
            json=request_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {sender_jwt}"
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
    # Test 1: Send message from bearertest to pythonagent
    print("\n" + "-" * 80)
    print("Test 1: Send message (bearertest -> pythonagent)")
    print("-" * 80)
    
    message_content = f"Hello from bearertest! This is a plain text message test."
    print(f"Message: {message_content}")
    
    send_result = await send_message(sender_jwt, sender_did, receiver_did, message_content)
    
    if send_result.get("result"):
        print("Send: SUCCESS")
        print(f"Message ID: {send_result['result'].get('id', 'N/A')}")
        print(f"Server Seq: {send_result['result'].get('server_seq', 'N/A')}")
    else:
        print("Send: FAILED")
        print(f"Error: {send_result.get('error', {}).get('message', 'Unknown error')}")
        return
    
    # Wait for message to be delivered
    await asyncio.sleep(1)
    
    # Test 2: Get inbox for receiver
    print("\n" + "-" * 80)
    print("Test 2: Get inbox (pythonagent)")
    print("-" * 80)
    
    inbox_result = await get_inbox(receiver_cred["jwt_token"], receiver_did)
    
    if inbox_result.get("result"):
        print("Get Inbox: SUCCESS")
        messages = inbox_result["result"].get("messages", [])
        print(f"Total messages: {len(messages)}")
        
        if messages:
            print("\nLatest messages:")
            for msg in messages[:5]:
                print(f"  [{msg.get('type', 'N/A')}] From: {msg.get('sender_did', 'N/A')[:30]}...")
                print(f"    Content: {msg.get('content', 'N/A')[:50]}...")
                print(f"    Server Seq: {msg.get('server_seq', 'N/A')}")
                
                # Check if our message is in the inbox
                if msg.get('content') == message_content:
                    print("\n  ✓ Our test message found in inbox!")
        else:
            print("No messages in inbox")
    else:
        print("Get Inbox: FAILED")
        print(f"Error: {inbox_result.get('error', {}).get('message', 'Unknown error')}")
    
    # Test 3: Send message back (pythonagent -> bearertest)
    print("\n" + "-" * 80)
    print("Test 3: Send reply (pythonagent -> bearertest)")
    print("-" * 80)
    
    reply_content = f"Reply from pythonagent! Received your message."
    print(f"Message: {reply_content}")
    
    reply_result = await send_message(receiver_cred["jwt_token"], receiver_did, sender_did, reply_content)
    
    if reply_result.get("result"):
        print("Send Reply: SUCCESS")
        print(f"Message ID: {reply_result['result'].get('id', 'N/A')}")
    else:
        print("Send Reply: FAILED")
        print(f"Error: {reply_result.get('error', {}).get('message', 'Unknown error')}")
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print("Plain text message test completed.")
    print("Check the output above for details.")

asyncio.run(main())
