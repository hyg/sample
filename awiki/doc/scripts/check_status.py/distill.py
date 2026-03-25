#!/usr/bin/env python3
"""Distill script for check_status.py - records input/output as golden standard.

Usage:
    python doc/scripts/check_status.py/distill.py
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add python directory to path for imports
script_dir = Path(__file__).resolve().parent
python_dir = script_dir.parent.parent.parent / "python"
scripts_dir = python_dir / "scripts"

sys.path.insert(0, str(scripts_dir))
sys.path.insert(0, str(python_dir))


def distill_ensure_local_upgrade_ready():
    """Distill ensure_local_upgrade_ready function."""
    from check_status import ensure_local_upgrade_ready
    
    # Test with default credential
    result = ensure_local_upgrade_ready("default")
    
    return {
        "function": "ensure_local_upgrade_ready",
        "input": {"credential_name": "default"},
        "output": result,
    }


def distill_summarize_group_watch():
    """Distill summarize_group_watch function."""
    from check_status import summarize_group_watch
    
    # Test with None owner_did
    result_none = summarize_group_watch(None)
    
    return {
        "function": "summarize_group_watch",
        "inputs": [
            {"owner_did": None},
        ],
        "outputs": [result_none],
    }


async def distill_check_identity():
    """Distill check_identity function."""
    from check_status import check_identity
    
    # Test with default credential
    result = await check_identity("default")
    
    return {
        "function": "check_identity",
        "input": {"credential_name": "default"},
        "output": result,
    }


async def distill_summarize_inbox():
    """Distill summarize_inbox function."""
    from check_status import summarize_inbox
    
    # Test with default credential
    result = await summarize_inbox("default")
    
    return {
        "function": "summarize_inbox",
        "input": {"credential_name": "default"},
        "output": result,
    }


async def distill_check_status():
    """Distill check_status main function."""
    from check_status import check_status
    
    # Test with default credential
    result = await check_status("default")
    
    return {
        "function": "check_status",
        "input": {"credential_name": "default"},
        "output": result,
    }


def run_distill():
    """Run all distill tests and collect results."""
    import asyncio
    
    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source_file": str(scripts_dir / "check_status.py"),
        "distill_file": str(script_dir / "distill.py"),
        "tests": [],
    }
    
    # Sync function tests
    print("Running: ensure_local_upgrade_ready...")
    try:
        result = distill_ensure_local_upgrade_ready()
        results["tests"].append(result)
        print(f"  Status: {result['output'].get('status', 'unknown')}")
    except Exception as e:
        results["tests"].append({
            "function": "ensure_local_upgrade_ready",
            "error": str(e),
        })
        print(f"  Error: {e}")
    
    print("Running: summarize_group_watch...")
    try:
        result = distill_summarize_group_watch()
        results["tests"].append(result)
        print(f"  Status: {result['outputs'][0].get('status', 'unknown')}")
    except Exception as e:
        results["tests"].append({
            "function": "summarize_group_watch",
            "error": str(e),
        })
        print(f"  Error: {e}")
    
    # Async function tests
    print("Running: check_identity...")
    try:
        result = asyncio.run(distill_check_identity())
        results["tests"].append(result)
        print(f"  Status: {result['output'].get('status', 'unknown')}")
    except Exception as e:
        results["tests"].append({
            "function": "check_identity",
            "error": str(e),
        })
        print(f"  Error: {e}")
    
    print("Running: summarize_inbox...")
    try:
        result = asyncio.run(distill_summarize_inbox())
        results["tests"].append(result)
        print(f"  Status: {result['output'].get('status', 'unknown')}")
    except Exception as e:
        results["tests"].append({
            "function": "summarize_inbox",
            "error": str(e),
        })
        print(f"  Error: {e}")
    
    print("Running: check_status...")
    try:
        result = asyncio.run(distill_check_status())
        results["tests"].append(result)
        print(f"  Status: {result['output'].get('status', 'unknown')}")
    except Exception as e:
        results["tests"].append({
            "function": "check_status",
            "error": str(e),
        })
        print(f"  Error: {e}")
    
    # Output results
    print("\n" + "=" * 60)
    print("DISTILL RESULTS (JSON)")
    print("=" * 60)
    print(json.dumps(results, indent=2, ensure_ascii=False, default=str))
    
    return results


def main():
    """Main entry point."""
    print("=" * 60)
    print("check_status.py Distill Script")
    print("=" * 60)
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print(f"Source: {scripts_dir / 'check_status.py'}")
    print()
    
    results = run_distill()
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    total = len(results["tests"])
    errors = sum(1 for t in results["tests"] if "error" in t and "output" not in t)
    print(f"Total tests: {total}")
    print(f"Errors: {errors}")
    print(f"Success: {total - errors}")
    
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
