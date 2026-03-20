#!/usr/bin/env python
"""蒸馏脚本：执行 test_manage_group_cli.py 并记录输入输出作为"黄金标准"。

[INPUT]: test_manage_group_cli.py 测试代码
[OUTPUT]: 测试执行结果和断言验证
[POS]: Discovery-group CLI 单元测试黄金标准
"""

from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from pathlib import Path
from contextlib import contextmanager
from io import StringIO

# 添加脚本路径 - 与原始测试文件一致
_scripts_dir = Path(__file__).resolve().parent.parent.parent.parent / "python" / "scripts"
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))

import manage_group as manage_group_cli
import local_store
from utils.rpc import JsonRpcError


@contextmanager
def capture_argv(new_argv):
    """临时替换 sys.argv。"""
    old_argv = sys.argv
    try:
        sys.argv = new_argv
        yield
    finally:
        sys.argv = old_argv


@contextmanager
def capture_stdout():
    """捕获标准输出。"""
    old_stdout = sys.stdout
    sys.stdout = StringIO()
    try:
        yield sys.stdout
    finally:
        sys.stdout = old_stdout


@contextmanager
def capture_stderr():
    """捕获标准错误。"""
    old_stderr = sys.stderr
    sys.stderr = StringIO()
    try:
        yield sys.stderr
    finally:
        sys.stderr = old_stderr


@contextmanager
def temp_data_dir():
    """临时数据目录。"""
    with tempfile.TemporaryDirectory() as tmp_dir:
        old_env = None
        if "AWIKI_DATA_DIR" in os.environ:
            old_env = os.environ.get("AWIKI_DATA_DIR")
        os.environ["AWIKI_DATA_DIR"] = tmp_dir
        try:
            yield tmp_dir
        finally:
            if old_env is not None:
                os.environ["AWIKI_DATA_DIR"] = old_env
            else:
                os.environ.pop("AWIKI_DATA_DIR", None)


def run_test(test_name, test_func):
    """运行测试并记录结果。"""
    print(f"\n{'='*60}")
    print(f"测试：{test_name}")
    print('='*60)
    try:
        test_func()
        print(f"✓ 通过：{test_name}")
        return True
    except AssertionError as e:
        print(f"✗ 失败：{test_name}")
        print(f"  断言错误：{e}")
        return False
    except Exception as e:
        print(f"✗ 异常：{test_name}")
        print(f"  错误：{type(e).__name__}: {e}")
        return False


# ==================== 测试用例 ====================

def test_join_rejects_group_id_with_guidance():
    """测试 join 拒绝带指导的 group_id。"""
    from _pytest.monkeypatch import MonkeyPatch
    
    monkeypatch = MonkeyPatch()
    monkeypatch.setattr(manage_group_cli, "configure_logging", lambda **kwargs: None)
    monkeypatch.setattr(
        sys, "argv",
        ["manage_group.py", "--join", "--group-id", "grp_1", "--join-code", "314159"]
    )
    
    captured_err = StringIO()
    old_stderr = sys.stderr
    sys.stderr = captured_err
    
    try:
        manage_group_cli.main()
        sys.stderr = old_stderr
        raise AssertionError("预期 SystemExit 异常")
    except SystemExit:
        sys.stderr = old_stderr
        err_output = captured_err.getvalue()
        assert "can only be joined with the global 6-digit join-code" in err_output, \
            f"错误消息不包含预期文本：{err_output}"
    finally:
        monkeypatch.undo()
        sys.stderr = old_stderr


def test_create_dispatches_with_group_name_alias():
    """测试 create 带 group_name 别名分派。"""
    from _pytest.monkeypatch import MonkeyPatch
    
    monkeypatch = MonkeyPatch()
    captured = {}
    
    async def _fake_create_group(**kwargs):
        captured.update(kwargs)
    
    monkeypatch.setattr(manage_group_cli, "configure_logging", lambda **kwargs: None)
    monkeypatch.setattr(manage_group_cli, "create_group", _fake_create_group)
    monkeypatch.setattr(
        sys, "argv",
        [
            "manage_group.py", "--create",
            "--group-name", "OpenClaw Meetup",
            "--slug", "openclaw-meetup",
            "--description", "desc",
            "--goal", "goal",
            "--rules", "rules",
            "--message-prompt", "prompt",
        ]
    )
    
    try:
        manage_group_cli.main()
        
        assert captured == {
            "name": "OpenClaw Meetup",
            "slug": "openclaw-meetup",
            "description": "desc",
            "goal": "goal",
            "rules": "rules",
            "message_prompt": "prompt",
            "join_enabled": True,
            "credential_name": "default",
        }, f"捕获的参数不匹配：{captured}"
    finally:
        monkeypatch.undo()


def test_join_dispatches_with_join_code_only():
    """测试 join 仅带 join_code 分派。"""
    from _pytest.monkeypatch import MonkeyPatch
    
    monkeypatch = MonkeyPatch()
    captured = {}
    
    async def _fake_join_group(**kwargs):
        captured.update(kwargs)
    
    monkeypatch.setattr(manage_group_cli, "configure_logging", lambda **kwargs: None)
    monkeypatch.setattr(manage_group_cli, "join_group", _fake_join_group)
    monkeypatch.setattr(
        sys, "argv",
        ["manage_group.py", "--join", "--join-code", "314159", "--credential", "bob"]
    )
    
    try:
        manage_group_cli.main()
        assert captured == {"join_code": "314159", "credential_name": "bob"}, \
            f"捕获的参数不匹配：{captured}"
    finally:
        monkeypatch.undo()


def test_join_accepts_legacy_passcode_alias():
    """测试 join 接受遗留 passcode 别名。"""
    from _pytest.monkeypatch import MonkeyPatch
    
    monkeypatch = MonkeyPatch()
    captured = {}
    
    async def _fake_join_group(**kwargs):
        captured.update(kwargs)
    
    monkeypatch.setattr(manage_group_cli, "configure_logging", lambda **kwargs: None)
    monkeypatch.setattr(manage_group_cli, "join_group", _fake_join_group)
    monkeypatch.setattr(
        sys, "argv",
        ["manage_group.py", "--join", "--passcode", "314159", "--credential", "bob"]
    )
    
    try:
        manage_group_cli.main()
        assert captured == {"join_code": "314159", "credential_name": "bob"}, \
            f"捕获的参数不匹配：{captured}"
    finally:
        monkeypatch.undo()


def test_jsonrpc_error_is_rendered_as_json():
    """测试 JSON-RPC 错误渲染为 JSON。"""
    from _pytest.monkeypatch import MonkeyPatch
    
    monkeypatch = MonkeyPatch()
    
    async def _fake_get_group(**kwargs):
        raise JsonRpcError(-32004, "group join is disabled")
    
    monkeypatch.setattr(manage_group_cli, "configure_logging", lambda **kwargs: None)
    monkeypatch.setattr(manage_group_cli, "get_group", _fake_get_group)
    monkeypatch.setattr(
        sys, "argv",
        ["manage_group.py", "--get", "--group-id", "grp_1"]
    )
    
    captured_out = StringIO()
    old_stdout = sys.stdout
    sys.stdout = captured_out
    
    try:
        manage_group_cli.main()
        raise AssertionError("预期 SystemExit 异常")
    except SystemExit as e:
        sys.stdout = old_stdout
        assert e.code == 1, f"退出码应为 1，实际为 {e.code}"
        output = captured_out.getvalue()
        assert '"error_type": "jsonrpc"' in output, \
            f"输出不包含预期文本：{output}"
    finally:
        sys.stdout = old_stdout
        monkeypatch.undo()


def test_fetch_doc_retries_with_x_handle_after_connect_error():
    """测试 fetch_doc 在连接错误后用 X-Handle 重试。"""
    from _pytest.monkeypatch import MonkeyPatch
    import httpx
    
    monkeypatch = MonkeyPatch()
    
    class _FakeResponse:
        def __init__(self, *, status_code: int, text: str = "") -> None:
            self.status_code = status_code
            self.text = text

        def raise_for_status(self) -> None:
            request = httpx.Request("GET", "https://awiki.ai")
            response = httpx.Response(self.status_code, request=request, text=self.text)
            response.raise_for_status()

    class _FakeClient:
        def __init__(self) -> None:
            self.calls = []

        async def get(self, url: str, headers: dict | None = None) -> _FakeResponse:
            self.calls.append((url, headers))
            if len(self.calls) == 1:
                raise httpx.ConnectError(
                    "public doc unreachable",
                    request=httpx.Request("GET", url),
                )
            return _FakeResponse(status_code=200, text="# OpenClaw Meetup")

    class _AsyncClientContext:
        def __init__(self, client: _FakeClient) -> None:
            self._client = client

        async def __aenter__(self) -> _FakeClient:
            return self._client

        async def __aexit__(self, exc_type, exc, tb) -> bool:
            return False

    fake_client = _FakeClient()
    monkeypatch.setattr(
        manage_group_cli,
        "create_user_service_client",
        lambda config: _AsyncClientContext(fake_client),
    )
    
    captured_out = StringIO()
    old_stdout = sys.stdout
    sys.stdout = captured_out
    
    try:
        asyncio.run(
            manage_group_cli.fetch_doc(
                doc_url="https://alice.awiki.ai/group/openclaw-meetup-20260310.md"
            )
        )
        output = captured_out.getvalue()
        assert "# OpenClaw Meetup" in output, f"输出不包含文档内容：{output}"
        assert fake_client.calls == [
            ("https://alice.awiki.ai/group/openclaw-meetup-20260310.md", None),
            ("/group/openclaw-meetup-20260310.md", {"X-Handle": "alice"}),
        ], f"调用记录不匹配：{fake_client.calls}"
    finally:
        sys.stdout = old_stdout
        monkeypatch.undo()


def test_create_group_persists_local_snapshot():
    """测试 create_group 持久化本地快照。"""
    from _pytest.monkeypatch import MonkeyPatch
    
    with temp_data_dir():
        monkeypatch = MonkeyPatch()
        
        monkeypatch.setattr(
            manage_group_cli,
            "_get_identity_data_or_exit",
            lambda credential_name, config: {
                "did": "did:alice",
                "handle": "alice.awiki.ai",
                "name": "Alice",
            },
        )

        async def _fake_group_call(credential_name: str, method: str, params=None):
            assert method == "create"
            return {
                "group_id": "grp_1",
                "name": "OpenClaw Meetup",
                "slug": "openclaw-meetup",
                "description": "desc",
                "goal": "goal",
                "rules": "rules",
                "message_prompt": "prompt",
                "doc_url": "https://alice.awiki.ai/group/openclaw-meetup.md",
                "join_enabled": True,
                "owner_did": "did:alice",
                "owner_handle": "alice.awiki.ai",
                "member_count": 1,
                "join_code": "314159",
                "join_code_expires_at": "2026-03-10T12:00:00+00:00",
                "created_at": "2026-03-10T00:00:00+00:00",
                "updated_at": "2026-03-10T00:00:00+00:00",
            }

        monkeypatch.setattr(manage_group_cli, "_authenticated_group_call", _fake_group_call)

        try:
            asyncio.run(
                manage_group_cli.create_group(
                    name="OpenClaw Meetup",
                    slug="openclaw-meetup",
                    description="desc",
                    goal="goal",
                    rules="rules",
                    message_prompt="prompt",
                    join_enabled=True,
                    credential_name="alice",
                )
            )

            conn = local_store.get_connection()
            row = conn.execute(
                "SELECT name, my_role, join_code FROM groups WHERE owner_did='did:alice' AND group_id='grp_1'"
            ).fetchone()
            conn.close()
            
            assert row["name"] == "OpenClaw Meetup", f"名称不匹配：{row['name']}"
            assert row["my_role"] == "owner", f"角色不匹配：{row['my_role']}"
            assert row["join_code"] == "314159", f"加入码不匹配：{row['join_code']}"
        finally:
            monkeypatch.undo()


def test_post_message_persists_outgoing_local_message():
    """测试 post_message 持久化 outgoing 本地消息。"""
    from _pytest.monkeypatch import MonkeyPatch
    
    with temp_data_dir():
        monkeypatch = MonkeyPatch()
        
        monkeypatch.setattr(
            manage_group_cli,
            "_get_identity_data_or_exit",
            lambda credential_name, config: {
                "did": "did:alice",
                "handle": "alice.awiki.ai",
            },
        )

        async def _fake_group_call(credential_name: str, method: str, params=None):
            assert method == "post_message"
            return {
                "message_id": "msg_1",
                "server_seq": 12,
                "created_at": "2026-03-10T01:00:00+00:00",
            }

        monkeypatch.setattr(manage_group_cli, "_authenticated_group_call", _fake_group_call)

        try:
            asyncio.run(
                manage_group_cli.post_message(
                    group_id="grp_1",
                    content="hello group",
                    client_msg_id="client_1",
                    credential_name="alice",
                )
            )

            conn = local_store.get_connection()
            row = conn.execute(
                """
                SELECT direction, group_id, content, server_seq
                FROM messages
                WHERE owner_did='did:alice' AND msg_id='msg_1'
                """
            ).fetchone()
            conn.close()
            
            assert row["direction"] == 1, f"方向不匹配：{row['direction']}"
            assert row["group_id"] == "grp_1", f"群组 ID 不匹配：{row['group_id']}"
            assert row["content"] == "hello group", f"内容不匹配：{row['content']}"
            assert row["server_seq"] == 12, f"服务器序列不匹配：{row['server_seq']}"
        finally:
            monkeypatch.undo()


def test_list_messages_backfills_local_history():
    """测试 list_messages 回填本地历史。"""
    from _pytest.monkeypatch import MonkeyPatch
    
    with temp_data_dir():
        monkeypatch = MonkeyPatch()
        
        monkeypatch.setattr(
            manage_group_cli,
            "_get_identity_data_or_exit",
            lambda credential_name, config: {"did": "did:alice"},
        )

        async def _fake_group_call(credential_name: str, method: str, params=None):
            assert method == "list_messages"
            return {
                "messages": [
                    {
                        "id": "msg_in",
                        "sender_did": "did:bob",
                        "sender_name": "bob.awiki.ai",
                        "group_id": "grp_1",
                        "content": "hi",
                        "type": "group_user",
                        "created_at": "2026-03-10T02:00:00+00:00",
                        "server_seq": 20,
                    },
                    {
                        "id": "msg_out",
                        "sender_did": "did:alice",
                        "sender_name": "alice.awiki.ai",
                        "group_id": "grp_1",
                        "content": "hello",
                        "type": "group_user",
                        "created_at": "2026-03-10T02:01:00+00:00",
                        "server_seq": 21,
                    },
                    {
                        "id": "msg_sys",
                        "sender_did": None,
                        "sender_name": "System",
                        "group_id": "grp_1",
                        "content": "bob.awiki.ai joined the group.",
                        "type": "group_system_member_joined",
                        "created_at": "2026-03-10T02:02:00+00:00",
                        "server_seq": 22,
                        "system_event": {
                            "kind": "member_joined",
                            "subject": {
                                "id": "user_bob",
                                "did": "did:bob",
                                "handle": "bob.awiki.ai",
                                "profile_url": "https://awiki.ai/profiles/user_bob",
                            },
                            "actor": {
                                "id": "user_bob",
                                "did": "did:bob",
                                "handle": "bob.awiki.ai",
                                "profile_url": "https://awiki.ai/profiles/user_bob",
                            },
                        },
                    },
                ],
                "total": 3,
                "next_since_seq": 22,
            }

        monkeypatch.setattr(manage_group_cli, "_authenticated_group_call", _fake_group_call)

        try:
            asyncio.run(
                manage_group_cli.list_messages(
                    group_id="grp_1",
                    since_seq=None,
                    limit=50,
                    credential_name="alice",
                )
            )

            conn = local_store.get_connection()
            messages = conn.execute(
                """
                SELECT msg_id, direction FROM messages
                WHERE owner_did='did:alice' AND group_id='grp_1'
                ORDER BY msg_id
                """
            ).fetchall()
            system_row = conn.execute(
                """
                SELECT metadata
                FROM messages
                WHERE owner_did='did:alice' AND msg_id='msg_sys'
                """
            ).fetchone()
            group_row = conn.execute(
                """
                SELECT last_synced_seq, membership_status
                FROM groups
                WHERE owner_did='did:alice' AND group_id='grp_1'
                """
            ).fetchone()
            member_row = conn.execute(
                """
                SELECT user_id, member_did, profile_url, status
                FROM group_members
                WHERE owner_did='did:alice' AND group_id='grp_1' AND user_id='user_bob'
                """
            ).fetchone()
            conn.close()
            
            assert [(row["msg_id"], row["direction"]) for row in messages] == [
                ("msg_in", 0),
                ("msg_out", 1),
                ("msg_sys", 0),
            ], f"消息列表不匹配：{messages}"
            assert '"kind": "member_joined"' in system_row["metadata"], \
                f"系统事件元数据不包含预期文本：{system_row['metadata']}"
            assert member_row["member_did"] == "did:bob", f"成员 DID 不匹配：{member_row['member_did']}"
            assert member_row["profile_url"] == "https://awiki.ai/profiles/user_bob", \
                f"个人资料 URL 不匹配：{member_row['profile_url']}"
            assert member_row["status"] == "active", f"状态不匹配：{member_row['status']}"
            assert group_row["last_synced_seq"] == 22, f"最后同步序列不匹配：{group_row['last_synced_seq']}"
            assert group_row["membership_status"] == "active", \
                f"成员状态不匹配：{group_row['membership_status']}"
        finally:
            monkeypatch.undo()


def test_list_members_replaces_local_member_snapshot():
    """测试 list_members 替换本地成员快照。"""
    from _pytest.monkeypatch import MonkeyPatch
    
    with temp_data_dir():
        monkeypatch = MonkeyPatch()
        
        monkeypatch.setattr(
            manage_group_cli,
            "_get_identity_data_or_exit",
            lambda credential_name, config: {"did": "did:alice"},
        )

        async def _fake_group_call(credential_name: str, method: str, params=None):
            assert method == "list_members"
            return {
                "members": [
                    {
                        "user_id": "user_1",
                        "did": "did:alice",
                        "handle": "alice.awiki.ai",
                        "profile_url": "https://awiki.ai/profiles/user_1",
                        "role": "owner",
                        "joined_at": "2026-03-10T00:00:00+00:00",
                        "sent_message_count": 2,
                    },
                    {
                        "user_id": "user_2",
                        "did": "did:bob",
                        "handle": "bob.awiki.ai",
                        "profile_url": "https://awiki.ai/profiles/user_2",
                        "role": "member",
                        "joined_at": "2026-03-10T00:01:00+00:00",
                        "sent_message_count": 1,
                    },
                ]
            }

        monkeypatch.setattr(manage_group_cli, "_authenticated_group_call", _fake_group_call)

        try:
            asyncio.run(
                manage_group_cli.get_group_members(
                    group_id="grp_1",
                    credential_name="alice",
                )
            )

            conn = local_store.get_connection()
            row = conn.execute(
                """
                SELECT COUNT(*) AS cnt, MAX(profile_url) AS any_profile_url
                FROM group_members
                WHERE owner_did='did:alice' AND group_id='grp_1'
                """
            ).fetchone()
            conn.close()
            
            assert row["cnt"] == 2, f"成员数量不匹配：{row['cnt']}"
            assert row["any_profile_url"] is not None, "个人资料 URL 应为非空"
        finally:
            monkeypatch.undo()


# ==================== 主程序 ====================

def main():
    """运行所有测试并记录结果。"""
    print("="*60)
    print("蒸馏脚本：test_manage_group_cli.py")
    print("黄金标准：Discovery-group CLI 单元测试")
    print("="*60)
    
    tests = [
        ("test_join_rejects_group_id_with_guidance", test_join_rejects_group_id_with_guidance),
        ("test_create_dispatches_with_group_name_alias", test_create_dispatches_with_group_name_alias),
        ("test_join_dispatches_with_join_code_only", test_join_dispatches_with_join_code_only),
        ("test_join_accepts_legacy_passcode_alias", test_join_accepts_legacy_passcode_alias),
        ("test_jsonrpc_error_is_rendered_as_json", test_jsonrpc_error_is_rendered_as_json),
        ("test_fetch_doc_retries_with_x_handle_after_connect_error", test_fetch_doc_retries_with_x_handle_after_connect_error),
        ("test_create_group_persists_local_snapshot", test_create_group_persists_local_snapshot),
        ("test_post_message_persists_outgoing_local_message", test_post_message_persists_outgoing_local_message),
        ("test_list_messages_backfills_local_history", test_list_messages_backfills_local_history),
        ("test_list_members_replaces_local_member_snapshot", test_list_members_replaces_local_member_snapshot),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        if run_test(test_name, test_func):
            passed += 1
        else:
            failed += 1
    
    print(f"\n{'='*60}")
    print(f"总结：{passed} 通过，{failed} 失败，共 {len(tests)} 个测试")
    print('='*60)
    
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
