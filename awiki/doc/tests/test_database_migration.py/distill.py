#!/usr/bin/env python
"""Distiller for test_database_migration.py - records golden standard I/O.

This script executes the database migration tests and captures input/output
as the golden standard for verification.
"""

from __future__ import annotations

import json
import sqlite3
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Setup paths
BASE_DIR = Path(__file__).resolve().parents[3]  # D:\huangyg\git\sample\awiki
PYTHON_DIR = BASE_DIR / "python"
TEST_FILE = PYTHON_DIR / "tests" / "test_database_migration.py"
OUTPUT_FILE = Path(__file__).with_suffix(".json")


def collect_input() -> dict:
    """Collect input information."""
    return {
        "test_file": str(TEST_FILE),
        "test_file_exists": TEST_FILE.exists(),
        "scripts_dir": str(PYTHON_DIR / "scripts"),
        "dependencies": [
            "database_migration",
            "local_store",
            "pytest",
            "sqlite3",
        ],
    }


def run_tests() -> dict:
    """Run pytest and capture output."""
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            str(TEST_FILE),
            "-v",
            "--tb=short",
        ],
        cwd=str(PYTHON_DIR),
        capture_output=True,
        text=True,
        timeout=30,
        env={**subprocess.os.environ, "PYTHONPATH": str(PYTHON_DIR / "scripts")},
    )

    return {
        "return_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "success": result.returncode == 0,
    }


def verify_schema_behavior() -> dict:
    """Verify database schema behavior directly."""
    import tempfile

    sys.path.insert(0, str(PYTHON_DIR / "scripts"))
    import database_migration
    import local_store

    results = {}

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        import os

        old_env = os.environ.get("AWIKI_DATA_DIR")
        os.environ["AWIKI_DATA_DIR"] = str(tmp_path)

        try:
            # Test 1: ensure_local_database_ready repairs missing indexes
            conn = local_store.get_connection()
            local_store.ensure_schema(conn)
            repaired_indexes = {
                "idx_messages_owner_thread",
                "idx_messages_owner_direction",
                "idx_e2ee_outbox_owner_status",
            }
            for idx in repaired_indexes:
                try:
                    conn.execute(f"DROP INDEX {idx}")
                except sqlite3.OperationalError:
                    pass
            conn.commit()
            conn.close()

            result = database_migration.ensure_local_database_ready()
            results["ensure_local_database_ready"] = {
                "status": result["status"],
                "before_version": result.get("before_version"),
                "after_version": result.get("after_version"),
            }

            # Verify indexes are restored
            conn = local_store.get_connection()
            rows = conn.execute(
                """
                SELECT name FROM sqlite_master
                WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
                """
            ).fetchall()
            index_names = {row[0] for row in rows}
            conn.close()

            results["ensure_local_database_ready"]["indexes_restored"] = bool(
                repaired_indexes <= index_names
            )

            # Test 2: detect_local_database_layout
            detection = database_migration.detect_local_database_layout()
            results["detect_local_database_layout"] = {
                "status": detection["status"],
                "version": detection.get("before_version"),
            }

        finally:
            if old_env:
                os.environ["AWIKI_DATA_DIR"] = old_env
            else:
                os.environ.pop("AWIKI_DATA_DIR", None)

    return results


def main() -> None:
    """Main entry point."""
    print("=" * 60)
    print("Distiller: test_database_migration.py")
    print("=" * 60)

    # Collect input
    print("\n[INPUT] Collecting input information...")
    input_data = collect_input()
    print(f"  Test file: {input_data['test_file']}")
    print(f"  File exists: {input_data['test_file_exists']}")

    # Run tests
    print("\n[EXECUTE] Running pytest...")
    try:
        test_result = run_tests()
        print(f"  Return code: {test_result['return_code']}")
        print(f"  Success: {test_result['success']}")
        if test_result["success"]:
            passed = test_result["stdout"].count(" PASSED")
            print(f"  Tests passed: {passed}")
    except subprocess.TimeoutExpired:
        print("  ERROR: Test execution timeout (>30s)")
        test_result = {"error": "timeout"}
    except Exception as e:
        print(f"  ERROR: {e}")
        test_result = {"error": str(e)}

    # Verify schema behavior
    print("\n[VERIFY] Verifying schema behavior...")
    try:
        schema_result = verify_schema_behavior()
        for func_name, data in schema_result.items():
            print(f"  {func_name}: {data.get('status', 'N/A')}")
    except Exception as e:
        print(f"  ERROR: {e}")
        schema_result = {"error": str(e)}

    # Write output
    output = {
        "timestamp": datetime.now().isoformat(),
        "input": input_data,
        "test_execution": test_result,
        "schema_verification": schema_result,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n[OUTPUT] Golden standard saved to: {OUTPUT_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
