#!/usr/bin/env python
"""Distiller script for test_setup_identity_cli.py.

执行测试并记录输入输出作为"黄金标准"。
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
TEST_FILE = PROJECT_ROOT / "python" / "tests" / "test_setup_identity_cli.py"
PY_MD_FILE = PROJECT_ROOT / "doc" / "tests" / "test_setup_identity_cli.py" / "py.md"


def run_tests() -> tuple[int, str, str]:
    """运行 pytest 并返回结果。"""
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        str(TEST_FILE),
        "-v",
        "--tb=short",
    ]
    result = subprocess.run(
        cmd,
        cwd=PROJECT_ROOT / "python",
        capture_output=True,
        text=True,
        timeout=30,
    )
    return result.returncode, result.stdout, result.stderr


def main() -> int:
    """主函数。"""
    print("=" * 60)
    print("Distiller: test_setup_identity_cli.py")
    print("=" * 60)
    print()

    # 显示输入文件
    print("[INPUT FILES]")
    print(f"  Test file: {TEST_FILE}")
    print(f"  Doc file:  {PY_MD_FILE}")
    print()

    # 检查文件存在
    if not TEST_FILE.exists():
        print(f"ERROR: Test file not found: {TEST_FILE}")
        return 1

    if not PY_MD_FILE.exists():
        print(f"ERROR: Doc file not found: {PY_MD_FILE}")
        return 1

    # 运行测试
    print("[RUNNING TESTS]")
    print("-" * 60)
    returncode, stdout, stderr = run_tests()

    # 显示输出
    if stdout:
        print(stdout)
    if stderr:
        print("STDERR:", file=sys.stderr)
        print(stderr, file=sys.stderr)

    # 总结
    print("-" * 60)
    print(f"[RESULT] {'PASS' if returncode == 0 else 'FAIL'} (exit code: {returncode})")
    print("=" * 60)

    return returncode


if __name__ == "__main__":
    sys.exit(main())
