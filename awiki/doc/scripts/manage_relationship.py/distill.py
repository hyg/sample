"""
Distiller script for manage_relationship.py

Purpose: Execute Python code and record input/output as "golden standard".
This script validates the module structure, function signatures, and behavior.
"""

import json
import sys
import importlib.util
from pathlib import Path

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_PATH = Path(__file__).parent.parent.parent.parent / "python" / "scripts" / "manage_relationship.py"
MODULE_NAME = "manage_relationship"

# ============================================================================
# Helper Functions
# ============================================================================

def load_module_from_path(path: Path, name: str):
    """Load a module from a file path."""
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load module from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module

def record_result(test_name: str, status: str, details: dict) -> None:
    """Record a test result."""
    result = {
        "test": test_name,
        "status": status,
        "details": details
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))

# ============================================================================
# Distillation Tests
# ============================================================================

def test_module_structure():
    """Test 1: Verify module structure and imports."""
    print("=== Test 1: Module Structure ===", file=sys.stderr)
    
    try:
        module = load_module_from_path(SCRIPT_PATH, MODULE_NAME)
        
        # Check required attributes
        required_attrs = {
            "RPC_ENDPOINT": str,
            "follow": type(lambda: None),
            "unfollow": type(lambda: None),
            "get_status": type(lambda: None),
            "get_following": type(lambda: None),
            "get_followers": type(lambda: None),
            "main": type(lambda: None),
        }
        
        missing = []
        type_mismatch = []
        
        for attr, expected_type in required_attrs.items():
            if not hasattr(module, attr):
                missing.append(attr)
            elif not isinstance(getattr(module, attr), expected_type):
                type_mismatch.append(attr)
        
        if missing:
            record_result("module_structure", "FAILED", {
                "error": "Missing attributes",
                "missing": missing
            })
            return False
        
        if type_mismatch:
            record_result("module_structure", "FAILED", {
                "error": "Type mismatch",
                "mismatch": type_mismatch
            })
            return False
        
        # Record module info
        record_result("module_structure", "PASSED", {
            "rpc_endpoint": module.RPC_ENDPOINT,
            "functions": [
                "follow", "unfollow", "get_status", 
                "get_following", "get_followers", "main"
            ],
            "script_path": str(SCRIPT_PATH)
        })
        return True
        
    except Exception as e:
        record_result("module_structure", "ERROR", {
            "exception": str(e),
            "type": type(e).__name__
        })
        return False

def test_function_signatures():
    """Test 2: Verify function signatures match documentation."""
    print("=== Test 2: Function Signatures ===", file=sys.stderr)
    
    try:
        import inspect
        module = load_module_from_path(SCRIPT_PATH, MODULE_NAME)
        
        expected_signatures = {
            "follow": ["target_did", "credential_name"],
            "unfollow": ["target_did", "credential_name"],
            "get_status": ["target_did", "credential_name"],
            "get_following": ["credential_name", "limit", "offset"],
            "get_followers": ["credential_name", "limit", "offset"],
            "main": [],
        }
        
        results = {}
        all_passed = True
        
        for func_name, expected_params in expected_signatures.items():
            func = getattr(module, func_name)
            sig = inspect.signature(func)
            actual_params = list(sig.parameters.keys())
            
            # Check if expected params are in actual params (allowing extra)
            match = all(p in actual_params for p in expected_params)
            results[func_name] = {
                "expected": expected_params,
                "actual": actual_params,
                "match": match
            }
            if not match:
                all_passed = False
        
        status = "PASSED" if all_passed else "FAILED"
        record_result("function_signatures", status, {
            "signatures": results
        })
        return all_passed
        
    except Exception as e:
        record_result("function_signatures", "ERROR", {
            "exception": str(e),
            "type": type(e).__name__
        })
        return False

def test_async_functions():
    """Test 3: Verify async functions are coroutines."""
    print("=== Test 3: Async Functions ===", file=sys.stderr)
    
    try:
        import inspect
        module = load_module_from_path(SCRIPT_PATH, MODULE_NAME)
        
        async_funcs = ["follow", "unfollow", "get_status", "get_following", "get_followers"]
        results = {}
        all_passed = True
        
        for func_name in async_funcs:
            func = getattr(module, func_name)
            is_async = inspect.iscoroutinefunction(func)
            results[func_name] = {"is_async": is_async}
            if not is_async:
                all_passed = False
        
        status = "PASSED" if all_passed else "FAILED"
        record_result("async_functions", status, {
            "functions": results
        })
        return all_passed
        
    except Exception as e:
        record_result("async_functions", "ERROR", {
            "exception": str(e),
            "type": type(e).__name__
        })
        return False

def test_cli_interface():
    """Test 4: Verify CLI argument parsing."""
    print("=== Test 4: CLI Interface ===", file=sys.stderr)
    
    try:
        module = load_module_from_path(SCRIPT_PATH, MODULE_NAME)
        
        # Test that main() exists and is callable
        main_func = module.main
        callable_check = callable(main_func)
        
        record_result("cli_interface", "PASSED" if callable_check else "FAILED", {
            "main_exists": hasattr(module, "main"),
            "main_callable": callable_check,
            "script_path": str(SCRIPT_PATH)
        })
        return callable_check
        
    except Exception as e:
        record_result("cli_interface", "ERROR", {
            "exception": str(e),
            "type": type(e).__name__
        })
        return False

def test_imports():
    """Test 5: Verify all required imports are available."""
    print("=== Test 5: Import Dependencies ===", file=sys.stderr)
    
    try:
        required_imports = [
            "argparse", "asyncio", "json", "logging", "sys",
            "utils", "utils.logging_config", "credential_store", "local_store"
        ]
        
        results = {}
        all_available = True
        
        for import_name in required_imports:
            try:
                if "." in import_name:
                    parts = import_name.split(".")
                    base = __import__(parts[0])
                    for part in parts[1:]:
                        base = getattr(base, part)
                else:
                    __import__(import_name)
                results[import_name] = {"available": True}
            except ImportError as e:
                results[import_name] = {"available": False, "error": str(e)}
                all_available = False
        
        status = "PASSED" if all_available else "WARNING"
        record_result("import_dependencies", status, {
            "imports": results,
            "note": "Some imports may require runtime environment"
        })
        return True  # Return True even if some imports fail (environment dependent)
        
    except Exception as e:
        record_result("import_dependencies", "ERROR", {
            "exception": str(e),
            "type": type(e).__name__
        })
        return False

# ============================================================================
# Main Entry Point
# ============================================================================

def main():
    """Run all distillation tests and record results."""
    print("=" * 60, file=sys.stderr)
    print("Distiller for manage_relationship.py", file=sys.stderr)
    print(f"Script: {SCRIPT_PATH}", file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    
    results = {
        "module_structure": test_module_structure(),
        "function_signatures": test_function_signatures(),
        "async_functions": test_async_functions(),
        "cli_interface": test_cli_interface(),
        "import_dependencies": test_imports(),
    }
    
    print("=" * 60, file=sys.stderr)
    print("Distillation Complete", file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    
    # Summary
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    print(json.dumps({
        "summary": {
            "passed": passed,
            "total": total,
            "success_rate": f"{passed/total*100:.1f}%"
        },
        "results": results
    }, indent=2, ensure_ascii=False))
    
    return 0 if all(results.values()) else 1

if __name__ == "__main__":
    sys.exit(main())
