"""Unit tests for discovery-group CLI behavior.

[INPUT]: manage_group CLI entrypoints, monkeypatched async RPC/doc clients, and CLI argv
[OUTPUT]: Regression coverage for join argument handling, JSON-RPC rendering, and fetch-doc fallback
[POS]: Discovery-group CLI unit tests

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updates
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import httpx
import pytest

_scripts_dir = Path(__file__).resolve().parent.parent / "scripts"
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))

import manage_group as manage_group_cli  # noqa: E402
import local_store  # noqa: E402
from utils.rpc import JsonRpcError  # noqa: E402


class TestManageGroupCli:
    """Test discovery-group CLI parsing and error handling."""

    def test_join_rejects_group_id_with_guidance(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys,
    ) -> None:
        monkeypatch.setattr(
            manage_group_cli, "configure_logging", lambda **kwargs: None
        )
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "manage_group.py",
                "--join",
                "--group-id",
                "grp_1",
                "--join-code",
                "314159",
            ],
        )

        with pytest.raises(SystemExit):
            manage_group_cli.main()

        assert (
            "can only be joined with the global 6-digit join-code"
            in capsys.readouterr().err
        )

    def test_create_dispatches_with_group_name_alias(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        captured: dict[str, object] = {}

        async def _fake_create_group(**kwargs):
            captured.update(kwargs)

        monkeypatch.setattr(
            manage_group_cli, "configure_logging", lambda **kwargs: None
        )
        monkeypatch.setattr(manage_group_cli, "create_group", _fake_create_group)
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "manage_group.py",
                "--create",
                "--group-name",
                "OpenClaw Meetup",
                "--slug",
                "openclaw-meetup",
                "--description",
                "desc",
                "--goal",
                "goal",
                "--rules",
                "rules",
                "--message-prompt",
                "prompt",
            ],
        )

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
        }

    def test_join_dispatches_with_join_code_only(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        captured: dict[str, object] = {}

        async def _fake_join_group(**kwargs):
            captured.update(kwargs)

        monkeypatch.setattr(
            manage_group_cli, "configure_logging", lambda **kwargs: None
        )
        monkeypatch.setattr(manage_group_cli, "join_group", _fake_join_group)
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "manage_group.py",
                "--join",
                "--join-code",
                "314159",
                "--credential",
                "bob",
            ],
        )

        manage_group_cli.main()

        assert captured == {"join_code": "314159", "credential_name": "bob"}

    def test_join_accepts_legacy_passcode_alias(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        captured: dict[str, object] = {}

        async def _fake_join_group(**kwargs):
            captured.update(kwargs)

        monkeypatch.setattr(
            manage_group_cli, "configure_logging", lambda **kwargs: None
        )
        monkeypatch.setattr(manage_group_cli, "join_group", _fake_join_group)
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "manage_group.py",
                "--join",
                "--passcode",
                "314159",
                "--credential",
                "bob",
            ],
        )

        manage_group_cli.main()

        assert captured == {"join_code": "314159", "credential_name": "bob"}

    def test_jsonrpc_error_is_rendered_as_json(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys,
    ) -> None:
        async def _fake_get_group(**kwargs):
            raise JsonRpcError(-32004, "group join is disabled")

        monkeypatch.setattr(
            manage_group_cli, "configure_logging", lambda **kwargs: None
        )
        monkeypatch.setattr(manage_group_cli, "get_group", _fake_get_group)
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "manage_group.py",
                "--get",
                "--group-id",
                "grp_1",
            ],
        )

        with pytest.raises(SystemExit) as exc_info:
            manage_group_cli.main()

        assert exc_info.value.code == 1
        assert '"error_type": "jsonrpc"' in capsys.readouterr().out

    def test_fetch_doc_retries_with_x_handle_after_connect_error(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys,
    ) -> None:
        class _FakeResponse:
            def __init__(self, *, status_code: int, text: str = "") -> None:
                self.status_code = status_code
                self.text = text

            def raise_for_status(self) -> None:
                request = httpx.Request("GET", "https://awiki.ai")
                response = httpx.Response(
                    self.status_code, request=request, text=self.text
                )
                response.raise_for_status()

        class _FakeClient:
            def __init__(self) -> None:
                self.calls: list[tuple[str, dict[str, str] | None]] = []

            async def get(
                self, url: str, headers: dict[str, str] | None = None
            ) -> _FakeResponse:
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
                del exc_type, exc, tb
                return False

        fake_client = _FakeClient()
        monkeypatch.setattr(
            manage_group_cli,
            "create_user_service_client",
            lambda config: _AsyncClientContext(fake_client),
        )

        asyncio.run(
            manage_group_cli.fetch_doc(
                doc_url="https://alice.awiki.ai/group/openclaw-meetup-20260310.md"
            )
        )

        captured = capsys.readouterr()
        assert "# OpenClaw Meetup" in captured.out
        assert fake_client.calls == [
            ("https://alice.awiki.ai/group/openclaw-meetup-20260310.md", None),
            ("/group/openclaw-meetup-20260310.md", {"X-Handle": "alice"}),
        ]

    def test_create_group_persists_local_snapshot(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        monkeypatch.setenv("AWIKI_DATA_DIR", str(tmp_path))
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
            del credential_name, params
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

        monkeypatch.setattr(
            manage_group_cli, "_authenticated_group_call", _fake_group_call
        )

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
        assert row["name"] == "OpenClaw Meetup"
        assert row["my_role"] == "owner"
        assert row["join_code"] == "314159"

    def test_post_message_persists_outgoing_local_message(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        monkeypatch.setenv("AWIKI_DATA_DIR", str(tmp_path))
        monkeypatch.setattr(
            manage_group_cli,
            "_get_identity_data_or_exit",
            lambda credential_name, config: {
                "did": "did:alice",
                "handle": "alice.awiki.ai",
            },
        )

        async def _fake_group_call(credential_name: str, method: str, params=None):
            del credential_name, params
            assert method == "post_message"
            return {
                "message_id": "msg_1",
                "server_seq": 12,
                "created_at": "2026-03-10T01:00:00+00:00",
            }

        monkeypatch.setattr(
            manage_group_cli, "_authenticated_group_call", _fake_group_call
        )

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
        assert row["direction"] == 1
        assert row["group_id"] == "grp_1"
        assert row["content"] == "hello group"
        assert row["server_seq"] == 12

    def test_list_messages_backfills_local_history(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        monkeypatch.setenv("AWIKI_DATA_DIR", str(tmp_path))
        monkeypatch.setattr(
            manage_group_cli,
            "_get_identity_data_or_exit",
            lambda credential_name, config: {"did": "did:alice"},
        )

        async def _fake_group_call(credential_name: str, method: str, params=None):
            del credential_name, params
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

        monkeypatch.setattr(
            manage_group_cli, "_authenticated_group_call", _fake_group_call
        )

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
        ]
        assert '"kind": "member_joined"' in system_row["metadata"]
        assert member_row["member_did"] == "did:bob"
        assert member_row["profile_url"] == "https://awiki.ai/profiles/user_bob"
        assert member_row["status"] == "active"
        assert group_row["last_synced_seq"] == 22
        assert group_row["membership_status"] == "active"

    def test_list_members_replaces_local_member_snapshot(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        monkeypatch.setenv("AWIKI_DATA_DIR", str(tmp_path))
        monkeypatch.setattr(
            manage_group_cli,
            "_get_identity_data_or_exit",
            lambda credential_name, config: {"did": "did:alice"},
        )

        async def _fake_group_call(credential_name: str, method: str, params=None):
            del credential_name, params
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

        monkeypatch.setattr(
            manage_group_cli, "_authenticated_group_call", _fake_group_call
        )

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
        assert row["cnt"] == 2
        assert row["any_profile_url"] is not None
