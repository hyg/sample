#!/usr/bin/env python3
"""Distillation script for message_transport.py.

[INPUT]: SDKConfig, settings.json path, receive mode constants
[OUTPUT]: Configured message transport mode (HTTP/WebSocket)
[POS]: Message transport mode configuration and persistence

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updating
"""

import sys
from pathlib import Path

# Use absolute path for project root
PROJECT_ROOT = Path(r"D:\\huangyg\\git\\sample\\awiki")
PYTHON_SCRIPTS = PROJECT_ROOT / 'python' / 'scripts'

sys.path.insert(0, str(PYTHON_SCRIPTS))

from message_transport import (
    RECEIVE_MODE_HTTP,
    RECEIVE_MODE_WEBSOCKET,
    write_receive_mode,
    load_receive_mode,
    is_websocket_mode,
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


def test_receive_mode_constants() -> dict:
    """Test receive mode constants."""
    input_args = {}
    output_data = {
        "RECEIVE_MODE_HTTP": RECEIVE_MODE_HTTP,
        "RECEIVE_MODE_WEBSOCKET": RECEIVE_MODE_WEBSOCKET
    }
    
    try:
        assert RECEIVE_MODE_HTTP == "http"
        assert RECEIVE_MODE_WEBSOCKET == "websocket"
        return record_result("constants", input_args, output_data, True)
    except Exception as e:
        return record_result("constants", input_args, output_data, False, str(e))


def test_write_receive_mode_websocket() -> dict:
    """Test writing WebSocket receive mode."""
    input_args = {"mode": RECEIVE_MODE_WEBSOCKET}
    output_data = {"config_written": False, "mode": None}
    
    try:
        write_receive_mode(RECEIVE_MODE_WEBSOCKET)
        config = SDKConfig.load()
        settings_path = config.data_dir / "config" / "settings.json"
        
        if settings_path.exists():
            data = json.loads(settings_path.read_text(encoding="utf-8"))
            output_data["config_written"] = True
            output_data["mode"] = data.get("receive_mode")
        
        return record_result("write_websocket", input_args, output_data, True)
    except Exception as e:
        return record_result("write_websocket", input_args, output_data, False, str(e))


def test_write_receive_mode_http() -> dict:
    """Test writing HTTP receive mode."""
    input_args = {"mode": RECEIVE_MODE_HTTP}
    output_data = {"config_written": False, "mode": None}
    
    try:
        write_receive_mode(RECEIVE_MODE_HTTP)
        config = SDKConfig.load()
        settings_path = config.data_dir / "config" / "settings.json"
        
        if settings_path.exists():
            data = json.loads(settings_path.read_text(encoding="utf-8"))
            output_data["config_written"] = True
            output_data["mode"] = data.get("receive_mode")
        
        return record_result("write_http", input_args, output_data, True)
    except Exception as e:
        return record_result("write_http", input_args, output_data, False, str(e))


def test_load_receive_mode() -> dict:
    """Test loading receive mode."""
    input_args = {}
    output_data = {"mode_read": None, "default": RECEIVE_MODE_HTTP}
    
    try:
        # First write a mode
        write_receive_mode(RECEIVE_MODE_WEBSOCKET)
        
        # Then read it back
        config = SDKConfig.load()
        mode = load_receive_mode(config)
        output_data["mode_read"] = mode
        
        return record_result("load_mode", input_args, output_data, True)
    except Exception as e:
        return record_result("load_mode", input_args, output_data, False, str(e))


def test_is_websocket_mode() -> dict:
    """Test is_websocket_mode check."""
    input_args = {"mode_to_set": RECEIVE_MODE_WEBSOCKET}
    output_data = {"is_websocket": None}
    
    try:
        write_receive_mode(RECEIVE_MODE_WEBSOCKET)
        config = SDKConfig.load()
        result = is_websocket_mode(config)
        output_data["is_websocket"] = result
        
        return record_result("is_websocket", input_args, output_data, True, )
    except Exception as e:
        return record_result("is_websocket", input_args, output_data, False, str(e))


def test_mode_switch() -> dict:
    """Test switching between modes."""
    input_args = {"switch_from": RECEIVE_MODE_WEBSOCKET, "switch_to": RECEIVE_MODE_HTTP}
    output_data = {"initial_mode": None, "final_mode": None, "switched": False}
    
    try:
        # Set initial mode
        write_receive_mode(RECEIVE_MODE_WEBSOCKET)
        config = SDKConfig.load()
        output_data["initial_mode"] = load_receive_mode(config)
        
        # Switch mode
        write_receive_mode(RECEIVE_MODE_HTTP)
        output_data["final_mode"] = load_receive_mode(config)
        
        output_data["switched"] = (
            output_data["initial_mode"] == RECEIVE_MODE_WEBSOCKET and
            output_data["final_mode"] == RECEIVE_MODE_HTTP
        )
        
        return record_result("mode_switch", input_args, output_data, True)
    except Exception as e:
        return record_result("mode_switch", input_args, output_data, False, str(e))


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
            test_mode_switch()
        ]
    })
    
    # Test load_receive_mode
    results["functions"].append({
        "name": "load_receive_mode",
        "type": "function",
        "signature": "(config: SDKConfig | None = None) -> str",
        "description": "Load message transport mode from settings.json (defaults to HTTP)",
        "tests": [test_load_receive_mode()]
    })
    
    # Test is_websocket_mode
    results["functions"].append({
        "name": "is_websocket_mode",
        "type": "function",
        "signature": "(config: SDKConfig | None = None) -> bool",
        "description": "Check if WebSocket mode is enabled",
        "tests": [test_is_websocket_mode()]
    })
    
    return results


if __name__ == "__main__":
    results = distill()
    print(json.dumps(results, indent=2, default=str))
