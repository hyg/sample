"""蒸馏脚本：记录 credential_store.py 的输入输出黄金标准。

此脚本执行 credential_store.py 的核心函数，记录输入和输出作为参考。
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

# 添加项目路径
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "python"))
sys.path.insert(0, str(PROJECT_ROOT / "python" / "scripts"))

from credential_store import (
    list_identities,
    save_identity,
    load_identity,
    delete_identity,
    backup_identity,
    update_jwt,
    extract_auth_files,
    list_identities_by_name,
    prune_unreferenced_credential_dir,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)


def generate_test_keys():
    """生成测试用的密钥对（简化版，实际应使用加密库）。"""
    private_key = b"""-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIBkg7qNz3V8xKzTbMxqzT5v8xKzTbMxqzT5v8xKzTbMxoGBgqgBBQMC
AQEwEwYHKoZIzj0CAQYIKoZIzj0DAQcEJzAlMCAkMCUwJTAjMCEwHzAdMB8wHQ
==
-----END EC PRIVATE KEY-----"""
    public_key = b"""-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE7qNz3V8xKzTbMxqzT5v8xKzTbMxq
zT5v8xKzTbMxqzT5v8xKzTbMxqzT5v8xKzTbMxqzT5v8xKzTbMxqzT5v8xQ==
-----END PUBLIC KEY-----"""
    return private_key, public_key


def run_distillation():
    """执行蒸馏流程，记录各函数的输入输出。"""
    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "module": "credential_store.py",
        "functions": {}
    }

    # 1. list_identities_by_name (初始状态)
    logger.info("=== 测试 list_identities_by_name (初始状态) ===")
    try:
        output = list_identities_by_name()
        results["functions"]["list_identities_by_name_initial"] = {
            "input": {},
            "output": output,
            "status": "success"
        }
        logger.info(f"初始凭证数量：{len(output)}")
    except Exception as e:
        results["functions"]["list_identities_by_name_initial"] = {
            "input": {},
            "output": None,
            "status": "error",
            "error": str(e)
        }
        logger.error(f"list_identities_by_name 失败：{e}")

    # 2. list_identities (初始状态)
    logger.info("=== 测试 list_identities (初始状态) ===")
    try:
        output = list_identities()
        results["functions"]["list_identities_initial"] = {
            "input": {},
            "output": output,
            "status": "success"
        }
        logger.info(f"初始身份列表：{len(output)} 个身份")
    except Exception as e:
        results["functions"]["list_identities_initial"] = {
            "input": {},
            "output": None,
            "status": "error",
            "error": str(e)
        }
        logger.error(f"list_identities 失败：{e}")

    # 3. save_identity
    logger.info("=== 测试 save_identity ===")
    private_key, public_key = generate_test_keys()
    test_did = "did:wba:awiki.ai:user:k1_test_distill_" + datetime.now().strftime("%Y%m%d%H%M%S")
    test_unique_id = "distill_unique_" + datetime.now().strftime("%Y%m%d%H%M%S")
    test_name = "distill_test"
    
    try:
        output_path = save_identity(
            did=test_did,
            unique_id=test_unique_id,
            user_id="distill_user_001",
            private_key_pem=private_key,
            public_key_pem=public_key,
            jwt_token="test_jwt_token_placeholder",
            display_name="Distill Test User",
            handle="distill_test_handle",
            name=test_name,
            did_document={"id": test_did, "verificationMethod": []},
            replace_existing=True,
        )
        results["functions"]["save_identity"] = {
            "input": {
                "did": test_did,
                "unique_id": test_unique_id,
                "user_id": "distill_user_001",
                "private_key_pem": "<bytes>",
                "public_key_pem": "<bytes>",
                "jwt_token": "test_jwt_token_placeholder",
                "display_name": "Distill Test User",
                "handle": "distill_test_handle",
                "name": test_name,
                "did_document": {"id": test_did, "verificationMethod": []},
                "replace_existing": True,
            },
            "output": str(output_path),
            "status": "success"
        }
        logger.info(f"保存身份成功：{output_path}")
    except Exception as e:
        results["functions"]["save_identity"] = {
            "input": {
                "did": test_did,
                "name": test_name,
            },
            "output": None,
            "status": "error",
            "error": str(e)
        }
        logger.error(f"save_identity 失败：{e}")

    # 4. load_identity
    logger.info("=== 测试 load_identity ===")
    try:
        output = load_identity(test_name)
        results["functions"]["load_identity"] = {
            "input": {"name": test_name},
            "output": {
                "did": output.get("did") if output else None,
                "unique_id": output.get("unique_id") if output else None,
                "user_id": output.get("user_id") if output else None,
                "name": output.get("name") if output else None,
                "handle": output.get("handle") if output else None,
                "has_jwt": bool(output.get("jwt_token")) if output else False,
                "has_private_key": bool(output.get("private_key_pem")) if output else False,
            } if output else None,
            "status": "success" if output else "not_found"
        }
        logger.info(f"加载身份成功：DID={output.get('did') if output else 'N/A'}")
    except Exception as e:
        results["functions"]["load_identity"] = {
            "input": {"name": test_name},
            "output": None,
            "status": "error",
            "error": str(e)
        }
        logger.error(f"load_identity 失败：{e}")

    # 5. list_identities (保存后)
    logger.info("=== 测试 list_identities (保存后) ===")
    try:
        output = list_identities()
        results["functions"]["list_identities_after_save"] = {
            "input": {},
            "output": output,
            "status": "success"
        }
        logger.info(f"保存后身份列表：{len(output)} 个身份")
    except Exception as e:
        results["functions"]["list_identities_after_save"] = {
            "input": {},
            "output": None,
            "status": "error",
            "error": str(e)
        }
        logger.error(f"list_identities 失败：{e}")

    # 6. update_jwt
    logger.info("=== 测试 update_jwt ===")
    new_jwt = "updated_jwt_token_" + datetime.now().strftime("%Y%m%d%H%M%S")
    try:
        success = update_jwt(test_name, new_jwt)
        results["functions"]["update_jwt"] = {
            "input": {"name": test_name, "jwt_token": new_jwt},
            "output": success,
            "status": "success" if success else "failed"
        }
        logger.info(f"更新 JWT 成功：{success}")
    except Exception as e:
        results["functions"]["update_jwt"] = {
            "input": {"name": test_name, "jwt_token": new_jwt},
            "output": None,
            "status": "error",
            "error": str(e)
        }
        logger.error(f"update_jwt 失败：{e}")

    # 7. extract_auth_files
    logger.info("=== 测试 extract_auth_files ===")
    try:
        output = extract_auth_files(test_name)
        results["functions"]["extract_auth_files"] = {
            "input": {"name": test_name},
            "output": {
                "did_document_path": str(output[0]) if output else None,
                "key1_private_path": str(output[1]) if output else None,
            } if output else None,
            "status": "success" if output else "not_found"
        }
        logger.info(f"提取认证文件成功：{output}")
    except Exception as e:
        results["functions"]["extract_auth_files"] = {
            "input": {"name": test_name},
            "output": None,
            "status": "error",
            "error": str(e)
        }
        logger.error(f"extract_auth_files 失败：{e}")

    # 8. backup_identity
    logger.info("=== 测试 backup_identity ===")
    try:
        output = backup_identity(test_name)
        results["functions"]["backup_identity"] = {
            "input": {"name": test_name},
            "output": str(output) if output else None,
            "status": "success" if output else "not_found"
        }
        logger.info(f"备份身份成功：{output}")
    except Exception as e:
        results["functions"]["backup_identity"] = {
            "input": {"name": test_name},
            "output": None,
            "status": "error",
            "error": str(e)
        }
        logger.error(f"backup_identity 失败：{e}")

    # 9. delete_identity
    logger.info("=== 测试 delete_identity ===")
    try:
        success = delete_identity(test_name)
        results["functions"]["delete_identity"] = {
            "input": {"name": test_name},
            "output": success,
            "status": "success" if success else "not_found"
        }
        logger.info(f"删除身份成功：{success}")
    except Exception as e:
        results["functions"]["delete_identity"] = {
            "input": {"name": test_name},
            "output": None,
            "status": "error",
            "error": str(e)
        }
        logger.error(f"delete_identity 失败：{e}")

    # 10. list_identities (删除后)
    logger.info("=== 测试 list_identities (删除后) ===")
    try:
        output = list_identities()
        results["functions"]["list_identities_after_delete"] = {
            "input": {},
            "output": output,
            "status": "success"
        }
        logger.info(f"删除后身份列表：{len(output)} 个身份")
    except Exception as e:
        results["functions"]["list_identities_after_delete"] = {
            "input": {},
            "output": None,
            "status": "error",
            "error": str(e)
        }
        logger.error(f"list_identities 失败：{e}")

    # 11. prune_unreferenced_credential_dir
    logger.info("=== 测试 prune_unreferenced_credential_dir ===")
    try:
        # 注意：此函数需要实际的 dir_name，这里使用测试值
        output = prune_unreferenced_credential_dir("nonexistent_dir")
        results["functions"]["prune_unreferenced_credential_dir"] = {
            "input": {"dir_name": "nonexistent_dir"},
            "output": output,
            "status": "success"
        }
        logger.info(f"清理未引用目录结果：{output}")
    except Exception as e:
        results["functions"]["prune_unreferenced_credential_dir"] = {
            "input": {"dir_name": "nonexistent_dir"},
            "output": None,
            "status": "error",
            "error": str(e)
        }
        logger.error(f"prune_unreferenced_credential_dir 失败：{e}")

    return results


def main():
    """主函数：执行蒸馏并输出结果。"""
    print("=" * 60)
    print("credential_store.py 蒸馏脚本")
    print("=" * 60)
    
    results = run_distillation()
    
    # 输出 JSON 结果
    print("\n" + "=" * 60)
    print("蒸馏结果 (JSON)")
    print("=" * 60)
    print(json.dumps(results, indent=2, default=str))
    
    # 输出摘要
    print("\n" + "=" * 60)
    print("执行摘要")
    print("=" * 60)
    for func_name, result in results["functions"].items():
        status = result.get("status", "unknown")
        print(f"  {func_name}: {status}")
    
    print("\n" + "=" * 60)
    print("蒸馏完成")
    print("=" * 60)
    
    return results


if __name__ == "__main__":
    main()
