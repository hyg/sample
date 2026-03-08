#!/usr/bin/env python3
"""
Test registration with Python-generated DID document.
"""

import json
import httpx
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "tests" / "python_output"
results = json.load(open(OUTPUT_DIR / "did_proof_intermediate.json"))
doc = results['final_did_document']

print(f"DID: {doc['id']}")
print(f"Proof: {doc['proof']['proofValue'][:50]}...")

try:
    with httpx.Client(timeout=30) as client:
        response = client.post('https://awiki.ai/user-service/did-auth/rpc', json={
            'jsonrpc': '2.0',
            'method': 'register',
            'params': {
                'did_document': doc,
                'name': 'PythonTest',
                'is_agent': True
            },
            'id': 1
        })
    
    result = response.json()
    with open('test_result.json', 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"Status: {response.status_code}")
    if 'error' in result:
        print(f"Error: {result['error']['message']}")
    else:
        print(f"SUCCESS: {result['result']['did']}")
        
except Exception as e:
    with open('test_result.json', 'w') as f:
        json.dump({'error': str(e)}, f, indent=2)
    print(f"Exception: {e}")
