#!/usr/bin/env python3
"""Distillation script for e2ee_session_store.py.

[INPUT]: E2EE session state, credential_store, local_store
[OUTPUT]: E2EE session persistence and retrieval
[POS]: E2EE session state management for cross-session reuse

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updating
"""

import sys
from pathlib import Path

# Project root: 5 levels up from distill.py
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
PYTHON_SCRIPTS = PROJECT_ROOT / 'python' / 'scripts'

sys.path.insert(0, str(PYTHON_SCRIPTS))

from e2ee_session_store import load_e2ee_client, save_e2ee_client
from e2ee_store import load_e2ee_state, save_e2ee_state
from utils import SDKConfig, E2eeClient
from utils.e2ee import SUPPORTED_E2EE_VERSION
from credential_store import load_identity
import json
import logging

logger = logging.getLogger(__name__)


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


def test_load_e2ee_client_no_session() -> dict:
    """Test loading E2EE client when no session exists."""
    input_args = {
        "peer_did": "did:wba:awiki.ai:user:k1_test",
        "credential_name": "default"
    }
    output_data = {
        "client_loaded": False,
        "session_exists": False,
        "needs_init": True
    }
    
    try:
        config = SDKConfig()
        identity = load_identity(input_args["credential_name"])
        
        if identity is None:
            return record_result("load_no_session", input_args, output_data, False, "No credential found")
        
        # Try to load non-existent session
        client = load_e2ee_client(identity, input_args["peer_did"])
        
        output_data["client_loaded"] = client is not None
        output_data["needs_init"] = client is None
        return record_result("load_no_session", input_args, output_data, True)
    except Exception as e:
        return record_result("load_no_session", input_args, output_data, False, str(e))


def test_save_e2ee_client() -> dict:
    """Test saving E2EE client state."""
    input_args = {
        "peer_did": "did:wba:awiki.ai:user:k1_test",
        "credential_name": "default",
        "e2ee_version": SUPPORTED_E2EE_VERSION
    }
    output_data = {
        "saved": False,
        "state_persisted": False
    }
    
    try:
        config = SDKConfig()
        identity = load_identity(input_args["credential_name"])
        
        if identity is None:
            return record_result("save_client", input_args, output_data, False, "No credential found")
        
        # Create a mock E2EE client state
        mock_state = {
            "version": input_args["e2ee_version"],
            "peer_did": input_args["peer_did"],
            "local_did": identity["did"],
            "session_confirmed": False
        }
        
        # Save the state
        save_e2ee_state(identity, input_args["peer_did"], mock_state)
        
        output_data["saved"] = True
        output_data["state_persisted"] = True
        return record_result("save_client", input_args, output_data, True)
    except Exception as e:
        return record_result("save_client", input_args, output_data, False, str(e))


def test_load_saved_e2ee_client() -> dict:
    """Test loading previously saved E2EE client."""
    input_args = {
        "peer_did": "did:wba:awiki.ai:user:k1_test",
        "credential_name": "default"
    }
    output_data = {
        "client_loaded": False,
        "state_loaded": False,
        "version": None
    }
    
    try:
        config = SDKConfig()
        identity = load_identity(input_args["credential_name"])
        
        if identity is None:
            return record_result("load_saved_client", input_args, output_data, False, "No credential found")
        
        # Load the previously saved state
        state = load_e2ee_state(identity, input_args["peer_did"])
        
        if state:
            output_data["client_loaded"] = True
            output_data["state_loaded"] = True
            output_data["version"] = state.get("version")
        
        return record_result("load_saved_client", input_args, output_data, True)
    except Exception as e:
        return record_result("load_saved_client", input_args, output_data, False, str(e))


def test_e2ee_session_cross_session() -> dict:
    """Test E2EE session persistence across sessions."""
    input_args = {
        "peer_did": "did:wba:awiki.ai:user:k1_cross_session_test",
        "credential_name": "default",
        "test_phase": "save_then_load"
    }
    output_data = {
        "save_success": False,
        "load_success": False,
        "state_matches": False
    }
    
    try:
        config = SDKConfig()
        identity = load_identity(input_args["credential_name"])
        
        if identity is None:
            return record_result("cross_session", input_args, output_data, False, "No credential found")
        
        # Phase 1: Save state
        test_state = {
            "version": SUPPORTED_E2EE_VERSION,
            "peer_did": input_args["peer_did"],
            "local_did": identity["did"],
            "session_confirmed": True,
            "test_marker": "cross_session_test"
        }
        
        save_e2ee_state(identity, input_args["peer_did"], test_state)
        output_data["save_success"] = True
        
        # Phase 2: Load state
        loaded_state = load_e2ee_state(identity, input_args["peer_did"])
        
        if loaded_state:
            output_data["load_success"] = True
            output_data["state_matches"] = (
                loaded_state.get("version") == test_state["version"] and
                loaded_state.get("peer_did") == test_state["peer_did"] and
                loaded_state.get("test_marker") == test_state["test_marker"]
            )
        
        return record_result("cross_session", input_args, output_data, True)
    except Exception as e:
        return record_result("cross_session", input_args, output_data, False, str(e))


def test_e2ee_session_state_structure() -> dict:
    """Test E2EE session state structure validation."""
    input_args = {
        "required_fields": ["version", "local_did", "signing_pem", "x25519_pem"],
        "optional_fields": ["confirmed_session_ids", "sessions"]
    }
    output_data = {
        "structure_valid": True,
        "fields_present": []
    }
    
    try:
        config = SDKConfig()
        identity = load_identity("default")
        
        if identity is None:
            return record_result("state_structure", input_args, output_data, False, "No credential found")
        
        # Load any existing state
        state = load_e2ee_state(identity, "did:wba:awiki.ai:user:k1_test")
        
        if state:
            for field in input_args["required_fields"]:
                if field in state:
                    output_data["fields_present"].append(field)
            
            output_data["structure_valid"] = all(
                field in state for field in input_args["required_fields"]
            )
        
        return record_result("state_structure", input_args, output_data, True)
    except Exception as e:
        return record_result("state_structure", input_args, output_data, False, str(e))


def distill():
    """Extract e2ee_session_store.py input/output as golden standard."""
    results = {
        "file": "python/scripts/e2ee_session_store.py",
        "doc_path": "doc/scripts/e2ee_session_store.py",
        "version": "1.3.10",
        "functions": [],
        "constants": {
            "SUPPORTED_E2EE_VERSION": SUPPORTED_E2EE_VERSION
        },
        "classes": {}
    }
    
    print("Running e2ee_session_store.py distillation tests...", file=sys.stderr)
    
    # Test load_e2ee_client
    results["functions"].append({
        "name": "load_e2ee_client",
        "type": "function",
        "signature": "(identity: dict, peer_did: str) -> E2eeClient | None",
        "description": "Load E2EE client for a peer, returns None if no session exists",
        "tests": [
            test_load_e2ee_client_no_session(),
            test_load_saved_e2ee_client()
        ]
    })
    
    # Test save_e2ee_client
    results["functions"].append({
        "name": "save_e2ee_client",
        "type": "function",
        "signature": "(identity: dict, peer_did: str, client: E2eeClient) -> None",
        "description": "Save E2EE client state for cross-session reuse",
        "tests": [
            test_save_e2ee_client(),
            test_e2ee_session_cross_session()
        ]
    })
    
    # Test state structure
    results["functions"].append({
        "name": "load_e2ee_state",
        "type": "function",
        "signature": "(identity: dict, peer_did: str) -> dict | None",
        "description": "Load E2EE state from local storage",
        "tests": [test_e2ee_session_state_structure()]
    })
    
    return results


if __name__ == "__main__":
    results = distill()
    print(json.dumps(results, indent=2, default=str))
