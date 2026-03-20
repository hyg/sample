#!/usr/bin/env python
"""test_handle_utils.py 的蒸馏脚本。

执行 normalize_phone() 的所有测试用例，记录输入输出作为"黄金标准"。
"""

from __future__ import annotations

import sys
from pathlib import Path

# 将 python/scripts/ 加入路径以便导入 utils.handle
# distill.py 位于 doc/tests/test_handle_utils.py/distill.py
# 需要到达 python/scripts/utils/handle.py
_project_root = Path(__file__).resolve().parent.parent.parent.parent
_scripts_dir = _project_root / "python" / "scripts"
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))

from utils.handle import normalize_phone  # noqa: E402


def log_result(test_name: str, input_val: str, output_val: str, status: str = "PASS") -> None:
    """记录测试结果。"""
    print(f"[{status}] {test_name}")
    print(f"  Input:    {input_val!r}")
    print(f"  Output:   {output_val!r}")
    print()


def main() -> int:
    """执行所有测试用例并记录结果。"""
    print("=" * 60)
    print("test_handle_utils.py 蒸馏脚本 - 黄金标准记录")
    print("=" * 60)
    print()

    passed = 0
    failed = 0

    # ---- 中国本地号码 → 自动加 +86 ----
    print("【中国本地号码测试】")
    chinese_tests = [
        ("13800138000", "+8613800138000"),
        ("15912345678", "+8615912345678"),
        ("19999999999", "+8619999999999"),
    ]
    for raw, expected in chinese_tests:
        try:
            result = normalize_phone(raw)
            if result == expected:
                log_result("test_chinese_local_numbers", raw, result)
                passed += 1
            else:
                log_result("test_chinese_local_numbers", raw, result, "FAIL")
                print(f"  Expected: {expected!r}")
                print()
                failed += 1
        except Exception as e:
            log_result("test_chinese_local_numbers", raw, str(e), "ERROR")
            failed += 1

    # ---- 已有国际格式 → 保持不变 ----
    print("【国际格式号码测试】")
    international_tests = [
        "+8613800138000",
        "+14155552671",
        "+447911123456",
        "+81312345678",
        "+85212345678",
    ]
    for phone in international_tests:
        try:
            result = normalize_phone(phone)
            if result == phone:
                log_result("test_international_format_unchanged", phone, result)
                passed += 1
            else:
                log_result("test_international_format_unchanged", phone, result, "FAIL")
                print(f"  Expected: {phone!r}")
                print()
                failed += 1
        except Exception as e:
            log_result("test_international_format_unchanged", phone, str(e), "ERROR")
            failed += 1

    # ---- 前后空格 → 自动 strip ----
    print("【空格处理测试】")
    whitespace_tests = [
        ("  13800138000  ", "+8613800138000"),
        (" +14155552671 ", "+14155552671"),
    ]
    for raw, expected in whitespace_tests:
        try:
            result = normalize_phone(raw)
            if result == expected:
                log_result("test_strips_whitespace", raw, result)
                passed += 1
            else:
                log_result("test_strips_whitespace", raw, result, "FAIL")
                print(f"  Expected: {expected!r}")
                print()
                failed += 1
        except Exception as e:
            log_result("test_strips_whitespace", raw, str(e), "ERROR")
            failed += 1

    # ---- 无效号码 → ValueError ----
    print("【无效号码测试】")
    invalid_tests = [
        "12345",       # 太短
        "abc",         # 非数字
        "+abc",        # + 后非数字
        "",            # 空字符串
        "+1234",       # 国际格式但太短
        "99999999999", # 11 位但不是 1[3-9] 开头
    ]
    for phone in invalid_tests:
        try:
            result = normalize_phone(phone)
            log_result("test_invalid_phone_raises", phone, result, "FAIL")
            print(f"  Expected: ValueError")
            print()
            failed += 1
        except ValueError as e:
            log_result("test_invalid_phone_raises", phone, f"ValueError({e})")
            passed += 1
        except Exception as e:
            log_result("test_invalid_phone_raises", phone, str(e), "ERROR")
            failed += 1

    # ---- 汇总 ----
    print("=" * 60)
    print(f"测试汇总：{passed} 通过，{failed} 失败")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
