#!/usr/bin/env python3
"""Distillation script for python/scripts/utils/identity.py

Records input/output as golden standard for all public functions and classes.
"""

import sys
import os

# ============================================================================
# Setup path
# ============================================================================
PYTHON_DIR = r'D:\huangyg\git\sample\awiki\python'
sys.path.insert(0, PYTHON_DIR)

# Direct execution of identity.py content (bypassing __init__.py)
# This avoids the "from utils.config import" issue in scripts/utils/__init__.py

exec(open(os.path.join(PYTHON_DIR, 'scripts', 'utils', 'identity.py')).read())

# Now DIDIdentity, create_identity, load_private_key are available in global scope

# ============================================================================
# Test Records
# ============================================================================

def record_test(name: str, test_func):
    """Execute test and record input/output."""
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print('='*60)
    try:
        result = test_func()
        print(f"STATUS: PASS")
        print(f"OUTPUT: {result}")
        return True
    except Exception as e:
        print(f"STATUS: FAIL")
        print(f"ERROR: {type(e).__name__}: {e}")
        return False

# ----------------------------------------------------------------------------
# Test 1: DIDIdentity class instantiation
# ----------------------------------------------------------------------------
def test_did_identity_creation():
    """Test DIDIdentity dataclass creation."""
    identity = DIDIdentity(
        did="did:wba:awiki.ai:user:k1_test123",
        did_document={"id": "did:wba:awiki.ai:user:k1_test123", "verificationMethod": []},
        private_key_pem=b"-----BEGIN EC PRIVATE KEY-----\ntest\n-----END EC PRIVATE KEY-----",
        public_key_pem=b"-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----",
    )
    return {
        "did": identity.did,
        "unique_id": identity.unique_id,
        "has_did_document": isinstance(identity.did_document, dict),
        "private_key_type": type(identity.private_key_pem).__name__,
    }

# ----------------------------------------------------------------------------
# Test 2: DIDIdentity.unique_id property
# ----------------------------------------------------------------------------
def test_did_identity_unique_id():
    """Test unique_id extraction from DID."""
    test_cases = [
        ("did:wba:awiki.ai:user:k1_abc123", "k1_abc123"),
        ("did:wba:localhost:agent:k1_xyz789", "k1_xyz789"),
        ("did:wba:example.com:user:test_user", "test_user"),
    ]
    results = []
    for did, expected in test_cases:
        identity = DIDIdentity(
            did=did,
            did_document={"id": did},
            private_key_pem=b"test",
            public_key_pem=b"test",
        )
        results.append({
            "did": did,
            "extracted": identity.unique_id,
            "expected": expected,
            "match": identity.unique_id == expected,
        })
    return results

# ----------------------------------------------------------------------------
# Test 3: DIDIdentity with optional fields
# ----------------------------------------------------------------------------
def test_did_identity_optional_fields():
    """Test DIDIdentity with user_id, jwt_token, and E2EE keys."""
    identity = DIDIdentity(
        did="did:wba:awiki.ai:user:k1_test",
        did_document={"id": "did:wba:awiki.ai:user:k1_test"},
        private_key_pem=b"private",
        public_key_pem=b"public",
        user_id="user-123",
        jwt_token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
        e2ee_signing_private_pem=b"e2ee_sign_priv",
        e2ee_signing_public_pem=b"e2ee_sign_pub",
        e2ee_agreement_private_pem=b"e2ee_agree_priv",
        e2ee_agreement_public_pem=b"e2ee_agree_pub",
    )
    return {
        "did": identity.did,
        "user_id": identity.user_id,
        "jwt_token": identity.jwt_token,
        "has_e2ee_signing": identity.e2ee_signing_private_pem is not None,
        "has_e2ee_agreement": identity.e2ee_agreement_private_pem is not None,
    }

# ----------------------------------------------------------------------------
# Test 4: create_identity function
# ----------------------------------------------------------------------------
def test_create_identity():
    """Test create_identity function with hostname."""
    identity = create_identity(
        hostname="awiki.ai",
        path_prefix=["user"],
        proof_purpose="authentication",
    )
    return {
        "did": identity.did,
        "did_starts_with": identity.did.startswith("did:wba:awiki.ai:user:k1_"),
        "has_did_document": isinstance(identity.did_document, dict),
        "has_private_key": isinstance(identity.private_key_pem, bytes),
        "has_public_key": isinstance(identity.public_key_pem, bytes),
        "private_key_starts_with": identity.private_key_pem.startswith(b"-----BEGIN"),
        "public_key_starts_with": identity.public_key_pem.startswith(b"-----BEGIN"),
    }

# ----------------------------------------------------------------------------
# Test 5: create_identity with custom path_prefix
# ----------------------------------------------------------------------------
def test_create_identity_agent():
    """Test create_identity with agent path_prefix."""
    identity = create_identity(
        hostname="awiki.ai",
        path_prefix=["agent"],
    )
    return {
        "did": identity.did,
        "did_starts_with": identity.did.startswith("did:wba:awiki.ai:agent:k1_"),
        "unique_id": identity.unique_id,
    }

# ----------------------------------------------------------------------------
# Test 6: create_identity with services
# ----------------------------------------------------------------------------
def test_create_identity_with_services():
    """Test create_identity with custom services."""
    services = [
        {
            "id": "#messaging",
            "type": "MessagingService",
            "serviceEndpoint": "https://awiki.ai/messaging",
        }
    ]
    identity = create_identity(
        hostname="awiki.ai",
        path_prefix=["user"],
        services=services,
    )
    return {
        "did": identity.did,
        "has_services": "service" in identity.did_document or "serviceEndpoint" in str(identity.did_document),
    }

# ----------------------------------------------------------------------------
# Test 7: load_private_key function
# ----------------------------------------------------------------------------
def test_load_private_key():
    """Test load_private_key with a real secp256k1 key."""
    # First create an identity to get a real private key
    identity = create_identity(hostname="awiki.ai", path_prefix=["user"])
    # Then load it back
    key_obj = load_private_key(identity.private_key_pem)
    return {
        "key_type": type(key_obj).__name__,
        "key_module": type(key_obj).__module__,
        "is_valid": hasattr(key_obj, 'public_key'),
    }

# ----------------------------------------------------------------------------
# Test 8: load_private_key with invalid input
# ----------------------------------------------------------------------------
def test_load_private_key_invalid():
    """Test load_private_key error handling."""
    try:
        load_private_key(b"invalid pem data")
        return {"error": "No exception raised"}
    except Exception as e:
        return {
            "exception_type": type(e).__name__,
            "expected_error": True,
        }

# ============================================================================
# Main Execution
# ============================================================================

if __name__ == "__main__":
    print("="*60)
    print("DISTILLATION SCRIPT: python/scripts/utils/identity.py")
    print("="*60)
    
    tests = [
        ("DIDIdentity - Creation", test_did_identity_creation),
        ("DIDIdentity - unique_id property", test_did_identity_unique_id),
        ("DIDIdentity - Optional fields", test_did_identity_optional_fields),
        ("create_identity - Basic", test_create_identity),
        ("create_identity - Agent prefix", test_create_identity_agent),
        ("create_identity - With services", test_create_identity_with_services),
        ("load_private_key - Valid key", test_load_private_key),
        ("load_private_key - Invalid input", test_load_private_key_invalid),
    ]
    
    results = []
    for name, test_func in tests:
        passed = record_test(name, test_func)
        results.append((name, passed))
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for name, passed in results:
        status = "PASS" if passed else "FAIL"
        print(f"  [{status}] {name}")

    print(f"\nTotal: {passed_count}/{total_count} tests passed")

    if passed_count == total_count:
        print("\nAll tests passed successfully!")
        sys.exit(0)
    else:
        print(f"{total_count - passed_count} test(s) failed")
        sys.exit(1)
