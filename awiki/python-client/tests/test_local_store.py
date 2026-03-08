"""Unit tests for local_store module.

Tests schema creation, CRUD operations, idempotent dedup, thread_id generation,
views, credential_name filtering, and SQL safety checks.
"""

import os
import sqlite3
import sys
from pathlib import Path

import pytest

# Add scripts/ to sys.path so we can import local_store
_scripts_dir = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(_scripts_dir))

import local_store


@pytest.fixture()
def db(tmp_path, monkeypatch):
    """Create a temporary SQLite database for testing."""
    monkeypatch.setenv("AWIKI_DATA_DIR", str(tmp_path))
    conn = local_store.get_connection()
    local_store.ensure_schema(conn)
    yield conn
    conn.close()


class TestSchema:
    """Schema creation and versioning."""

    def test_tables_created(self, db):
        tables = {
            row[0]
            for row in db.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        assert "contacts" in tables
        assert "messages" in tables
        assert "e2ee_outbox" in tables

    def test_views_created(self, db):
        views = {
            row[0]
            for row in db.execute(
                "SELECT name FROM sqlite_master WHERE type='view'"
            ).fetchall()
        }
        assert "threads" in views
        assert "inbox" in views
        assert "outbox" in views

    def test_schema_version(self, db):
        version = db.execute("PRAGMA user_version").fetchone()[0]
        assert version == 4

    def test_ensure_schema_idempotent(self, db):
        """Calling ensure_schema multiple times is safe."""
        local_store.ensure_schema(db)
        local_store.ensure_schema(db)
        version = db.execute("PRAGMA user_version").fetchone()[0]
        assert version == 4

    def test_wal_mode(self, db):
        mode = db.execute("PRAGMA journal_mode").fetchone()[0]
        assert mode == "wal"

    def test_credential_name_column_exists(self, db):
        columns = {
            row[1]
            for row in db.execute("PRAGMA table_info(messages)").fetchall()
        }
        assert "credential_name" in columns

    def test_database_path(self, tmp_path, monkeypatch):
        """Database is created at <DATA_DIR>/database/awiki.db."""
        monkeypatch.setenv("AWIKI_DATA_DIR", str(tmp_path))
        conn = local_store.get_connection()
        local_store.ensure_schema(conn)
        conn.close()
        assert (tmp_path / "database" / "awiki.db").exists()


class TestThreadId:
    """Thread ID generation."""

    def test_dm_sorted(self):
        tid1 = local_store.make_thread_id("did:a", peer_did="did:b")
        tid2 = local_store.make_thread_id("did:b", peer_did="did:a")
        assert tid1 == tid2
        assert tid1.startswith("dm:")

    def test_group(self):
        tid = local_store.make_thread_id("did:a", group_id="g1")
        assert tid == "group:g1"

    def test_group_takes_priority(self):
        tid = local_store.make_thread_id("did:a", peer_did="did:b", group_id="g1")
        assert tid == "group:g1"

    def test_no_peer(self):
        tid = local_store.make_thread_id("did:a")
        assert "unknown" in tid


class TestStoreMessage:
    """Single message storage."""

    def test_store_and_retrieve(self, db):
        local_store.store_message(
            db,
            msg_id="m1",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:a",
            content="hello",
        )
        rows = db.execute("SELECT * FROM messages WHERE msg_id='m1'").fetchall()
        assert len(rows) == 1
        assert rows[0]["content"] == "hello"
        assert rows[0]["direction"] == 0

    def test_idempotent_dedup(self, db):
        for _ in range(3):
            local_store.store_message(
                db,
                msg_id="m_dup",
                thread_id="dm:a:b",
                direction=0,
                sender_did="did:a",
                content="hello",
            )
        count = db.execute(
            "SELECT COUNT(*) FROM messages WHERE msg_id='m_dup'"
        ).fetchone()[0]
        assert count == 1

    def test_stored_at_populated(self, db):
        local_store.store_message(
            db,
            msg_id="m_ts",
            thread_id="dm:a:b",
            direction=1,
            sender_did="did:a",
            content="test",
        )
        row = db.execute(
            "SELECT stored_at FROM messages WHERE msg_id='m_ts'"
        ).fetchone()
        assert row["stored_at"] is not None

    def test_credential_name_stored(self, db):
        local_store.store_message(
            db,
            msg_id="m_cred",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:a",
            content="hello",
            credential_name="alice",
        )
        row = db.execute(
            "SELECT credential_name FROM messages WHERE msg_id='m_cred'"
        ).fetchone()
        assert row["credential_name"] == "alice"

    def test_credential_name_default_none(self, db):
        local_store.store_message(
            db,
            msg_id="m_no_cred",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:a",
            content="hello",
        )
        row = db.execute(
            "SELECT credential_name FROM messages WHERE msg_id='m_no_cred'"
        ).fetchone()
        assert row["credential_name"] == ""

    def test_get_message_by_id(self, db):
        local_store.store_message(
            db,
            msg_id="m_lookup",
            thread_id="dm:a:b",
            direction=1,
            sender_did="did:a",
            content="lookup",
            credential_name="alice",
        )
        row = local_store.get_message_by_id(
            db, msg_id="m_lookup", credential_name="alice"
        )
        assert row is not None
        assert row["content"] == "lookup"


class TestStoreMessagesBatch:
    """Batch message storage."""

    def test_batch_insert(self, db):
        batch = [
            {"msg_id": f"b{i}", "thread_id": "dm:a:b", "direction": 0,
             "sender_did": "did:a", "content": f"msg {i}"}
            for i in range(5)
        ]
        local_store.store_messages_batch(db, batch)
        count = db.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
        assert count == 5

    def test_batch_dedup(self, db):
        batch = [
            {"msg_id": "dup1", "thread_id": "dm:a:b", "direction": 0,
             "sender_did": "did:a", "content": "first"},
        ]
        local_store.store_messages_batch(db, batch)
        local_store.store_messages_batch(db, batch)
        count = db.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
        assert count == 1

    def test_empty_batch(self, db):
        local_store.store_messages_batch(db, [])
        count = db.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
        assert count == 0

    def test_batch_with_credential_name(self, db):
        batch = [
            {"msg_id": "bc1", "thread_id": "dm:a:b", "direction": 0,
             "sender_did": "did:a", "content": "msg1"},
            {"msg_id": "bc2", "thread_id": "dm:a:b", "direction": 0,
             "sender_did": "did:a", "content": "msg2"},
        ]
        local_store.store_messages_batch(db, batch, credential_name="bob")
        rows = db.execute(
            "SELECT credential_name FROM messages ORDER BY msg_id"
        ).fetchall()
        assert all(row["credential_name"] == "bob" for row in rows)

    def test_batch_allows_same_msg_id_for_different_credentials(self, db):
        batch = [
            {"msg_id": "shared1", "thread_id": "dm:a:b", "direction": 1,
             "sender_did": "did:a", "content": "msg", "credential_name": "alice"},
            {"msg_id": "shared1", "thread_id": "dm:a:b", "direction": 0,
             "sender_did": "did:a", "content": "msg", "credential_name": "bob"},
        ]
        local_store.store_messages_batch(db, batch)
        rows = db.execute(
            "SELECT msg_id, credential_name, direction FROM messages "
            "WHERE msg_id='shared1' ORDER BY credential_name"
        ).fetchall()
        assert len(rows) == 2
        assert rows[0]["credential_name"] == "alice"
        assert rows[1]["credential_name"] == "bob"

    def test_batch_per_message_credential_override(self, db):
        batch = [
            {"msg_id": "bo1", "thread_id": "dm:a:b", "direction": 0,
             "sender_did": "did:a", "content": "msg1", "credential_name": "alice"},
            {"msg_id": "bo2", "thread_id": "dm:a:b", "direction": 0,
             "sender_did": "did:a", "content": "msg2"},
        ]
        local_store.store_messages_batch(db, batch, credential_name="default")
        rows = {
            row["msg_id"]: row["credential_name"]
            for row in db.execute("SELECT msg_id, credential_name FROM messages").fetchall()
        }
        assert rows["bo1"] == "alice"
        assert rows["bo2"] == "default"


class TestUpsertContact:
    """Contact insert/update."""

    def test_insert_new_contact(self, db):
        local_store.upsert_contact(db, did="did:c1", name="Alice", handle="alice")
        row = db.execute("SELECT * FROM contacts WHERE did='did:c1'").fetchone()
        assert row["name"] == "Alice"
        assert row["handle"] == "alice"
        assert row["first_seen_at"] is not None

    def test_update_existing_contact(self, db):
        local_store.upsert_contact(db, did="did:c2", name="Bob")
        local_store.upsert_contact(db, did="did:c2", name="Bobby", handle="bobby")
        row = db.execute("SELECT * FROM contacts WHERE did='did:c2'").fetchone()
        assert row["name"] == "Bobby"
        assert row["handle"] == "bobby"

    def test_ignores_unknown_fields(self, db):
        local_store.upsert_contact(db, did="did:c3", unknown_field="ignored")
        row = db.execute("SELECT * FROM contacts WHERE did='did:c3'").fetchone()
        assert row is not None


class TestE2eeOutbox:
    """E2EE outbox persistence and retry status tracking."""

    def test_queue_and_fetch_outbox_record(self, db):
        outbox_id = local_store.queue_e2ee_outbox(
            db,
            peer_did="did:b",
            plaintext="secret",
            session_id="sess-1",
            credential_name="alice",
        )

        record = local_store.get_e2ee_outbox(
            db, outbox_id=outbox_id, credential_name="alice"
        )
        assert record is not None
        assert record["peer_did"] == "did:b"
        assert record["local_status"] == "queued"
        assert record["attempt_count"] == 0

    def test_mark_outbox_sent(self, db):
        outbox_id = local_store.queue_e2ee_outbox(
            db,
            peer_did="did:b",
            plaintext="hello",
            credential_name="alice",
        )
        local_store.mark_e2ee_outbox_sent(
            db,
            outbox_id=outbox_id,
            credential_name="alice",
            session_id="sess-2",
            sent_msg_id="msg-1",
            sent_server_seq=8,
        )

        record = local_store.get_e2ee_outbox(
            db, outbox_id=outbox_id, credential_name="alice"
        )
        assert record["local_status"] == "sent"
        assert record["attempt_count"] == 1
        assert record["sent_msg_id"] == "msg-1"
        assert record["sent_server_seq"] == 8

    def test_mark_outbox_failed_by_failed_msg_id(self, db):
        outbox_id = local_store.queue_e2ee_outbox(
            db,
            peer_did="did:b",
            plaintext="hello",
            session_id="sess-3",
            credential_name="alice",
        )
        local_store.mark_e2ee_outbox_sent(
            db,
            outbox_id=outbox_id,
            credential_name="alice",
            session_id="sess-3",
            sent_msg_id="msg-2",
            sent_server_seq=11,
        )

        matched = local_store.mark_e2ee_outbox_failed(
            db,
            credential_name="alice",
            peer_did="did:b",
            failed_msg_id="msg-2",
            error_code="decryption_failed",
            retry_hint="resend",
        )
        assert matched == outbox_id

        record = local_store.get_e2ee_outbox(
            db, outbox_id=outbox_id, credential_name="alice"
        )
        assert record["local_status"] == "failed"
        assert record["last_error_code"] == "decryption_failed"
        assert record["retry_hint"] == "resend"

    def test_list_failed_outbox(self, db):
        outbox_id = local_store.queue_e2ee_outbox(
            db,
            peer_did="did:b",
            plaintext="hello",
            credential_name="alice",
        )
        local_store.update_e2ee_outbox_status(
            db,
            outbox_id=outbox_id,
            local_status="failed",
            credential_name="alice",
        )
        failed = local_store.list_e2ee_outbox(
            db, credential_name="alice", local_status="failed"
        )
        assert len(failed) == 1
        assert failed[0]["outbox_id"] == outbox_id


class TestViews:
    """View correctness."""

    def test_threads_view(self, db):
        local_store.store_message(
            db, msg_id="v1", thread_id="dm:a:b", direction=0,
            sender_did="did:a", content="hello",
        )
        local_store.store_message(
            db, msg_id="v2", thread_id="dm:a:b", direction=0,
            sender_did="did:a", content="world", is_read=True,
        )
        rows = db.execute("SELECT * FROM threads").fetchall()
        assert len(rows) == 1
        assert rows[0]["message_count"] == 2
        assert rows[0]["unread_count"] == 1

    def test_inbox_view(self, db):
        local_store.store_message(
            db, msg_id="in1", thread_id="dm:a:b", direction=0,
            sender_did="did:a", content="incoming",
        )
        local_store.store_message(
            db, msg_id="out1", thread_id="dm:a:b", direction=1,
            sender_did="did:b", content="outgoing",
        )
        inbox = db.execute("SELECT * FROM inbox").fetchall()
        outbox = db.execute("SELECT * FROM outbox").fetchall()
        assert len(inbox) == 1
        assert inbox[0]["msg_id"] == "in1"
        assert len(outbox) == 1
        assert outbox[0]["msg_id"] == "out1"


class TestCredentialNameFilter:
    """Credential name based filtering."""

    def test_filter_by_credential(self, db):
        local_store.store_message(
            db, msg_id="f1", thread_id="dm:a:b", direction=0,
            sender_did="did:a", content="alice msg",
            credential_name="alice",
        )
        local_store.store_message(
            db, msg_id="f2", thread_id="dm:a:b", direction=0,
            sender_did="did:a", content="bob msg",
            credential_name="bob",
        )
        local_store.store_message(
            db, msg_id="f3", thread_id="dm:a:b", direction=0,
            sender_did="did:a", content="no cred msg",
        )
        result = local_store.execute_sql(
            db, "SELECT COUNT(*) as cnt FROM messages WHERE credential_name = 'alice'"
        )
        assert result[0]["cnt"] == 1

        result = local_store.execute_sql(
            db, "SELECT COUNT(*) as cnt FROM messages WHERE credential_name = ''"
        )
        assert result[0]["cnt"] == 1


class TestExecuteSql:
    """SQL safety checks."""

    def test_select(self, db):
        local_store.store_message(
            db, msg_id="s1", thread_id="dm:a:b", direction=0,
            sender_did="did:a", content="test",
        )
        result = local_store.execute_sql(db, "SELECT COUNT(*) as cnt FROM messages")
        assert result[0]["cnt"] == 1

    def test_reject_drop(self, db):
        with pytest.raises(ValueError, match="Forbidden"):
            local_store.execute_sql(db, "DROP TABLE messages")

    def test_reject_truncate(self, db):
        with pytest.raises(ValueError, match="Forbidden"):
            local_store.execute_sql(db, "TRUNCATE TABLE messages")

    def test_reject_delete_no_where(self, db):
        with pytest.raises(ValueError, match="WHERE"):
            local_store.execute_sql(db, "DELETE FROM messages")

    def test_allow_delete_with_where(self, db):
        local_store.store_message(
            db, msg_id="del1", thread_id="dm:a:b", direction=0,
            sender_did="did:a", content="to delete",
        )
        result = local_store.execute_sql(
            db, "DELETE FROM messages WHERE msg_id='del1'"
        )
        assert result[0]["rows_affected"] == 1

    def test_reject_multiple_statements(self, db):
        with pytest.raises(ValueError, match="Multiple"):
            local_store.execute_sql(
                db, "SELECT 1; DROP TABLE messages"
            )

    def test_insert_via_execute_sql(self, db):
        result = local_store.execute_sql(
            db,
            "INSERT INTO contacts (did, name) VALUES ('did:x', 'Test')",
        )
        assert result[0]["rows_affected"] == 1
