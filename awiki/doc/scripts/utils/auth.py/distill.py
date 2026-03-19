#!/usr/bin/env python3
"""蒸馏脚本 - utils/auth.py

提取 auth.py 中所有公共函数的输入输出作为黄金标准
"""

import sys
import json
from pathlib import Path

# 项目根目录：从 distill.py 向上 5 层
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
PYTHON_SCRIPTS = PROJECT_ROOT / 'python' / 'scripts'

# 添加 Python 脚本目录到路径
sys.path.insert(0, str(PYTHON_SCRIPTS))

# 导入目标模块
from utils.auth import (
    generate_wba_auth_header,
    register_did,
    update_did_document,
    get_jwt_via_wba,
    create_authenticated_identity,
)
from utils.config import SDKConfig
from utils.identity import DIDIdentity

def distill():
    """执行蒸馏，返回输入输出对"""
    results = {
        "file": "python/scripts/utils/auth.py",
        "doc_path": "doc/scripts/utils/auth.py",
        "functions": [],
        "constants": {},
        "classes": {}
    }
    
    # 注意：以下函数需要实际执行环境（DID、HTTP 客户端等）
    # 这里使用模拟数据记录函数签名和预期行为
    
    # 1. generate_wba_auth_header - 需要实际 DID 身份
    results["functions"].append({
        "name": "generate_wba_auth_header",
        "type": "function",
        "signature": "(identity: DIDIdentity, service_domain: str) -> str",
        "tests": [{
            "input": {
                "note": "需要实际的 DIDIdentity 实例",
                "identity": "DIDIdentity(did, private_key)",
                "service_domain": "https://awiki.ai"
            },
            "output": {
                "note": "返回 DIDWba 格式的授权头",
                "format": "DIDWba <did>:<signature>:<timestamp>"
            },
            "scenario": "生成 DID WBA 授权头"
        }],
        "mock_test": {
            "input": {"identity": "mock", "service_domain": "https://awiki.ai"},
            "output": "DIDWba did:wba:awiki.ai:user:k1_test:signature:timestamp",
            "scenario": "模拟测试（不需要实际身份）"
        }
    })
    
    # 2. register_did - 需要 HTTP 客户端和实际身份
    results["functions"].append({
        "name": "register_did",
        "type": "async_function",
        "signature": "(client, identity, name, is_public, is_agent, role, endpoint_url, description) -> dict",
        "tests": [{
            "input": {
                "note": "需要实际的 httpx.AsyncClient 和 DIDIdentity",
                "client": "httpx.AsyncClient",
                "identity": "DIDIdentity",
                "name": "Test User",
                "is_public": True,
                "is_agent": False
            },
            "output": {
                "did": "did:wba:awiki.ai:user:k1_xxx",
                "user_id": "uuid",
                "message": "Registration successful"
            },
            "scenario": "注册 DID 身份"
        }]
    })
    
    # 3. update_did_document - 需要 HTTP 客户端和实际身份
    results["functions"].append({
        "name": "update_did_document",
        "type": "async_function",
        "signature": "(client, identity, domain, is_public, is_agent, role, endpoint_url) -> dict",
        "tests": [{
            "input": {
                "note": "需要实际的 httpx.AsyncClient 和 DIDIdentity",
                "client": "httpx.AsyncClient",
                "identity": "DIDIdentity",
                "domain": "awiki.ai"
            },
            "output": {
                "access_token": "jwt_token"
            },
            "scenario": "更新 DID 文档"
        }]
    })
    
    # 4. get_jwt_via_wba - 需要 HTTP 客户端和实际身份
    results["functions"].append({
        "name": "get_jwt_via_wba",
        "type": "async_function",
        "signature": "(client, identity, domain) -> str",
        "tests": [{
            "input": {
                "note": "需要实际的 httpx.AsyncClient 和 DIDIdentity",
                "client": "httpx.AsyncClient",
                "identity": "DIDIdentity",
                "domain": "awiki.ai"
            },
            "output": {
                "jwt_token": "eyJ..."
            },
            "scenario": "通过 WBA 获取 JWT token"
        }]
    })
    
    # 5. create_authenticated_identity - 一站式身份创建
    results["functions"].append({
        "name": "create_authenticated_identity",
        "type": "async_function",
        "signature": "(client, config, name, is_agent) -> DIDIdentity",
        "tests": [{
            "input": {
                "note": "需要实际的 httpx.AsyncClient 和 SDKConfig",
                "client": "httpx.AsyncClient",
                "config": "SDKConfig",
                "name": "Test User",
                "is_agent": False
            },
            "output": {
                "did": "did:wba:awiki.ai:user:k1_xxx",
                "unique_id": "k1_xxx",
                "user_id": "uuid",
                "jwt_token": "eyJ...",
                "private_key_pem": "-----BEGIN EC PRIVATE KEY-----...",
                "public_key_pem": "-----BEGIN PUBLIC KEY-----..."
            },
            "scenario": "一站式创建认证身份"
        }]
    })
    
    # 导出常量
    results["constants"] = {
        "NOTE": "auth.py 没有定义模块级常量，所有配置通过参数传递"
    }
    
    # 导出类信息（auth.py 没有定义类，只使用外部类）
    results["classes"] = {
        "USED_CLASSES": [
            "DIDIdentity (from utils.identity)",
            "SDKConfig (from utils.config)"
        ]
    }
    
    return results

if __name__ == "__main__":
    results = distill()
    print(json.dumps(results, indent=2, default=str))
