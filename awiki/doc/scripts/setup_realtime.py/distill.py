#!/usr/bin/env python3
"""Distillation script for setup_realtime.py.

[INPUT]: SDKConfig, user preferences
[OUTPUT]: Configuration files and service setup results
[POS]: One-click setup for message transport mode and real-time delivery

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

from setup_realtime import (
    _generate_token,
    _generate_local_daemon_token,
    _is_placeholder_token,
    DEFAULT_LOCAL_DAEMON_HOST,
    DEFAULT_LOCAL_DAEMON_PORT,
)
from message_transport import RECEIVE_MODE_HTTP, RECEIVE_MODE_WEBSOCKET
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


def test_generate_token() -> dict:
    """Test secure token generation."""
    input_args = {}
    output_data = {
        "token_generated": False,
        "token_prefix": None,
        "token_length": 0
    }
    
    try:
        token = _generate_token()
        output_data["token_generated"] = True
        output_data["token_prefix"] = token[:6]
        output_data["token_length"] = len(token)
        
        return record_result("generate_token", input_args, output_data, True)
    except Exception as e:
        return record_result("generate_token", input_args, output_data, False, str(e))


def test_generate_local_daemon_token() -> dict:
    """Test local daemon token generation."""
    input_args = {}
    output_data = {
        "token_generated": False,
        "token_prefix": None,
        "token_length": 0
    }
    
    try:
        token = _generate_local_daemon_token()
        output_data["token_generated"] = True
        output_data["token_prefix"] = token[:13]
        output_data["token_length"] = len(token)
        
        return record_result("generate_local_daemon_token", input_args, output_data, True)
    except Exception as e:
        return record_result("generate_local_daemon_token", input_args, output_data, False, str(e))


def test_is_placeholder_token() -> dict:
    """Test placeholder token detection."""
    test_cases = [
        ("", True, "Empty string"),
        ("<placeholder>", True, "Angle brackets"),
        ("changeme", True, "Changeme"),
        ("awiki_abc123", False, "Real token"),
        ("awiki_local_xyz", False, "Local daemon token"),
    ]
    
    tests = []
    for token, expected, desc in test_cases:
        input_args = {"token": token, "desc": desc}
        output_data = {"is_placeholder": None}
        
        try:
            result = _is_placeholder_token(token)
            output_data["is_placeholder"] = result
            success = result == expected
            tests.append(record_result(f"is_placeholder: {desc}", input_args, output_data, success))
        except Exception as e:
            tests.append(record_result(f"is_placeholder: {desc}", input_args, output_data, False, str(e)))
    
    return {"batch_tests": tests}


def test_constants() -> dict:
    """Test module constants."""
    input_args = {}
    output_data = {
        "DEFAULT_LOCAL_DAEMON_HOST": DEFAULT_LOCAL_DAEMON_HOST,
        "DEFAULT_LOCAL_DAEMON_PORT": DEFAULT_LOCAL_DAEMON_PORT,
        "RECEIVE_MODE_HTTP": RECEIVE_MODE_HTTP,
        "RECEIVE_MODE_WEBSOCKET": RECEIVE_MODE_WEBSOCKET
    }
    
    try:
        return record_result("constants", input_args, output_data, True)
    except Exception as e:
        return record_result("constants", input_args, output_data, False, str(e))


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
    """Extract setup_realtime.py input/output as golden standard."""
    results = {
        "file": "python/scripts/setup_realtime.py",
        "doc_path": "doc/scripts/setup_realtime.py",
        "version": "1.3.10",
        "functions": [],
        "constants": {
            "DEFAULT_LOCAL_DAEMON_HOST": DEFAULT_LOCAL_DAEMON_HOST,
            "DEFAULT_LOCAL_DAEMON_PORT": DEFAULT_LOCAL_DAEMON_PORT,
            "RECEIVE_MODE_HTTP": RECEIVE_MODE_HTTP,
            "RECEIVE_MODE_WEBSOCKET": RECEIVE_MODE_WEBSOCKET
        },
        "classes": {}
    }
    
    print("Running setup_realtime.py distillation tests...", file=sys.stderr)
    
    # Test constants
    results["functions"].append({
        "name": "Constants",
        "type": "constants",
        "description": "Module constants",
        "tests": [test_constants()]
    })
    
    # Test token generation
    results["functions"].append({
        "name": "_generate_token",
        "type": "function",
        "signature": "() -> str",
        "description": "Generate secure webhook token with awiki_ prefix",
        "tests": [test_generate_token()]
    })
    
    results["functions"].append({
        "name": "_generate_local_daemon_token",
        "type": "function",
        "signature": "() -> str",
        "description": "Generate secure token for localhost daemon requests",
        "tests": [test_generate_local_daemon_token()]
    })
    
    # Test placeholder detection
    results["functions"].append({
        "name": "_is_placeholder_token",
        "type": "function",
        "signature": "(token: str) -> bool",
        "description": "Check if token is a template placeholder",
        "tests": test_is_placeholder_token()
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
