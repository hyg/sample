"""
蒸馏脚本：执行 test_handle_recovery.py 并记录黄金标准输入输出。

用途：记录测试的实际输入输出作为验证基准。
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

# 添加 scripts 目录到路径
# distill.py 位于 doc/tests/test_handle_recovery.py/
# python/scripts 位于 ../../../python/scripts
_scripts_dir = Path(__file__).resolve().parent.parent.parent.parent / "python" / "scripts"
sys.path.insert(0, str(_scripts_dir))

from utils.config import SDKConfig
from utils.identity import DIDIdentity
from utils import handle as handle_utils


def _make_identity(did: str) -> DIDIdentity:
    """Create a minimal DID identity for recovery tests."""
    return DIDIdentity(
        did=did,
        did_document={"id": did, "proof": {"challenge": "nonce"}},
        private_key_pem=b"private-key",
        public_key_pem=b"public-key",
    )


def main() -> None:
    """执行测试并记录黄金标准输入输出。"""
    print("=" * 60)
    print("test_handle_recovery.py 蒸馏脚本")
    print("=" * 60)
    
    # 记录输入
    test_input = {
        "config": {
            "did_domain": "awiki.ai"
        },
        "phone": "+8613800138000",
        "otp_code": "123456",
        "handle": "alice",
    }
    
    print("\n【输入】")
    print(json.dumps(test_input, indent=2, ensure_ascii=False))
    
    # 记录模拟行为
    recorded: dict[str, object] = {}
    
    async def fake_rpc_call(client, endpoint, method, payload):
        recorded["endpoint"] = endpoint
        recorded["method"] = method
        recorded["payload"] = payload
        return {
            "did": "did:wba:awiki.ai:alice:k1_new",
            "user_id": "user-1",
            "handle": "alice",
            "full_handle": "alice.awiki.ai",
            "access_token": "jwt-token",
            "message": "recovered",
        }
    
    # 应用模拟
    original_create_identity = handle_utils.create_identity
    original_rpc_call = handle_utils.rpc_call
    
    handle_utils.create_identity = lambda **kwargs: _make_identity("did:wba:awiki.ai:alice:k1_new")
    handle_utils.rpc_call = fake_rpc_call
    
    try:
        # 执行测试
        async def _run():
            identity, result = await handle_utils.recover_handle(
                client=object(),
                config=SDKConfig(did_domain="awiki.ai"),
                phone="+8613800138000",
                otp_code="123456",
                handle="alice",
            )
            return identity, result
        
        identity, result = asyncio.run(_run())
        
        # 记录输出
        test_output = {
            "recorded_rpc_call": {
                "endpoint": recorded["endpoint"],
                "method": recorded["method"],
                "payload": recorded["payload"],
            },
            "identity": {
                "did": identity.did,
                "jwt_token": identity.jwt_token,
            },
            "result": {
                "full_handle": result["full_handle"],
            },
        }
        
        print("\n【输出】")
        print(json.dumps(test_output, indent=2, ensure_ascii=False))
        
        # 验证点
        print("\n【验证点】")
        validations = [
            ("endpoint == /user-service/did-auth/rpc", recorded["endpoint"] == "/user-service/did-auth/rpc"),
            ("method == recover_handle", recorded["method"] == "recover_handle"),
            ("payload.handle == alice", recorded["payload"]["handle"] == "alice"),
            ("payload.otp_code == 123456", recorded["payload"]["otp_code"] == "123456"),
            ("identity.did == did:wba:awiki.ai:alice:k1_new", identity.did == "did:wba:awiki.ai:alice:k1_new"),
            ("identity.jwt_token == jwt-token", identity.jwt_token == "jwt-token"),
            ("result.full_handle == alice.awiki.ai", result["full_handle"] == "alice.awiki.ai"),
        ]
        
        all_passed = True
        for desc, passed in validations:
            status = "✓ PASS" if passed else "✗ FAIL"
            print(f"  {status}: {desc}")
            if not passed:
                all_passed = False
        
        print("\n" + "=" * 60)
        if all_passed:
            print("所有验证点通过 ✓")
        else:
            print("存在验证点失败 ✗")
            sys.exit(1)
        print("=" * 60)
        
    finally:
        # 恢复原始函数
        handle_utils.create_identity = original_create_identity
        handle_utils.rpc_call = original_rpc_call


if __name__ == "__main__":
    main()
