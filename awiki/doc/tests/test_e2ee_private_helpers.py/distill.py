#!/usr/bin/env python3
"""蒸馏脚本：执行 test_e2ee_private_helpers.py 并记录黄金标准输出。

此脚本执行所有测试并记录输入输出作为"黄金标准"。
"""

from __future__ import annotations

import sys
from pathlib import Path

# 添加 scripts 目录到路径
# distill.py 位于 doc/tests/test_e2ee_private_helpers.py/distill.py
# 需要添加 python/scripts 到路径
_project_root = Path(__file__).resolve().parent.parent.parent.parent
_scripts_dir = _project_root / "python" / "scripts"
sys.path.insert(0, str(_scripts_dir))

import e2ee_messaging
import e2ee_handler
import check_inbox
import check_status
import send_message as send_message_script
from utils import e2ee as e2ee_utils


def log_result(test_name: str, passed: bool, details: str = "") -> None:
    """记录测试结果。"""
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"[{status}] {test_name}")
    if details:
        print(f"       {details}")


def main() -> int:
    """执行所有测试并返回失败数量。"""
    print("=" * 60)
    print("test_e2ee_private_helpers.py 蒸馏脚本")
    print("=" * 60)
    print()

    failures = 0

    # ==================== TestDecryptErrorClassification ====================
    print("--- TestDecryptErrorClassification ---")

    # test_handler_classifies_session_not_found
    result = e2ee_handler.E2eeHandler._classify_error(
        RuntimeError("Cannot find session for session_id=abc")
    )
    passed = result == ("session_not_found", "rekey_then_resend")
    log_result("test_handler_classifies_session_not_found", passed, f"result={result}")
    failures += not passed

    # test_cli_classifies_invalid_seq
    result = e2ee_messaging._classify_decrypt_error(
        RuntimeError("Invalid seq: 8")
    )
    passed = result == ("invalid_seq", "rekey_then_resend")
    log_result("test_cli_classifies_invalid_seq", passed, f"result={result}")
    failures += not passed

    # test_cli_classifies_generic_failure
    result = e2ee_messaging._classify_decrypt_error(
        RuntimeError("ciphertext authentication failed")
    )
    passed = result == ("decryption_failed", "resend")
    log_result("test_cli_classifies_generic_failure", passed, f"result={result}")
    failures += not passed

    # test_cli_classifies_unsupported_version
    result = e2ee_messaging._classify_decrypt_error(
        RuntimeError("unsupported_version: missing e2ee_version (required 1.1)")
    )
    passed = result == ("unsupported_version", "drop")
    log_result("test_cli_classifies_unsupported_version", passed, f"result={result}")
    failures += not passed

    # ==================== TestProtocolErrorClassification ====================
    print()
    print("--- TestProtocolErrorClassification ---")

    # test_protocol_classifies_proof_expired
    result = e2ee_utils._classify_protocol_error(
        ValueError("e2ee_init proof verification failed: proof_expired")
    )
    passed = result == ("proof_expired", "resend")
    log_result("test_protocol_classifies_proof_expired", passed, f"result={result}")
    failures += not passed

    # test_protocol_classifies_proof_from_future
    result = e2ee_utils._classify_protocol_error(
        ValueError("e2ee_init proof verification failed: proof_from_future")
    )
    passed = result == ("proof_from_future", "drop")
    log_result("test_protocol_classifies_proof_from_future", passed, f"result={result}")
    failures += not passed

    # test_protocol_classifies_unsupported_version
    result = e2ee_utils._classify_protocol_error(
        ValueError("unsupported_version: missing e2ee_version (required 1.1)")
    )
    passed = result == ("unsupported_version", "drop")
    log_result("test_protocol_classifies_unsupported_version", passed, f"result={result}")
    failures += not passed

    # ==================== TestErrorMessageText ====================
    print()
    print("--- TestErrorMessageText ---")

    # test_upgrade_message_is_consistent
    message = e2ee_utils.build_e2ee_error_message(
        "unsupported_version",
        required_e2ee_version="1.1",
    )
    passed = "upgrade" in message.lower() and "1.1" in message
    log_result("test_upgrade_message_is_consistent", passed, f"message={message}")
    failures += not passed

    # ==================== TestInboxSortKey ====================
    print()
    print("--- TestInboxSortKey ---")

    # test_message_sort_key_prefers_server_seq
    messages = [
        {
            "sender_did": "did:a",
            "server_seq": 9,
            "created_at": "2026-03-07T12:31:00Z",
            "type": "e2ee_msg",
        },
        {
            "sender_did": "did:a",
            "server_seq": 8,
            "created_at": "2026-03-07T12:32:00Z",
            "type": "e2ee_init",
        },
    ]
    messages.sort(key=e2ee_messaging._message_sort_key)
    passed = messages[0]["server_seq"] == 8 and messages[1]["server_seq"] == 9
    log_result("test_message_sort_key_prefers_server_seq", passed,
               f"sorted_seqs={[m['server_seq'] for m in messages]}")
    failures += not passed

    # test_check_inbox_sort_key_tolerates_missing_timestamps
    messages = [
        {
            "sender_did": "did:a",
            "server_seq": None,
            "sent_at": None,
            "created_at": None,
            "type": "e2ee_msg",
        },
        {
            "sender_did": "did:a",
            "server_seq": None,
            "sent_at": "2026-03-07T12:31:00Z",
            "created_at": None,
            "type": "e2ee_init",
        },
    ]
    messages.sort(key=check_inbox._message_sort_key)
    passed = messages[0]["sent_at"] is None and messages[1]["sent_at"] == "2026-03-07T12:31:00Z"
    log_result("test_check_inbox_sort_key_tolerates_missing_timestamps", passed,
               f"sorted_sent_at={[m['sent_at'] for m in messages]}")
    failures += not passed

    # test_check_status_sort_key_tolerates_missing_timestamps
    messages = [
        {
            "sender_did": "did:a",
            "server_seq": None,
            "sent_at": None,
            "created_at": None,
            "type": "e2ee_msg",
        },
        {
            "sender_did": "did:a",
            "server_seq": None,
            "sent_at": None,
            "created_at": "2026-03-07T12:31:00Z",
            "type": "e2ee_init",
        },
    ]
    messages.sort(key=check_status._message_sort_key)
    passed = messages[0]["created_at"] is None and messages[1]["created_at"] == "2026-03-07T12:31:00Z"
    log_result("test_check_status_sort_key_tolerates_missing_timestamps", passed,
               f"sorted_created_at={[m['created_at'] for m in messages]}")
    failures += not passed

    # test_e2ee_messaging_sort_key_tolerates_missing_timestamps
    messages = [
        {
            "sender_did": "did:a",
            "server_seq": None,
            "sent_at": None,
            "created_at": None,
            "type": "e2ee_msg",
        },
        {
            "sender_did": "did:a",
            "server_seq": None,
            "sent_at": None,
            "created_at": "2026-03-07T12:31:00Z",
            "type": "e2ee_init",
        },
    ]
    messages.sort(key=e2ee_messaging._message_sort_key)
    passed = messages[0]["created_at"] is None and messages[1]["created_at"] == "2026-03-07T12:31:00Z"
    log_result("test_e2ee_messaging_sort_key_tolerates_missing_timestamps", passed,
               f"sorted_created_at={[m['created_at'] for m in messages]}")
    failures += not passed

    # test_check_inbox_sort_key_tolerates_missing_sender_did
    messages = [
        {
            "sender_did": None,
            "server_seq": None,
            "sent_at": "2026-03-10T12:00:00Z",
            "created_at": "2026-03-10T12:00:00Z",
            "type": "group_system_member_joined",
        },
        {
            "sender_did": "did:a",
            "server_seq": None,
            "sent_at": "2026-03-10T12:01:00Z",
            "created_at": "2026-03-10T12:01:00Z",
            "type": "e2ee_msg",
        },
    ]
    messages.sort(key=check_inbox._message_sort_key)
    passed = messages[0]["sender_did"] is None and messages[1]["sender_did"] == "did:a"
    log_result("test_check_inbox_sort_key_tolerates_missing_sender_did", passed,
               f"sorted_sender_dids={[m['sender_did'] for m in messages]}")
    failures += not passed

    # test_check_status_sort_key_tolerates_missing_sender_did
    messages = [
        {
            "sender_did": None,
            "server_seq": None,
            "sent_at": "2026-03-10T12:00:00Z",
            "created_at": "2026-03-10T12:00:00Z",
            "type": "group_system_member_joined",
        },
        {
            "sender_did": "did:a",
            "server_seq": None,
            "sent_at": "2026-03-10T12:01:00Z",
            "created_at": "2026-03-10T12:01:00Z",
            "type": "e2ee_msg",
        },
    ]
    messages.sort(key=check_status._message_sort_key)
    passed = messages[0]["sender_did"] is None and messages[1]["sender_did"] == "did:a"
    log_result("test_check_status_sort_key_tolerates_missing_sender_did", passed,
               f"sorted_sender_dids={[m['sender_did'] for m in messages]}")
    failures += not passed

    # test_e2ee_messaging_sort_key_tolerates_missing_sender_did
    messages = [
        {
            "sender_did": None,
            "server_seq": None,
            "sent_at": "2026-03-10T12:00:00Z",
            "created_at": "2026-03-10T12:00:00Z",
            "type": "group_system_member_joined",
        },
        {
            "sender_did": "did:a",
            "server_seq": None,
            "sent_at": "2026-03-10T12:01:00Z",
            "created_at": "2026-03-10T12:01:00Z",
            "type": "e2ee_msg",
        },
    ]
    messages.sort(key=e2ee_messaging._message_sort_key)
    passed = messages[0]["sender_did"] is None and messages[1]["sender_did"] == "did:a"
    log_result("test_e2ee_messaging_sort_key_tolerates_missing_sender_did", passed,
               f"sorted_sender_dids={[m['sender_did'] for m in messages]}")
    failures += not passed

    # test_e2ee_messaging_sender_did_value_uses_placeholder_for_none
    passed = (
        e2ee_messaging._sender_did_value({"sender_did": None}) == "?" and
        e2ee_messaging._sender_did_value({"sender_did": "did:a"}) == "did:a"
    )
    log_result("test_e2ee_messaging_sender_did_value_uses_placeholder_for_none", passed,
               f"None->'{e2ee_messaging._sender_did_value({'sender_did': None})}', did:a->'{e2ee_messaging._sender_did_value({'sender_did': 'did:a'})}'")
    failures += not passed

    # ==================== TestOutgoingHistoryRender ====================
    print()
    print("--- TestOutgoingHistoryRender ---")

    # test_render_outgoing_message_without_local_copy_returns_none
    rendered = check_inbox._render_local_outgoing_e2ee_message(
        "default",
        {"id": "missing"},
    )
    passed = rendered is None
    log_result("test_render_outgoing_message_without_local_copy_returns_none", passed,
               f"rendered={rendered}")
    failures += not passed

    # ==================== TestUserVisibleE2EEPresentation ====================
    print()
    print("--- TestUserVisibleE2EEPresentation ---")

    # test_check_inbox_decorates_decrypted_message_with_minimal_notice
    rendered = check_inbox._decorate_user_visible_e2ee_message(
        {"id": "m1", "type": "e2ee_msg", "content": "ciphertext"},
        original_type="text",
        plaintext="hello",
    )
    passed = (
        rendered["type"] == "text" and
        rendered["content"] == "hello" and
        rendered["_e2ee"] is True and
        rendered["_e2ee_notice"] == "This is an encrypted message."
    )
    log_result("test_check_inbox_decorates_decrypted_message_with_minimal_notice", passed,
               f"rendered={rendered}")
    failures += not passed

    # test_cli_renders_minimal_encrypted_message_text
    rendered = e2ee_messaging._render_user_visible_e2ee_text("secret")
    passed = "encrypted message" in rendered.lower() and rendered.endswith("secret")
    log_result("test_cli_renders_minimal_encrypted_message_text", passed,
               f"rendered='{rendered}'")
    failures += not passed

    # test_cli_renders_send_first_auto_init_notice
    rendered = e2ee_messaging._render_auto_session_notice("did:wba:example:user:bob")
    passed = "automatic init" in rendered.lower() and "did:wba:example:user:bob" in rendered
    log_result("test_cli_renders_send_first_auto_init_notice", passed,
               f"rendered='{rendered}'")
    failures += not passed

    # test_check_status_hides_protocol_only_message_types
    passed = (
        check_status._is_user_visible_message_type("text") is True and
        check_status._is_user_visible_message_type("e2ee_init") is False and
        check_status._is_user_visible_message_type("e2ee_msg") is False
    )
    log_result("test_check_status_hides_protocol_only_message_types", passed,
               f"text={check_status._is_user_visible_message_type('text')}, e2ee_init={check_status._is_user_visible_message_type('e2ee_init')}, e2ee_msg={check_status._is_user_visible_message_type('e2ee_msg')}")
    failures += not passed

    # test_check_inbox_strips_hidden_title_field
    rendered = check_inbox._strip_hidden_user_fields(
        {"id": "m1", "content": "hello", "title": "secret-title"}
    )
    passed = "title" not in rendered
    log_result("test_check_inbox_strips_hidden_title_field", passed,
               f"rendered={rendered}")
    failures += not passed

    # test_send_message_result_strips_hidden_title_field
    rendered = send_message_script._strip_hidden_result_fields(
        {"id": "m1", "title": "hidden", "content": "hello"}
    )
    passed = "title" not in rendered
    log_result("test_send_message_result_strips_hidden_title_field", passed,
               f"rendered={rendered}")
    failures += not passed

    # ==================== 总结 ====================
    print()
    print("=" * 60)
    if failures == 0:
        print("全部测试通过！✓")
    else:
        print(f"失败：{failures} 个测试")
    print("=" * 60)

    return failures


if __name__ == "__main__":
    sys.exit(main())
