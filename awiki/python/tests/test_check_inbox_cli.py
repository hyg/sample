"""Unit tests for check_inbox CLI routing and scope filtering.

[INPUT]: check_inbox CLI helpers, monkeypatched async entrypoints, and CLI argv
[OUTPUT]: Regression coverage for inbox scope filtering and group-history dispatch
[POS]: Message CLI unit tests for unified direct/group inbox behavior

[PROTOCOL]:
1. Update this header when logic changes
2. Check the containing folder's CLAUDE.md after updates
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_scripts_dir = Path(__file__).resolve().parent.parent / "scripts"
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))

import check_inbox as check_inbox_cli  # noqa: E402
import local_store  # noqa: E402


class TestCheckInboxCli:
    """Test inbox CLI parsing and group-aware routing."""

    def test_filter_messages_by_scope_variants(self) -> None:
        messages = [
            {"id": "dm_1", "group_id": None, "content": "private"},
            {"id": "grp_1", "group_id": "group-1", "content": "group"},
        ]

        assert check_inbox_cli._filter_messages_by_scope(messages, "all") == messages
        assert check_inbox_cli._filter_messages_by_scope(messages, "direct") == [
            messages[0]
        ]
        assert check_inbox_cli._filter_messages_by_scope(messages, "group") == [
            messages[1]
        ]

    def test_parse_group_history_target(self) -> None:
        assert (
            check_inbox_cli._parse_group_history_target(
                "group:321cf92a-b54a-4e66-b791-f883c9bb4b26"
            )
            == "321cf92a-b54a-4e66-b791-f883c9bb4b26"
        )
        assert check_inbox_cli._parse_group_history_target("did:wba:example:user:alice") is None

    def test_main_dispatches_group_history_from_group_id(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        captured: dict[str, object] = {}

        async def _fake_get_group_history(
            group_id: str,
            credential_name: str,
            limit: int,
            since_seq: int | None,
        ) -> None:
            captured.update(
                {
                    "group_id": group_id,
                    "credential_name": credential_name,
                    "limit": limit,
                    "since_seq": since_seq,
                }
            )

        monkeypatch.setattr(
            check_inbox_cli, "configure_logging", lambda **kwargs: None
        )
        monkeypatch.setattr(
            check_inbox_cli, "get_group_history", _fake_get_group_history
        )
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "check_inbox.py",
                "--group-id",
                "grp_1",
                "--credential",
                "bob",
                "--limit",
                "30",
                "--since-seq",
                "7",
            ],
        )

        check_inbox_cli.main()

        assert captured == {
            "group_id": "grp_1",
            "credential_name": "bob",
            "limit": 30,
            "since_seq": 7,
        }

    def test_main_dispatches_group_history_from_history_prefix(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        captured: dict[str, object] = {}

        async def _fake_get_group_history(
            group_id: str,
            credential_name: str,
            limit: int,
            since_seq: int | None,
        ) -> None:
            captured.update(
                {
                    "group_id": group_id,
                    "credential_name": credential_name,
                    "limit": limit,
                    "since_seq": since_seq,
                }
            )

        monkeypatch.setattr(
            check_inbox_cli, "configure_logging", lambda **kwargs: None
        )
        monkeypatch.setattr(
            check_inbox_cli, "get_group_history", _fake_get_group_history
        )
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "check_inbox.py",
                "--history",
                "group:grp_1",
                "--credential",
                "bob",
            ],
        )

        check_inbox_cli.main()

        assert captured == {
            "group_id": "grp_1",
            "credential_name": "bob",
            "limit": 20,
            "since_seq": None,
        }

    def test_main_dispatches_inbox_with_scope(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        captured: dict[str, object] = {}

        async def _fake_check_inbox(
            credential_name: str,
            limit: int,
            scope: str,
        ) -> None:
            captured.update(
                {
                    "credential_name": credential_name,
                    "limit": limit,
                    "scope": scope,
                }
            )

        monkeypatch.setattr(
            check_inbox_cli, "configure_logging", lambda **kwargs: None
        )
        monkeypatch.setattr(check_inbox_cli, "check_inbox", _fake_check_inbox)
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "check_inbox.py",
                "--credential",
                "bob",
                "--scope",
                "group",
                "--limit",
                "40",
            ],
        )

        check_inbox_cli.main()

        assert captured == {
            "credential_name": "bob",
            "limit": 40,
            "scope": "group",
        }

    def test_main_rejects_since_seq_without_group_history(
        self,
        monkeypatch: pytest.MonkeyPatch,
        capsys,
    ) -> None:
        monkeypatch.setattr(
            check_inbox_cli, "configure_logging", lambda **kwargs: None
        )
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "check_inbox.py",
                "--credential",
                "bob",
                "--since-seq",
                "7",
            ],
        )

        with pytest.raises(SystemExit):
            check_inbox_cli.main()

        assert "--since-seq only supports group history reads" in capsys.readouterr().err

    def test_resolve_group_since_seq_prefers_explicit_argument(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        monkeypatch.setenv("AWIKI_DATA_DIR", str(tmp_path))

        since_seq, cursor_source = check_inbox_cli._resolve_group_since_seq(
            owner_did="did:alice",
            group_id="grp_1",
            explicit_since_seq=9,
        )

        assert since_seq == 9
        assert cursor_source == "argument"

    def test_resolve_group_since_seq_reads_group_snapshot_first(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        monkeypatch.setenv("AWIKI_DATA_DIR", str(tmp_path))
        conn = local_store.get_connection()
        try:
            local_store.ensure_schema(conn)
            local_store.upsert_group(
                conn,
                owner_did="did:alice",
                group_id="grp_1",
                last_synced_seq=12,
                credential_name="alice",
            )
        finally:
            conn.close()

        since_seq, cursor_source = check_inbox_cli._resolve_group_since_seq(
            owner_did="did:alice",
            group_id="grp_1",
            explicit_since_seq=None,
        )

        assert since_seq == 12
        assert cursor_source == "group_snapshot"

    def test_resolve_group_since_seq_falls_back_to_message_cache(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        monkeypatch.setenv("AWIKI_DATA_DIR", str(tmp_path))
        conn = local_store.get_connection()
        try:
            local_store.ensure_schema(conn)
            local_store.store_message(
                conn,
                msg_id="msg_1",
                owner_did="did:alice",
                thread_id=local_store.make_thread_id("did:alice", group_id="grp_1"),
                direction=0,
                sender_did="did:bob",
                group_id="grp_1",
                content_type="group_user",
                content="hello",
                server_seq=21,
                sent_at="2026-03-10T01:00:00+00:00",
                credential_name="alice",
            )
        finally:
            conn.close()

        since_seq, cursor_source = check_inbox_cli._resolve_group_since_seq(
            owner_did="did:alice",
            group_id="grp_1",
            explicit_since_seq=None,
        )

        assert since_seq == 21
        assert cursor_source == "message_cache"

    def test_get_group_history_uses_resolved_local_cursor(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        captured: dict[str, object] = {}

        monkeypatch.setattr(
            check_inbox_cli,
            "create_authenticator",
            lambda credential_name, config: (
                object(),
                {"did": "did:alice", "handle": "alice.awiki.ai"},
            ),
        )
        monkeypatch.setattr(
            check_inbox_cli,
            "_resolve_group_since_seq",
            lambda owner_did, group_id, explicit_since_seq: (22, "group_snapshot"),
        )

        async def _fake_group_rpc_call(**kwargs):
            captured.update(kwargs)
            return {"messages": [], "next_since_seq": 22}

        monkeypatch.setattr(
            check_inbox_cli, "_group_rpc_call", _fake_group_rpc_call
        )
        monkeypatch.setattr(
            check_inbox_cli,
            "_persist_group_messages",
            lambda **kwargs: None,
        )

        import asyncio

        asyncio.run(
            check_inbox_cli.get_group_history(
                "grp_1",
                credential_name="alice",
                limit=30,
                since_seq=None,
            )
        )

        assert captured["params"] == {"group_id": "grp_1", "limit": 30, "since_seq": 22}
