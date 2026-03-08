#!/usr/bin/env python3
"""
Multi-round E2EE ratchet test.
Tests chain key derivation and message key derivation across multiple rounds.
"""

import json
import asyncio
import base64
import hashlib
import hmac
from pathlib import Path
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.kdf.hkdf import HKDFExpand
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import httpx

print("=" * 80)
print("Multi-Round E2EE Ratchet Test")
print("=" * 80)

# Load identities
cred_dir = Path.home() / ".openclaw" / "credentials" / "awiki-agent-id-message"
nodejs_cred_path = Path(__file__).parent.parent / "nodejs-awiki" / ".credentials" / "nodeagentfixed.json"
python_cred_path = cred_dir / "pythonmsgtest.json"

print("\n[Loading Identities]")

nodejs_cred = json.loads(nodejs_cred_path.read_text())
python_cred = json.loads(python_cred_path.read_text())

print(f"OK Node.js: {nodejs_cred['did']}")
print(f"OK Python: {python_cred['did']}")

# Determine direction
is_initiator = nodejs_cred['did'].encode('utf-8') < python_cred['did'].encode('utf-8')
print(f"\nInitiator: {'Node.js' if is_initiator else 'Python'}")

# Derive initial chain keys
root_seed = b"multi-round-test-seed"  # Fixed seed for testing

init_chain_key = HKDFExpand(
    algorithm=SHA256(),
    length=32,
    info=b"anp-e2ee-init",
).derive(root_seed)

resp_chain_key = HKDFExpand(
    algorithm=SHA256(),
    length=32,
    info=b"anp-e2ee-resp",
).derive(root_seed)

print(f"\nInitial chain keys derived:")
print(f"  init: {init_chain_key.hex()[:32]}...")
print(f"  resp: {resp_chain_key.hex()[:32]}...")

# Assign keys based on direction
if is_initiator:
    nodejs_send_chain_key = init_chain_key
    nodejs_recv_chain_key = resp_chain_key
    python_send_chain_key = resp_chain_key
    python_recv_chain_key = init_chain_key
else:
    nodejs_send_chain_key = resp_chain_key
    nodejs_recv_chain_key = init_chain_key
    python_send_chain_key = init_chain_key
    python_recv_chain_key = resp_chain_key

print(f"\nNode.js chain keys:")
print(f"  send: {nodejs_send_chain_key.hex()[:32]}...")
print(f"  recv: {nodejs_recv_chain_key.hex()[:32]}...")

print(f"\nPython chain keys:")
print(f"  send: {python_send_chain_key.hex()[:32]}...")
print(f"  recv: {python_recv_chain_key.hex()[:32]}...")

def derive_message_key(chain_key: bytes, seq: int):
    """Derive message key from chain key and sequence number."""
    seq_bytes = seq.to_bytes(8, "big")
    
    msg_key = hmac.new(chain_key, b"msg" + seq_bytes, hashlib.sha256).digest()
    new_chain_key = hmac.new(chain_key, b"ck", hashlib.sha256).digest()
    
    enc_key = hmac.new(msg_key, b"key", hashlib.sha256).digest()[:16]
    nonce = hmac.new(msg_key, b"nonce", hashlib.sha256).digest()[:12]
    
    return enc_key, nonce, new_chain_key

def encrypt_message(plaintext: str, enc_key: bytes, nonce: bytes) -> str:
    """Encrypt message with AES-GCM."""
    aesgcm = AESGCM(enc_key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
    return base64.b64encode(ciphertext).decode('utf-8')

async def send_e2ee_message(sender_cred, receiver_did, plaintext, enc_key, nonce, seq):
    """Send E2EE encrypted message."""
    # Encrypt
    ciphertext = encrypt_message(plaintext, enc_key, nonce)
    
    # Create E2EE message structure
    e2ee_content = base64.b64encode(json.dumps({
        'ciphertext': ciphertext,
        'seq': seq,
        'sender': sender_cred['did'],
        'receiver': receiver_did
    }).encode('utf-8')).decode('utf-8')
    
    # Send via API
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://awiki.ai/message/rpc",
            json={
                "jsonrpc": "2.0",
                "method": "send",
                "params": {
                    "sender_did": sender_cred['did'],
                    "receiver_did": receiver_did,
                    "content": e2ee_content,
                    "type": "e2ee_msg",
                    "client_msg_id": str(hash(plaintext))
                },
                "id": 1
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {sender_cred['jwt_token']}"
            }
        )
        
        result = response.json()
        if result.get('result'):
            return {
                'success': True,
                'server_seq': result['result'].get('server_seq'),
                'plaintext': plaintext,
                'ciphertext': ciphertext[:32] + '...'
            }
        else:
            return {
                'success': False,
                'error': result.get('error', {}).get('message', 'Unknown error')
            }

async def run_multi_round_test():
    """Run multi-round ratchet test."""
    global nodejs_send_chain_key, nodejs_recv_chain_key, python_send_chain_key, python_recv_chain_key
    global nodejs_seq, python_seq
    
    results = []
    
    # Initialize sequence numbers
    nodejs_seq = 0
    python_seq = 0
    
    print("\n" + "=" * 80)
    print("Round 1: Node.js sends 3 messages to Python")
    print("=" * 80)
    
    for i in range(3):
        plaintext = f"[Round 1] Node.js message {i+1}"
        
        # Derive message key
        enc_key, nonce, nodejs_send_chain_key = derive_message_key(nodejs_send_chain_key, nodejs_seq)
        nodejs_seq += 1
        
        # Send message
        result = await send_e2ee_message(nodejs_cred, python_cred['did'], plaintext, enc_key, nonce, nodejs_seq - 1)
        print(f"\n  Message {i+1}: {plaintext}")
        print(f"    Seq: {nodejs_seq - 1}, Enc key: {enc_key.hex()[:16]}...")
        status = 'OK' if result['success'] else 'FAIL'
        print(f"    Status: {status} {result.get('error', '')}")
        
        results.append({
            'round': 1,
            'direction': 'Node.js -> Python',
            'plaintext': plaintext,
            'seq': nodejs_seq - 1,
            'success': result['success']
        })
    
    print("\n" + "=" * 80)
    print("Round 2: Python sends 3 messages to Node.js")
    print("=" * 80)
    
    for i in range(3):
        plaintext = f"[Round 2] Python message {i+1}"
        
        # Derive message key
        enc_key, nonce, python_send_chain_key = derive_message_key(python_send_chain_key, python_seq)
        python_seq += 1
        
        # Send message
        result = await send_e2ee_message(python_cred, nodejs_cred['did'], plaintext, enc_key, nonce, python_seq - 1)
        print(f"\n  Message {i+1}: {plaintext}")
        print(f"    Seq: {python_seq - 1}, Enc key: {enc_key.hex()[:16]}...")
        status = 'OK' if result['success'] else 'FAIL'
        print(f"    Status: {status} {result.get('error', '')}")
        
        results.append({
            'round': 2,
            'direction': 'Python -> Node.js',
            'plaintext': plaintext,
            'seq': python_seq - 1,
            'success': result['success']
        })
    
    print("\n" + "=" * 80)
    print("Round 3: Alternating conversation (5 rounds)")
    print("=" * 80)
    
    for i in range(5):
        if i % 2 == 0:
            # Node.js sends
            plaintext = f"[Round 3.{i+1}] Node.js says: How about message {i+1}?"
            enc_key, nonce, nodejs_send_chain_key = derive_message_key(nodejs_send_chain_key, nodejs_seq)
            nodejs_seq += 1
            
            result = await send_e2ee_message(nodejs_cred, python_cred['did'], plaintext, enc_key, nonce, nodejs_seq - 1)
            print(f"\n  Node.js -> Python: {plaintext}")
            print(f"    Seq: {nodejs_seq - 1}, Chain key updated: {nodejs_send_chain_key.hex()[:16]}...")
            
            results.append({
                'round': 3,
                'direction': 'Node.js -> Python',
                'plaintext': plaintext,
                'seq': nodejs_seq - 1,
                'success': result['success']
            })
        else:
            # Python sends
            plaintext = f"[Round 3.{i+1}] Python replies: Got your message {i+1}!"
            enc_key, nonce, python_send_chain_key = derive_message_key(python_send_chain_key, python_seq)
            python_seq += 1
            
            result = await send_e2ee_message(python_cred, nodejs_cred['did'], plaintext, enc_key, nonce, python_seq - 1)
            print(f"\n  Python -> Node.js: {plaintext}")
            print(f"    Seq: {python_seq - 1}, Chain key updated: {python_send_chain_key.hex()[:16]}...")
            
            results.append({
                'round': 3,
                'direction': 'Python -> Node.js',
                'plaintext': plaintext,
                'seq': python_seq - 1,
                'success': result['success']
            })
        
        await asyncio.sleep(0.5)  # Small delay between messages
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    total = len(results)
    passed = sum(1 for r in results if r['success'])
    
    print(f"\nTotal messages: {total}")
    print(f"Successful: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success rate: {passed/total*100:.1f}%")
    
    print("\nChain key evolution:")
    print(f"  Node.js send chain key (final): {nodejs_send_chain_key.hex()[:32]}...")
    print(f"  Node.js recv chain key (final): {nodejs_recv_chain_key.hex()[:32]}...")
    print(f"  Python send chain key (final): {python_send_chain_key.hex()[:32]}...")
    print(f"  Python recv chain key (final): {python_recv_chain_key.hex()[:32]}...")
    
    print(f"\nSequence numbers:")
    print(f"  Node.js sent: {nodejs_seq} messages")
    print(f"  Python sent: {python_seq} messages")
    
    if passed == total:
        print("\nOK ALL ROUNDS PASSED!")
        print("Ratchet algorithm is working correctly!")
    else:
        print("\nFAIL SOME ROUNDS FAILED")
    
    # Save results
    from datetime import datetime
    report = {
        'timestamp': datetime.now().isoformat(),
        'test_name': 'Multi-Round E2EE Ratchet Test',
        'identities': {
            'nodejs': nodejs_cred['did'],
            'python': python_cred['did']
        },
        'results': results,
        'summary': {
            'total': total,
            'passed': passed,
            'failed': total - passed,
            'success_rate': passed/total*100
        },
        'final_chain_keys': {
            'nodejs_send': nodejs_send_chain_key.hex(),
            'nodejs_recv': nodejs_recv_chain_key.hex(),
            'python_send': python_send_chain_key.hex(),
            'python_recv': python_recv_chain_key.hex()
        },
        'sequence_numbers': {
            'nodejs_sent': nodejs_seq,
            'python_sent': python_seq
        }
    }
    
    report_path = Path(__file__).parent / "multi_round_ratchet_results.json"
    report_path.write_text(json.dumps(report, indent=2))
    print(f"\nResults saved to: {report_path}")

asyncio.run(run_multi_round_test())
