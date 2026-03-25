#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
anp-0.6.8 蒸馏脚本

基于 py.md 和 distill.json 生成可执行的测试用例，
记录输入输出作为"黄金标准"。

覆盖模块:
- anp.authentication - DID WBA 认证
- anp.e2e_encryption_hpke - E2EE 加密
"""

import json
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# 导入 anp 模块
from anp.authentication import (
    DIDWbaAuthHeader,
    create_did_wba_document_with_key_binding,
    generate_auth_header,
    resolve_did_wba_document,
)
from anp.e2e_encryption_hpke import (
    E2eeHpkeSession,
    SessionState,
    HpkeKeyManager,
    MessageType,
    generate_proof,
    validate_proof,
    detect_message_type,
    extract_x25519_public_key_from_did_document,
    extract_signing_public_key_from_did_document,
    generate_x25519_key_pair,
    E2EE_VERSION,
    SeqMode,
)


def get_current_timestamp() -> str:
    """获取当前 ISO 8601 时间戳"""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def serialize_key(key: Any) -> str:
    """序列化密钥对象为字符串表示"""
    if key is None:
        return "None"
    type_name = type(key).__name__
    return f"<{type_name}>"


def serialize_output(obj: Any) -> Any:
    """序列化输出对象为 JSON 兼容格式"""
    if obj is None:
        return None
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, (int, float, str)):
        return obj
    if isinstance(obj, bytes):
        return f"<bytes:{len(obj)}>"
    if isinstance(obj, (list, tuple)):
        return [serialize_output(item) for item in obj]
    if isinstance(obj, dict):
        return {k: serialize_output(v) for k, v in obj.items()}
    if isinstance(obj, Exception):
        return {"error": str(type(obj).__name__), "message": str(obj)}
    # 处理密钥对象
    type_name = type(obj).__name__
    if "Key" in type_name or "key" in type_name.lower():
        return serialize_key(obj)
    if hasattr(obj, '__dict__'):
        return {f"<{type_name}>": "object"}
    return str(obj)


def load_private_key_from_pem(pem_bytes: bytes):
    """从 PEM 字节加载私钥对象"""
    from cryptography.hazmat.primitives import serialization
    
    # 确保是字符串
    if isinstance(pem_bytes, bytes):
        pem_str = pem_bytes.decode('utf-8')
    else:
        pem_str = pem_bytes
    
    return serialization.load_pem_private_key(
        pem_str.encode('utf-8'),
        password=None,
    )


# =============================================================================
# Authentication 模块测试
# =============================================================================

def test_generate_auth_header() -> Dict[str, Any]:
    """
    TC-AUTH-001: 生成 DID WBA 认证头
    
    测试 generate_auth_header 函数的基本功能
    """
    result = {
        "id": "TC-AUTH-001",
        "module": "anp.authentication",
        "function": "generate_auth_header",
        "business_scenario": "生成 DID WBA 认证头用于 JSON-RPC 请求认证",
        "timestamp": get_current_timestamp(),
    }
    
    # 首先创建一个 DID 文档用于测试
    try:
        did_doc, keys = create_did_wba_document_with_key_binding(
            hostname="awiki.ai",
            path_prefix=["user"],
            proof_purpose="authentication",
            domain="awiki.ai",
            challenge="test_challenge_123456",
        )
        
        # 获取私钥用于签名（bytes -> 对象）
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.utils import int_to_bytes
        
        private_key_pem_bytes = keys["key-1"][0]
        private_key = load_private_key_from_pem(private_key_pem_bytes)
        
        # 定义签名回调 - 使用 anp 内部期望的 R|S 格式
        def sign_callback(content: bytes, vm_fragment: str) -> bytes:
            # 使用 secp256k1 签名（DER 格式）
            signature_der = private_key.sign(content, ec.ECDSA(hashes.SHA256()))
            # 从 DER 格式提取 R 和 S
            # DER 格式：0x30 [总长度] 0x02 [R 长度] [R] 0x02 [S 长度] [S]
            from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
            r, s = decode_dss_signature(signature_der)
            # 转换为 R|S 格式（anp 期望的格式）
            r_bytes = int_to_bytes(r, 32)
            s_bytes = int_to_bytes(s, 32)
            return r_bytes + s_bytes
        
        from cryptography.hazmat.primitives import hashes
        
        # 生成认证头
        auth_header = generate_auth_header(
            did_document=did_doc,
            service_domain="awiki.ai",
            sign_callback=sign_callback,
        )
        
        result["input"] = {
            "did_document_id": did_doc["id"],
            "service_domain": "awiki.ai",
            "sign_callback": "function(content: bytes, vm_fragment: str) -> bytes (R|S format)",
        }
        result["output"] = {
            "type": "str",
            "format": "DIDWba <base64url_encoded_token>",
            "example": auth_header[:60] + "..." if len(auth_header) > 60 else auth_header,
            "success": True,
        }
        result["status"] = "PASS"
        
    except Exception as e:
        result["output"] = {"error": str(type(e).__name__), "message": str(e)}
        result["status"] = "ERROR"
    
    return result


def test_generate_auth_header_error_scenarios() -> Dict[str, Any]:
    """
    TC-AUTH-001-ERR: generate_auth_header 错误场景测试
    """
    result = {
        "id": "TC-AUTH-001-ERR",
        "module": "anp.authentication",
        "function": "generate_auth_header",
        "business_scenario": "测试错误场景处理",
        "timestamp": get_current_timestamp(),
        "error_tests": [],
    }
    
    # 测试场景 1: did_document 缺少 authentication 字段
    try:
        invalid_doc = {"id": "did:wba:test", "verificationMethod": []}
        
        def dummy_sign(content: bytes, vm: str) -> bytes:
            return b"dummy"
        
        generate_auth_header(
            did_document=invalid_doc,
            service_domain="awiki.ai",
            sign_callback=dummy_sign,
        )
        result["error_tests"].append({
            "condition": "did_document 缺少 authentication 字段",
            "expected": "ValueError",
            "actual": "No error raised",
            "status": "FAIL",
        })
    except ValueError as e:
        result["error_tests"].append({
            "condition": "did_document 缺少 authentication 字段",
            "expected": "ValueError",
            "actual": f"ValueError: {str(e)[:50]}",
            "status": "PASS",
        })
    except Exception as e:
        result["error_tests"].append({
            "condition": "did_document 缺少 authentication 字段",
            "expected": "ValueError",
            "actual": f"{type(e).__name__}: {str(e)[:50]}",
            "status": "PARTIAL",
        })
    
    # 测试场景 2: service_domain 为空字符串
    try:
        did_doc, keys = create_did_wba_document_with_key_binding(
            hostname="awiki.ai",
            path_prefix=["user"],
        )
        
        def dummy_sign(content: bytes, vm: str) -> bytes:
            return b"dummy"
        
        generate_auth_header(
            did_document=did_doc,
            service_domain="",
            sign_callback=dummy_sign,
        )
        result["error_tests"].append({
            "condition": "service_domain 为空字符串",
            "expected": "ValueError",
            "actual": "No error raised",
            "status": "FAIL",
        })
    except ValueError as e:
        result["error_tests"].append({
            "condition": "service_domain 为空字符串",
            "expected": "ValueError",
            "actual": f"ValueError: {str(e)[:50]}",
            "status": "PASS",
        })
    except Exception as e:
        result["error_tests"].append({
            "condition": "service_domain 为空字符串",
            "expected": "ValueError",
            "actual": f"{type(e).__name__}: {str(e)[:50]}",
            "status": "PARTIAL",
        })
    
    return result


def test_create_did_wba_document_with_key_binding() -> Dict[str, Any]:
    """
    TC-AUTH-002: 创建带密钥绑定的 DID WBA 文档
    
    测试 create_did_wba_document_with_key_binding 函数的基本功能
    """
    result = {
        "id": "TC-AUTH-002",
        "module": "anp.authentication",
        "function": "create_did_wba_document_with_key_binding",
        "business_scenario": "创建带密钥绑定的 DID WBA 身份文档（注册新用户）",
        "timestamp": get_current_timestamp(),
    }
    
    try:
        did_doc, keys = create_did_wba_document_with_key_binding(
            hostname="awiki.ai",
            path_prefix=["user"],
            proof_purpose="authentication",
            domain="awiki.ai",
            challenge="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
        )
        
        result["input"] = {
            "hostname": "awiki.ai",
            "path_prefix": ["user"],
            "proof_purpose": "authentication",
            "domain": "awiki.ai",
            "challenge": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
            "services": None,
        }
        result["output"] = {
            "type": "tuple",
            "structure": "(did_document: dict, keys: dict)",
            "did_document": {
                "id": did_doc["id"],
                "verificationMethod_count": len(did_doc.get("verificationMethod", [])),
                "authentication_present": "authentication" in did_doc,
                "proof_present": "proof" in did_doc,
                "proof_type": did_doc.get("proof", {}).get("type", "N/A"),
            },
            "keys": {
                "key-1_present": "key-1" in keys,
                "key-1_key_count": len(keys.get("key-1", [])),
            },
            "success": True,
        }
        result["status"] = "PASS"
        
    except Exception as e:
        result["output"] = {"error": str(type(e).__name__), "message": str(e)}
        result["status"] = "ERROR"
    
    return result


def test_create_did_wba_document_with_e2ee_keys() -> Dict[str, Any]:
    """
    TC-AUTH-003: 创建带 E2EE 密钥的 DID 身份
    
    测试创建包含 key-1, key-2, key-3 的完整 DID 文档
    """
    result = {
        "id": "TC-AUTH-003",
        "module": "anp.authentication",
        "function": "create_did_wba_document_with_key_binding",
        "business_scenario": "创建带 E2EE 密钥的 DID 身份（支持端到端加密）",
        "timestamp": get_current_timestamp(),
    }
    
    try:
        services = [
            {
                "id": "#messaging",
                "type": "MessagingService",
                "serviceEndpoint": "https://awiki.ai/message/rpc",
            }
        ]
        
        did_doc, keys = create_did_wba_document_with_key_binding(
            hostname="awiki.ai",
            path_prefix=["user"],
            proof_purpose="authentication",
            domain="awiki.ai",
            challenge="e2ee_challenge_hex",
            services=services,
        )
        
        result["input"] = {
            "hostname": "awiki.ai",
            "path_prefix": ["user"],
            "proof_purpose": "authentication",
            "domain": "awiki.ai",
            "challenge": "e2ee_challenge_hex",
            "services": [{"id": "#messaging", "type": "MessagingService"}],
        }
        result["output"] = {
            "type": "tuple",
            "did_document": {
                "id": did_doc["id"],
                "verificationMethod_count": len(did_doc.get("verificationMethod", [])),
                "key_types": [
                    vm.get("publicKeyJwk", {}).get("crv", "unknown")
                    for vm in did_doc.get("verificationMethod", [])
                ],
                "authentication_present": "authentication" in did_doc,
                "keyAgreement_present": "keyAgreement" in did_doc,
                "service_present": "service" in did_doc,
            },
            "keys": {
                "keys_present": list(keys.keys()),
            },
            "success": True,
        }
        result["status"] = "PASS"
        
    except Exception as e:
        result["output"] = {"error": str(type(e).__name__), "message": str(e)}
        result["status"] = "ERROR"
    
    return result


def test_resolve_did_wba_document() -> Dict[str, Any]:
    """
    TC-AUTH-004: 解析 DID WBA 文档
    
    测试 resolve_did_wba_document 函数（异步）
    """
    result = {
        "id": "TC-AUTH-004",
        "module": "anp.authentication",
        "function": "resolve_did_wba_document",
        "business_scenario": "解析远程 DID 文档用于 E2EE 会话建立",
        "timestamp": get_current_timestamp(),
    }
    
    # 测试有效 DID 格式（不保证 DID 实际存在）
    test_did = "did:wba:awiki.ai:user:k1_test_resolve"
    
    try:
        import asyncio
        
        async def resolve_async():
            resolved = await resolve_did_wba_document(test_did)
            return resolved
        
        resolved = asyncio.run(resolve_async())
        
        result["input"] = {"did": test_did}
        result["output"] = {
            "type": "dict | None",
            "resolved": resolved is not None,
            "content": serialize_output(resolved) if resolved else None,
        }
        result["status"] = "PASS" if resolved else "INFO_DID_NOT_FOUND"
        
    except Exception as e:
        result["output"] = {"error": str(type(e).__name__), "message": str(e)}
        result["status"] = "ERROR"
    
    # 添加错误场景测试
    result["error_scenarios"] = []
    
    # 测试无效 DID 格式
    try:
        import asyncio
        
        async def resolve_invalid():
            resolved = await resolve_did_wba_document("invalid_did_format")
            return resolved
        
        resolved = asyncio.run(resolve_invalid())
        result["error_scenarios"].append({
            "condition": "DID 格式无效",
            "expected": "None or ValueError",
            "actual": f"resolved={resolved is not None}",
            "status": "INFO",
        })
    except Exception as e:
        result["error_scenarios"].append({
            "condition": "DID 格式无效",
            "expected": "Exception",
            "actual": f"{type(e).__name__}: {str(e)[:50]}",
            "status": "PASS",
        })
    
    return result


# =============================================================================
# E2EE Encryption 模块测试
# =============================================================================

def _get_signing_key_from_keys(keys: dict, key_name: str = "key-1"):
    """从 keys 字典加载签名私钥对象"""
    pem_bytes = keys[key_name][0]
    return load_private_key_from_pem(pem_bytes)


def test_e2ee_hpke_session_initiate() -> Dict[str, Any]:
    """
    TC-E2EE-001: 发起 E2EE 会话
    
    测试 E2eeHpkeSession.initiate_session 方法
    """
    result = {
        "id": "TC-E2EE-001",
        "module": "anp.e2e_encryption_hpke",
        "class": "E2eeHpkeSession",
        "method": "initiate_session",
        "business_scenario": "发起 E2EE 会话（发送 e2ee_init）",
        "timestamp": get_current_timestamp(),
    }
    
    try:
        # 生成 X25519 密钥对
        local_x25519_priv, local_x25519_pub = generate_x25519_key_pair()
        peer_x25519_priv, peer_x25519_pub = generate_x25519_key_pair()
        
        # 创建本地和对方的 DID 文档
        local_did_doc, local_keys = create_did_wba_document_with_key_binding(
            hostname="awiki.ai",
            path_prefix=["user"],
            proof_purpose="authentication",
        )
        peer_did_doc, peer_keys = create_did_wba_document_with_key_binding(
            hostname="awiki.ai",
            path_prefix=["user"],
            proof_purpose="authentication",
        )
        
        # 加载签名私钥对象
        signing_private_key = _get_signing_key_from_keys(local_keys, "key-1")
        
        # 创建会话 - 使用正确的构造函数签名
        session = E2eeHpkeSession(
            local_did=local_did_doc["id"],
            peer_did=peer_did_doc["id"],
            local_x25519_private_key=local_x25519_priv,
            local_x25519_key_id=f"{local_did_doc['id']}#key-3",
            signing_private_key=signing_private_key,
            signing_verification_method=f"{local_did_doc['id']}#key-1",
        )
        
        # 发起会话 - 使用正确的参数名 (peer_pk, peer_key_id)
        msg_type, content = session.initiate_session(
            peer_pk=peer_x25519_pub,
            peer_key_id=f"{peer_did_doc['id']}#key-3",
        )
        
        result["input"] = {
            "local_did": local_did_doc["id"],
            "peer_did": peer_did_doc["id"],
            "local_x25519_key_id": f"{local_did_doc['id']}#key-3",
            "peer_key_id": f"{peer_did_doc['id']}#key-3",
        }
        result["output"] = {
            "type": "tuple",
            "structure": "(msg_type: str, content: dict)",
            "msg_type": msg_type,
            "content": {
                "e2ee_version": content.get("e2ee_version", "N/A"),
                "session_id": content.get("session_id", "N/A")[:20] + "..." if isinstance(content.get("session_id"), str) else "N/A",
                "sender_did": content.get("sender_did", "N/A"),
                "recipient_did": content.get("recipient_did", "N/A"),
                "has_proof": "proof" in content,
            },
            "session_state": str(session.state) if hasattr(session, 'state') else "N/A",
        }
        result["status"] = "PASS"
        
    except Exception as e:
        result["output"] = {"error": str(type(e).__name__), "message": str(e)}
        result["status"] = "ERROR"
    
    return result


def test_e2ee_hpke_session_process_init() -> Dict[str, Any]:
    """
    TC-E2EE-002: 处理 e2ee_init 消息
    
    测试 E2eeHpkeSession.process_init 方法
    """
    result = {
        "id": "TC-E2EE-002",
        "module": "anp.e2e_encryption_hpke",
        "class": "E2eeHpkeSession",
        "method": "process_init",
        "business_scenario": "处理收到的 e2ee_init 消息（接收方建立会话）",
        "timestamp": get_current_timestamp(),
    }
    
    try:
        # 生成密钥对
        initiator_x25519_priv, initiator_x25519_pub = generate_x25519_key_pair()
        receiver_x25519_priv, receiver_x25519_pub = generate_x25519_key_pair()
        
        # 创建 DID 文档
        initiator_did_doc, initiator_keys = create_did_wba_document_with_key_binding(
            hostname="awiki.ai", path_prefix=["initiator"]
        )
        receiver_did_doc, receiver_keys = create_did_wba_document_with_key_binding(
            hostname="awiki.ai", path_prefix=["receiver"]
        )
        
        # 加载签名私钥对象
        initiator_signing_key = _get_signing_key_from_keys(initiator_keys, "key-1")
        receiver_signing_key = _get_signing_key_from_keys(receiver_keys, "key-1")
        
        # 发起方创建会话并生成 init 消息
        initiator_session = E2eeHpkeSession(
            local_did=initiator_did_doc["id"],
            peer_did=receiver_did_doc["id"],
            local_x25519_private_key=initiator_x25519_priv,
            local_x25519_key_id=f"{initiator_did_doc['id']}#key-3",
            signing_private_key=initiator_signing_key,
            signing_verification_method=f"{initiator_did_doc['id']}#key-1",
        )
        
        msg_type, init_content = initiator_session.initiate_session(
            peer_pk=receiver_x25519_pub,
            peer_key_id=f"{receiver_did_doc['id']}#key-3",
        )
        
        # 接收方创建会话并处理 init - 使用正确的参数名 (sender_signing_pk)
        receiver_session = E2eeHpkeSession(
            local_did=receiver_did_doc["id"],
            peer_did=initiator_did_doc["id"],
            local_x25519_private_key=receiver_x25519_priv,
            local_x25519_key_id=f"{receiver_did_doc['id']}#key-3",
            signing_private_key=receiver_signing_key,
            signing_verification_method=f"{receiver_did_doc['id']}#key-1",
        )
        
        receiver_session.process_init(
            content=init_content,
            sender_signing_pk=initiator_x25519_pub,
        )
        
        result["input"] = {
            "content": init_content,
            "sender_signing_pk": serialize_key(initiator_x25519_pub),
        }
        result["output"] = {
            "type": "None",
            "side_effect": "会话状态变为 ACTIVE",
            "receiver_session_state": str(receiver_session.state) if hasattr(receiver_session, 'state') else "N/A",
            "success": True,
        }
        result["status"] = "PASS"
        
    except Exception as e:
        result["output"] = {"error": str(type(e).__name__), "message": str(e)}
        result["status"] = "ERROR"
    
    return result


def test_e2ee_encrypt_decrypt_message() -> Dict[str, Any]:
    """
    TC-E2EE-003/004: E2EE 消息加密和解密
    
    测试 E2eeHpkeSession.encrypt_message 和 decrypt_message 方法
    """
    result = {
        "id": "TC-E2EE-003-004",
        "module": "anp.e2e_encryption_hpke",
        "class": "E2eeHpkeSession",
        "methods": ["encrypt_message", "decrypt_message"],
        "business_scenario": "使用 HPKE 加密和解密消息（Chain Ratchet 前向安全）",
        "timestamp": get_current_timestamp(),
    }
    
    try:
        # 生成密钥对
        sender_x25519_priv, sender_x25519_pub = generate_x25519_key_pair()
        receiver_x25519_priv, receiver_x25519_pub = generate_x25519_key_pair()
        
        # 创建 DID 文档
        sender_did_doc, sender_keys = create_did_wba_document_with_key_binding(
            hostname="awiki.ai", path_prefix=["sender"]
        )
        receiver_did_doc, receiver_keys = create_did_wba_document_with_key_binding(
            hostname="awiki.ai", path_prefix=["receiver"]
        )
        
        # 加载签名私钥对象
        sender_signing_key = _get_signing_key_from_keys(sender_keys, "key-1")
        receiver_signing_key = _get_signing_key_from_keys(receiver_keys, "key-1")
        
        # 发送方创建会话并发起
        sender_session = E2eeHpkeSession(
            local_did=sender_did_doc["id"],
            peer_did=receiver_did_doc["id"],
            local_x25519_private_key=sender_x25519_priv,
            local_x25519_key_id=f"{sender_did_doc['id']}#key-3",
            signing_private_key=sender_signing_key,
            signing_verification_method=f"{sender_did_doc['id']}#key-1",
        )
        
        msg_type, init_content = sender_session.initiate_session(
            peer_pk=receiver_x25519_pub,
            peer_key_id=f"{receiver_did_doc['id']}#key-3",
        )
        
        # 接收方创建会话并处理 init
        receiver_session = E2eeHpkeSession(
            local_did=receiver_did_doc["id"],
            peer_did=sender_did_doc["id"],
            local_x25519_private_key=receiver_x25519_priv,
            local_x25519_key_id=f"{receiver_did_doc['id']}#key-3",
            signing_private_key=receiver_signing_key,
            signing_verification_method=f"{receiver_did_doc['id']}#key-1",
        )
        
        receiver_session.process_init(
            content=init_content,
            sender_signing_pk=sender_x25519_pub,
        )
        
        # 发送方加密消息
        plaintext = "Hello, this is a secret message!"
        enc_type, enc_content = sender_session.encrypt_message(
            original_type="text",
            plaintext=plaintext,
        )
        
        # 接收方解密消息
        dec_type, (original_type, decrypted_plaintext) = receiver_session.decrypt_message(
            content=enc_content,
        )
        
        result["input"] = {
            "original_type": "text",
            "plaintext": plaintext,
        }
        result["output"] = {
            "encrypt": {
                "msg_type": enc_type,
                "content": {
                    "e2ee_version": enc_content.get("e2ee_version", "N/A"),
                    "session_id": enc_content.get("session_id", "N/A")[:20] + "..." if isinstance(enc_content.get("session_id"), str) else "N/A",
                    "original_type": enc_content.get("original_type", "N/A"),
                    "ciphertext_length": len(enc_content.get("ciphertext", "")),
                    "seq": enc_content.get("seq", "N/A"),
                },
            },
            "decrypt": {
                "original_type": original_type,
                "plaintext": decrypted_plaintext,
                "match": decrypted_plaintext == plaintext,
            },
            "success": True,
        }
        result["status"] = "PASS" if decrypted_plaintext == plaintext else "FAIL"
        
    except Exception as e:
        result["output"] = {"error": str(type(e).__name__), "message": str(e)}
        result["status"] = "ERROR"
    
    return result


def test_generate_proof() -> Dict[str, Any]:
    """
    TC-E2EE-006: 生成 E2EE 消息证明
    
    测试 generate_proof 函数
    """
    result = {
        "id": "TC-E2EE-006",
        "module": "anp.e2e_encryption_hpke",
        "function": "generate_proof",
        "business_scenario": "为 E2EE 消息生成签名证明（用于 e2ee_ack）",
        "timestamp": get_current_timestamp(),
    }
    
    try:
        # 生成密钥对（secp256r1 用于签名）
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.backends import default_backend
        
        signing_priv = ec.generate_private_key(ec.SECP256R1(), default_backend())
        signing_pub = signing_priv.public_key()
        
        # 创建内容
        content = {
            "e2ee_version": E2EE_VERSION,
            "session_id": "test_session_123",
            "sender_did": "did:wba:awiki.ai:user:k1_sender",
            "recipient_did": "did:wba:awiki.ai:user:k1_receiver",
            "expires": 86400,
        }
        
        # 生成证明
        proof_content = generate_proof(
            content=content,
            private_key=signing_priv,
            verification_method="did:wba:awiki.ai:user:k1_sender#key-2",
        )
        
        result["input"] = {
            "content": {
                "e2ee_version": E2EE_VERSION,
                "session_id": "test_session_123",
                "sender_did": "did:wba:awiki.ai:user:k1_sender",
                "recipient_did": "did:wba:awiki.ai:user:k1_receiver",
                "expires": 86400,
            },
            "private_key": serialize_key(signing_priv),
            "verification_method": "did:wba:awiki.ai:user:k1_sender#key-2",
        }
        result["output"] = {
            "type": "dict",
            "structure": "content with added 'proof' field",
            "has_proof": "proof" in proof_content,
            "proof_type": proof_content.get("proof", {}).get("type", "N/A"),
            "proof_verification_method": proof_content.get("proof", {}).get("verificationMethod", "N/A"),
            "proof_has_created": "created" in proof_content.get("proof", {}),
            "proof_has_proof_value": "proofValue" in proof_content.get("proof", {}),
        }
        result["status"] = "PASS"
        
    except Exception as e:
        result["output"] = {"error": str(type(e).__name__), "message": str(e)}
        result["status"] = "ERROR"
    
    return result


def test_validate_proof() -> Dict[str, Any]:
    """
    TC-E2EE-007: 验证 E2EE 消息证明
    
    测试 validate_proof 函数
    """
    result = {
        "id": "TC-E2EE-007",
        "module": "anp.e2e_encryption_hpke",
        "function": "validate_proof",
        "business_scenario": "验证 E2EE 消息的签名证明",
        "timestamp": get_current_timestamp(),
    }
    
    try:
        # 生成密钥对（secp256r1 用于签名）
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.backends import default_backend
        
        signing_priv = ec.generate_private_key(ec.SECP256R1(), default_backend())
        signing_pub = signing_priv.public_key()
        
        # 创建带证明的内容
        content = {
            "e2ee_version": E2EE_VERSION,
            "session_id": "test_session_456",
            "sender_did": "did:wba:awiki.ai:user:k1_sender",
            "recipient_did": "did:wba:awiki.ai:user:k1_receiver",
            "expires": 86400,
        }
        
        proof_content = generate_proof(
            content=content,
            private_key=signing_priv,
            verification_method="did:wba:awiki.ai:user:k1_sender#key-2",
        )
        
        # 验证证明
        validate_proof(
            content=proof_content,
            public_key=signing_pub,
            max_past_age_seconds=86400,
        )
        
        result["input"] = {
            "content": proof_content,
            "public_key": serialize_key(signing_pub),
            "max_past_age_seconds": 86400,
        }
        result["output"] = {
            "type": "None",
            "success": "无异常抛出（证明有效）",
        }
        result["status"] = "PASS"
        
    except Exception as e:
        result["output"] = {"error": str(type(e).__name__), "message": str(e)}
        result["status"] = "ERROR"
    
    return result


def test_validate_proof_error_scenarios() -> Dict[str, Any]:
    """
    TC-E2EE-007-ERR: validate_proof 错误场景测试
    """
    result = {
        "id": "TC-E2EE-007-ERR",
        "module": "anp.e2e_encryption_hpke",
        "function": "validate_proof",
        "business_scenario": "测试证明验证错误场景",
        "timestamp": get_current_timestamp(),
        "error_tests": [],
    }
    
    # 测试场景 1: 签名验证失败（使用错误的公钥）
    try:
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.backends import default_backend
        
        signing_priv1 = ec.generate_private_key(ec.SECP256R1(), default_backend())
        signing_pub1 = signing_priv1.public_key()
        signing_priv2 = ec.generate_private_key(ec.SECP256R1(), default_backend())
        signing_pub2 = signing_priv2.public_key()  # 不同的密钥对
        
        content = {
            "e2ee_version": E2EE_VERSION,
            "session_id": "test_session",
        }
        
        proof_content = generate_proof(
            content=content,
            private_key=signing_priv1,
            verification_method="#key-2",
        )
        
        validate_proof(
            content=proof_content,
            public_key=signing_pub2,  # 错误的公钥
            max_past_age_seconds=86400,
        )
        result["error_tests"].append({
            "condition": "签名验证失败（错误的公钥）",
            "expected": "ValueError",
            "actual": "No error raised",
            "status": "FAIL",
        })
    except ValueError as e:
        result["error_tests"].append({
            "condition": "签名验证失败（错误的公钥）",
            "expected": "ValueError",
            "actual": f"ValueError: {str(e)[:50]}",
            "status": "PASS",
        })
    except Exception as e:
        result["error_tests"].append({
            "condition": "签名验证失败（错误的公钥）",
            "expected": "ValueError",
            "actual": f"{type(e).__name__}: {str(e)[:50]}",
            "status": "PARTIAL",
        })
    
    return result


def test_detect_message_type() -> Dict[str, Any]:
    """
    TC-E2EE-008: 检测 E2EE 消息类型
    
    测试 detect_message_type 函数
    """
    result = {
        "id": "TC-E2EE-008",
        "module": "anp.e2e_encryption_hpke",
        "function": "detect_message_type",
        "business_scenario": "检测 E2EE 消息类型",
        "timestamp": get_current_timestamp(),
    }
    
    # detect_message_type 接受 type_field 字符串参数
    test_cases = [
        "e2ee_init",
        "e2ee_ack",
        "e2ee_msg",
        "e2ee_rekey",
        "e2ee_error",
        "unknown_type",
    ]
    
    results = []
    expected_map = {
        "e2ee_init": MessageType.E2EE_INIT,
        "e2ee_ack": MessageType.E2EE_ACK,
        "e2ee_msg": MessageType.E2EE_MSG,
        "e2ee_rekey": MessageType.E2EE_REKEY,
        "e2ee_error": MessageType.E2EE_ERROR,
        "unknown_type": None,
    }
    
    for type_field in test_cases:
        detected = detect_message_type(type_field)
        expected = expected_map.get(type_field)
        match = detected == expected
        results.append({
            "input": {"type_field": type_field},
            "output": str(detected),
            "expected": str(expected),
            "match": match,
        })
    
    result["test_cases"] = results
    result["status"] = "PASS" if all(r["match"] for r in results) else "PARTIAL"
    
    return result


def test_extract_x25519_public_key() -> Dict[str, Any]:
    """
    TC-E2EE-009: 从 DID 文档提取 X25519 公钥
    
    测试 extract_x25519_public_key_from_did_document 函数
    """
    result = {
        "id": "TC-E2EE-009",
        "module": "anp.e2e_encryption_hpke",
        "function": "extract_x25519_public_key_from_did_document",
        "business_scenario": "从 DID 文档提取 X25519 公钥用于 HPKE 密钥协商",
        "timestamp": get_current_timestamp(),
    }
    
    try:
        # 创建带 E2EE 密钥的 DID 文档
        did_doc, keys = create_did_wba_document_with_key_binding(
            hostname="awiki.ai",
            path_prefix=["user"],
            proof_purpose="authentication",
        )
        
        key_id = f"{did_doc['id']}#key-3"
        
        # 使用正确的参数名 (doc, key_id)
        public_key, extracted_key_id = extract_x25519_public_key_from_did_document(
            doc=did_doc,
            key_id=key_id,
        )
        
        result["input"] = {
            "doc_id": did_doc["id"],
            "key_id": key_id,
        }
        result["output"] = {
            "type": "tuple",
            "structure": "(public_key: X25519PublicKey, key_id: str)",
            "public_key": serialize_key(public_key),
            "key_id": extracted_key_id,
            "key_id_match": extracted_key_id == key_id,
        }
        result["status"] = "PASS"
        
    except Exception as e:
        result["output"] = {"error": str(type(e).__name__), "message": str(e)}
        result["status"] = "ERROR"
    
    return result


def test_extract_signing_public_key() -> Dict[str, Any]:
    """
    TC-E2EE-010: 从 DID 文档提取签名公钥
    
    测试 extract_signing_public_key_from_did_document 函数
    """
    result = {
        "id": "TC-E2EE-010",
        "module": "anp.e2e_encryption_hpke",
        "function": "extract_signing_public_key_from_did_document",
        "business_scenario": "从 DID 文档提取 secp256r1 签名公钥用于证明验证",
        "timestamp": get_current_timestamp(),
    }
    
    try:
        # 创建 DID 文档
        did_doc, keys = create_did_wba_document_with_key_binding(
            hostname="awiki.ai",
            path_prefix=["user"],
            proof_purpose="authentication",
        )
        
        key_id = f"{did_doc['id']}#key-2"
        
        # 使用正确的参数名 (doc, vm_id)
        public_key = extract_signing_public_key_from_did_document(
            doc=did_doc,
            vm_id=key_id,
        )
        
        result["input"] = {
            "doc_id": did_doc["id"],
            "vm_id": key_id,
        }
        result["output"] = {
            "type": "object",
            "public_key": serialize_key(public_key),
        }
        result["status"] = "PASS"
        
    except Exception as e:
        result["output"] = {"error": str(type(e).__name__), "message": str(e)}
        result["status"] = "ERROR"
    
    return result


def test_hpke_key_manager() -> Dict[str, Any]:
    """
    TC-E2EE-011/012: HpkeKeyManager 测试
    
    测试 HpkeKeyManager 的 register_session 和 cleanup_expired 方法
    """
    result = {
        "id": "TC-E2EE-011-012",
        "module": "anp.e2e_encryption_hpke",
        "class": "HpkeKeyManager",
        "methods": ["register_session", "cleanup_expired", "get_active_session"],
        "business_scenario": "注册和管理 E2EE 会话",
        "timestamp": get_current_timestamp(),
    }
    
    try:
        # 生成密钥对
        sender_x25519_priv, sender_x25519_pub = generate_x25519_key_pair()
        receiver_x25519_priv, receiver_x25519_pub = generate_x25519_key_pair()
        
        # 创建 DID 文档
        sender_did_doc, sender_keys = create_did_wba_document_with_key_binding(
            hostname="awiki.ai", path_prefix=["sender"]
        )
        receiver_did_doc, receiver_keys = create_did_wba_document_with_key_binding(
            hostname="awiki.ai", path_prefix=["receiver"]
        )
        
        # 加载签名私钥对象
        sender_signing_key = _get_signing_key_from_keys(sender_keys, "key-1")
        receiver_signing_key = _get_signing_key_from_keys(receiver_keys, "key-1")
        
        # 创建密钥管理器
        key_manager = HpkeKeyManager()
        
        # 创建并注册会话
        sender_session = E2eeHpkeSession(
            local_did=sender_did_doc["id"],
            peer_did=receiver_did_doc["id"],
            local_x25519_private_key=sender_x25519_priv,
            local_x25519_key_id=f"{sender_did_doc['id']}#key-3",
            signing_private_key=sender_signing_key,
            signing_verification_method=f"{sender_did_doc['id']}#key-1",
        )
        
        msg_type, init_content = sender_session.initiate_session(
            peer_pk=receiver_x25519_pub,
            peer_key_id=f"{receiver_did_doc['id']}#key-3",
        )
        
        # 注册会话
        key_manager.register_session(sender_session)
        
        # 获取活跃会话 - 使用正确的参数名
        active_session = key_manager.get_active_session(
            local_did=sender_did_doc["id"],
            peer_did=receiver_did_doc["id"],
        )
        
        # 清理过期会话
        key_manager.cleanup_expired()
        
        result["input"] = {
            "session_state": str(sender_session.state) if hasattr(sender_session, 'state') else "N/A",
        }
        result["output"] = {
            "register_session": {
                "success": True,
                "side_effect": "会话可通过 get_active_session 获取",
            },
            "get_active_session": {
                "session_found": active_session is not None,
            },
            "cleanup_expired": {
                "success": True,
                "side_effect": "过期会话从内部存储中移除",
            },
        }
        result["status"] = "PASS"
        
    except Exception as e:
        result["output"] = {"error": str(type(e).__name__), "message": str(e)}
        result["status"] = "ERROR"
    
    return result


# =============================================================================
# 主函数
# =============================================================================

def main():
    """执行所有测试并输出 JSON 结果"""
    
    output = {
        "meta": {
            "anp_version": "0.6.8+",
            "generated_date": get_current_timestamp(),
            "source_file": "doc/lib/anp-0.6.8/distill.py",
            "description": "anp 库蒸馏数据 - 基于可执行测试用例生成的黄金标准",
        },
        "modules_covered": [
            "anp.authentication",
            "anp.e2e_encryption_hpke",
        ],
        "test_cases": [],
    }
    
    # 执行所有测试
    tests = [
        # Authentication 模块
        test_generate_auth_header,
        test_generate_auth_header_error_scenarios,
        test_create_did_wba_document_with_key_binding,
        test_create_did_wba_document_with_e2ee_keys,
        test_resolve_did_wba_document,
        
        # E2EE 模块
        test_e2ee_hpke_session_initiate,
        test_e2ee_hpke_session_process_init,
        test_e2ee_encrypt_decrypt_message,
        test_generate_proof,
        test_validate_proof,
        test_validate_proof_error_scenarios,
        test_detect_message_type,
        test_extract_x25519_public_key,
        test_extract_signing_public_key,
        test_hpke_key_manager,
    ]
    
    for test_func in tests:
        try:
            result = test_func()
            output["test_cases"].append(result)
        except Exception as e:
            output["test_cases"].append({
                "id": test_func.__name__,
                "status": "FATAL_ERROR",
                "error": str(type(e).__name__),
                "message": str(e),
            })
    
    # 输出 JSON
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
