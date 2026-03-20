"""Distill script for recover_handle.py - records input/output as golden standard."""

import json
import sys
from typing import Any

# 添加项目路径以导入模块
sys.path.insert(0, str(__file__).rsplit("\\", 4)[0] + "\\python")
sys.path.insert(0, str(__file__).rsplit("\\", 4)[0] + "\\python\\scripts")

from recover_handle import (
    _allocate_recovery_credential_name,
    _resolve_recovery_target,
)


def test_allocate_recovery_credential_name() -> None:
    """测试 _allocate_recovery_credential_name 函数."""
    print("=" * 60)
    print("测试：_allocate_recovery_credential_name")
    print("=" * 60)

    test_cases = [
        {"handle": "test_user"},
        {"handle": "alice"},
        {"handle": "bob"},
    ]

    for case in test_cases:
        handle = case["handle"]
        result = _allocate_recovery_credential_name(handle)
        print(f"\n输入：handle={handle!r}")
        print(f"输出：{result!r}")


def test_resolve_recovery_target() -> None:
    """测试 _resolve_recovery_target 函数."""
    print("\n" + "=" * 60)
    print("测试：_resolve_recovery_target")
    print("=" * 60)

    test_cases: list[dict[str, Any]] = [
        {
            "description": "无请求凭证名称 - 自动分配",
            "handle": "alice",
            "requested_credential_name": None,
            "replace_existing": False,
        },
        {
            "description": "请求新凭证名称",
            "handle": "bob",
            "requested_credential_name": "bob_new",
            "replace_existing": False,
        },
        {
            "description": "请求现有凭证但不替换",
            "handle": "charlie",
            "requested_credential_name": "existing_cred",
            "replace_existing": False,
            "expect_error": True,
        },
        {
            "description": "请求现有凭证并替换",
            "handle": "david",
            "requested_credential_name": "replace_cred",
            "replace_existing": True,
        },
    ]

    for case in test_cases:
        description = case.pop("description")
        expect_error = case.pop("expect_error", False)

        print(f"\n场景：{description}")
        print(f"输入：handle={case['handle']!r}, requested_credential_name={case['requested_credential_name']!r}, replace_existing={case['replace_existing']!r}")

        try:
            result = _resolve_recovery_target(**case)
            if expect_error:
                print(f"输出：预期错误但未发生")
            else:
                print(f"输出：credential_name={result[0]!r}, old_credential={result[1]!r}")
        except ValueError as e:
            if expect_error:
                print(f"输出：ValueError - {e}")
            else:
                print(f"输出：意外错误 - {e}")


def test_migrate_local_cache_signature() -> None:
    """测试 _migrate_local_cache 函数签名."""
    print("\n" + "=" * 60)
    print("测试：_migrate_local_cache 签名")
    print("=" * 60)

    from recover_handle import _migrate_local_cache
    import inspect

    sig = inspect.signature(_migrate_local_cache)
    print(f"\n函数签名：_migrate_local_cache{sig}")
    print(f"参数：{list(sig.parameters.keys())}")


def test_do_recover_signature() -> None:
    """测试 do_recover 函数签名."""
    print("\n" + "=" * 60)
    print("测试：do_recover 签名")
    print("=" * 60)

    from recover_handle import do_recover
    import inspect

    sig = inspect.signature(do_recover)
    print(f"\n函数签名：do_recover{sig}")
    print(f"参数：{list(sig.parameters.keys())}")


def test_main_cli_args() -> None:
    """测试 main 函数的 CLI 参数解析."""
    print("\n" + "=" * 60)
    print("测试：CLI 参数解析")
    print("=" * 60)

    from recover_handle import main
    import argparse

    # 模拟参数解析
    parser = argparse.ArgumentParser(description="Recover a Handle with phone OTP")
    parser.add_argument("--handle", required=True, type=str, help="Handle local-part")
    parser.add_argument("--phone", required=True, type=str, help="Phone number")
    parser.add_argument("--otp-code", type=str, default=None, help="OTP code")
    parser.add_argument("--credential", type=str, default=None, help="Credential name")
    parser.add_argument("--replace-existing", action="store_true", help="Replace existing")

    test_args = [
        ["--handle", "alice", "--phone", "+8613800138000"],
        ["--handle", "bob", "--phone", "+14155552671", "--credential", "bob_cred"],
        ["--handle", "charlie", "--phone", "+8613900139000", "--otp-code", "123456", "--replace-existing"],
    ]

    for args in test_args:
        parsed = parser.parse_args(args)
        print(f"\n输入：{args}")
        print(f"输出：handle={parsed.handle!r}, phone={parsed.phone!r}, otp_code={parsed.otp_code!r}, credential={parsed.credential!r}, replace_existing={parsed.replace_existing!r}")


def main() -> None:
    """运行所有蒸馏测试."""
    print("recover_handle.py 蒸馏脚本 - 黄金标准记录")
    print("=" * 60)

    test_allocate_recovery_credential_name()
    test_resolve_recovery_target()
    test_migrate_local_cache_signature()
    test_do_recover_signature()
    test_main_cli_args()

    print("\n" + "=" * 60)
    print("蒸馏完成")
    print("=" * 60)


if __name__ == "__main__":
    main()
