"""蒸馏脚本：test_check_status_group_watch.py 的黄金标准记录

用途：执行测试并记录输入输出作为黄金标准
"""

from __future__ import annotations

import asyncio
import json
import sys
import tempfile
from pathlib import Path

# 添加脚本目录到路径
_scripts_dir = Path(__file__).resolve().parent.parent.parent.parent / "python" / "scripts"
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))

import check_status
import local_store


def test_summarize_group_watch_reports_active_group_metrics() -> dict:
    """Group-watch summary should expose heartbeat-relevant local metrics."""
    # 创建临时目录
    with tempfile.TemporaryDirectory() as tmp_path:
        # 设置环境变量
        import os
        old_env = os.environ.get("AWIKI_DATA_DIR")
        os.environ["AWIKI_DATA_DIR"] = str(tmp_path)

        try:
            conn = local_store.get_connection()
            try:
                local_store.ensure_schema(conn)
                local_store.upsert_group(
                    conn,
                    owner_did="did:alice",
                    group_id="grp_1",
                    name="OpenClaw Meetup",
                    slug="openclaw-meetup",
                    my_role="member",
                    membership_status="active",
                    member_count=6,
                    group_owner_did="did:owner",
                    group_owner_handle="owner.awiki.ai",
                    last_synced_seq=12,
                    last_message_at="2026-03-10T02:00:00+00:00",
                    credential_name="alice",
                )
                local_store.replace_group_members(
                    conn,
                    owner_did="did:alice",
                    group_id="grp_1",
                    credential_name="alice",
                    members=[
                        {
                            "user_id": f"user_{index}",
                            "did": f"did:user:{index}",
                            "handle": f"user{index}.awiki.ai",
                            "profile_url": f"https://awiki.ai/profiles/user_{index}",
                            "role": "member",
                            "joined_at": f"2026-03-10T00:0{index}:00+00:00",
                            "sent_message_count": index,
                        }
                        for index in range(1, 6)
                    ],
                )
                local_store.store_message(
                    conn,
                    msg_id="owner_msg_1",
                    owner_did="did:alice",
                    thread_id=local_store.make_thread_id("did:alice", group_id="grp_1"),
                    direction=0,
                    sender_did="did:owner",
                    group_id="grp_1",
                    content_type="group_user",
                    content="Please introduce yourselves clearly.",
                    server_seq=11,
                    sent_at="2026-03-10T01:55:00+00:00",
                    sender_name="owner.awiki.ai",
                    credential_name="alice",
                )
                local_store.store_message(
                    conn,
                    msg_id="member_msg_1",
                    owner_did="did:alice",
                    thread_id=local_store.make_thread_id("did:alice", group_id="grp_1"),
                    direction=0,
                    sender_did="did:user:1",
                    group_id="grp_1",
                    content_type="group_user",
                    content="I work on agent infra.",
                    server_seq=12,
                    sent_at="2026-03-10T02:00:00+00:00",
                    sender_name="user1.awiki.ai",
                    credential_name="alice",
                )
                local_store.append_relationship_event(
                    conn,
                    owner_did="did:alice",
                    target_did="did:user:2",
                    target_handle="user2.awiki.ai",
                    event_type="ai_recommended",
                    source_type="meetup",
                    source_name="OpenClaw Meetup",
                    source_group_id="grp_1",
                    reason="Strong infra fit",
                    status="pending",
                    credential_name="alice",
                )
                local_store.upsert_contact(
                    conn,
                    owner_did="did:alice",
                    did="did:user:3",
                    handle="user3.awiki.ai",
                    source_type="meetup",
                    source_name="OpenClaw Meetup",
                    source_group_id="grp_1",
                    connected_at="2026-03-10T02:05:00+00:00",
                    recommended_reason="Already saved",
                )
            finally:
                conn.close()

            # 输入：owner_did
            input_data = {"owner_did": "did:alice"}
            
            # 执行：调用 summarize_group_watch
            summary = check_status.summarize_group_watch("did:alice")
            
            # 输出：摘要结果
            output_data = summary

            # 验证断言
            assert output_data["status"] == "ok"
            assert output_data["active_groups"] == 1
            assert output_data["groups_with_pending_recommendations"] == 1
            group = output_data["groups"][0]
            assert group["group_id"] == "grp_1"
            assert group["tracked_active_members"] == 5
            assert group["local_group_user_messages"] == 2
            assert group["local_owner_messages"] == 1
            assert group["latest_owner_message_at"] == "2026-03-10T01:55:00+00:00"
            assert group["pending_recommendations"] == 1
            assert group["saved_contacts"] == 1
            assert group["recommendation_signal_ready"] is True

            return {
                "test": "test_summarize_group_watch_reports_active_group_metrics",
                "input": input_data,
                "output": output_data,
                "status": "PASS"
            }
        finally:
            if old_env is not None:
                os.environ["AWIKI_DATA_DIR"] = old_env
            elif "AWIKI_DATA_DIR" in os.environ:
                del os.environ["AWIKI_DATA_DIR"]


def test_check_status_includes_group_watch_summary() -> dict:
    """Unified status should attach group-watch data for heartbeat callers."""
    # 保存原始函数
    original_ensure_local_upgrade_ready = check_status.ensure_local_upgrade_ready
    original_check_identity = check_status.check_identity
    original_build_inbox_report = check_status._build_inbox_report_with_auto_e2ee
    original_summarize_group_watch = check_status.summarize_group_watch
    original_load_e2ee_state = check_status.load_e2ee_state
    original_fetch_group_messages = check_status.fetch_group_messages

    try:
        # 模拟依赖
        check_status.ensure_local_upgrade_ready = lambda credential_name: {
            "status": "ready",
            "credential_ready": True,
            "database_ready": True,
            "performed": [],
            "credential_layout": {"credential_ready": True, "status": "ready"},
            "local_database": {"status": "ready"},
        }

        async def _fake_check_identity(credential_name: str) -> dict:
            del credential_name
            return {
                "status": "ok",
                "did": "did:alice",
                "name": "Alice",
                "jwt_valid": True,
            }

        async def _fake_build_inbox_report_with_auto_e2ee(credential_name: str) -> dict:
            del credential_name
            return {
                "status": "ok",
                "total": 0,
                "text_messages": 0,
                "by_type": {},
                "text_by_sender": {},
                "messages": [],
            }

        check_status.check_identity = _fake_check_identity
        check_status._build_inbox_report_with_auto_e2ee = _fake_build_inbox_report_with_auto_e2ee

        check_status.summarize_group_watch = (
            lambda owner_did: {
                "status": "ok",
                "active_groups": 1,
                "groups_with_pending_recommendations": 0,
                "groups": [{"group_id": "grp_1", "name": "OpenClaw Meetup"}],
            }
            if owner_did == "did:alice"
            else {"status": "no_identity", "active_groups": 0, "groups": []}
        )

        check_status.load_e2ee_state = lambda credential_name: None

        async def _fake_fetch_group_messages(group_watch, *, owner_did, credential_name):
            return {"fetched_groups": 0, "total_new_messages": 0, "errors": []}

        check_status.fetch_group_messages = _fake_fetch_group_messages

        # 输入：credential_name
        input_data = {"credential_name": "alice"}

        # 执行：调用 check_status
        report = asyncio.run(check_status.check_status("alice"))

        # 输出：状态报告
        output_data = {
            "group_watch": report["group_watch"]
        }

        # 验证断言
        assert output_data["group_watch"]["status"] == "ok"
        assert output_data["group_watch"]["active_groups"] == 1
        assert output_data["group_watch"]["groups"][0]["group_id"] == "grp_1"

        return {
            "test": "test_check_status_includes_group_watch_summary",
            "input": input_data,
            "output": output_data,
            "status": "PASS"
        }
    finally:
        # 恢复原始函数
        check_status.ensure_local_upgrade_ready = original_ensure_local_upgrade_ready
        check_status.check_identity = original_check_identity
        check_status._build_inbox_report_with_auto_e2ee = original_build_inbox_report
        check_status.summarize_group_watch = original_summarize_group_watch
        check_status.load_e2ee_state = original_load_e2ee_state
        check_status.fetch_group_messages = original_fetch_group_messages


def main():
    """执行所有测试并输出黄金标准记录。"""
    print("=" * 60)
    print("蒸馏脚本：test_check_status_group_watch.py")
    print("=" * 60)
    print()

    results = []

    # 测试 1
    print("运行测试 1: test_summarize_group_watch_reports_active_group_metrics")
    try:
        result = test_summarize_group_watch_reports_active_group_metrics()
        results.append(result)
        print(f"  状态：{result['status']}")
    except Exception as e:
        results.append({
            "test": "test_summarize_group_watch_reports_active_group_metrics",
            "status": "FAIL",
            "error": str(e)
        })
        print(f"  状态：FAIL - {e}")
    print()

    # 测试 2
    print("运行测试 2: test_check_status_includes_group_watch_summary")
    try:
        result = test_check_status_includes_group_watch_summary()
        results.append(result)
        print(f"  状态：{result['status']}")
    except Exception as e:
        results.append({
            "test": "test_check_status_includes_group_watch_summary",
            "status": "FAIL",
            "error": str(e)
        })
        print(f"  状态：FAIL - {e}")
    print()

    # 输出黄金标准记录
    print("=" * 60)
    print("黄金标准记录")
    print("=" * 60)
    for result in results:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        print()

    # 总结
    passed = sum(1 for r in results if r["status"] == "PASS")
    total = len(results)
    print("=" * 60)
    print(f"总结：{passed}/{total} 测试通过")
    print("=" * 60)

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
