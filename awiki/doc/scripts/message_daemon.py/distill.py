#!/usr/bin/env python3
"""Distillation script for message_daemon.py.

[INPUT]: Local daemon configuration
[OUTPUT]: Local message daemon settings and availability check
[POS]: Local message daemon configuration for HTTP polling fallback

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

from message_daemon import (
    DEFAULT_LOCAL_DAEMON_HOST,
    DEFAULT_LOCAL_DAEMON_PORT,
    load_local_daemon_settings,
    is_local_daemon_available,
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
        assert DEFAULT_LOCAL_DAEMON_HOST == "localhost"
        assert isinstance(DEFAULT_LOCAL_DAEMON_PORT, int)
        assert DEFAULT_LOCAL_DAEMON_PORT > 0
        return record_result("constants", input_args, output_data, True)
    except Exception as e:
        return record_result("constants", input_args, output_data, False, str(e))


def test_load_local_daemon_settings() -> dict:
    """Test loading local daemon settings."""
    input_args = {}
    output_data = {
        "settings_loaded": False,
        "host": None,
        "port": None,
        "token": None
    }
    
    try:
        config = SDKConfig.load()
        settings = load_local_daemon_settings(config)
        
        output_data["settings_loaded"] = settings is not None
        if settings:
            output_data["host"] = settings.get("host")
            output_data["port"] = settings.get("port")
            output_data["token"] = settings.get("token")[:20] + "..." if settings.get("token") else None
        
        return record_result("load_settings", input_args, output_data, True)
    except Exception as e:
        return record_result("load_settings", input_args, output_data, False, str(e))


def test_is_local_daemon_available_false() -> dict:
    """Test daemon availability when not configured."""
    input_args = {"daemon_not_configured": True}
    output_data = {
        "available": False,
        "reason": "not_configured_or_running"
    }
    
    try:
        available = is_local_daemon_available()
        output_data["available"] = available
        
        return record_result("daemon_not_available", input_args, output_data, True)
    except Exception as e:
        return record_result("daemon_not_available", input_args, output_data, False, str(e))


def test_sdk_config_integration() -> dict:
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
    
    # Test load_local_daemon_settings
    results["functions"].append({
        "name": "load_local_daemon_settings",
        "type": "function",
        "signature": "(config: SDKConfig) -> dict | None",
        "description": "Load local daemon settings from settings.json",
        "tests": [test_load_local_daemon_settings()]
    })
    
    # Test is_local_daemon_available
    results["functions"].append({
        "name": "is_local_daemon_available",
        "type": "function",
        "signature": "() -> bool",
        "description": "Check if local daemon is configured and available",
        "tests": [test_is_local_daemon_available_false()]
    })
    
    # Test SDK integration
    results["functions"].append({
        "name": "SDKConfig.load",
        "type": "classmethod",
        "signature": "() -> SDKConfig",
        "description": "Load SDK configuration",
        "tests": [test_sdk_config_integration()]
    })
    
    return results


if __name__ == "__main__":
    results = distill()
    print(json.dumps(results, indent=2, default=str))
