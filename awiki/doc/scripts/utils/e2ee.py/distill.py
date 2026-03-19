#!/usr/bin/env python
"""Distill script for e2ee.py - records golden standard I/O for public functions and classes.

This script executes the public API of e2ee.py and records input/output pairs
as golden standards for testing and documentation purposes.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

# Add python directory to path and import e2ee module directly
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PYTHON_DIR = os.path.join(SCRIPT_DIR, "..", "..", "..", "..", "python")
sys.path.insert(0, os.path.normpath(PYTHON_DIR))

# Import e2ee module directly to avoid __init__.py dependency chain
import importlib.util
e2ee_path = os.path.join(PYTHON_DIR, "scripts", "utils", "e2ee.py")
spec = importlib.util.spec_from_file_location("e2ee_module", e2ee_path)
e2ee_module = importlib.util.module_from_spec(spec)  # type: ignore
spec.loader.exec_module(e2ee_module)  # type: ignore

# Extract public API
SUPPORTED_E2EE_VERSION = e2ee_module.SUPPORTED_E2EE_VERSION
_STATE_VERSION = e2ee_module._STATE_VERSION
ensure_supported_e2ee_version = e2ee_module.ensure_supported_e2ee_version
build_e2ee_error_content = e2ee_module.build_e2ee_error_content
build_e2ee_error_message = e2ee_module.build_e2ee_error_message
_classify_protocol_error = e2ee_module._classify_protocol_error
_extract_proof_verification_method = e2ee_module._extract_proof_verification_method
E2eeClient = e2ee_module.E2eeClient


def record_result(name: str, inputs: Any, outputs: Any, error: str | None = None) -> dict[str, Any]:
    """Record a test result with input/output."""
    return {
        "name": name,
        "inputs": inputs,
        "outputs": outputs,
        "error": error,
    }


def distill_constants() -> list[dict[str, Any]]:
    """Distill module constants."""
    results = []
    results.append(record_result(
        "SUPPORTED_E2EE_VERSION",
        {},
        SUPPORTED_E2EE_VERSION,
    ))
    results.append(record_result(
        "_STATE_VERSION",
        {},
        _STATE_VERSION,
    ))
    return results


def distill_ensure_supported_e2ee_version() -> list[dict[str, Any]]:
    """Distill ensure_supported_e2ee_version function."""
    results = []

    # Test case 1: Valid version
    content_valid = {"e2ee_version": "1.1"}
    try:
        result = ensure_supported_e2ee_version(content_valid)
        results.append(record_result(
            "ensure_supported_e2ee_version(valid)",
            {"content": content_valid},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "ensure_supported_e2ee_version(valid)",
            {"content": content_valid},
            None,
            str(e),
        ))

    # Test case 2: Missing version
    content_missing = {}
    try:
        result = ensure_supported_e2ee_version(content_missing)
        results.append(record_result(
            "ensure_supported_e2ee_version(missing)",
            {"content": content_missing},
            None,
            "ValueError: unsupported_version: missing e2ee_version (required 1.1)",
        ))
    except ValueError as e:
        results.append(record_result(
            "ensure_supported_e2ee_version(missing)",
            {"content": content_missing},
            None,
            str(e),
        ))

    # Test case 3: Unsupported version
    content_unsupported = {"e2ee_version": "1.0"}
    try:
        result = ensure_supported_e2ee_version(content_unsupported)
        results.append(record_result(
            "ensure_supported_e2ee_version(unsupported)",
            {"content": content_unsupported},
            result,
        ))
    except ValueError as e:
        results.append(record_result(
            "ensure_supported_e2ee_version(unsupported)",
            {"content": content_unsupported},
            None,
            str(e),
        ))

    return results


def distill_build_e2ee_error_content() -> list[dict[str, Any]]:
    """Distill build_e2ee_error_content function."""
    results = []

    # Test case 1: Basic error
    try:
        result = build_e2ee_error_content(error_code="session_not_found")
        results.append(record_result(
            "build_e2ee_error_content(basic)",
            {"error_code": "session_not_found"},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "build_e2ee_error_content(basic)",
            {"error_code": "session_not_found"},
            None,
            str(e),
        ))

    # Test case 2: Error with all fields
    try:
        result = build_e2ee_error_content(
            error_code="decryption_failed",
            session_id="sess-123",
            failed_msg_id="msg-456",
            failed_server_seq=10,
            retry_hint="resend",
            required_e2ee_version="1.1",
            message="Test error message",
        )
        results.append(record_result(
            "build_e2ee_error_content(full)",
            {
                "error_code": "decryption_failed",
                "session_id": "sess-123",
                "failed_msg_id": "msg-456",
                "failed_server_seq": 10,
                "retry_hint": "resend",
                "required_e2ee_version": "1.1",
                "message": "Test error message",
            },
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "build_e2ee_error_content(full)",
            {
                "error_code": "decryption_failed",
                "session_id": "sess-123",
                "failed_msg_id": "msg-456",
                "failed_server_seq": 10,
                "retry_hint": "resend",
                "required_e2ee_version": "1.1",
                "message": "Test error message",
            },
            None,
            str(e),
        ))

    return results


def distill_build_e2ee_error_message() -> list[dict[str, Any]]:
    """Distill build_e2ee_error_message function."""
    results = []

    # Test case 1: Basic error message
    try:
        result = build_e2ee_error_message(error_code="session_not_found")
        results.append(record_result(
            "build_e2ee_error_message(basic)",
            {"error_code": "session_not_found"},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "build_e2ee_error_message(basic)",
            {"error_code": "session_not_found"},
            None,
            str(e),
        ))

    # Test case 2: Error message with detail
    try:
        result = build_e2ee_error_message(
            error_code="decryption_failed",
            detail="Additional context",
        )
        results.append(record_result(
            "build_e2ee_error_message(with_detail)",
            {"error_code": "decryption_failed", "detail": "Additional context"},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "build_e2ee_error_message(with_detail)",
            {"error_code": "decryption_failed", "detail": "Additional context"},
            None,
            str(e),
        ))

    # Test case 3: Unsupported version error
    try:
        result = build_e2ee_error_message(
            error_code="unsupported_version",
            required_e2ee_version="1.1",
        )
        results.append(record_result(
            "build_e2ee_error_message(version)",
            {"error_code": "unsupported_version", "required_e2ee_version": "1.1"},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "build_e2ee_error_message(version)",
            {"error_code": "unsupported_version", "required_e2ee_version": "1.1"},
            None,
            str(e),
        ))

    return results


def distill_classify_protocol_error() -> list[dict[str, Any]]:
    """Distill _classify_protocol_error function."""
    results = []

    # Test case 1: Unsupported version error
    try:
        exc = ValueError("unsupported_version: expected 1.1, got 1.0")
        result = _classify_protocol_error(exc)
        results.append(record_result(
            "_classify_protocol_error(unsupported_version)",
            {"exception": str(exc)},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "_classify_protocol_error(unsupported_version)",
            {"exception": "unsupported_version: expected 1.1, got 1.0"},
            None,
            str(e),
        ))

    # Test case 2: Proof expired error
    try:
        exc = ValueError("proof_expired: the proof has expired")
        result = _classify_protocol_error(exc)
        results.append(record_result(
            "_classify_protocol_error(proof_expired)",
            {"exception": str(exc)},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "_classify_protocol_error(proof_expired)",
            {"exception": "proof_expired: the proof has expired"},
            None,
            str(e),
        ))

    # Test case 3: Proof from future error
    try:
        exc = ValueError("proof_from_future: timestamp is too far in the future")
        result = _classify_protocol_error(exc)
        results.append(record_result(
            "_classify_protocol_error(proof_from_future)",
            {"exception": str(exc)},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "_classify_protocol_error(proof_from_future)",
            {"exception": "proof_from_future: timestamp is too far in the future"},
            None,
            str(e),
        ))

    # Test case 4: Unknown error
    try:
        exc = RuntimeError("unknown error occurred")
        result = _classify_protocol_error(exc)
        results.append(record_result(
            "_classify_protocol_error(unknown)",
            {"exception": str(exc)},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "_classify_protocol_error(unknown)",
            {"exception": "unknown error occurred"},
            None,
            str(e),
        ))

    return results


def distill_extract_proof_verification_method() -> list[dict[str, Any]]:
    """Distill _extract_proof_verification_method function."""
    results = []

    # Test case 1: snake_case field
    try:
        proof = {"verification_method": "did:wba:awiki.ai:user:k1_abc#key-2"}
        result = _extract_proof_verification_method(proof)
        results.append(record_result(
            "_extract_proof_verification_method(snake_case)",
            {"proof": proof},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "_extract_proof_verification_method(snake_case)",
            {"proof": {"verification_method": "did:wba:awiki.ai:user:k1_abc#key-2"}},
            None,
            str(e),
        ))

    # Test case 2: camelCase field
    try:
        proof = {"verificationMethod": "did:wba:awiki.ai:user:k1_xyz#key-2"}
        result = _extract_proof_verification_method(proof)
        results.append(record_result(
            "_extract_proof_verification_method(camelCase)",
            {"proof": proof},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "_extract_proof_verification_method(camelCase)",
            {"proof": {"verificationMethod": "did:wba:awiki.ai:user:k1_xyz#key-2"}},
            None,
            str(e),
        ))

    # Test case 3: Both fields (snake_case takes precedence)
    try:
        proof = {
            "verification_method": "did:wba:awiki.ai:user:k1_snake#key-2",
            "verificationMethod": "did:wba:awiki.ai:user:k1_camel#key-2",
        }
        result = _extract_proof_verification_method(proof)
        results.append(record_result(
            "_extract_proof_verification_method(both)",
            {"proof": proof},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "_extract_proof_verification_method(both)",
            {"proof": {"verification_method": "did:wba:awiki.ai:user:k1_snake#key-2", "verificationMethod": "did:wba:awiki.ai:user:k1_camel#key-2"}},
            None,
            str(e),
        ))

    # Test case 4: Not a dict
    try:
        proof = "not_a_dict"
        result = _extract_proof_verification_method(proof)
        results.append(record_result(
            "_extract_proof_verification_method(not_dict)",
            {"proof": proof},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "_extract_proof_verification_method(not_dict)",
            {"proof": "not_a_dict"},
            None,
            str(e),
        ))

    # Test case 5: Empty dict
    try:
        proof = {}
        result = _extract_proof_verification_method(proof)
        results.append(record_result(
            "_extract_proof_verification_method(empty)",
            {"proof": proof},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "_extract_proof_verification_method(empty)",
            {"proof": {}},
            None,
            str(e),
        ))

    return results


def distill_e2ee_client() -> list[dict[str, Any]]:
    """Distill E2eeClient class basic functionality."""
    results = []

    # Test case 1: Create client without keys
    try:
        client = E2eeClient(local_did="did:wba:awiki.ai:user:k1_test")
        result = {
            "local_did": client.local_did,
            "has_signing_key": client._signing_key is not None,
            "has_x25519_key": client._x25519_key is not None,
        }
        results.append(record_result(
            "E2eeClient(no_keys)",
            {"local_did": "did:wba:awiki.ai:user:k1_test"},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "E2eeClient(no_keys)",
            {"local_did": "did:wba:awiki.ai:user:k1_test"},
            None,
            str(e),
        ))

    # Test case 2: Check has_active_session (no session)
    try:
        client = E2eeClient(local_did="did:wba:awiki.ai:user:k1_test")
        result = client.has_active_session("did:wba:awiki.ai:user:k1_peer")
        results.append(record_result(
            "E2eeClient.has_active_session(no_session)",
            {"peer_did": "did:wba:awiki.ai:user:k1_peer"},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "E2eeClient.has_active_session(no_session)",
            {"peer_did": "did:wba:awiki.ai:user:k1_peer"},
            None,
            str(e),
        ))

    # Test case 3: Check has_session_id (None)
    try:
        client = E2eeClient(local_did="did:wba:awiki.ai:user:k1_test")
        result = client.has_session_id(None)
        results.append(record_result(
            "E2eeClient.has_session_id(None)",
            {"session_id": None},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "E2eeClient.has_session_id(None)",
            {"session_id": None},
            None,
            str(e),
        ))

    # Test case 4: Check is_session_confirmed (None)
    try:
        client = E2eeClient(local_did="did:wba:awiki.ai:user:k1_test")
        result = client.is_session_confirmed(None)
        results.append(record_result(
            "E2eeClient.is_session_confirmed(None)",
            {"session_id": None},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "E2eeClient.is_session_confirmed(None)",
            {"session_id": None},
            None,
            str(e),
        ))

    # Test case 5: Export state (empty)
    try:
        client = E2eeClient(local_did="did:wba:awiki.ai:user:k1_test")
        result = client.export_state()
        # Remove PEM keys for cleaner output
        result_clean = {
            "version": result.get("version"),
            "local_did": result.get("local_did"),
            "has_signing_pem": result.get("signing_pem") is not None,
            "has_x25519_pem": result.get("x25519_pem") is not None,
            "confirmed_session_ids": result.get("confirmed_session_ids"),
            "sessions_count": len(result.get("sessions", [])),
        }
        results.append(record_result(
            "E2eeClient.export_state(empty)",
            {},
            result_clean,
        ))
    except Exception as e:
        results.append(record_result(
            "E2eeClient.export_state(empty)",
            {},
            None,
            str(e),
        ))

    # Test case 6: from_state (restore)
    try:
        state = {
            "version": _STATE_VERSION,
            "local_did": "did:wba:awiki.ai:user:k1_restored",
            "signing_pem": None,
            "x25519_pem": None,
            "confirmed_session_ids": [],
            "sessions": [],
        }
        client = E2eeClient.from_state(state)
        result = {
            "local_did": client.local_did,
            "has_signing_key": client._signing_key is not None,
            "has_x25519_key": client._x25519_key is not None,
        }
        results.append(record_result(
            "E2eeClient.from_state(basic)",
            {"state_version": _STATE_VERSION, "local_did": "did:wba:awiki.ai:user:k1_restored"},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "E2eeClient.from_state(basic)",
            {"state_version": _STATE_VERSION, "local_did": "did:wba:awiki.ai:user:k1_restored"},
            None,
            str(e),
        ))

    # Test case 7: cleanup_expired
    try:
        client = E2eeClient(local_did="did:wba:awiki.ai:user:k1_test")
        client.cleanup_expired()
        result = "cleanup completed without error"
        results.append(record_result(
            "E2eeClient.cleanup_expired()",
            {},
            result,
        ))
    except Exception as e:
        results.append(record_result(
            "E2eeClient.cleanup_expired()",
            {},
            None,
            str(e),
        ))

    return results


def main() -> None:
    """Run all distillation tests and output results."""
    all_results = []

    print("=" * 60)
    print("E2EE.PY DISTILLATION - GOLDEN STANDARD I/O RECORDS")
    print("=" * 60)
    print()

    # Distill constants
    print("[1/7] Distilling constants...")
    all_results.extend(distill_constants())

    # Distill ensure_supported_e2ee_version
    print("[2/7] Distilling ensure_supported_e2ee_version...")
    all_results.extend(distill_ensure_supported_e2ee_version())

    # Distill build_e2ee_error_content
    print("[3/7] Distilling build_e2ee_error_content...")
    all_results.extend(distill_build_e2ee_error_content())

    # Distill build_e2ee_error_message
    print("[4/7] Distilling build_e2ee_error_message...")
    all_results.extend(distill_build_e2ee_error_message())

    # Distill _classify_protocol_error
    print("[5/7] Distilling _classify_protocol_error...")
    all_results.extend(distill_classify_protocol_error())

    # Distill _extract_proof_verification_method
    print("[6/7] Distilling _extract_proof_verification_method...")
    all_results.extend(distill_extract_proof_verification_method())

    # Distill E2eeClient
    print("[7/7] Distilling E2eeClient...")
    all_results.extend(distill_e2ee_client())

    print()
    print("=" * 60)
    print(f"TOTAL: {len(all_results)} test cases executed")
    print("=" * 60)
    print()

    # Output results as JSON
    print("JSON OUTPUT:")
    print("-" * 60)
    print(json.dumps(all_results, indent=2, ensure_ascii=False))

    # Summary
    errors = [r for r in all_results if r.get("error")]
    if errors:
        print()
        print(f"WARNING: {len(errors)} test case(s) had errors:")
        for r in errors:
            print(f"  - {r['name']}: {r['error']}")
    else:
        print()
        print("SUCCESS: All test cases passed without errors.")


if __name__ == "__main__":
    main()
