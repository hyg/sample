#!/usr/bin/env python3
"""Distillation script for listener_recovery.py.

[INPUT]: SDKConfig, service_manager, ws_listener runtime state
[OUTPUT]: Listener runtime status and auto-recovery actions
[POS]: WebSocket listener runtime monitoring and recovery

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

from listener_recovery import (
    ensure_listener_runtime,
    get_listener_runtime_report,
    _listener_status_path,
    _load_listener_status,
    _save_listener_status
)
from service_manager import get_service_manager
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


def test_listener_status_path() -> dict:
    """Test listener status path resolution."""
    input_args = {}
    output_data = {
        "path": str(_listener_status_path()),
        "parent_exists": False,
        "is_absolute": False
    }
    
    try:
        output_data["parent_exists"] = _listener_status_path().parent.exists()
        output_data["is_absolute"] = _listener_status_path().is_absolute()
        
        return record_result("status_path", input_args, output_data, True)
    except Exception as e:
        return record_result("status_path", input_args, output_data, False, str(e))


def test_load_listener_status_missing() -> dict:
    """Test loading listener status when file is missing."""
    input_args = {"config_missing": True}
    output_data = {
        "status_loaded": False,
        "running": False
    }
    
    try:
        status = _load_listener_status()
        
        output_data["status_loaded"] = status is not None
        if status:
            output_data["running"] = status.get("running", False)
        
        return record_result("load_missing", input_args, output_data, True)
    except Exception as e:
        return record_result("load_missing", input_args, output_data, False, str(e))


def test_save_and_load_listener_status() -> dict:
    """Test saving and loading listener status."""
    input_args = {
        "running": True,
        "pid": 12345,
        "mode": "websocket"
    }
    output_data = {
        "saved": False,
        "loaded": False,
        "matches": False
    }
    
    try:
        # Save status
        _save_listener_status(input_args)
        output_data["saved"] = True
        
        # Load status
        loaded = _load_listener_status()
        output_data["loaded"] = loaded is not None
        
        if loaded:
            output_data["matches"] = (
                loaded.get("running") == input_args["running"] and
                loaded.get("pid") == input_args["pid"] and
                loaded.get("mode") == input_args["mode"]
            )
        
        return record_result("save_and_load", input_args, output_data, True)
    except Exception as e:
        return record_result("save_and_load", input_args, output_data, False, str(e))


def test_get_listener_runtime_report() -> dict:
    """Test getting listener runtime report."""
    input_args = {}
    output_data = {
        "report_generated": False,
        "running": False,
        "pid": None,
        "mode": None
    }
    
    try:
        report = get_listener_runtime_report()
        
        output_data["report_generated"] = report is not None
        if report:
            output_data["running"] = report.get("running", False)
            output_data["pid"] = report.get("pid")
            output_data["mode"] = report.get("mode")
        
        return record_result("runtime_report", input_args, output_data, True)
    except Exception as e:
        return record_result("runtime_report", input_args, output_data, False, str(e))


def test_ensure_listener_runtime_stopped() -> dict:
    """Test ensure_listener_runtime when listener is stopped."""
    input_args = {"listener_stopped": True}
    output_data = {
        "was_running": False,
        "auto_restart_attempted": False,
        "now_running": False
    }
    
    try:
        # Get initial status
        initial_report = get_listener_runtime_report()
        output_data["was_running"] = initial_report.get("running", False) if initial_report else False
        
        # Ensure runtime (should attempt restart if stopped)
        result = ensure_listener_runtime()
        
        output_data["auto_restart_attempted"] = result is not None
        output_data["now_running"] = result.get("running", False) if result else False
        
        return record_result("ensure_stopped", input_args, output_data, True)
    except Exception as e:
        return record_result("ensure_stopped", input_args, output_data, False, str(e))


def test_ensure_listener_runtime_running() -> dict:
    """Test ensure_listener_runtime when listener is already running."""
    input_args = {"listener_running": True}
    output_data = {
        "was_running": False,
        "no_restart_needed": True,
        "still_running": False
    }
    
    try:
        # Get initial status
        initial_report = get_listener_runtime_report()
        output_data["was_running"] = initial_report.get("running", False) if initial_report else False
        
        # Ensure runtime (should not restart if already running)
        result = ensure_listener_runtime()
        
        output_data["no_restart_needed"] = result is not None
        output_data["still_running"] = result.get("running", False) if result else False
        
        return record_result("ensure_running", input_args, output_data, True)
    except Exception as e:
        return record_result("ensure_running", input_args, output_data, False, str(e))


def test_service_manager_integration() -> dict:
    """Test service manager integration."""
    input_args = {}
    output_data = {
        "service_manager_available": False,
        "platform": None
    }
    
    try:
        manager = get_service_manager()
        
        output_data["service_manager_available"] = manager is not None
        if manager:
            output_data["platform"] = manager.platform
        
        return record_result("service_manager", input_args, output_data, True)
    except Exception as e:
        return record_result("service_manager", input_args, output_data, False, str(e))


def test_sdk_config_integration() -> dict:
    """Test SDK config integration."""
    input_args = {}
    output_data = {
        "sdk_config_loaded": False,
        "listener_config_path": None
    }
    
    try:
        config = SDKConfig()
        
        output_data["sdk_config_loaded"] = config is not None
        output_data["listener_config_path"] = str(_listener_status_path())
        
        return record_result("sdk_integration", input_args, output_data, True)
    except Exception as e:
        return record_result("sdk_integration", input_args, output_data, False, str(e))


def test_status_update_flow() -> dict:
    """Test complete status update flow."""
    input_args = {
        "flow": "save_status -> load_status -> verify"
    }
    output_data = {
        "initial_status": None,
        "updated_status": None,
        "flow_success": False
    }
    
    try:
        # Save initial status
        initial_status = {
            "running": True,
            "pid": 99999,
            "mode": "websocket",
            "last_check": "2026-03-24T00:00:00Z"
        }
        _save_listener_status(initial_status)
        output_data["initial_status"] = initial_status
        
        # Load and verify
        loaded = _load_listener_status()
        output_data["updated_status"] = loaded
        
        if loaded:
            output_data["flow_success"] = (
                loaded.get("running") == initial_status["running"] and
                loaded.get("pid") == initial_status["pid"] and
                loaded.get("mode") == initial_status["mode"]
            )
        
        return record_result("status_flow", input_args, output_data, True)
    except Exception as e:
        return record_result("status_flow", input_args, output_data, False, str(e))


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
    
    # Test status path
    results["functions"].append({
        "name": "_listener_status_path",
        "type": "function",
        "signature": "() -> Path",
        "description": "Resolve listener status file path",
        "tests": [test_listener_status_path()]
    })
    
    # Test status load/save
    results["functions"].append({
        "name": "_load_listener_status",
        "type": "function",
        "signature": "() -> dict | None",
        "description": "Load listener status from file",
        "tests": [
            test_load_listener_status_missing(),
            test_save_and_load_listener_status()
        ]
    })
    
    results["functions"].append({
        "name": "_save_listener_status",
        "type": "function",
        "signature": "(status: dict) -> None",
        "description": "Save listener status to file",
        "tests": [
            test_save_and_load_listener_status(),
            test_status_update_flow()
        ]
    })
    
    # Test runtime report
    results["functions"].append({
        "name": "get_listener_runtime_report",
        "type": "function",
        "signature": "() -> dict | None",
        "description": "Get current listener runtime status report",
        "tests": [test_get_listener_runtime_report()]
    })
    
    # Test ensure runtime
    results["functions"].append({
        "name": "ensure_listener_runtime",
        "type": "function",
        "signature": "() -> dict | None",
        "description": "Ensure listener is running, auto-restart if stopped",
        "tests": [
            test_ensure_listener_runtime_stopped(),
            test_ensure_listener_runtime_running()
        ]
    })
    
    # Test integrations
    results["functions"].append({
        "name": "get_service_manager",
        "type": "function",
        "signature": "() -> ServiceManager",
        "description": "Get service manager for platform",
        "tests": [test_service_manager_integration()]
    })
    
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
