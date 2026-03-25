#!/usr/bin/env python3
"""Distillation script for e2ee_session_store.py.

[INPUT]: Identity data, peer DID, E2EE state
[OUTPUT]: E2EE session persistence and retrieval results
[POS]: E2EE session state management for cross-session reuse

Note: This script tests the module structure and functions that don't require
valid credentials. For full E2EE session tests, valid credentials are needed.

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updating
"""

import sys
from pathlib import Path

# Use absolute path for project root
PROJECT_ROOT = Path(r"D:\huangyg\git\sample\awiki")
PYTHON_SCRIPTS = PROJECT_ROOT / 'python' / 'scripts'

sys.path.insert(0, str(PYTHON_SCRIPTS))

# Import module to check it exists
import e2ee_session_store
import e2ee_store

from utils.config import SDKConfig
import json


def record_result(scenario: str, input_args: dict, output_data: dict, success: bool, error: str = None) -> dict:
    """Record a test result."""
    result = {
        "scenario": scenario,
        "input": input_args,
        "output": output_data,
        "success": success
    }
    if error:
        result["error"] = error
    return result


def test_module_import() -> dict:
    """Test that module can be imported."""
    input_args = {}
    output_data = {
        "module_imported": True,
        "functions_available": []
    }
    
    try:
        functions = [x for x in dir(e2ee_session_store) if not x.startswith('_')]
        output_data["functions_available"] = functions
        
        return record_result("module_import", input_args, output_data, True)
    except Exception as e:
        return record_result("module_import", input_args, output_data, False, str(e))


def test_load_e2ee_client_no_credential() -> dict:
    """Test loading E2EE client when no credential exists."""
    input_args = {
        "peer_did": "did:wba:awiki.ai:user:k1_test",
        "credential_name": "nonexistent_credential"
    }
    output_data = {
        "client_loaded": False,
        "reason": "credential_not_found"
    }
    
    try:
        from credential_store import load_identity
        
        identity = load_identity(input_args["credential_name"])
        
        if identity is None:
            output_data["client_loaded"] = False
            output_data["reason"] = "credential_not_found"
            return record_result("no_credential", input_args, output_data, True)
        
        # If credential exists, try to load client
        from e2ee_session_store import load_e2ee_client
        client = load_e2ee_client(identity, input_args["peer_did"])
        
        output_data["client_loaded"] = client is not None
        return record_result("no_credential", input_args, output_data, True)
    except Exception as e:
        return record_result("no_credential", input_args, output_data, False, str(e))


def test_e2ee_store_module() -> dict:
    """Test e2ee_store module functions."""
    input_args = {}
    output_data = {
        "module_imported": True,
        "functions_available": []
    }
    
    try:
        functions = [x for x in dir(e2ee_store) if not x.startswith('_')]
        output_data["functions_available"] = functions
        
        return record_result("e2ee_store_module", input_args, output_data, True)
    except Exception as e:
        return record_result("e2ee_store_module", input_args, output_data, False, str(e))


def test_sdk_config() -> dict:
    """Test SDK config integration."""
    input_args = {}
    output_data = {
        "sdk_config_loaded": False,
        "data_dir": None
    }
    
    try:
        config = SDKConfig.load()
        output_data["sdk_config_loaded"] = config is not None
        output_data["data_dir"] = str(config.data_dir)
        
        return record_result("sdk_integration", input_args, output_data, True)
    except Exception as e:
        return record_result("sdk_integration", input_args, output_data, False, str(e))


def distill():
    """Extract e2ee_session_store.py input/output as golden standard."""
    results = {
        "file": "python/scripts/e2ee_session_store.py",
        "doc_path": "doc/scripts/e2ee_session_store.py",
        "version": "1.3.10",
        "functions": [],
        "constants": {},
        "classes": {}
    }
    
    print("Running e2ee_session_store.py distillation tests...", file=sys.stderr)
    print("Note: Full E2EE tests require valid credentials", file=sys.stderr)
    
    # Test module import
    results["functions"].append({
        "name": "Module Import",
        "type": "module",
        "description": "Module structure and available functions",
        "tests": [
            test_module_import(),
            test_e2ee_store_module()
        ]
    })
    
    # Test load_e2ee_client (no credential scenario)
    results["functions"].append({
        "name": "load_e2ee_client",
        "type": "function",
        "signature": "(identity: dict, peer_did: str) -> E2eeClient | None",
        "description": "Load E2EE client for a peer (returns None if no session or credential)",
        "tests": [test_load_e2ee_client_no_credential()]
    })
    
    # Test SDK integration
    results["functions"].append({
        "name": "SDKConfig.load",
        "type": "classmethod",
        "signature": "() -> SDKConfig",
        "description": "Load SDK configuration",
        "tests": [test_sdk_config()]
    })
    
    return results


if __name__ == "__main__":
    results = distill()
    print(json.dumps(results, indent=2, default=str))
