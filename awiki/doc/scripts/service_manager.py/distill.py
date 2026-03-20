#!/usr/bin/env python3
"""Distiller script for service_manager.py - records input/output as golden standard.

This script executes service_manager.py and captures:
- Input: platform info, configuration, environment
- Output: service manager instances, status data, method results
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

# Add scripts directory to path for imports (service_manager.py and utils are siblings)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_SCRIPTS_DIR = _PROJECT_ROOT / "python" / "scripts"
sys.path.insert(0, str(_SCRIPTS_DIR))

from service_manager import (
    ServiceManager,
    MacOSServiceManager,
    LinuxServiceManager,
    WindowsServiceManager,
    get_service_manager,
)


def record_input() -> dict[str, Any]:
    """Record input environment and configuration."""
    return {
        "platform": sys.platform,
        "python_version": sys.version,
        "python_executable": sys.executable,
        "project_root": str(_PROJECT_ROOT),
        "environment": {
            "LOCALAPPDATA": os.environ.get("LOCALAPPDATA"),
            "XDG_CONFIG_HOME": os.environ.get("XDG_CONFIG_HOME"),
            "XDG_STATE_HOME": os.environ.get("XDG_STATE_HOME"),
            "HOME": os.environ.get("HOME"),
        },
    }


def record_service_manager_info(manager: ServiceManager) -> dict[str, Any]:
    """Record service manager instance information."""
    info: dict[str, Any] = {
        "class_name": manager.__class__.__name__,
        "type": type(manager).__name__,
        "is_installed": manager.is_installed(),
        "log_dir": str(manager.log_dir()),
        "python_path": manager.find_python(),
    }
    
    # Platform-specific info
    if isinstance(manager, MacOSServiceManager):
        info["plist_path"] = str(manager._plist_path)
        info["agents_dir"] = str(manager._agents_dir)
    elif isinstance(manager, LinuxServiceManager):
        info["unit_path"] = str(manager._unit_path)
        info["unit_dir"] = str(manager._unit_dir)
        info["unit_name"] = manager._UNIT_NAME
    elif isinstance(manager, WindowsServiceManager):
        info["task_name"] = manager._TASK_NAME
        info["bat_path"] = str(manager._bat_path)
        info["app_dir"] = str(manager._app_dir)
    
    return info


def record_status(manager: ServiceManager) -> dict[str, Any]:
    """Record service status."""
    return manager.status()


def test_build_run_args(manager: ServiceManager) -> dict[str, Any]:
    """Test _build_run_args method."""
    args = manager._build_run_args(
        credential="test_cred",
        config_path=None,
        mode="smart"
    )
    return {
        "credential": "test_cred",
        "config_path": None,
        "mode": "smart",
        "built_args": args,
    }


def main() -> dict[str, Any]:
    """Execute distillation and return golden standard data."""
    result: dict[str, Any] = {
        "input": record_input(),
        "output": {},
        "tests": {},
    }
    
    # Get service manager for current platform
    print("=" * 60)
    print("DISTILLER: service_manager.py")
    print("=" * 60)
    
    try:
        manager = get_service_manager()
        print(f"\n[INPUT] Platform: {sys.platform}")
        print(f"[INPUT] Manager class: {manager.__class__.__name__}")
        
        result["output"]["manager_info"] = record_service_manager_info(manager)
        print(f"\n[OUTPUT] Manager info recorded")
        
        # Record status
        status = record_status(manager)
        result["output"]["status"] = status
        print(f"[OUTPUT] Status: installed={status.get('installed')}, running={status.get('running')}")
        
        # Test _build_run_args
        build_args_result = test_build_run_args(manager)
        result["tests"]["build_run_args"] = build_args_result
        print(f"\n[TEST] _build_run_args: {len(build_args_result['built_args'])} args built")
        
        # Print summary
        print("\n" + "=" * 60)
        print("GOLDEN STANDARD SUMMARY")
        print("=" * 60)
        print(f"Platform: {sys.platform}")
        print(f"Service Manager: {manager.__class__.__name__}")
        print(f"Installed: {status.get('installed')}")
        print(f"Running: {status.get('running')}")
        print(f"Log Dir: {manager.log_dir()}")
        
        result["success"] = True
        
    except Exception as e:
        result["success"] = False
        result["error"] = str(e)
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
    
    # Output JSON for verification
    print("\n" + "=" * 60)
    print("JSON OUTPUT (for verification)")
    print("=" * 60)
    print(json.dumps(result, indent=2, default=str))
    
    return result


if __name__ == "__main__":
    main()
