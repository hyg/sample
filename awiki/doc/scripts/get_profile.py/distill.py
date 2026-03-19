"""Distill script for get_profile.py - 记录输入输出作为黄金标准。

此脚本模拟原脚本的核心功能，记录输入参数和输出结果。
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

# 模拟外部依赖
class SDKConfig:
    """模拟 SDK 配置"""
    def __init__(self):
        self.host = "https://awiki.ai"
        self.timeout = 30


class MockUserServiceClient:
    """模拟用户服务客户端"""
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
    
    async def call(self, rpc_path: str, method: str, params: dict):
        """模拟 RPC 调用"""
        return self._mock_response(method, params)
    
    def _mock_response(self, method: str, params: dict) -> dict:
        """生成模拟响应"""
        if method == "get_me":
            return {
                "did": "did:wba:awiki.ai:user:k1_test123",
                "handle": "test_user",
                "displayName": "Test User",
                "bio": "This is a test profile",
                "avatar": "https://example.com/avatar.png",
                "createdAt": "2026-03-20T00:00:00Z"
            }
        elif method == "get_public_profile":
            identifier = params.get("did") or params.get("handle", "unknown")
            return {
                "did": f"did:wba:awiki.ai:user:k1_{identifier}",
                "handle": identifier if not params.get("did") else "user123",
                "displayName": f"Profile: {identifier}",
                "bio": "Public profile bio",
                "verified": True
            }
        elif method == "resolve":
            did = params.get("did", "unknown")
            return {
                "@context": ["https://www.w3.org/ns/did/v1"],
                "id": did,
                "verificationMethod": [{
                    "id": f"{did}#key-1",
                    "type": "Ed25519VerificationKey2018",
                    "controller": did,
                    "publicKeyMultibase": "z6Mktest123"
                }],
                "service": [{
                    "id": f"{did}#service-1",
                    "type": "UserProfile",
                    "serviceEndpoint": "https://awiki.ai/profile"
                }]
            }
        return {"error": "Unknown method"}


async def mock_authenticated_rpc_call(client, rpc_path: str, method: str, **kwargs) -> dict:
    """模拟认证 RPC 调用"""
    return await client.call(rpc_path, method, kwargs.get("params", {}))


async def mock_rpc_call(client, rpc_path: str, method: str, params: dict) -> dict:
    """模拟 RPC 调用"""
    return await client.call(rpc_path, method, params)


# 核心功能函数（与原脚本保持一致的签名）
async def get_my_profile(credential_name: str = "default") -> None:
    """查看自己的 Profile（模拟）。"""
    print(f"[INPUT] get_my_profile(credential_name='{credential_name}')")
    
    config = SDKConfig()
    async with MockUserServiceClient() as client:
        result = await mock_authenticated_rpc_call(
            client, "/user-service/did/profile/rpc", "get_me",
            params={"credential_name": credential_name}
        )
        print(f"[OUTPUT] {json.dumps(result, indent=2, ensure_ascii=False)}")


async def get_public_profile(*, did: str | None = None, handle: str | None = None) -> None:
    """查看公开 Profile（模拟）。"""
    print(f"[INPUT] get_public_profile(did={did!r}, handle={handle!r})")
    
    params: dict[str, str] = {}
    if did:
        params["did"] = did
    elif handle:
        params["handle"] = handle
    
    config = SDKConfig()
    async with MockUserServiceClient() as client:
        result = await mock_rpc_call(
            client, "/user-service/did/profile/rpc", "get_public_profile", params
        )
        print(f"[OUTPUT] {json.dumps(result, indent=2, ensure_ascii=False)}")


async def resolve_did(did: str) -> None:
    """解析 DID 文档（模拟）。"""
    print(f"[INPUT] resolve_did(did='{did}')")
    
    config = SDKConfig()
    async with MockUserServiceClient() as client:
        result = await mock_rpc_call(
            client, "/user-service/did/profile/rpc", "resolve", {"did": did}
        )
        print(f"[OUTPUT] {json.dumps(result, indent=2, ensure_ascii=False)}")


def main() -> None:
    """CLI 入口点 - 演示各种模式。"""
    parser = argparse.ArgumentParser(description="Distill: View DID Profile")
    parser.add_argument("--did", type=str, help="查看特定 DID 的公开 Profile")
    parser.add_argument("--handle", type=str, help="查看特定 handle 的公开 Profile")
    parser.add_argument("--resolve", type=str, help="解析特定 DID 文档")
    parser.add_argument("--credential", type=str, default="default",
                        help="凭证名称（默认：default）")
    parser.add_argument("--demo", action="store_true",
                        help="运行所有模式的演示")

    args = parser.parse_args()

    if args.demo:
        # 演示所有模式
        print("=" * 60)
        print("演示模式：运行所有功能")
        print("=" * 60)
        
        print("\n--- 模式 1: 查看自己的 Profile ---")
        asyncio.run(get_my_profile(args.credential))
        
        print("\n--- 模式 2: 查看公开 Profile (by DID) ---")
        asyncio.run(get_public_profile(did="did:wba:awiki.ai:user:k1_example"))
        
        print("\n--- 模式 3: 查看公开 Profile (by Handle) ---")
        asyncio.run(get_public_profile(handle="alice"))
        
        print("\n--- 模式 4: 解析 DID 文档 ---")
        asyncio.run(resolve_did("did:wba:awiki.ai:user:k1_example"))
        
        print("\n" + "=" * 60)
        print("演示完成")
        print("=" * 60)
    elif args.resolve:
        asyncio.run(resolve_did(args.resolve))
    elif args.did or args.handle:
        asyncio.run(get_public_profile(did=args.did, handle=args.handle))
    else:
        asyncio.run(get_my_profile(args.credential))


if __name__ == "__main__":
    main()
