"""蒸馏脚本：执行 test_auth_update.py 并记录黄金标准输入输出。"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# 添加脚本目录到路径
_scripts_dir = Path(__file__).resolve().parent.parent.parent.parent / "python" / "scripts"
sys.path.insert(0, str(_scripts_dir))

from utils.auth import update_did_document  # noqa: E402
from utils.identity import DIDIdentity  # noqa: E402
from utils.rpc import JsonRpcError  # noqa: E402


def _make_identity() -> DIDIdentity:
    """创建最小化的 DIDIdentity 用于测试。"""
    return DIDIdentity(
        did="did:wba:test.example.com:user:alice",
        did_document={
            "@context": ["https://www.w3.org/ns/did/v1"],
            "id": "did:wba:test.example.com:user:alice",
            "verificationMethod": [],
            "authentication": [],
            "proof": {"challenge": "nonce"},
        },
        private_key_pem=b"test-private-key",
        public_key_pem=b"test-public-key",
    )


async def test_update_did_document_uses_body_access_token() -> dict:
    """测试 1: Body access_token 应该按原样返回。"""
    import httpx
    
    # 模拟 generate_wba_auth_header
    original_func = None
    try:
        from utils import auth as auth_module
        original_func = auth_module.generate_wba_auth_header
        auth_module.generate_wba_auth_header = lambda identity, domain: "DIDWba test"
    except Exception:
        pass
    
    try:
        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.headers["Authorization"] == "DIDWba test"
            return httpx.Response(
                200,
                json={
                    "jsonrpc": "2.0",
                    "result": {
                        "did": "did:wba:test.example.com:user:alice",
                        "user_id": "user-1",
                        "message": "DID document updated",
                        "access_token": "body-token",
                    },
                    "id": 1,
                },
            )

        async def _run() -> dict[str, str]:
            async with httpx.AsyncClient(
                transport=httpx.MockTransport(handler),
                base_url="https://example.com",
            ) as client:
                return await update_did_document(
                    client,
                    _make_identity(),
                    "test.example.com",
                    is_public=True,
                )

        result = await _run()
        assert result["access_token"] == "body-token"
        return {"input": "body access_token scenario", "output": result}
    finally:
        # 恢复原函数
        if original_func:
            from utils import auth as auth_module
            auth_module.generate_wba_auth_header = original_func


async def test_update_did_document_uses_authorization_header_fallback() -> dict:
    """测试 2: Authorization 响应头应该填充 access_token（当 body 省略时）。"""
    import httpx
    
    # 模拟 generate_wba_auth_header
    original_func = None
    try:
        from utils import auth as auth_module
        original_func = auth_module.generate_wba_auth_header
        auth_module.generate_wba_auth_header = lambda identity, domain: "DIDWba test"
    except Exception:
        pass
    
    try:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                headers={"authorization": "bearer header-token"},
                json={
                    "jsonrpc": "2.0",
                    "result": {
                        "did": "did:wba:test.example.com:user:alice",
                        "user_id": "user-1",
                        "message": "DID document updated",
                    },
                    "id": 1,
                },
            )

        async def _run() -> dict[str, str]:
            async with httpx.AsyncClient(
                transport=httpx.MockTransport(handler),
                base_url="https://example.com",
            ) as client:
                return await update_did_document(
                    client, _make_identity(), "test.example.com"
                )

        result = await _run()
        assert result["access_token"] == "header-token"
        return {"input": "authorization header fallback scenario", "output": result}
    finally:
        # 恢复原函数
        if original_func:
            from utils import auth as auth_module
            auth_module.generate_wba_auth_header = original_func


async def test_update_did_document_raises_json_rpc_error() -> dict:
    """测试 3: JSON-RPC 错误应该抛出 JsonRpcError。"""
    import httpx
    
    # 模拟 generate_wba_auth_header
    original_func = None
    try:
        from utils import auth as auth_module
        original_func = auth_module.generate_wba_auth_header
        auth_module.generate_wba_auth_header = lambda identity, domain: "DIDWba test"
    except Exception:
        pass
    
    try:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={
                    "jsonrpc": "2.0",
                    "result": None,
                    "error": {
                        "code": -32003,
                        "message": "DID already registered",
                        "data": None,
                    },
                    "id": 1,
                },
            )

        async def _run() -> None:
            async with httpx.AsyncClient(
                transport=httpx.MockTransport(handler),
                base_url="https://example.com",
            ) as client:
                await update_did_document(client, _make_identity(), "test.example.com")

        try:
            await _run()
            raise AssertionError("Expected JsonRpcError but none was raised")
        except JsonRpcError as e:
            assert "DID already registered" in str(e)
            return {"input": "json rpc error scenario", "output": {"error": str(e)}}
    finally:
        # 恢复原函数
        if original_func:
            from utils import auth as auth_module
            auth_module.generate_wba_auth_header = original_func


async def main() -> None:
    """执行所有测试并记录黄金标准。"""
    print("=" * 60)
    print("蒸馏脚本：test_auth_update.py")
    print("=" * 60)
    
    # 测试 1
    print("\n[测试 1] Body access_token 返回")
    result1 = await test_update_did_document_uses_body_access_token()
    print(f"输入：{result1['input']}")
    print(f"输出：{result1['output']}")
    
    # 测试 2
    print("\n[测试 2] Authorization 头回退")
    result2 = await test_update_did_document_uses_authorization_header_fallback()
    print(f"输入：{result2['input']}")
    print(f"输出：{result2['output']}")
    
    # 测试 3
    print("\n[测试 3] JSON-RPC 错误抛出")
    result3 = await test_update_did_document_raises_json_rpc_error()
    print(f"输入：{result3['input']}")
    print(f"输出：{result3['output']}")
    
    print("\n" + "=" * 60)
    print("所有测试通过！黄金标准已记录。")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
