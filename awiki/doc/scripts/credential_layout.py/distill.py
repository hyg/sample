"""Distill script for credential_layout.py - records input/output as golden standard."""

import json
import sys
import tempfile
from pathlib import Path

# Add scripts directory to path for imports (credential_layout.py imports from utils.config)
# distill.py location: doc/scripts/credential_layout.py/distill.py
# parents[0]: credential_layout.py dir
# parents[1]: scripts dir (doc/scripts)
# parents[2]: doc dir
# parents[3]: project root (awiki)
project_root = Path(__file__).resolve().parents[3]
scripts_dir = project_root / "python" / "scripts"
sys.path.insert(0, str(scripts_dir))

from credential_layout import (
    AUTH_FILE_NAME,
    CredentialPaths,
    DID_DOCUMENT_FILE_NAME,
    E2EE_AGREEMENT_PRIVATE_FILE_NAME,
    E2EE_SIGNING_PRIVATE_FILE_NAME,
    E2EE_STATE_FILE_NAME,
    IDENTITY_FILE_NAME,
    INDEX_FILE_NAME,
    INDEX_SCHEMA_VERSION,
    KEY1_PRIVATE_FILE_NAME,
    KEY1_PUBLIC_FILE_NAME,
    _default_index,
    _normalize_index_payload,
    _is_legacy_identity_payload,
    sanitize_credential_dir_name,
    preferred_credential_dir_name,
    build_credential_paths,
    legacy_layout_hint,
    ensure_credentials_root,
    index_path,
    legacy_backup_root,
    write_secure_text,
    write_secure_json,
    write_secure_bytes,
)


def record_result(name: str, input_data: str, output_data: str, status: str = "PASS") -> dict:
    """Record a test result."""
    return {
        "name": name,
        "input": input_data,
        "output": output_data,
        "status": status,
    }


def main():
    """Run distillation tests and record golden standard results."""
    results = []
    
    # Create temporary directory for testing
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        from utils.config import SDKConfig
        config = SDKConfig(credentials_dir=tmp_path)
        
        # Test 1: Constants
        results.append(record_result(
            "constants",
            "N/A",
            json.dumps({
                "INDEX_SCHEMA_VERSION": INDEX_SCHEMA_VERSION,
                "INDEX_FILE_NAME": INDEX_FILE_NAME,
                "IDENTITY_FILE_NAME": IDENTITY_FILE_NAME,
                "AUTH_FILE_NAME": AUTH_FILE_NAME,
                "DID_DOCUMENT_FILE_NAME": DID_DOCUMENT_FILE_NAME,
                "KEY1_PRIVATE_FILE_NAME": KEY1_PRIVATE_FILE_NAME,
                "KEY1_PUBLIC_FILE_NAME": KEY1_PUBLIC_FILE_NAME,
                "E2EE_SIGNING_PRIVATE_FILE_NAME": E2EE_SIGNING_PRIVATE_FILE_NAME,
                "E2EE_AGREEMENT_PRIVATE_FILE_NAME": E2EE_AGREEMENT_PRIVATE_FILE_NAME,
                "E2EE_STATE_FILE_NAME": E2EE_STATE_FILE_NAME,
            }, indent=2),
        ))
        
        # Test 2: _default_index
        results.append(record_result(
            "_default_index",
            "N/A",
            json.dumps(_default_index(), indent=2),
        ))
        
        # Test 3: _normalize_index_payload
        test_index_data = {
            "schema_version": 2,
            "credentials": {
                "test_cred": {"dir_name": "test_dir"}
            }
        }
        normalized = _normalize_index_payload(test_index_data)
        results.append(record_result(
            "_normalize_index_payload",
            json.dumps(test_index_data, indent=2),
            json.dumps(normalized, indent=2),
        ))
        
        # Test 4: sanitize_credential_dir_name
        test_names = ["test-cred", "test_cred", "test.cred", "test@cred!"]
        sanitized_results = {name: sanitize_credential_dir_name(name) for name in test_names}
        results.append(record_result(
            "sanitize_credential_dir_name",
            json.dumps(test_names),
            json.dumps(sanitized_results, indent=2),
        ))
        
        # Test 5: preferred_credential_dir_name
        pref_name = preferred_credential_dir_name(handle="test_handle", unique_id="abc123")
        results.append(record_result(
            "preferred_credential_dir_name",
            json.dumps({"handle": "test_handle", "unique_id": "abc123"}),
            json.dumps({"result": pref_name}, indent=2),
        ))
        
        # Test 6: ensure_credentials_root
        root = ensure_credentials_root(config)
        results.append(record_result(
            "ensure_credentials_root",
            json.dumps({"credentials_dir": str(tmp_path)}, indent=2),
            json.dumps({"root": str(root), "exists": root.exists()}, indent=2),
        ))
        
        # Test 7: index_path
        idx_path = index_path(config)
        results.append(record_result(
            "index_path",
            json.dumps({"credentials_dir": str(tmp_path)}, indent=2),
            json.dumps({"index_path": str(idx_path)}, indent=2),
        ))
        
        # Test 8: legacy_backup_root
        backup_path = legacy_backup_root(config)
        results.append(record_result(
            "legacy_backup_root",
            json.dumps({"credentials_dir": str(tmp_path)}, indent=2),
            json.dumps({"backup_path": str(backup_path)}, indent=2),
        ))
        
        # Test 9: build_credential_paths
        paths = build_credential_paths("test_dir_name", config)
        results.append(record_result(
            "build_credential_paths",
            json.dumps({"dir_name": "test_dir_name"}, indent=2),
            json.dumps({
                "root_dir": str(paths.root_dir),
                "dir_name": paths.dir_name,
                "credential_dir": str(paths.credential_dir),
                "identity_path": str(paths.identity_path),
                "auth_path": str(paths.auth_path),
                "did_document_path": str(paths.did_document_path),
                "key1_private_path": str(paths.key1_private_path),
                "key1_public_path": str(paths.key1_public_path),
                "e2ee_signing_private_path": str(paths.e2ee_signing_private_path),
                "e2ee_agreement_private_path": str(paths.e2ee_agreement_private_path),
                "e2ee_state_path": str(paths.e2ee_state_path),
            }, indent=2),
        ))
        
        # Test 10: write_secure_text
        test_file = tmp_path / "test_text.txt"
        write_secure_text(test_file, "test content")
        results.append(record_result(
            "write_secure_text",
            json.dumps({"path": str(test_file), "content": "test content"}, indent=2),
            json.dumps({"written": test_file.exists(), "content": test_file.read_text()}, indent=2),
        ))
        
        # Test 11: write_secure_json
        test_json_file = tmp_path / "test_json.json"
        test_payload = {"key": "value", "number": 42}
        write_secure_json(test_json_file, test_payload)
        results.append(record_result(
            "write_secure_json",
            json.dumps({"path": str(test_json_file), "payload": test_payload}, indent=2),
            json.dumps({"written": test_json_file.exists(), "content": json.loads(test_json_file.read_text())}, indent=2),
        ))
        
        # Test 12: write_secure_bytes
        test_bytes_file = tmp_path / "test_bytes.bin"
        test_bytes = b"binary content"
        write_secure_bytes(test_bytes_file, test_bytes)
        results.append(record_result(
            "write_secure_bytes",
            json.dumps({"path": str(test_bytes_file), "content": "b'binary content'"}, indent=2),
            json.dumps({"written": test_bytes_file.exists(), "content": str(test_bytes_file.read_bytes())}, indent=2),
        ))
        
        # Test 13: _is_legacy_identity_payload
        legacy_payload = {"did": "did:wba:test", "private_key_pem": "-----BEGIN..."}
        non_legacy_payload = {"key": "value"}
        results.append(record_result(
            "_is_legacy_identity_payload",
            json.dumps({
                "legacy_payload": legacy_payload,
                "non_legacy_payload": non_legacy_payload
            }, indent=2),
            json.dumps({
                "legacy_result": _is_legacy_identity_payload(legacy_payload),
                "non_legacy_result": _is_legacy_identity_payload(non_legacy_payload),
            }, indent=2),
        ))
        
        # Test 14: legacy_layout_hint
        results.append(record_result(
            "legacy_layout_hint",
            "N/A",
            json.dumps({"hint": legacy_layout_hint()}, indent=2),
        ))
        
        # Test 15: CredentialPaths dataclass
        results.append(record_result(
            "CredentialPaths",
            json.dumps({"dir_name": "test_dir_name"}, indent=2),
            json.dumps({
                "type": "CredentialPaths",
                "dir_name": paths.dir_name,
                "credential_dir": str(paths.credential_dir),
            }, indent=2),
        ))
    
    # Print results
    print("=" * 60)
    print("DISTILLATION RESULTS - credential_layout.py")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for result in results:
        status_icon = "✓" if result["status"] == "PASS" else "✗"
        print(f"\n{status_icon} {result['name']}")
        print(f"  Input: {result['input'][:100]}{'...' if len(result['input']) > 100 else ''}")
        print(f"  Output: {result['output'][:200]}{'...' if len(result['output']) > 200 else ''}")
        
        if result["status"] == "PASS":
            passed += 1
        else:
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"SUMMARY: {passed} passed, {failed} failed, {len(results)} total")
    print("=" * 60)
    
    # Save golden standard
    golden_file = Path(__file__).parent / "golden.json"
    golden_file.parent.mkdir(parents=True, exist_ok=True)
    golden_file.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nGolden standard saved to: {golden_file}")
    
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
