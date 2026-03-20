#!/usr/bin/env python3
"""蒸馏脚本：执行 test_credential_store.py 并记录输入输出作为黄金标准。"""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
import re

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parents[3]
PYTHON_DIR = PROJECT_ROOT / "python"
TEST_FILE = PYTHON_DIR / "tests" / "test_credential_store.py"
ANALYSIS_FILE = Path(__file__).parent / "py.md"
OUTPUT_FILE = Path(__file__).parent / "distill-output.json"


def run_tests() -> dict:
    """运行 pytest 并捕获输出。"""
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        str(TEST_FILE),
        "-v",
        "--tb=short",
    ]

    try:
        result = subprocess.run(
            cmd,
            cwd=str(PYTHON_DIR),
            capture_output=True,
            text=True,
            timeout=30,
        )
        return {
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "success": result.returncode == 0,
        }
    except subprocess.TimeoutExpired:
        return {
            "returncode": -1,
            "stdout": "",
            "stderr": "测试执行超时（30 秒）",
            "success": False,
            "timeout": True,
        }
    except Exception as e:
        return {
            "returncode": -1,
            "stdout": "",
            "stderr": f"执行错误：{e}",
            "success": False,
        }


def count_tests(output: str) -> dict:
    """从输出中解析测试结果统计。"""
    stats = {"total": 0, "passed": 0, "failed": 0, "skipped": 0}

    # 查找总结行，如 "14 failed, 1 passed in 2.00s"
    summary_match = re.search(r"(\d+) failed, (\d+) passed", output)
    if summary_match:
        stats["failed"] = int(summary_match.group(1))
        stats["passed"] = int(summary_match.group(2))
    else:
        # 备用解析：统计 PASSED/FAILED/SKIPPED 行
        stats["passed"] = len(re.findall(r"PASSED\s*$", output, re.MULTILINE))
        stats["failed"] = len(re.findall(r"FAILED\s*$", output, re.MULTILINE))
        stats["skipped"] = len(re.findall(r"SKIPPED\s*$", output, re.MULTILINE))

    # 查找收集的测试数，如 "collected 15 items"
    collected_match = re.search(r"collected (\d+) items", output)
    if collected_match:
        stats["total"] = int(collected_match.group(1))
    else:
        stats["total"] = stats["passed"] + stats["failed"] + stats["skipped"]

    return stats


def main():
    """主函数：执行测试并记录黄金标准。"""
    print("=" * 60)
    print("蒸馏脚本：test_credential_store.py")
    print("=" * 60)

    # 检查输入文件
    print(f"\n[输入] 测试文件：{TEST_FILE}")
    if not TEST_FILE.exists():
        print(f"错误：测试文件不存在：{TEST_FILE}")
        sys.exit(1)

    print(f"[输入] 分析文件：{ANALYSIS_FILE}")
    if not ANALYSIS_FILE.exists():
        print(f"警告：分析文件不存在：{ANALYSIS_FILE}")

    # 读取输入文件内容
    test_content = TEST_FILE.read_text(encoding="utf-8")
    analysis_content = ANALYSIS_FILE.read_text(encoding="utf-8") if ANALYSIS_FILE.exists() else ""

    print(f"\n[执行] 运行 pytest 测试...")
    start_time = datetime.now()

    # 运行测试
    test_result = run_tests()

    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    print(f"[完成] 耗时：{duration:.2f}秒")
    print(f"[结果] 返回码：{test_result['returncode']}")
    print(f"[结果] 成功：{test_result['success']}")

    # 解析测试统计
    stats = count_tests(test_result["stdout"])

    # 构建输出记录
    output_record = {
        "metadata": {
            "script": str(Path(__file__).resolve()),
            "test_file": str(TEST_FILE),
            "analysis_file": str(ANALYSIS_FILE),
            "timestamp": datetime.now().isoformat(),
            "duration_seconds": duration,
        },
        "input": {
            "test_file_exists": TEST_FILE.exists(),
            "analysis_file_exists": ANALYSIS_FILE.exists(),
            "test_file_lines": len(test_content.splitlines()),
            "analysis_file_lines": len(analysis_content.splitlines()) if analysis_content else 0,
        },
        "execution": {
            "command": f"pytest {TEST_FILE.relative_to(PYTHON_DIR)} -v",
            "working_directory": str(PYTHON_DIR),
            "timeout_seconds": 30,
            "actual_duration_seconds": duration,
            "returncode": test_result["returncode"],
            "success": test_result["success"],
            "timeout": test_result.get("timeout", False),
        },
        "output": {
            "stdout": test_result["stdout"],
            "stderr": test_result["stderr"],
            "stats": stats,
        },
        "golden_standard": {
            "description": "黄金标准：记录实际执行结果",
            "expected_total_tests": 15,
            "actual_result": {
                "returncode": test_result["returncode"],
                "stats": stats,
            },
        },
        "verification": {
            "total_tests_collected": stats["total"] == 15,
            "within_timeout": duration < 30,
            "execution_completed": not test_result.get("timeout", False),
        },
    }

    # 保存输出
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output_record, f, indent=2, ensure_ascii=False)

    print(f"\n[输出] 结果已保存至：{OUTPUT_FILE}")

    # 打印摘要
    print("\n" + "=" * 60)
    print("测试摘要")
    print("=" * 60)
    print(f"总测试数：{stats['total']}")
    print(f"通过：{stats['passed']}")
    print(f"失败：{stats['failed']}")
    print(f"跳过：{stats['skipped']}")
    print(f"执行完成：{output_record['verification']['execution_completed']}")
    print(f"在时限内：{output_record['verification']['within_timeout']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
