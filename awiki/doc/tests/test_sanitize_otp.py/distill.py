"""蒸馏脚本：执行 test_sanitize_otp.py 并记录输入输出作为黄金标准。"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# 获取项目根目录：doc/tests/test_sanitize_otp.py/distill.py -> ../../../../ -> D:\huangyg\git\sample\awiki
# 然后进入 python/scripts
_project_root = Path(__file__).resolve().parent.parent.parent.parent
_scripts_dir = _project_root / "python" / "scripts"
sys.path.insert(0, str(_scripts_dir))

from utils import handle as handle_utils  # noqa: E402
from utils.config import SDKConfig  # noqa: E402
from utils.identity import DIDIdentity  # noqa: E402


def make_identity(did: str) -> DIDIdentity:
    """创建最小 DID 身份。"""
    return DIDIdentity(
        did=did,
        did_document={"id": did, "proof": {"challenge": "nonce"}},
        private_key_pem=b"private-key",
        public_key_pem=b"public-key",
    )


def sanitize_otp_golden_tests():
    """执行 _sanitize_otp 的黄金标准测试。"""
    print("=" * 60)
    print("测试：_sanitize_otp 函数")
    print("=" * 60)
    
    test_cases = [
        ("123456", "123456"),          # already clean
        ("123 456", "123456"),         # single space
        ("12 34 56", "123456"),        # multiple spaces
        (" 123456 ", "123456"),        # leading/trailing spaces
        ("123\n456", "123456"),        # newline
        ("123\t456", "123456"),        # tab
        ("123\r\n456", "123456"),      # CRLF
        (" 1 2 3\n4 5 6 ", "123456"),  # mixed whitespace everywhere
    ]
    
    results = []
    for raw, expected in test_cases:
        result = handle_utils._sanitize_otp(raw)
        status = "✓" if result == expected else "✗"
        print(f"{status} 输入：{repr(raw):25} -> 输出：{repr(result):15} (期望：{repr(expected)})")
        results.append({
            "input": raw,
            "output": result,
            "expected": expected,
            "passed": result == expected
        })
    
    return results


async def test_register_handle_golden():
    """测试 register_handle 的 OTP 清理集成。"""
    print("\n" + "=" * 60)
    print("集成测试：register_handle OTP 清理")
    print("=" * 60)
    
    # 打补丁
    original_create = handle_utils.create_identity
    original_rpc = handle_utils.rpc_call
    
    handle_utils.create_identity = lambda **kwargs: make_identity("did:wba:awiki.ai:alice:k1_new")
    
    recorded = {}
    async def patched_rpc(client, endpoint, method, payload):
        recorded["method"] = method
        recorded["payload"] = dict(payload)
        return {
            "did": "did:wba:awiki.ai:alice:k1_new",
            "user_id": "user-1",
            "handle": "alice",
            "full_handle": "alice.awiki.ai",
            "access_token": "jwt-token",
            "message": "ok",
        }
    
    handle_utils.rpc_call = patched_rpc
    
    try:
        input_otp = "123 456"
        expected_otp = "123456"
        
        print(f"输入 OTP: {repr(input_otp)}")
        
        result = await handle_utils.register_handle(
            client=object(),
            config=SDKConfig(did_domain="awiki.ai"),
            phone="+8613800138000",
            otp_code=input_otp,
            handle="alice",
        )
        
        actual_otp = recorded["payload"]["otp_code"]
        status = "✓" if actual_otp == expected_otp else "✗"
        print(f"{status} Payload OTP: {repr(actual_otp)} (期望：{repr(expected_otp)})")
        
        return {
            "input_otp": input_otp,
            "output_otp": actual_otp,
            "expected_otp": expected_otp,
            "passed": actual_otp == expected_otp
        }
    finally:
        handle_utils.create_identity = original_create
        handle_utils.rpc_call = original_rpc


async def test_recover_handle_golden():
    """测试 recover_handle 的 OTP 清理集成。"""
    print("\n" + "=" * 60)
    print("集成测试：recover_handle OTP 清理")
    print("=" * 60)
    
    # 打补丁
    original_create = handle_utils.create_identity
    original_rpc = handle_utils.rpc_call
    
    handle_utils.create_identity = lambda **kwargs: make_identity("did:wba:awiki.ai:alice:k1_new")
    
    recorded = {}
    async def patched_rpc(client, endpoint, method, payload):
        recorded["method"] = method
        recorded["payload"] = dict(payload)
        return {
            "did": "did:wba:awiki.ai:alice:k1_new",
            "user_id": "user-1",
            "handle": "alice",
            "full_handle": "alice.awiki.ai",
            "access_token": "jwt-token",
            "message": "ok",
        }
    
    handle_utils.rpc_call = patched_rpc
    
    try:
        input_otp = "12\n34\t56"
        expected_otp = "123456"
        
        print(f"输入 OTP: {repr(input_otp)}")
        
        result = await handle_utils.recover_handle(
            client=object(),
            config=SDKConfig(did_domain="awiki.ai"),
            phone="+8613800138000",
            otp_code=input_otp,
            handle="alice",
        )
        
        actual_otp = recorded["payload"]["otp_code"]
        status = "✓" if actual_otp == expected_otp else "✗"
        print(f"{status} Payload OTP: {repr(actual_otp)} (期望：{repr(expected_otp)})")
        
        return {
            "input_otp": input_otp,
            "output_otp": actual_otp,
            "expected_otp": expected_otp,
            "passed": actual_otp == expected_otp
        }
    finally:
        handle_utils.create_identity = original_create
        handle_utils.rpc_call = original_rpc


def main():
    """主函数：执行所有黄金标准测试。"""
    print("OTP 代码清理 - 黄金标准测试")
    print("=" * 60)
    
    # 执行单元测试
    unit_results = sanitize_otp_golden_tests()
    
    # 执行集成测试
    register_result = asyncio.run(test_register_handle_golden())
    recover_result = asyncio.run(test_recover_handle_golden())
    
    # 汇总结果
    print("\n" + "=" * 60)
    print("测试汇总")
    print("=" * 60)
    
    unit_passed = sum(1 for r in unit_results if r["passed"])
    unit_total = len(unit_results)
    print(f"单元测试：{unit_passed}/{unit_total} 通过")
    
    integration_passed = sum(1 for r in [register_result, recover_result] if r["passed"])
    integration_total = 2
    print(f"集成测试：{integration_passed}/{integration_total} 通过")
    
    total_passed = unit_passed + integration_passed
    total_tests = unit_total + integration_total
    print(f"总计：{total_passed}/{total_tests} 通过")
    
    if total_passed == total_tests:
        print("\n✓ 所有测试通过！")
        return 0
    else:
        print(f"\n✗ 有 {total_tests - total_passed} 个测试失败")
        return 1


if __name__ == "__main__":
    sys.exit(main())
