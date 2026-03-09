"""Unit tests for local_store module."""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

import pytest

_scripts_dir = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(_scripts_dir))

import local_store  # noqa: E402

EXPECTED_V6_INDEXES = {
    "idx_contacts_owner",
    "idx_messages_owner_thread",
    "idx_messages_owner_direction",
    "idx_messages_owner_sender",
    "idx_messages_owner",
    "idx_messages_credential",
    "idx_e2ee_outbox_owner_status",
    "idx_e2ee_outbox_owner_sent_msg",
    "idx_e2ee_outbox_owner_sent_seq",
    "idx_e2ee_outbox_credential",
}


def _schema_object_names(conn: sqlite3.Connection, object_type: str) -> set[str]:
    """Return named schema objects for assertions."""
    rows = conn.execute(
        """
        SELECT name FROM sqlite_master
        WHERE type = ? AND name NOT LIKE 'sqlite_%'
        """,
        (object_type,),
    ).fetchall()
    return {row[0] for row in rows}


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
        views = _schema_object_names(db, "view")
        assert "threads" in views
        assert "inbox" in views
        assert "outbox" in views

    def test_expected_indexes_created(self, db):
        indexes = _schema_object_names(db, "index")
        assert EXPECTED_V6_INDEXES <= indexes

    def test_schema_version(self, db):
        version = db.execute("PRAGMA user_version").fetchone()[0]
        assert version == 6

    def test_ensure_schema_idempotent(self, db):
        """Calling ensure_schema multiple times is safe."""
        local_store.ensure_schema(db)
        local_store.ensure_schema(db)
        version = db.execute("PRAGMA user_version").fetchone()[0]
        assert version == 6

    def test_wal_mode(self, db):
        mode = db.execute("PRAGMA journal_mode").fetchone()[0]
        assert mode == "wal"

    def test_credential_name_column_exists(self, db):
        message_columns = {
            row[1]
            for row in db.execute("PRAGMA table_info(messages)").fetchall()
        }
        contact_columns = {
            row[1] for row in db.execute("PRAGMA table_info(contacts)").fetchall()
        }
        outbox_columns = {
            row[1] for row in db.execute("PRAGMA table_info(e2ee_outbox)").fetchall()
        }
        assert "credential_name" in message_columns
        assert "title" in message_columns
        assert "owner_did" in contact_columns
        assert "owner_did" in message_columns
        assert "owner_did" in outbox_columns

    def test_database_path(self, tmp_path, monkeypatch):
        monkeypatch.setenv("AWIKI_DATA_DIR", str(tmp_path))
        conn = local_store.get_connection()
        local_store.ensure_schema(conn)
        conn.close()
        assert (tmp_path / "database" / "awiki.db").exists()

    def test_ensure_schema_repairs_missing_indexes_on_v6_database(self, db):
        db.execute("DROP INDEX idx_messages_owner_thread")
        db.execute("DROP INDEX idx_messages_owner_direction")
        db.execute("DROP INDEX idx_e2ee_outbox_owner_status")
        db.commit()

        before_indexes = _schema_object_names(db, "index")
        assert "idx_messages_owner_thread" not in before_indexes
        assert "idx_messages_owner_direction" not in before_indexes
        assert "idx_e2ee_outbox_owner_status" not in before_indexes

        local_store.ensure_schema(db)

        after_indexes = _schema_object_names(db, "index")
        version = db.execute("PRAGMA user_version").fetchone()[0]

        assert version == 6
        assert EXPECTED_V6_INDEXES <= after_indexes


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


class TestStoreMessage:
    """Single message storage."""

    def test_store_and_retrieve(self, db):
        local_store.store_message(
            db,
            msg_id="m1",
            owner_did="did:self",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:a",
            content="hello",
        )
        rows = db.execute("SELECT * FROM messages WHERE msg_id='m1'").fetchall()
        assert len(rows) == 1
        assert rows[0]["content"] == "hello"
        assert rows[0]["owner_did"] == "did:self"

    def test_dedup_scoped_by_owner_did(self, db):
        local_store.store_message(
            db,
            msg_id="m_dup",
            owner_did="did:alice",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:a",
            content="hello",
        )
        local_store.store_message(
            db,
            msg_id="m_dup",
            owner_did="did:alice",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:a",
            content="hello",
        )
        local_store.store_message(
            db,
            msg_id="m_dup",
            owner_did="did:bob",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:a",
            content="hello",
        )
        count = db.execute(
            "SELECT COUNT(*) FROM messages WHERE msg_id='m_dup'"
        ).fetchone()[0]
        assert count == 2

    def test_get_message_by_id_uses_owner_did(self, db):
        local_store.store_message(
            db,
            msg_id="m_lookup",
            owner_did="did:alice",
            thread_id="dm:a:b",
            direction=1,
            sender_did="did:alice",
            content="lookup",
            credential_name="alice",
        )
        row = local_store.get_message_by_id(
            db,
            msg_id="m_lookup",
            owner_did="did:alice",
        )
        assert row is not None
        assert row["content"] == "lookup"


class TestStoreMessagesBatch:
    """Batch message storage."""

    def test_batch_with_default_owner(self, db):
        batch = [
            {"msg_id": f"b{i}", "thread_id": "dm:a:b", "direction": 0,
             "sender_did": "did:a", "content": f"msg {i}"}
            for i in range(3)
        ]
        local_store.store_messages_batch(db, batch, owner_did="did:alice")
        owners = {
            row["owner_did"]
            for row in db.execute("SELECT owner_did FROM messages").fetchall()
        }
        assert owners == {"did:alice"}

    def test_batch_per_message_owner_override(self, db):
        batch = [
            {"msg_id": "bo1", "owner_did": "did:alice", "thread_id": "dm:a:b", "direction": 0,
             "sender_did": "did:a", "content": "msg1"},
            {"msg_id": "bo2", "thread_id": "dm:a:b", "direction": 0,
             "sender_did": "did:a", "content": "msg2"},
        ]
        local_store.store_messages_batch(db, batch, owner_did="did:bob")
        rows = {
            row["msg_id"]: row["owner_did"]
            for row in db.execute("SELECT msg_id, owner_did FROM messages").fetchall()
        }
        assert rows["bo1"] == "did:alice"
        assert rows["bo2"] == "did:bob"


class TestUpsertContact:
    """Contact insert/update with owner isolation."""

    def test_insert_new_contact(self, db):
        local_store.upsert_contact(
            db,
            owner_did="did:alice",
            did="did:c1",
            name="Alice",
            handle="alice",
        )
        row = db.execute(
            "SELECT * FROM contacts WHERE owner_did='did:alice' AND did='did:c1'"
        ).fetchone()
        assert row["name"] == "Alice"
        assert row["handle"] == "alice"

    def test_same_contact_can_exist_for_multiple_owners(self, db):
        local_store.upsert_contact(
            db,
            owner_did="did:alice",
            did="did:bob",
            relationship="following",
        )
        local_store.upsert_contact(
            db,
            owner_did="did:charlie",
            did="did:bob",
            relationship="none",
        )
        rows = db.execute(
            "SELECT owner_did, relationship FROM contacts WHERE did='did:bob' ORDER BY owner_did"
        ).fetchall()
        assert len(rows) == 2
        assert rows[0]["relationship"] == "following"
        assert rows[1]["relationship"] == "none"

    def test_rebind_owner_did_moves_contacts(self, db):
        local_store.upsert_contact(
            db,
            owner_did="did:old",
            did="did:bob",
            relationship="following",
        )
        summary = local_store.rebind_owner_did(
            db,
            old_owner_did="did:old",
            new_owner_did="did:new",
        )
        row = db.execute(
            "SELECT owner_did, relationship FROM contacts WHERE did='did:bob'"
        ).fetchone()
        assert summary["contacts"] == 1
        assert row["owner_did"] == "did:new"


class TestE2eeOutbox:
    """E2EE outbox persistence and retry status tracking."""

    def test_queue_and_fetch_outbox_record(self, db):
        outbox_id = local_store.queue_e2ee_outbox(
            db,
            owner_did="did:alice",
            peer_did="did:b",
            plaintext="secret",
            session_id="sess-1",
            credential_name="alice",
        )
        record = local_store.get_e2ee_outbox(
            db,
            outbox_id=outbox_id,
            owner_did="did:alice",
        )
        assert record is not None
        assert record["peer_did"] == "did:b"
        assert record["owner_did"] == "did:alice"

    def test_mark_outbox_failed_uses_owner_did(self, db):
        outbox_id = local_store.queue_e2ee_outbox(
            db,
            owner_did="did:alice",
            peer_did="did:b",
            plaintext="secret",
            session_id="sess-1",
            credential_name="alice",
        )
        local_store.mark_e2ee_outbox_sent(
            db,
            outbox_id=outbox_id,
            owner_did="did:alice",
            credential_name="alice",
            sent_msg_id="msg-1",
            sent_server_seq=7,
        )
        matched = local_store.mark_e2ee_outbox_failed(
            db,
            owner_did="did:alice",
            peer_did="did:b",
            failed_msg_id="msg-1",
            error_code="decryption_failed",
            retry_hint="resend",
        )
        assert matched == outbox_id
        record = local_store.get_e2ee_outbox(
            db,
            outbox_id=outbox_id,
            owner_did="did:alice",
        )
        assert record["local_status"] == "failed"

    def test_clear_owner_e2ee_data_removes_outbox_records(self, db):
        outbox_id = local_store.queue_e2ee_outbox(
            db,
            owner_did="did:alice",
            peer_did="did:b",
            plaintext="secret",
            credential_name="alice",
        )
        summary = local_store.clear_owner_e2ee_data(
            db,
            owner_did="did:alice",
            credential_name="alice",
        )
        record = local_store.get_e2ee_outbox(
            db,
            outbox_id=outbox_id,
            owner_did="did:alice",
        )
        assert summary["e2ee_outbox"] == 1
        assert record is None


class TestViews:
    """View correctness with owner_did grouping."""

    def test_threads_view_groups_by_owner_did(self, db):
        local_store.store_message(
            db,
            msg_id="v1",
            owner_did="did:alice",
            thread_id="group:g1",
            direction=0,
            sender_did="did:x",
            content="hello",
        )
        local_store.store_message(
            db,
            msg_id="v2",
            owner_did="did:bob",
            thread_id="group:g1",
            direction=0,
            sender_did="did:x",
            content="world",
        )
        rows = db.execute(
            "SELECT owner_did, thread_id, message_count FROM threads ORDER BY owner_did"
        ).fetchall()
        assert len(rows) == 2
        assert rows[0]["owner_did"] == "did:alice"
        assert rows[1]["owner_did"] == "did:bob"

    def test_inbox_and_outbox_views_include_owner_did(self, db):
        local_store.store_message(
            db,
            msg_id="in1",
            owner_did="did:alice",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:a",
            content="incoming",
        )
        local_store.store_message(
            db,
            msg_id="out1",
            owner_did="did:alice",
            thread_id="dm:a:b",
            direction=1,
            sender_did="did:alice",
            content="outgoing",
        )
        inbox = db.execute("SELECT owner_did, msg_id FROM inbox").fetchall()
        outbox = db.execute("SELECT owner_did, msg_id FROM outbox").fetchall()
        assert inbox[0]["owner_did"] == "did:alice"
        assert outbox[0]["owner_did"] == "did:alice"


class TestExecuteSql:
    """SQL safety checks."""

    def test_select(self, db):
        local_store.store_message(
            db,
            msg_id="s1",
            owner_did="did:self",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:a",
            content="test",
        )
        result = local_store.execute_sql(db, "SELECT COUNT(*) as cnt FROM messages")
        assert result[0]["cnt"] == 1

    def test_reject_drop(self, db):
        with pytest.raises(ValueError, match="Forbidden"):
            local_store.execute_sql(db, "DROP TABLE messages")

    def test_allow_delete_with_where(self, db):
        local_store.store_message(
            db,
            msg_id="del1",
            owner_did="did:self",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:a",
            content="to delete",
        )
        result = local_store.execute_sql(
            db, "DELETE FROM messages WHERE msg_id='del1'"
        )
        assert result[0]["rows_affected"] == 1


class TestMigration:
    """Migration from legacy schemas should preserve v6 ownership semantics."""

    def test_migrate_v4_schema_to_v6(self, tmp_path, monkeypatch):
        monkeypatch.setenv("AWIKI_DATA_DIR", str(tmp_path))
        monkeypatch.setenv("HOME", str(tmp_path))
        db_dir = tmp_path / "database"
        db_dir.mkdir(parents=True, exist_ok=True)
        db_path = db_dir / "awiki.db"

        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        conn.executescript("""
            CREATE TABLE contacts (
                did TEXT PRIMARY KEY,
                name TEXT,
                handle TEXT,
                nick_name TEXT,
                bio TEXT,
                profile_md TEXT,
                tags TEXT,
                relationship TEXT,
                first_seen_at TEXT,
                last_seen_at TEXT,
                metadata TEXT
            );
            CREATE TABLE messages (
                msg_id TEXT NOT NULL,
                thread_id TEXT NOT NULL,
                direction INTEGER NOT NULL DEFAULT 0,
                sender_did TEXT,
                receiver_did TEXT,
                group_id TEXT,
                group_did TEXT,
                content_type TEXT DEFAULT 'text',
                content TEXT,
                server_seq INTEGER,
                sent_at TEXT,
                stored_at TEXT NOT NULL,
                is_e2ee INTEGER DEFAULT 0,
                is_read INTEGER DEFAULT 0,
                sender_name TEXT,
                metadata TEXT,
                credential_name TEXT NOT NULL DEFAULT '',
                PRIMARY KEY (msg_id, credential_name)
            );
            CREATE TABLE e2ee_outbox (
                outbox_id TEXT PRIMARY KEY,
                peer_did TEXT NOT NULL,
                session_id TEXT,
                original_type TEXT NOT NULL DEFAULT 'text',
                plaintext TEXT NOT NULL,
                local_status TEXT NOT NULL DEFAULT 'queued',
                attempt_count INTEGER NOT NULL DEFAULT 0,
                sent_msg_id TEXT,
                sent_server_seq INTEGER,
                last_error_code TEXT,
                retry_hint TEXT,
                failed_msg_id TEXT,
                failed_server_seq INTEGER,
                metadata TEXT,
                last_attempt_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                credential_name TEXT NOT NULL DEFAULT ''
            );
            PRAGMA user_version = 4;
        """)
        conn.execute(
            "INSERT INTO contacts (did, relationship) VALUES ('did:peer', 'following')"
        )
        conn.execute(
            """
            INSERT INTO messages
            (msg_id, thread_id, direction, sender_did, receiver_did, content, stored_at, credential_name)
            VALUES ('m1', 'dm:did:alice:did:peer', 1, 'did:alice', 'did:peer', 'hello', '2026-01-01T00:00:00+00:00', 'alice')
            """
        )
        conn.execute(
            """
            INSERT INTO e2ee_outbox
            (outbox_id, peer_did, plaintext, created_at, updated_at, credential_name)
            VALUES ('o1', 'did:peer', 'secret', '2026-01-01T00:00:00+00:00', '2026-01-01T00:00:00+00:00', 'alice')
            """
        )
        conn.commit()
        conn.close()

        cred_root = tmp_path / ".openclaw" / "credentials" / "awiki-agent-id-message"
        cred_root.mkdir(parents=True, exist_ok=True)
        (cred_root / "index.json").write_text(
            json.dumps(
                {
                    "schema_version": 3,
                    "default_credential_name": "alice",
                    "credentials": {
                        "alice": {
                            "credential_name": "alice",
                            "dir_name": "k1_alice",
                            "did": "did:alice",
                            "unique_id": "k1_alice",
                            "is_default": True,
                        }
                    },
                },
                indent=2,
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        conn = local_store.get_connection()
        local_store.ensure_schema(conn)
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        migrated_message = conn.execute(
            "SELECT owner_did FROM messages WHERE msg_id='m1'"
        ).fetchone()
        migrated_contact = conn.execute(
            "SELECT owner_did FROM contacts WHERE did='did:peer'"
        ).fetchone()
        migrated_outbox = conn.execute(
            "SELECT owner_did FROM e2ee_outbox WHERE outbox_id='o1'"
        ).fetchone()
        conn.close()

        assert version == 6
        assert migrated_message["owner_did"] == "did:alice"
        assert migrated_contact["owner_did"] == "did:alice"
        assert migrated_outbox["owner_did"] == "did:alice"

    def test_rebind_owner_did_moves_messages_without_duplicate_conflicts(self, db):
        local_store.store_message(
            db,
            msg_id="m1",
            owner_did="did:old",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:b",
            content="old",
        )
        local_store.store_message(
            db,
            msg_id="m1",
            owner_did="did:new",
            thread_id="dm:a:b",
            direction=0,
            sender_did="did:b",
            content="new",
        )
        summary = local_store.rebind_owner_did(
            db,
            old_owner_did="did:old",
            new_owner_did="did:new",
        )
        count = db.execute(
            "SELECT COUNT(*) FROM messages WHERE msg_id='m1'"
        ).fetchone()[0]
        assert summary["messages"] == 1
        assert count == 1
