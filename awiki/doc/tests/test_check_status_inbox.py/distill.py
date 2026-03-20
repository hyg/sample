"""蒸馏脚本：执行 test_check_status_inbox.py 并记录黄金标准输出。

此脚本执行测试函数，记录输入（模拟数据）和输出（结果）作为黄金标准。
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any

# 添加 scripts 目录到路径以导入 check_status
_scripts_dir = Path(__file__).resolve().parent.parent.parent.parent / "python" / "scripts"
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))

import check_status


class _DummyAsyncClient:
    """Minimal async context manager used by mocked RPC calls."""

    async def __aenter__(self) -> "_DummyAsyncClient":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        del exc_type, exc, tb


class _FakeE2eeClient:
    """Small E2EE client stub for inbox processing tests."""

    def __init__(self) -> None:
        self.process_calls: list[tuple[str, dict[str, Any]]] = []
        self.decrypt_calls: list[dict[str, Any]] = []

    async def process_e2ee_message(
        self,
        msg_type: str,
        content: dict[str, Any],
    ) -> list[tuple[str, dict[str, Any]]]:
        self.process_calls.append((msg_type, content))
        return [("e2ee_ack", {"session_id": content.get("session_id")})]

    def has_session_id(self, session_id: str | None) -> bool:
        return session_id == "sess-1"

    def decrypt_message(self, content: dict[str, Any]) -> tuple[str, str]:
        self.decrypt_calls.append(content)
        return "text", "Secret hello"

    def export_state(self) -> dict[str, Any]:
        return {"sessions": [{"session_id": "sess-1"}]}


def test_summarize_inbox_hides_protocol_messages_from_user_output() -> dict[str, Any]:
    """Summary mode should keep protocol messages hidden from user output."""
    
    # 输入：模拟的 RPC 返回数据
    inbox_messages = [
        {
            "id": "init-1",
            "type": "e2ee_init",
            "sender_did": "did:bob",
            "content": json.dumps({"session_id": "sess-1"}),
            "created_at": "2026-03-11T09:00:00Z",
        },
        {
            "id": "plain-1",
            "type": "text",
            "sender_did": "did:carol",
            "content": "Hello",
            "created_at": "2026-03-11T09:05:00Z",
        },
    ]
    
    async def _fake_authenticated_rpc_call(
        client,
        endpoint: str,
        method: str,
        params: dict[str, Any],
        *,
        auth: Any,
        credential_name: str,
    ) -> dict[str, Any]:
        del client, endpoint, params, auth, credential_name
        assert method == "get_inbox"
        return {"messages": inbox_messages}

    # 应用模拟
    original_create_auth = check_status.create_authenticator
    original_create_molt = check_status.create_molt_message_client
    original_rpc_call = check_status.authenticated_rpc_call
    
    check_status.create_authenticator = lambda credential_name, config: (object(), {"did": "did:alice"})
    check_status.create_molt_message_client = lambda config: _DummyAsyncClient()
    check_status.authenticated_rpc_call = _fake_authenticated_rpc_call
    
    try:
        # 执行测试
        report = asyncio.run(check_status.summarize_inbox("alice"))
        
        # 输出：验证结果
        result = {
            "test_name": "test_summarize_inbox_hides_protocol_messages_from_user_output",
            "input": {
                "inbox_messages": inbox_messages,
                "credential_name": "alice",
            },
            "output": {
                "status": report["status"],
                "total": report["total"],
                "messages": report["messages"],
            },
            "assertions": {
                "status_ok": report["status"] == "ok",
                "total_count": report["total"] == 1,
                "only_plain_messages": report["messages"] == [
                    {
                        "id": "plain-1",
                        "type": "text",
                        "sender_did": "did:carol",
                        "content": "Hello",
                        "created_at": "2026-03-11T09:05:00Z",
                    }
                ],
            },
            "passed": (
                report["status"] == "ok" and
                report["total"] == 1 and
                report["messages"] == [
                    {
                        "id": "plain-1",
                        "type": "text",
                        "sender_did": "did:carol",
                        "content": "Hello",
                        "created_at": "2026-03-11T09:05:00Z",
                    }
                ]
            ),
        }
        return result
    finally:
        # 恢复原始函数
        check_status.create_authenticator = original_create_auth
        check_status.create_molt_message_client = original_create_molt
        check_status.authenticated_rpc_call = original_rpc_call


def test_check_identity_bootstraps_missing_jwt_via_did_auth() -> dict[str, Any]:
    """Identity status should stay OK when a missing JWT is re-issued automatically."""
    
    # 输入：初始凭证数据（JWT 为 None）
    credential_data = {
        "did": "did:alice",
        "name": "Alice",
        "jwt_token": None,
    }
    
    async def _fake_authenticated_rpc_call(
        client,
        endpoint: str,
        method: str,
        params: dict[str, Any] | None = None,
        request_id: int | str = 1,
        *,
        auth: Any,
        credential_name: str,
    ) -> dict[str, Any]:
        del client, endpoint, method, params, request_id, auth, credential_name
        credential_data["jwt_token"] = "jwt-new"
        return {"did": "did:alice", "name": "Alice"}

    # 应用模拟
    original_load_identity = check_status.load_identity
    original_create_auth = check_status.create_authenticator
    original_create_user = check_status.create_user_service_client
    original_rpc_call = check_status.authenticated_rpc_call
    
    check_status.load_identity = lambda credential_name: dict(credential_data)
    check_status.create_authenticator = lambda credential_name, config: (object(), dict(credential_data))
    check_status.create_user_service_client = lambda config: _DummyAsyncClient()
    check_status.authenticated_rpc_call = _fake_authenticated_rpc_call
    
    try:
        # 执行测试
        result_data = asyncio.run(check_status.check_identity("alice"))
        
        # 输出：验证结果
        result = {
            "test_name": "test_check_identity_bootstraps_missing_jwt_via_did_auth",
            "input": {
                "initial_credential_data": dict(credential_data),
                "credential_name": "alice",
            },
            "output": {
                "status": result_data["status"],
                "jwt_valid": result_data["jwt_valid"],
                "jwt_refreshed": result_data.get("jwt_refreshed", False),
                "final_jwt_token": credential_data["jwt_token"],
            },
            "assertions": {
                "status_ok": result_data["status"] == "ok",
                "jwt_valid": result_data["jwt_valid"] is True,
                "jwt_refreshed": result_data.get("jwt_refreshed", False) is True,
                "jwt_updated": credential_data["jwt_token"] == "jwt-new",
            },
            "passed": (
                result_data["status"] == "ok" and
                result_data["jwt_valid"] is True and
                result_data.get("jwt_refreshed", False) is True and
                credential_data["jwt_token"] == "jwt-new"
            ),
        }
        return result
    finally:
        # 恢复原始函数
        check_status.load_identity = original_load_identity
        check_status.create_authenticator = original_create_auth
        check_status.create_user_service_client = original_create_user
        check_status.authenticated_rpc_call = original_rpc_call


def test_auto_e2ee_builds_plaintext_inbox_report() -> dict[str, Any]:
    """Auto-E2EE mode should surface decrypted plaintext and mark handled items read."""
    
    # 输入：模拟的 E2EE 客户端和 RPC 调用
    fake_client = _FakeE2eeClient()
    sent_calls: list[tuple[str, dict[str, Any]]] = []
    marked_read: list[str] = []
    
    inbox_messages = [
        {
            "id": "init-1",
            "type": "e2ee_init",
            "sender_did": "did:bob",
            "content": json.dumps({"session_id": "sess-1", "sender_did": "did:bob"}),
            "created_at": "2026-03-11T09:00:00Z",
        },
        {
            "id": "cipher-1",
            "type": "e2ee_msg",
            "sender_did": "did:bob",
            "content": json.dumps({"session_id": "sess-1"}),
            "created_at": "2026-03-11T09:02:00Z",
        },
        {
            "id": "plain-1",
            "type": "text",
            "sender_did": "did:carol",
            "content": "Hello",
            "created_at": "2026-03-11T09:01:00Z",
        },
    ]

    async def _fake_authenticated_rpc_call(
        client,
        endpoint: str,
        method: str,
        params: dict[str, Any],
        *,
        auth: Any,
        credential_name: str,
    ) -> dict[str, Any]:
        del client, endpoint, auth, credential_name
        if method == "get_inbox":
            return {"messages": inbox_messages}
        if method == "send":
            sent_calls.append((params["type"], json.loads(params["content"])))
            return {"id": "resp-1"}
        if method == "mark_read":
            marked_read.extend(params["message_ids"])
            return {"ok": True}
        raise AssertionError(f"Unexpected RPC method: {method}")

    # 应用模拟
    original_create_auth = check_status.create_authenticator
    original_create_molt = check_status.create_molt_message_client
    original_rpc_call = check_status.authenticated_rpc_call
    original_load_e2ee = check_status._load_or_create_e2ee_client
    original_save_e2ee = check_status._save_e2ee_client
    
    check_status.create_authenticator = lambda credential_name, config: (object(), {"did": "did:alice"})
    check_status.create_molt_message_client = lambda config: _DummyAsyncClient()
    check_status.authenticated_rpc_call = _fake_authenticated_rpc_call
    check_status._load_or_create_e2ee_client = lambda local_did, credential_name: fake_client
    check_status._save_e2ee_client = lambda client, credential_name: None
    
    try:
        # 执行测试
        inbox_report = asyncio.run(check_status._build_inbox_report_with_auto_e2ee("alice"))
        
        # 输出：验证结果
        result = {
            "test_name": "test_auto_e2ee_builds_plaintext_inbox_report",
            "input": {
                "inbox_messages": inbox_messages,
                "credential_name": "alice",
                "e2ee_session_id": "sess-1",
            },
            "output": {
                "status": inbox_report["status"],
                "total": inbox_report["total"],
                "by_type": inbox_report["by_type"],
                "text_messages": inbox_report["text_messages"],
                "messages": inbox_report["messages"],
                "marked_read": marked_read,
                "sent_calls": sent_calls,
            },
            "assertions": {
                "status_ok": inbox_report["status"] == "ok",
                "total_count": inbox_report["total"] == 2,
                "by_type_correct": inbox_report["by_type"] == {"text": 2},
                "text_count": inbox_report["text_messages"] == 2,
                "first_message_decrypted": inbox_report["messages"][0]["content"] == "Secret hello",
                "first_message_is_e2ee": inbox_report["messages"][0]["is_e2ee"] is True,
                "first_message_has_notice": inbox_report["messages"][0]["e2ee_notice"] == "This is an encrypted message.",
                "second_message_plain": inbox_report["messages"][1]["content"] == "Hello",
                "marked_read_correct": marked_read == ["init-1", "cipher-1"],
                "sent_e2ee_ack": sent_calls == [("e2ee_ack", {"session_id": "sess-1"})],
            },
            "passed": (
                inbox_report["status"] == "ok" and
                inbox_report["total"] == 2 and
                inbox_report["by_type"] == {"text": 2} and
                inbox_report["text_messages"] == 2 and
                inbox_report["messages"][0]["content"] == "Secret hello" and
                inbox_report["messages"][0]["is_e2ee"] is True and
                inbox_report["messages"][0]["e2ee_notice"] == "This is an encrypted message." and
                inbox_report["messages"][1]["content"] == "Hello" and
                marked_read == ["init-1", "cipher-1"] and
                sent_calls == [("e2ee_ack", {"session_id": "sess-1"})]
            ),
        }
        return result
    finally:
        # 恢复原始函数
        check_status.create_authenticator = original_create_auth
        check_status.create_molt_message_client = original_create_molt
        check_status.authenticated_rpc_call = original_rpc_call
        check_status._load_or_create_e2ee_client = original_load_e2ee
        check_status._save_e2ee_client = original_save_e2ee


def test_check_status_uses_auto_e2ee_inbox_report() -> dict[str, Any]:
    """Unified status should attach auto-decrypted inbox content."""
    
    # 输入：模拟的各组件返回值
    upgrade_status = {
        "status": "ready",
        "credential_ready": True,
        "database_ready": True,
        "performed": [],
        "credential_layout": {"credential_ready": True, "status": "ready"},
        "local_database": {"status": "ready"},
    }
    
    identity_result = {
        "status": "ok",
        "did": "did:alice",
        "name": "Alice",
        "jwt_valid": True,
    }
    
    inbox_result = {
        "status": "ok",
        "total": 1,
        "by_type": {"text": 1},
        "text_messages": 1,
        "text_by_sender": {"did:bob": {"count": 1, "latest": "2026-03-11T09:00:00Z"}},
        "messages": [{"id": "cipher-1", "content": "Secret hello", "is_e2ee": True}],
    }
    
    group_watch_result = {"status": "ok", "active_groups": 0, "groups": []}

    # 应用模拟
    original_ensure_upgrade = check_status.ensure_local_upgrade_ready
    original_check_identity = check_status.check_identity
    original_group_watch = check_status.summarize_group_watch
    original_build_inbox = check_status._build_inbox_report_with_auto_e2ee
    original_load_e2ee = check_status.load_e2ee_state
    
    check_status.ensure_local_upgrade_ready = lambda credential_name: upgrade_status
    
    async def fake_check_identity(credential_name: str) -> dict[str, Any]:
        del credential_name
        return identity_result
    
    check_status.check_identity = fake_check_identity
    check_status.summarize_group_watch = lambda owner_did: group_watch_result
    
    async def fake_build_inbox(credential_name: str) -> dict[str, Any]:
        assert credential_name == "alice"
        return inbox_result
    
    check_status._build_inbox_report_with_auto_e2ee = fake_build_inbox
    check_status.load_e2ee_state = lambda credential_name: None
    
    try:
        # 执行测试
        report = asyncio.run(check_status.check_status("alice"))
        
        # 输出：验证结果
        result = {
            "test_name": "test_check_status_uses_auto_e2ee_inbox_report",
            "input": {
                "upgrade_status": upgrade_status,
                "identity_result": identity_result,
                "inbox_result": inbox_result,
                "group_watch_result": group_watch_result,
                "credential_name": "alice",
            },
            "output": {
                "inbox_messages": report["inbox"]["messages"],
                "has_e2ee_auto": "e2ee_auto" in report,
            },
            "assertions": {
                "first_message_content": report["inbox"]["messages"][0]["content"] == "Secret hello",
                "first_message_is_e2ee": report["inbox"]["messages"][0]["is_e2ee"] is True,
                "no_e2ee_auto_key": "e2ee_auto" not in report,
            },
            "passed": (
                report["inbox"]["messages"][0]["content"] == "Secret hello" and
                report["inbox"]["messages"][0]["is_e2ee"] is True and
                "e2ee_auto" not in report
            ),
        }
        return result
    finally:
        # 恢复原始函数
        check_status.ensure_local_upgrade_ready = original_ensure_upgrade
        check_status.check_identity = original_check_identity
        check_status.summarize_group_watch = original_group_watch
        check_status._build_inbox_report_with_auto_e2ee = original_build_inbox
        check_status.load_e2ee_state = original_load_e2ee


def main():
    """执行所有测试并输出黄金标准报告。"""
    print("=" * 80)
    print("蒸馏脚本：test_check_status_inbox.py 黄金标准输出")
    print("=" * 80)
    print()
    
    tests = [
        test_summarize_inbox_hides_protocol_messages_from_user_output,
        test_check_identity_bootstraps_missing_jwt_via_did_auth,
        test_auto_e2ee_builds_plaintext_inbox_report,
        test_check_status_uses_auto_e2ee_inbox_report,
    ]
    
    results = []
    passed_count = 0
    failed_count = 0
    
    for test_func in tests:
        print(f"执行测试：{test_func.__name__}")
        print("-" * 60)
        
        try:
            result = test_func()
            results.append(result)
            
            if result["passed"]:
                print(f"  ✓ PASSED")
                passed_count += 1
            else:
                print(f"  ✗ FAILED")
                failed_count += 1
                print(f"  断言失败：")
                for assertion_name, assertion_value in result["assertions"].items():
                    if not assertion_value:
                        print(f"    - {assertion_name}: {assertion_value}")
            
            print(f"  输出摘要：")
            print(f"    {json.dumps(result['output'], indent=2, ensure_ascii=False)[:500]}...")
            
        except Exception as e:
            print(f"  ✗ ERROR: {e}")
            failed_count += 1
            results.append({
                "test_name": test_func.__name__,
                "error": str(e),
                "passed": False,
            })
        
        print()
    
    # 输出总结
    print("=" * 80)
    print("总结")
    print("=" * 80)
    print(f"总测试数：{len(tests)}")
    print(f"通过：{passed_count}")
    print(f"失败：{failed_count}")
    print()
    
    # 输出完整的黄金标准数据（JSON 格式）
    print("黄金标准数据（JSON）：")
    print("-" * 60)
    print(json.dumps({
        "summary": {
            "total": len(tests),
            "passed": passed_count,
            "failed": failed_count,
        },
        "results": results,
    }, indent=2, ensure_ascii=False))
    
    return 0 if failed_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
