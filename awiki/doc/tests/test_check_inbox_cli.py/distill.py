#!/usr/bin/env python
"""蒸馏脚本：执行 test_check_inbox_cli.py 并记录黄金标准输入输出。

用途：
    python distill.py

输出：
    - 黄金标准输入：测试代码、依赖模块
    - 黄金标准输出：pytest 测试结果
"""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# 项目根目录（distill.py 位于 doc/tests/xxx/distill.py，向上 3 级到项目根目录）
DISTILL_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = DISTILL_DIR.parent.parent.parent  # doc/tests/xxx -> project root
TEST_FILE = PROJECT_ROOT / "python" / "tests" / "test_check_inbox_cli.py"
PY_MD_FILE = DISTILL_DIR / "py.md"
OUTPUT_FILE = DISTILL_DIR / "golden_output.json"


def collect_inputs() -> dict:
    """收集黄金标准输入。"""
    inputs = {
        "test_file": str(TEST_FILE),
        "test_file_content": TEST_FILE.read_text(encoding="utf-8"),
        "py_md_file": str(PY_MD_FILE),
        "py_md_content": PY_MD_FILE.read_text(encoding="utf-8") if PY_MD_FILE.exists() else None,
    }
    return inputs


def run_tests() -> dict:
    """执行测试并收集输出。"""
    result = {
        "command": f"pytest {TEST_FILE} -v",
        "exit_code": 0,
        "stdout": "",
        "stderr": "",
        "duration_seconds": 0.0,
    }

    start_time = datetime.now()
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", str(TEST_FILE), "-v"],
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
        timeout=30,
    )
    end_time = datetime.now()

    result["exit_code"] = proc.returncode
    result["stdout"] = proc.stdout
    result["stderr"] = proc.stderr
    result["duration_seconds"] = (end_time - start_time).total_seconds()

    return result


def main() -> None:
    """主函数：收集输入、执行测试、保存黄金标准。"""
    print("=" * 60)
    print("蒸馏脚本：test_check_inbox_cli.py")
    print("=" * 60)
    print(f"  - 项目根目录：{PROJECT_ROOT}")
    print(f"  - 测试文件路径：{TEST_FILE}")

    # 收集输入
    print("\n[1/3] 收集黄金标准输入...")
    inputs = collect_inputs()
    print(f"  - 测试文件：{inputs['test_file']}")
    print(f"  - 分析文档：{inputs['py_md_file']}")

    # 执行测试
    print("\n[2/3] 执行测试...")
    output = run_tests()
    print(f"  - 命令：{output['command']}")
    print(f"  - 退出码：{output['exit_code']}")
    print(f"  - 耗时：{output['duration_seconds']:.2f}秒")

    # 保存黄金标准
    print("\n[3/3] 保存黄金标准...")
    golden = {
        "metadata": {
            "created_at": datetime.now().isoformat(),
            "test_file": str(TEST_FILE),
            "project_root": str(PROJECT_ROOT),
        },
        "inputs": inputs,
        "outputs": output,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(golden, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  - 输出文件：{OUTPUT_FILE}")

    # 打印测试结果摘要
    print("\n" + "=" * 60)
    print("测试结果摘要")
    print("=" * 60)
    print(output["stdout"])
    if output["stderr"]:
        print("STDERR:", output["stderr"])

    if output["exit_code"] == 0:
        print("\n✓ 所有测试通过")
    else:
        print(f"\n✗ 测试失败 (退出码：{output['exit_code']})")
        sys.exit(output["exit_code"])


if __name__ == "__main__":
    main()
