#!/usr/bin/env python3
"""Distillation script for message_transport.py.

[INPUT]: SDKConfig, settings.json path, receive mode constants
[OUTPUT]: Configured message transport mode (HTTP/WebSocket)
[POS]: Message transport mode configuration and persistence

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updating

Idempotent design: safe to run multiple times. Existing config is merged, not overwritten.
"""

import sys
from pathlib import Path

# Project root: 5 levels up from distill.py
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
PYTHON_SCRIPTS = PROJECT_ROOT / 'python' / 'scripts'

sys.path.insert(0, str(PYTHON_SCRIPTS))

from message_transport import (
    RECEIVE_MODE_HTTP,
    RECEIVE_MODE_WEBSOCKET,
    write_receive_mode,
    read_receive_mode,
    _settings_path,
    _load_json,
    _save_json
)
from utils.config import SDKConfig
import json
import os


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


def test_receive_mode_constants() -> dict:
    """Test receive mode constants."""
    input_args = {}
    output_data = {
        "RECEIVE_MODE_HTTP": RECEIVE_MODE_HTTP,
        "RECEIVE_MODE_WEBSOCKET": RECEIVE_MODE_WEBSOCKET
    }
    
    try:
        # Verify constants are defined
        assert RECEIVE_MODE_HTTP == "http"
        assert RECEIVE_MODE_WEBSOCKET == "websocket"
        
        return record_result("constants", input_args, output_data, True)
    except Exception as e:
        return record_result("constants", input_args, output_data, False, str(e))


def test_write_receive_mode_websocket() -> dict:
    """Test writing WebSocket receive mode."""
    input_args = {"mode": RECEIVE_MODE_WEBSOCKET}
    output_data = {"config_written": False, "mode": None, "path": str(_settings_path())}
    
    try:
        write_receive_mode(RECEIVE_MODE_WEBSOCKET)
        
        # Verify the config was written
        if _settings_path.exists():
            config = _load_json(_settings_path())
            output_data["config_written"] = True
            output_data["mode"] = config.get("receive_mode")
        
        return record_result("write_websocket", input_args, output_data, True)
    except Exception as e:
        return record_result("write_websocket", input_args, output_data, False, str(e))


def test_write_receive_mode_http() -> dict:
    """Test writing HTTP receive mode."""
    input_args = {"mode": RECEIVE_MODE_HTTP}
    output_data = {"config_written": False, "mode": None, "path": str(_settings_path())}
    
    try:
        write_receive_mode(RECEIVE_MODE_HTTP)
        
        # Verify the config was written
        if _settings_path.exists():
            config = _load_json(_settings_path())
            output_data["config_written"] = True
            output_data["mode"] = config.get("receive_mode")
        
        return record_result("write_http", input_args, output_data, True)
    except Exception as e:
        return record_result("write_http", input_args, output_data, False, str(e))


def test_read_receive_mode() -> dict:
    """Test reading receive mode."""
    input_args = {}
    output_data = {"mode_read": None, "default": RECEIVE_MODE_HTTP}
    
    try:
        # First write a mode
        write_receive_mode(RECEIVE_MODE_WEBSOCKET)
        
        # Then read it back
        mode = read_receive_mode()
        output_data["mode_read"] = mode
        
        return record_result("read_mode", input_args, output_data, True)
    except Exception as e:
        return record_result("read_mode", input_args, output_data, False, str(e))


def test_read_receive_mode_missing() -> dict:
    """Test reading receive mode when config is missing."""
    input_args = {"config_missing": True}
    output_data = {"mode_read": None, "default": RECEIVE_MODE_HTTP}
    
    try:
        # Backup existing config
        backup = None
        if _settings_path.exists():
            backup = _load_json(_settings_path())
            _settings_path.unlink()
        
        # Read mode (should return default)
        mode = read_receive_mode()
        output_data["mode_read"] = mode
        output_data["returned_default"] = mode == RECEIVE_MODE_HTTP
        
        # Restore backup
        if backup:
            _save_json(_settings_path(), backup)
        
        return record_result("read_missing", input_args, output_data, True)
    except Exception as e:
        return record_result("read_missing", input_args, output_data, False, str(e))


def test_idempotent_write() -> dict:
    """Test idempotent write (multiple writes should merge, not overwrite)."""
    input_args = {"mode": RECEIVE_MODE_WEBSOCKET, "rerun": True}
    output_data = {"first_write": None, "second_write": None, "unchanged": True}
    
    try:
        # First write
        write_receive_mode(RECEIVE_MODE_WEBSOCKET)
        config1 = _load_json(_settings_path()) if _settings_path.exists() else None
        output_data["first_write"] = config1.get("receive_mode") if config1 else None
        
        # Second write (same mode)
        write_receive_mode(RECEIVE_MODE_WEBSOCKET)
        config2 = _load_json(_settings_path()) if _settings_path.exists() else None
        output_data["second_write"] = config2.get("receive_mode") if config2 else None
        
        # Verify unchanged
        output_data["unchanged"] = output_data["first_write"] == output_data["second_write"]
        
        return record_result("idempotent_write", input_args, output_data, True)
    except Exception as e:
        return record_result("idempotent_write", input_args, output_data, False, str(e))


def test_mode_switch() -> dict:
    """Test switching between modes."""
    input_args = {"switch_from": RECEIVE_MODE_WEBSOCKET, "switch_to": RECEIVE_MODE_HTTP}
    output_data = {"initial_mode": None, "final_mode": None, "switched": False}
    
    try:
        # Set initial mode
        write_receive_mode(RECEIVE_MODE_WEBSOCKET)
        config1 = _load_json(_settings_path())
        output_data["initial_mode"] = config1.get("receive_mode")
        
        # Switch mode
        write_receive_mode(RECEIVE_MODE_HTTP)
        config2 = _load_json(_settings_path())
        output_data["final_mode"] = config2.get("receive_mode")
        
        # Verify switch
        output_data["switched"] = (
            output_data["initial_mode"] == RECEIVE_MODE_WEBSOCKET and
            output_data["final_mode"] == RECEIVE_MODE_HTTP
        )
        
        return record_result("mode_switch", input_args, output_data, True)
    except Exception as e:
        return record_result("mode_switch", input_args, output_data, False, str(e))


def test_settings_path_resolution() -> dict:
    """Test settings path resolution."""
    input_args = {}
    output_data = {
        "path": str(_settings_path()),
        "parent_exists": False,
        "is_absolute": False
    }
    
    try:
        output_data["parent_exists"] = _settings_path.parent.exists()
        output_data["is_absolute"] = _settings_path.is_absolute()
        
        return record_result("path_resolution", input_args, output_data, True)
    except Exception as e:
        return record_result("path_resolution", input_args, output_data, False, str(e))


def distill():
    """Extract message_transport.py input/output as golden standard."""
    results = {
        "file": "python/scripts/message_transport.py",
        "doc_path": "doc/scripts/message_transport.py",
        "version": "1.3.10",
        "functions": [],
        "constants": {
            "RECEIVE_MODE_HTTP": RECEIVE_MODE_HTTP,
            "RECEIVE_MODE_WEBSOCKET": RECEIVE_MODE_WEBSOCKET
        },
        "classes": {}
    }
    
    print("Running message_transport.py distillation tests...", file=sys.stderr)
    
    # Test constants
    results["functions"].append({
        "name": "RECEIVE_MODE_HTTP",
        "type": "constant",
        "value": RECEIVE_MODE_HTTP,
        "description": "HTTP polling receive mode",
        "tests": [test_receive_mode_constants()]
    })
    
    results["functions"].append({
        "name": "RECEIVE_MODE_WEBSOCKET",
        "type": "constant",
        "value": RECEIVE_MODE_WEBSOCKET,
        "description": "WebSocket push receive mode",
        "tests": [test_receive_mode_constants()]
    })
    
    # Test write_receive_mode
    results["functions"].append({
        "name": "write_receive_mode",
        "type": "function",
        "signature": "(mode: str) -> None",
        "description": "Write message transport mode to settings.json",
        "tests": [
            test_write_receive_mode_websocket(),
            test_write_receive_mode_http(),
            test_idempotent_write(),
            test_mode_switch()
        ]
    })
    
    # Test read_receive_mode
    results["functions"].append({
        "name": "read_receive_mode",
        "type": "function",
        "signature": "() -> str",
        "description": "Read message transport mode from settings.json (defaults to HTTP)",
        "tests": [
            test_read_receive_mode(),
            test_read_receive_mode_missing()
        ]
    })
    
    # Test internal helpers
    results["functions"].append({
        "name": "_settings_path",
        "type": "function",
        "signature": "() -> Path",
        "description": "Resolve settings.json path",
        "tests": [test_settings_path_resolution()]
    })
    
    results["functions"].append({
        "name": "_load_json",
        "type": "function",
        "signature": "(path: Path) -> dict",
        "description": "Load JSON file, returns empty dict if missing",
        "tests": []
    })
    
    results["functions"].append({
        "name": "_save_json",
        "type": "function",
        "signature": "(path: Path, data: dict) -> None",
        "description": "Save JSON file, creates parent directories",
        "tests": []
    })
    
    return results


if __name__ == "__main__":
    results = distill()
    print(json.dumps(results, indent=2, default=str))
