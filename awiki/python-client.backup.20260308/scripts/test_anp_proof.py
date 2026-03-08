#!/usr/bin/env python3
"""
Test anp.proof generate_w3c_proof function.
"""

from anp.proof import generate_w3c_proof
from cryptography.hazmat.primitives.asymmetric import ec
import json

# Generate key
priv_key = ec.generate_private_key(ec.SECP256K1())

# Create simple document
doc = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    'id': 'did:wba:awiki.ai:user:test',
    'verificationMethod': [{
        'id': 'did:wba:awiki.ai:user:test#key-1',
        'type': 'EcdsaSecp256k1VerificationKey2019',
        'controller': 'did:wba:awiki.ai:user:test',
        'publicKeyJwk': {'kty': 'EC', 'crv': 'secp256k1', 'x': 'test', 'y': 'test'}
    }],
    'authentication': ['did:wba:awiki.ai:user:test#key-1']
}

# Generate proof
signed = generate_w3c_proof(
    document=doc,
    private_key=priv_key,
    verification_method='did:wba:awiki.ai:user:test#key-1',
    proof_purpose='authentication',
    domain='awiki.ai',
    challenge='test123'
)

with open('anp_proof_test.json', 'w') as f:
    json.dump(signed, f, indent=2)

print("Generated proof:")
print(json.dumps(signed['proof'], indent=2))

# Now try to register
import httpx

try:
    with httpx.Client(timeout=30) as client:
        response = client.post('https://awiki.ai/user-service/did-auth/rpc', json={
            'jsonrpc': '2.0',
            'method': 'register',
            'params': {
                'did_document': signed,
                'name': 'AnpProofTest',
                'is_agent': True
            },
            'id': 1
        })
    
    result = response.json()
    with open('anp_registration_result.json', 'w') as f:
        json.dump(result, f, indent=2)
    
    print(f"\nStatus: {response.status_code}")
    if 'error' in result:
        print(f"Error: {result['error']['message']}")
    else:
        print(f"SUCCESS: {result['result']['did']}")
        
except Exception as e:
    with open('anp_registration_result.json', 'w') as f:
        json.dump({'error': str(e)}, f, indent=2)
    print(f"Exception: {e}")
