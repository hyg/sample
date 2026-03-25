#!/usr/bin/env python3
"""Distillation script for listener_recovery.py.

[INPUT]: SDKConfig, listener runtime state
[OUTPUT]: Listener runtime status and health checks
[POS]: WebSocket listener runtime monitoring and recovery

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

from listener_recovery import (
    ensure_listener_runtime,
    get_listener_runtime_report,
    get_listener_recovery_state,
    probe_listener_runtime,
    note_listener_healthy,
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


def test_get_listener_runtime_report() -> dict:
    """Test getting listener runtime report."""
    input_args = {}
    output_data = {
        "report": None,
        "running": False
    }
    
    try:
        report = get_listener_runtime_report()
        output_data["report"] = report
        output_data["running"] = report.get("running", False) if report else False
        
        return record_result("runtime_report", input_args, output_data, True)
    except Exception as e:
        return record_result("runtime_report", input_args, output_data, False, str(e))


def test_probe_listener_runtime() -> dict:
    """Test probing listener runtime."""
    input_args = {}
    output_data = {
        "probe_result": None,
        "daemon_available": False
    }
    
    try:
        result = probe_listener_runtime()
        output_data["probe_result"] = result
        output_data["daemon_available"] = is_local_daemon_available()
        
        return record_result("probe_runtime", input_args, output_data, True)
    except Exception as e:
        return record_result("probe_runtime", input_args, output_data, False, str(e))


def test_ensure_listener_runtime() -> dict:
    """Test ensuring listener runtime."""
    input_args = {}
    output_data = {
        "result": None,
        "running": False
    }
    
    try:
        result = ensure_listener_runtime()
        output_data["result"] = result
        output_data["running"] = result.get("running", False) if result else False
        
        return record_result("ensure_runtime", input_args, output_data, True)
    except Exception as e:
        return record_result("ensure_runtime", input_args, output_data, False, str(e))


def test_get_listener_recovery_state() -> dict:
    """Test getting listener recovery state."""
    input_args = {}
    output_data = {
        "state": None,
        "restart_failures": 0
    }
    
    try:
        state = get_listener_recovery_state()
        output_data["state"] = state
        output_data["restart_failures"] = state.get("restart_failures", 0) if state else 0
        
        return record_result("recovery_state", input_args, output_data, True)
    except Exception as e:
        return record_result("recovery_state", input_args, output_data, False, str(e))


def test_is_local_daemon_available() -> dict:
    """Test checking local daemon availability."""
    input_args = {}
    output_data = {
        "available": False
    }
    
    try:
        available = is_local_daemon_available()
        output_data["available"] = available
        
        return record_result("daemon_available", input_args, output_data, True)
    except Exception as e:
        return record_result("daemon_available", input_args, output_data, False, str(e))


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
    """Extract listener_recovery.py input/output as golden standard."""
    results = {
        "file": "python/scripts/listener_recovery.py",
        "doc_path": "doc/scripts/listener_recovery.py",
        "version": "1.3.10",
        "functions": [],
        "constants": {},
        "classes": {}
    }
    
    print("Running listener_recovery.py distillation tests...", file=sys.stderr)
    
    # Test get_listener_runtime_report
    results["functions"].append({
        "name": "get_listener_runtime_report",
        "type": "function",
        "signature": "() -> dict | None",
        "description": "Get current listener runtime status report",
        "tests": [test_get_listener_runtime_report()]
    })
    
    # Test probe_listener_runtime
    results["functions"].append({
        "name": "probe_listener_runtime",
        "type": "function",
        "signature": "() -> dict | None",
        "description": "Probe listener runtime status",
        "tests": [test_probe_listener_runtime()]
    })
    
    # Test ensure_listener_runtime
    results["functions"].append({
        "name": "ensure_listener_runtime",
        "type": "function",
        "signature": "() -> dict | None",
        "description": "Ensure listener is running, auto-restart if stopped",
        "tests": [test_ensure_listener_runtime()]
    })
    
    # Test get_listener_recovery_state
    results["functions"].append({
        "name": "get_listener_recovery_state",
        "type": "function",
        "signature": "() -> dict | None",
        "description": "Get listener recovery state including restart failures",
        "tests": [test_get_listener_recovery_state()]
    })
    
    # Test is_local_daemon_available
    results["functions"].append({
        "name": "is_local_daemon_available",
        "type": "function",
        "signature": "() -> bool",
        "description": "Check if local daemon is configured and available",
        "tests": [test_is_local_daemon_available()]
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
