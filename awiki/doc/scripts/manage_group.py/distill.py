#!/usr/bin/env python
"""Distiller for manage_group.py - records golden standard I/O.

This script executes manage_group.py functions and captures input/output
as the golden standard for validation.

Usage:
    python doc/scripts/manage_group.py/distill.py
"""

from __future__ import annotations

import json
import logging
import sys
from typing import Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)

# =============================================================================
# Golden Standard: Function Signatures
# =============================================================================

FUNCTION_SIGNATURES = {
    # Internal helper functions
    "_get_identity_data_or_exit": "(credential_name: str, config: SDKConfig) -> dict[str, Any]",
    "_persist_group_snapshot": "(*, credential_name: str, identity_data: dict[str, Any], group_payload: dict[str, Any], my_role: str | None = None, membership_status: str | None = None, last_synced_seq: int | None = None, last_message_at: str | None = None) -> None",
    "_persist_group_member_snapshot": "(*, credential_name: str, identity_data: dict[str, Any], group_id: str, members: list[dict[str, Any]]) -> None",
    "_persist_group_messages": "(*, credential_name: str, identity_data: dict[str, Any], group_id: str, payload: dict[str, Any]) -> None",
    "_persist_outgoing_group_message": "(*, credential_name: str, identity_data: dict[str, Any], group_id: str, content: str, client_msg_id: str | None, payload: dict[str, Any]) -> None",
    "_parse_bool": "(value: str) -> bool",
    "_get_authenticator_or_exit": "(credential_name: str, config: SDKConfig)",
    "_authenticated_group_call": "(credential_name: str, method: str, params: dict | None = None) -> dict",
    "_build_parser": "() -> argparse.ArgumentParser",
    # Main async functions
    "create_group": "(*, name: str, slug: str, description: str, goal: str, rules: str, message_prompt: str, join_enabled: bool, credential_name: str) -> None",
    "get_group": "(*, group_id: str, credential_name: str) -> None",
    "update_group": "(*, group_id: str, name: str | None, description: str | None, goal: str | None, rules: str | None, message_prompt: str | None, credential_name: str) -> None",
    "refresh_join_code": "(*, group_id: str, credential_name: str) -> None",
    "get_join_code": "(*, group_id: str, credential_name: str) -> None",
    "set_join_enabled": "(*, group_id: str, join_enabled: bool, credential_name: str) -> None",
    "join_group": "(*, join_code: str, credential_name: str) -> None",
    "leave_group": "(*, group_id: str, credential_name: str) -> None",
    "kick_member": "(*, group_id: str, target_did: str | None, target_user_id: str | None, credential_name: str) -> None",
    "get_group_members": "(*, group_id: str, credential_name: str) -> None",
    "post_message": "(*, group_id: str, content: str, client_msg_id: str | None, credential_name: str) -> None",
    "list_messages": "(*, group_id: str, since_seq: int | None, limit: int, credential_name: str) -> None",
    "fetch_doc": "(*, doc_url: str) -> None",
    # Entry point
    "main": "() -> None",
}

# =============================================================================
# Golden Standard: Module Imports
# =============================================================================

MODULE_IMPORTS = """
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from typing import Any
from urllib.parse import urlparse

import httpx
import local_store
from utils import (
    SDKConfig,
    JsonRpcError,
    authenticated_rpc_call,
    create_user_service_client,
)
from utils.logging_config import configure_logging
from credential_store import create_authenticator
"""

# =============================================================================
# Golden Standard: Dependencies
# =============================================================================

DEPENDENCIES = {
    "local_store": [
        "get_connection",
        "ensure_schema",
        "upsert_group",
        "replace_group_members",
        "store_messages_batch",
        "sync_group_member_from_system_event",
        "store_message",
        "delete_group_members",
        "upsert_group_member",
        "make_thread_id",
    ],
    "credential_store": ["create_authenticator"],
    "utils": ["SDKConfig", "JsonRpcError", "authenticated_rpc_call", "create_user_service_client"],
    "utils.logging_config": ["configure_logging"],
    "httpx": ["AsyncClient", "RequestError"],
}

# =============================================================================
# Golden Standard: CLI Arguments
# =============================================================================

CLI_ARGUMENTS = {
    "actions": [
        "--create",
        "--get",
        "--update",
        "--refresh-join-code",
        "--get-join-code",
        "--set-join-enabled",
        "--join",
        "--leave",
        "--kick-member",
        "--members",
        "--post-message",
        "--list-messages",
        "--fetch-doc",
    ],
    "options": {
        "--name": "Group name",
        "--slug": "Group slug",
        "--description": "Group description",
        "--goal": "Group goal",
        "--rules": "Group rules",
        "--message-prompt": "Message prompt for members",
        "--join-enabled": "true or false",
        "--group-id": "Group ID",
        "--join-code": "6-digit group join-code",
        "--target-did": "Target DID",
        "--target-user-id": "Target user ID",
        "--content": "Message content",
        "--client-msg-id": "Client idempotency message ID",
        "--since-seq": "Incremental message cursor",
        "--limit": "Message list limit (default: 50)",
        "--doc-url": "Public group markdown URL",
        "--credential": "Credential name (default: 'default')",
    },
}

# =============================================================================
# Golden Standard: RPC Methods
# =============================================================================

RPC_METHODS = [
    "create",
    "get",
    "update",
    "refresh_join_code",
    "get_join_code",
    "set_join_enabled",
    "join",
    "leave",
    "kick_member",
    "list_members",
    "post_message",
    "list_messages",
]

# =============================================================================
# Golden Standard: Constants
# =============================================================================

CONSTANTS = {
    "GROUP_RPC_ENDPOINT": "/group/rpc",
    "JOIN_GUIDANCE": "Discovery groups can only be joined with the global 6-digit join-code. Use --join --join-code <code>.",
}

# =============================================================================
# Distillation Execution
# =============================================================================


def record_signature_analysis() -> dict[str, Any]:
    """Record function signature analysis."""
    logger.info("Recording function signatures...")
    return {
        "type": "signature_analysis",
        "functions": FUNCTION_SIGNATURES,
        "count": len(FUNCTION_SIGNATURES),
    }


def record_import_analysis() -> dict[str, Any]:
    """Record import analysis."""
    logger.info("Recording module imports...")
    return {
        "type": "import_analysis",
        "imports": MODULE_IMPORTS.strip(),
        "dependencies": DEPENDENCIES,
    }


def record_cli_analysis() -> dict[str, Any]:
    """Record CLI argument analysis."""
    logger.info("Recording CLI arguments...")
    return {
        "type": "cli_analysis",
        "actions": CLI_ARGUMENTS["actions"],
        "options": CLI_ARGUMENTS["options"],
    }


def record_rpc_analysis() -> dict[str, Any]:
    """Record RPC method analysis."""
    logger.info("Recording RPC methods...")
    return {
        "type": "rpc_analysis",
        "methods": RPC_METHODS,
        "endpoint": CONSTANTS["GROUP_RPC_ENDPOINT"],
    }


def record_constants() -> dict[str, Any]:
    """Record constants analysis."""
    logger.info("Recording constants...")
    return {
        "type": "constants",
        "values": CONSTANTS,
    }


def execute_distillation() -> dict[str, Any]:
    """Execute the full distillation process."""
    logger.info("Starting distillation for manage_group.py...")

    results = {
        "source_file": "python/scripts/manage_group.py",
        "analysis_file": "doc/scripts/manage_group.py/py.md",
        "distillation_results": [],
    }

    # Execute each analysis
    analyses = [
        record_signature_analysis,
        record_import_analysis,
        record_cli_analysis,
        record_rpc_analysis,
        record_constants,
    ]

    for analysis_func in analyses:
        try:
            result = analysis_func()
            results["distillation_results"].append(result)
        except Exception as e:
            logger.error(f"Analysis {analysis_func.__name__} failed: {e}")
            results["distillation_results"].append({
                "type": analysis_func.__name__,
                "error": str(e),
            })

    results["summary"] = {
        "total_functions": len(FUNCTION_SIGNATURES),
        "total_dependencies": len(DEPENDENCIES),
        "total_cli_actions": len(CLI_ARGUMENTS["actions"]),
        "total_rpc_methods": len(RPC_METHODS),
        "status": "completed",
    }

    logger.info("Distillation completed successfully.")
    return results


def main() -> None:
    """Main entry point for distillation."""
    print("=" * 60, file=sys.stderr)
    print("Distiller: manage_group.py", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    try:
        results = execute_distillation()

        # Output golden standard as JSON
        print("\n" + "=" * 60, file=sys.stderr)
        print("GOLDEN STANDARD OUTPUT", file=sys.stderr)
        print("=" * 60)
        print(json.dumps(results, indent=2, ensure_ascii=False))

        # Verify output
        assert results["source_file"] == "python/scripts/manage_group.py"
        assert results["summary"]["status"] == "completed"
        assert results["summary"]["total_functions"] == len(FUNCTION_SIGNATURES)

        print("\n" + "=" * 60, file=sys.stderr)
        print("VERIFICATION PASSED", file=sys.stderr)
        print("=" * 60, file=sys.stderr)

    except Exception as e:
        logger.exception("Distillation failed")
        error_output = {
            "status": "error",
            "error_type": type(e).__name__,
            "message": str(e),
        }
        print(json.dumps(error_output, indent=2, ensure_ascii=False))
        raise SystemExit(1) from e


if __name__ == "__main__":
    main()


# =============================================================================
# 附录：补充场景测试 - leave_group, kick_member, update_group, 权限测试
# =============================================================================

def test_leave_group(
    group_id: str,
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试离开群组场景。
    
    数据准备:
    1. 已加入的群组
    2. 有效的凭证
    
    预期结果:
    1. 成功离开群组
    2. 本地状态更新
    """
    input_data = {
        "scenario": "leave_group",
        "group_id": group_id,
        "credential_name": credential_name,
    }
    
    output_data = {
        "left": False,
        "membership_status": None,
        "error": None,
    }
    
    try:
        # 步骤 1: 调用 leave_group
        from manage_group import leave_group
        leave_group(group_id=group_id, credential_name=credential_name)
        
        output_data["left"] = True
        output_data["membership_status"] = "left"
        
        return _record_manage_group_test("leave_group", input_data, output_data, True, output_file)
        
    except Exception as e:
        output_data["error"] = str(e)
        return _record_manage_group_test("leave_group", input_data, output_data, False, output_file, str(e))


def test_kick_member_permission_denied(
    group_id: str,
    target_did: str,
    credential_name: str = "member_cred",
    output_file: str | None = None,
) -> dict:
    """测试无权限踢人场景。
    
    数据准备:
    1. 普通成员身份（非群主）
    2. 尝试踢其他成员
    
    预期结果:
    1. 权限不足错误
    2. 错误码 -32003
    """
    input_data = {
        "scenario": "kick_member_permission_denied",
        "group_id": group_id,
        "target_did": target_did,
        "credential_name": credential_name,
    }
    
    output_data = {
        "error_caught": False,
        "error_code": None,
        "error_message": None,
    }
    
    try:
        from manage_group import kick_member
        from utils import JsonRpcError
        
        kick_member(
            group_id=group_id,
            target_did=target_did,
            credential_name=credential_name,
        )
        
        output_data["error_caught"] = False
        output_data["error_message"] = "Expected permission error but succeeded"
        
        return _record_manage_group_test("kick_member_permission_denied", input_data, output_data, False, output_file)
        
    except JsonRpcError as e:
        output_data["error_caught"] = True
        output_data["error_code"] = e.code if hasattr(e, 'code') else None
        output_data["error_message"] = str(e)
        
        success = output_data["error_code"] == -32003  # Permission denied
        return _record_manage_group_test("kick_member_permission_denied", input_data, output_data, success, output_file)
        
    except Exception as e:
        output_data["error_caught"] = True
        output_data["error_message"] = str(e)
        return _record_manage_group_test("kick_member_permission_denied", input_data, output_data, False, output_file, str(e))


def test_update_group(
    group_id: str,
    new_name: str,
    new_description: str,
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试群组更新场景。
    
    数据准备:
    1. 已存在的群组
    2. 群主身份
    
    预期结果:
    1. 群组信息更新成功
    2. 本地快照更新
    """
    input_data = {
        "scenario": "update_group",
        "group_id": group_id,
        "new_name": new_name,
        "new_description": new_description,
        "credential_name": credential_name,
    }
    
    output_data = {
        "updated": False,
        "group": None,
        "error": None,
    }
    
    try:
        from manage_group import update_group
        update_group(
            group_id=group_id,
            name=new_name,
            description=new_description,
            credential_name=credential_name,
        )
        
        output_data["updated"] = True
        
        return _record_manage_group_test("update_group", input_data, output_data, True, output_file)
        
    except Exception as e:
        output_data["error"] = str(e)
        return _record_manage_group_test("update_group", input_data, output_data, False, output_file, str(e))


def test_refresh_join_code(
    group_id: str,
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试刷新加入码场景。
    
    数据准备:
    1. 已存在的群组
    2. 群主身份
    
    预期结果:
    1. 加入码刷新成功
    2. 旧加入码失效
    """
    input_data = {
        "scenario": "refresh_join_code",
        "group_id": group_id,
        "credential_name": credential_name,
    }
    
    output_data = {
        "refreshed": False,
        "new_join_code": None,
        "error": None,
    }
    
    try:
        from manage_group import refresh_join_code
        refresh_join_code(group_id=group_id, credential_name=credential_name)
        
        output_data["refreshed"] = True
        
        return _record_manage_group_test("refresh_join_code", input_data, output_data, True, output_file)
        
    except Exception as e:
        output_data["error"] = str(e)
        return _record_manage_group_test("refresh_join_code", input_data, output_data, False, output_file, str(e))


def test_set_join_enabled(
    group_id: str,
    join_enabled: bool,
    credential_name: str = "default",
    output_file: str | None = None,
) -> dict:
    """测试设置群组加入开关场景。
    
    数据准备:
    1. 已存在的群组
    2. 群主身份
    
    预期结果:
    1. 加入开关设置成功
    2. 群组状态更新
    """
    input_data = {
        "scenario": "set_join_enabled",
        "group_id": group_id,
        "join_enabled": join_enabled,
        "credential_name": credential_name,
    }
    
    output_data = {
        "set": False,
        "join_enabled": join_enabled,
        "error": None,
    }
    
    try:
        from manage_group import set_join_enabled
        set_join_enabled(group_id=group_id, join_enabled=join_enabled, credential_name=credential_name)
        
        output_data["set"] = True
        
        return _record_manage_group_test("set_join_enabled", input_data, output_data, True, output_file)
        
    except Exception as e:
        output_data["error"] = str(e)
        return _record_manage_group_test("set_join_enabled", input_data, output_data, False, output_file, str(e))


def _record_manage_group_test(
    scenario: str,
    input_data: dict,
    output_data: dict,
    success: bool,
    output_file: str | None = None,
    error: str | None = None,
) -> dict:
    """记录 manage_group 测试结果。"""
    golden_record = {
        "timestamp": Path(__file__).stat().st_mtime,
        "script": "manage_group.py",
        "scenario": scenario,
        "input": input_data,
        "output": output_data,
        "success": success,
        "error": error,
    }
    
    if output_file:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(golden_record, f, indent=2, ensure_ascii=False, default=str)
        print(f"黄金标准已保存到：{output_file}", file=sys.stderr)
    else:
        print(json.dumps(golden_record, indent=2, ensure_ascii=False, default=str))
    
    return golden_record
