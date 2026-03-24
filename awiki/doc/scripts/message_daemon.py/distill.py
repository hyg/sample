#!/usr/bin/env python3
"""Distillation script for message_daemon.py.

[INPUT]: SDKConfig, daemon configuration parameters
[OUTPUT]: Configured message daemon settings for local HTTP server
[POS]: Local message daemon configuration for HTTP polling mode

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

from message_daemon import (
    DEFAULT_LOCAL_DAEMON_HOST,
    DEFAULT_LOCAL_DAEMON_PORT,
    _generate_local_daemon_token,
    _is_valid_token,
    _daemon_config_path,
    _load_daemon_config,
    _save_daemon_config
)
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


def test_daemon_constants() -> dict:
    """Test daemon configuration constants."""
    input_args = {}
    output_data = {
        "DEFAULT_LOCAL_DAEMON_HOST": DEFAULT_LOCAL_DAEMON_HOST,
        "DEFAULT_LOCAL_DAEMON_PORT": DEFAULT_LOCAL_DAEMON_PORT
    }
    
    try:
        # Verify constants
        assert DEFAULT_LOCAL_DAEMON_HOST == "localhost"
        assert isinstance(DEFAULT_LOCAL_DAEMON_PORT, int)
        assert DEFAULT_LOCAL_DAEMON_PORT > 0
        
        return record_result("constants", input_args, output_data, True)
    except Exception as e:
        return record_result("constants", input_args, output_data, False, str(e))


def test_generate_local_daemon_token() -> dict:
    """Test local daemon token generation."""
    input_args = {}
    output_data = {
        "token_generated": False,
        "token_prefix": "awiki_local_",
        "token_length": 0
    }
    
    try:
        token = _generate_local_daemon_token()
        
        output_data["token_generated"] = True
        output_data["token"] = token[:20] + "..."  # Truncate for security
        output_data["token_prefix"] = token[:13]
        output_data["token_length"] = len(token)
        
        return record_result("generate_token", input_args, output_data, True)
    except Exception as e:
        return record_result("generate_token", input_args, output_data, False, str(e))


def test_is_valid_token() -> dict:
    """Test token validation."""
    test_cases = [
        ("awiki_local_abc123", True, "Valid token"),
        ("awiki_abc123", False, "Wrong prefix"),
        ("", False, "Empty token"),
        (None, False, "None token"),
        ("awiki_local_", False, "Prefix only"),
    ]
    
    tests = []
    for token, expected, desc in test_cases:
        input_args = {"token": token, "desc": desc}
        output_data = {"is_valid": None}
        
        try:
            result = _is_valid_token(token)
            output_data["is_valid"] = result
            success = result == expected
            tests.append(record_result(f"valid_token: {desc}", input_args, output_data, success))
        except Exception as e:
            tests.append(record_result(f"valid_token: {desc}", input_args, output_data, False, str(e)))
    
    return {"batch_tests": tests}


def test_daemon_config_path() -> dict:
    """Test daemon config path resolution."""
    input_args = {}
    output_data = {
        "path": str(_daemon_config_path()),
        "parent_exists": False,
        "is_absolute": False
    }
    
    try:
        output_data["parent_exists"] = _daemon_config_path().parent.exists()
        output_data["is_absolute"] = _daemon_config_path().is_absolute()
        
        return record_result("config_path", input_args, output_data, True)
    except Exception as e:
        return record_result("config_path", input_args, output_data, False, str(e))


def test_load_daemon_config_missing() -> dict:
    """Test loading daemon config when file is missing."""
    input_args = {"config_missing": True}
    output_data = {
        "config_loaded": False,
        "default_host": None,
        "default_port": None
    }
    
    try:
        config = _load_daemon_config()
        
        output_data["config_loaded"] = config is not None
        if config:
            output_data["default_host"] = config.get("host")
            output_data["default_port"] = config.get("port")
        
        return record_result("load_missing", input_args, output_data, True)
    except Exception as e:
        return record_result("load_missing", input_args, output_data, False, str(e))


def test_save_and_load_daemon_config() -> dict:
    """Test saving and loading daemon config."""
    input_args = {
        "host": "localhost",
        "port": 8765,
        "token": _generate_local_daemon_token()
    }
    output_data = {
        "saved": False,
        "loaded": False,
        "matches": False
    }
    
    try:
        # Save config
        config_to_save = {
            "host": input_args["host"],
            "port": input_args["port"],
            "token": input_args["token"]
        }
        _save_daemon_config(config_to_save)
        output_data["saved"] = True
        
        # Load config
        loaded_config = _load_daemon_config()
        output_data["loaded"] = loaded_config is not None
        
        if loaded_config:
            output_data["matches"] = (
                loaded_config.get("host") == input_args["host"] and
                loaded_config.get("port") == input_args["port"]
            )
        
        return record_result("save_and_load", input_args, output_data, True)
    except Exception as e:
        return record_result("save_and_load", input_args, output_data, False, str(e))


def test_daemon_config_merge() -> dict:
    """Test that saving config merges with existing config."""
    input_args = {
        "initial": {"host": "localhost", "port": 8765},
        "update": {"port": 9999}
    }
    output_data = {
        "initial_saved": False,
        "updated_saved": False,
        "host_preserved": False,
        "port_updated": False
    }
    
    try:
        # Save initial config
        _save_daemon_config(input_args["initial"])
        output_data["initial_saved"] = True
        
        # Update config (merge)
        _save_daemon_config(input_args["update"])
        output_data["updated_saved"] = True
        
        # Load and verify merge
        loaded = _load_daemon_config()
        if loaded:
            output_data["host_preserved"] = loaded.get("host") == "localhost"
            output_data["port_updated"] = loaded.get("port") == 9999
        
        return record_result("config_merge", input_args, output_data, True)
    except Exception as e:
        return record_result("config_merge", input_args, output_data, False, str(e))


def test_sdk_config_integration() -> dict:
    """Test SDK config integration with daemon config."""
    input_args = {}
    output_data = {
        "sdk_config_loaded": False,
        "daemon_config_path": None
    }
    
    try:
        # Load SDK config
        config = SDKConfig()
        output_data["sdk_config_loaded"] = config is not None
        output_data["daemon_config_path"] = str(_daemon_config_path())
        
        return record_result("sdk_integration", input_args, output_data, True)
    except Exception as e:
        return record_result("sdk_integration", input_args, output_data, False, str(e))


def distill():
    """Extract message_daemon.py input/output as golden standard."""
    results = {
        "file": "python/scripts/message_daemon.py",
        "doc_path": "doc/scripts/message_daemon.py",
        "version": "1.3.10",
        "functions": [],
        "constants": {
            "DEFAULT_LOCAL_DAEMON_HOST": DEFAULT_LOCAL_DAEMON_HOST,
            "DEFAULT_LOCAL_DAEMON_PORT": DEFAULT_LOCAL_DAEMON_PORT
        },
        "classes": {}
    }
    
    print("Running message_daemon.py distillation tests...", file=sys.stderr)
    
    # Test constants
    results["functions"].append({
        "name": "DEFAULT_LOCAL_DAEMON_HOST",
        "type": "constant",
        "value": DEFAULT_LOCAL_DAEMON_HOST,
        "description": "Default host for local message daemon",
        "tests": [test_daemon_constants()]
    })
    
    results["functions"].append({
        "name": "DEFAULT_LOCAL_DAEMON_PORT",
        "type": "constant",
        "value": DEFAULT_LOCAL_DAEMON_PORT,
        "description": "Default port for local message daemon",
        "tests": [test_daemon_constants()]
    })
    
    # Test token generation
    results["functions"].append({
        "name": "_generate_local_daemon_token",
        "type": "function",
        "signature": "() -> str",
        "description": "Generate secure token for local daemon requests",
        "tests": [test_generate_local_daemon_token()]
    })
    
    # Test token validation
    results["functions"].append({
        "name": "_is_valid_token",
        "type": "function",
        "signature": "(token: str | None) -> bool",
        "description": "Validate local daemon token format",
        "tests": [test_is_valid_token()]
    })
    
    # Test config path
    results["functions"].append({
        "name": "_daemon_config_path",
        "type": "function",
        "signature": "() -> Path",
        "description": "Resolve daemon config path",
        "tests": [test_daemon_config_path()]
    })
    
    # Test config load/save
    results["functions"].append({
        "name": "_load_daemon_config",
        "type": "function",
        "signature": "() -> dict | None",
        "description": "Load daemon config from file",
        "tests": [
            test_load_daemon_config_missing(),
            test_save_and_load_daemon_config()
        ]
    })
    
    results["functions"].append({
        "name": "_save_daemon_config",
        "type": "function",
        "signature": "(config: dict) -> None",
        "description": "Save daemon config to file (merges with existing)",
        "tests": [
            test_save_and_load_daemon_config(),
            test_daemon_config_merge()
        ]
    })
    
    # Test SDK integration
    results["functions"].append({
        "name": "SDKConfig",
        "type": "class",
        "description": "SDK configuration integration",
        "tests": [test_sdk_config_integration()]
    })
    
    return results


if __name__ == "__main__":
    results = distill()
    print(json.dumps(results, indent=2, default=str))
