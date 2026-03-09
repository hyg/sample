"""SQLite local storage for messages, contacts, and E2EE outbox state.

[INPUT]: SDKConfig (data_dir for database path), credential_store (owner DID lookup
         during migration)
[OUTPUT]: get_connection(), ensure_schema(), store_message(), store_messages_batch(),
         queue_e2ee_outbox(), mark_e2ee_outbox_sent(), mark_e2ee_outbox_failed(),
         list_e2ee_outbox(), get_e2ee_outbox(), get_message_by_id(), make_thread_id(),
         upsert_contact(), rebind_owner_did(), clear_owner_e2ee_data(), execute_sql()
[POS]: Persistence layer — single shared SQLite database for offline message storage,
       contact management, and resendable E2EE outbox tracking with explicit
       owner_did isolation for multi-identity local environments

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updating
"""

from __future__ import annotations

import json
import logging
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

from utils.config import SDKConfig

logger = logging.getLogger(__name__)

_SCHEMA_VERSION = 6

_V6_TABLES_SQL = """
    CREATE TABLE IF NOT EXISTS contacts (
        owner_did       TEXT NOT NULL DEFAULT '',
        did             TEXT NOT NULL,
        name            TEXT,
        handle          TEXT,
        nick_name       TEXT,
        bio             TEXT,
        profile_md      TEXT,
        tags            TEXT,
        relationship    TEXT,
        first_seen_at   TEXT,
        last_seen_at    TEXT,
        metadata        TEXT,
        PRIMARY KEY (owner_did, did)
    );

    CREATE TABLE IF NOT EXISTS messages (
        msg_id          TEXT NOT NULL,
        owner_did       TEXT NOT NULL DEFAULT '',
        thread_id       TEXT NOT NULL,
        direction       INTEGER NOT NULL DEFAULT 0,
        sender_did      TEXT,
        receiver_did    TEXT,
        group_id        TEXT,
        group_did       TEXT,
        content_type    TEXT DEFAULT 'text',
        content         TEXT,
        title           TEXT,
        server_seq      INTEGER,
        sent_at         TEXT,
        stored_at       TEXT NOT NULL,
        is_e2ee         INTEGER DEFAULT 0,
        is_read         INTEGER DEFAULT 0,
        sender_name     TEXT,
        metadata        TEXT,
        credential_name TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (msg_id, owner_did)
    );

    CREATE TABLE IF NOT EXISTS e2ee_outbox (
        outbox_id            TEXT PRIMARY KEY,
        owner_did            TEXT NOT NULL DEFAULT '',
        peer_did             TEXT NOT NULL,
        session_id           TEXT,
        original_type        TEXT NOT NULL DEFAULT 'text',
        plaintext            TEXT NOT NULL,
        local_status         TEXT NOT NULL DEFAULT 'queued',
        attempt_count        INTEGER NOT NULL DEFAULT 0,
        sent_msg_id          TEXT,
        sent_server_seq      INTEGER,
        last_error_code      TEXT,
        retry_hint           TEXT,
        failed_msg_id        TEXT,
        failed_server_seq    INTEGER,
        metadata             TEXT,
        last_attempt_at      TEXT,
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL,
        credential_name      TEXT NOT NULL DEFAULT ''
    );
"""

_V6_INDEX_STATEMENTS = {
    "idx_contacts_owner": """
        CREATE INDEX IF NOT EXISTS idx_contacts_owner
            ON contacts(owner_did, last_seen_at DESC)
    """,
    "idx_messages_owner_thread": """
        CREATE INDEX IF NOT EXISTS idx_messages_owner_thread
            ON messages(owner_did, thread_id, sent_at)
    """,
    "idx_messages_owner_direction": """
        CREATE INDEX IF NOT EXISTS idx_messages_owner_direction
            ON messages(owner_did, direction)
    """,
    "idx_messages_owner_sender": """
        CREATE INDEX IF NOT EXISTS idx_messages_owner_sender
            ON messages(owner_did, sender_did)
    """,
    "idx_messages_owner": """
        CREATE INDEX IF NOT EXISTS idx_messages_owner
            ON messages(owner_did)
    """,
    "idx_messages_credential": """
        CREATE INDEX IF NOT EXISTS idx_messages_credential
            ON messages(credential_name)
    """,
    "idx_e2ee_outbox_owner_status": """
        CREATE INDEX IF NOT EXISTS idx_e2ee_outbox_owner_status
            ON e2ee_outbox(owner_did, local_status, updated_at DESC)
    """,
    "idx_e2ee_outbox_owner_sent_msg": """
        CREATE INDEX IF NOT EXISTS idx_e2ee_outbox_owner_sent_msg
            ON e2ee_outbox(owner_did, sent_msg_id)
    """,
    "idx_e2ee_outbox_owner_sent_seq": """
        CREATE INDEX IF NOT EXISTS idx_e2ee_outbox_owner_sent_seq
            ON e2ee_outbox(owner_did, peer_did, sent_server_seq)
    """,
    "idx_e2ee_outbox_credential": """
        CREATE INDEX IF NOT EXISTS idx_e2ee_outbox_credential
            ON e2ee_outbox(credential_name)
    """,
}

_V6_VIEW_STATEMENTS = {
    "threads": """
        CREATE VIEW threads AS
        SELECT
            owner_did,
            thread_id,
            COUNT(*)                                        AS message_count,
            SUM(CASE WHEN is_read = 0 AND direction = 0
                     THEN 1 ELSE 0 END)                    AS unread_count,
            MAX(COALESCE(sent_at, stored_at))               AS last_message_at,
            (SELECT m2.content FROM messages m2
             WHERE m2.owner_did = m.owner_did
               AND m2.thread_id = m.thread_id
             ORDER BY COALESCE(m2.sent_at, m2.stored_at) DESC
             LIMIT 1)                                       AS last_content
        FROM messages m
        GROUP BY owner_did, thread_id
    """,
    "inbox": """
        CREATE VIEW inbox AS
        SELECT * FROM messages WHERE direction = 0
        ORDER BY owner_did, COALESCE(sent_at, stored_at) DESC
    """,
    "outbox": """
        CREATE VIEW outbox AS
        SELECT * FROM messages WHERE direction = 1
        ORDER BY owner_did, COALESCE(sent_at, stored_at) DESC
    """,
}

_FORBIDDEN_PATTERNS = [
    re.compile(r"\bDROP\b", re.IGNORECASE),
    re.compile(r"\bTRUNCATE\b", re.IGNORECASE),
]
_DELETE_NO_WHERE = re.compile(r"\bDELETE\s+FROM\s+\S+\s*$", re.IGNORECASE)


def get_connection() -> sqlite3.Connection:
    """Open (or create) the shared SQLite database."""
    config = SDKConfig()
    db_dir = config.data_dir / "database"
    db_dir.mkdir(parents=True, exist_ok=True)

    db_path = db_dir / "awiki.db"
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    logger.debug("Opened local SQLite database path=%s", db_path)
    return conn


def _table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    """Return whether a table exists."""
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def _normalize_credential_name(credential_name: str | None) -> str:
    """Normalize credential_name for local storage."""
    return credential_name or ""


def _normalize_owner_did(owner_did: str | None) -> str:
    """Normalize owner_did for local storage."""
    return owner_did or ""


def _schema_object_exists(
    conn: sqlite3.Connection,
    *,
    object_type: str,
    object_name: str,
) -> bool:
    """Return whether a schema object exists."""
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = ? AND name = ?",
        (object_type, object_name),
    ).fetchone()
    return row is not None


def _ensure_v6_indexes(conn: sqlite3.Connection) -> list[str]:
    """Create any missing v6 indexes and return the repaired index names."""
    repaired_indexes: list[str] = []
    for index_name, statement in _V6_INDEX_STATEMENTS.items():
        if _schema_object_exists(conn, object_type="index", object_name=index_name):
            continue
        conn.execute(statement)
        repaired_indexes.append(index_name)
    return repaired_indexes


def _recreate_v6_views(conn: sqlite3.Connection) -> None:
    """Recreate the canonical v6 views."""
    for view_name in _V6_VIEW_STATEMENTS:
        conn.execute(f"DROP VIEW IF EXISTS {view_name}")
    for statement in _V6_VIEW_STATEMENTS.values():
        conn.execute(statement)


def _ensure_v6_views(conn: sqlite3.Connection) -> list[str]:
    """Create any missing v6 views and return the repaired view names."""
    repaired_views: list[str] = []
    for view_name, statement in _V6_VIEW_STATEMENTS.items():
        if _schema_object_exists(conn, object_type="view", object_name=view_name):
            continue
        conn.execute(statement)
        repaired_views.append(view_name)
    return repaired_views


def _create_schema_v6(conn: sqlite3.Connection) -> None:
    """Create the owner_did-aware schema."""
    conn.executescript(_V6_TABLES_SQL)
    _ensure_v6_indexes(conn)
    _recreate_v6_views(conn)


def _load_credential_owner_dids() -> dict[str, str]:
    """Load a credential_name -> owner_did map from credential storage."""
    try:
        from credential_store import list_identities

        mapping: dict[str, str] = {}
        for identity in list_identities():
            credential_name = identity.get("credential_name")
            did = identity.get("did")
            if credential_name and did:
                mapping[str(credential_name)] = str(did)
        return mapping
    except Exception:
        logger.debug("Failed to load credential owner DID map", exc_info=True)
        return {}


def _extract_dm_owner_from_thread(thread_id: str, sender_did: str | None) -> str:
    """Infer owner_did from a DM thread ID and sender DID."""
    if not thread_id.startswith("dm:"):
        return ""
    parts = thread_id.split(":")
    if len(parts) < 3:
        return ""
    did_pair = [parts[-2], parts[-1]]
    if sender_did and sender_did in did_pair:
        did_pair.remove(sender_did)
        return did_pair[0] if did_pair else ""
    return ""


def _infer_owner_did_from_message_row(
    row: dict[str, Any],
    credential_owner_dids: dict[str, str],
) -> str:
    """Infer owner_did for a migrated legacy message row."""
    credential_name = _normalize_credential_name(row.get("credential_name"))
    if credential_name and credential_name in credential_owner_dids:
        return credential_owner_dids[credential_name]

    sender_did = str(row.get("sender_did") or "")
    receiver_did = str(row.get("receiver_did") or "")
    thread_id = str(row.get("thread_id") or "")
    direction = int(row.get("direction") or 0)

    if direction == 1 and sender_did:
        return sender_did
    if receiver_did:
        return receiver_did
    if thread_id.startswith("dm:"):
        return _extract_dm_owner_from_thread(thread_id, sender_did)
    return ""


def _infer_owner_did_from_outbox_row(
    row: dict[str, Any],
    credential_owner_dids: dict[str, str],
    conn: sqlite3.Connection,
) -> str:
    """Infer owner_did for a migrated legacy outbox row."""
    credential_name = _normalize_credential_name(row.get("credential_name"))
    if credential_name and credential_name in credential_owner_dids:
        return credential_owner_dids[credential_name]

    sent_msg_id = row.get("sent_msg_id")
    if sent_msg_id:
        migrated_msg = conn.execute(
            "SELECT owner_did FROM messages WHERE msg_id = ? AND owner_did != '' LIMIT 1",
            (sent_msg_id,),
        ).fetchone()
        if migrated_msg is not None:
            return str(migrated_msg["owner_did"])
    return ""


def _merge_metadata(metadata: str | None, extra: dict[str, Any]) -> str:
    """Merge extra metadata into a JSON metadata string."""
    payload: dict[str, Any] = {}
    if metadata:
        try:
            parsed = json.loads(metadata)
            if isinstance(parsed, dict):
                payload.update(parsed)
        except json.JSONDecodeError:
            payload["legacy_metadata_raw"] = metadata
    payload.update(extra)
    return json.dumps(payload, ensure_ascii=False)


def _infer_contact_owner_dids(
    conn: sqlite3.Connection,
    contact_did: str,
    known_owner_dids: set[str],
) -> tuple[list[str], bool]:
    """Infer owner DID(s) for a migrated legacy contact row."""
    owner_rows = conn.execute(
        """
        SELECT DISTINCT owner_did FROM messages
        WHERE owner_did != '' AND (sender_did = ? OR receiver_did = ?)
        UNION
        SELECT DISTINCT owner_did FROM e2ee_outbox
        WHERE owner_did != '' AND peer_did = ?
        """,
        (contact_did, contact_did, contact_did),
    ).fetchall()
    owner_dids = sorted(str(row["owner_did"]) for row in owner_rows if row["owner_did"])
    if owner_dids:
        return owner_dids, False
    if len(known_owner_dids) == 1:
        return sorted(known_owner_dids), False
    if known_owner_dids:
        return sorted(known_owner_dids), True
    return [""], True


def _migrate_existing_schema_to_v6(conn: sqlite3.Connection, version: int) -> None:
    """Migrate an existing database to schema v6."""
    logger.info("Migrating local schema from version=%d to version=%d", version, _SCHEMA_VERSION)

    conn.executescript(
        """
        DROP VIEW IF EXISTS threads;
        DROP VIEW IF EXISTS inbox;
        DROP VIEW IF EXISTS outbox;
        """
    )

    if _table_exists(conn, "messages"):
        conn.execute("ALTER TABLE messages RENAME TO messages_legacy")
    if _table_exists(conn, "e2ee_outbox"):
        conn.execute("ALTER TABLE e2ee_outbox RENAME TO e2ee_outbox_legacy")
    if _table_exists(conn, "contacts"):
        conn.execute("ALTER TABLE contacts RENAME TO contacts_legacy")

    _create_schema_v6(conn)
    credential_owner_dids = _load_credential_owner_dids()

    if _table_exists(conn, "messages_legacy"):
        rows = conn.execute("SELECT * FROM messages_legacy").fetchall()
        for row in rows:
            data = dict(row)
            owner_did = _infer_owner_did_from_message_row(data, credential_owner_dids)
            conn.execute(
                """INSERT OR IGNORE INTO messages
                   (msg_id, owner_did, thread_id, direction, sender_did, receiver_did,
                    group_id, group_did, content_type, content, title, server_seq, sent_at,
                    stored_at, is_e2ee, is_read, sender_name, metadata, credential_name)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    data.get("msg_id", ""),
                    owner_did,
                    data.get("thread_id", ""),
                    data.get("direction", 0),
                    data.get("sender_did"),
                    data.get("receiver_did"),
                    data.get("group_id"),
                    data.get("group_did"),
                    data.get("content_type", "text"),
                    data.get("content", ""),
                    data.get("title"),
                    data.get("server_seq"),
                    data.get("sent_at"),
                    data.get("stored_at") or datetime.now(timezone.utc).isoformat(),
                    int(data.get("is_e2ee", 0)),
                    int(data.get("is_read", 0)),
                    data.get("sender_name"),
                    data.get("metadata"),
                    _normalize_credential_name(data.get("credential_name")),
                ),
            )
        conn.execute("DROP TABLE messages_legacy")

    if _table_exists(conn, "e2ee_outbox_legacy"):
        rows = conn.execute("SELECT * FROM e2ee_outbox_legacy").fetchall()
        for row in rows:
            data = dict(row)
            owner_did = _infer_owner_did_from_outbox_row(data, credential_owner_dids, conn)
            conn.execute(
                """INSERT OR REPLACE INTO e2ee_outbox
                   (outbox_id, owner_did, peer_did, session_id, original_type, plaintext,
                    local_status, attempt_count, sent_msg_id, sent_server_seq, last_error_code,
                    retry_hint, failed_msg_id, failed_server_seq, metadata, last_attempt_at,
                    created_at, updated_at, credential_name)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    data.get("outbox_id", str(uuid.uuid4())),
                    owner_did,
                    data.get("peer_did", ""),
                    data.get("session_id"),
                    data.get("original_type", "text"),
                    data.get("plaintext", ""),
                    data.get("local_status", "queued"),
                    int(data.get("attempt_count", 0)),
                    data.get("sent_msg_id"),
                    data.get("sent_server_seq"),
                    data.get("last_error_code"),
                    data.get("retry_hint"),
                    data.get("failed_msg_id"),
                    data.get("failed_server_seq"),
                    data.get("metadata"),
                    data.get("last_attempt_at"),
                    data.get("created_at") or datetime.now(timezone.utc).isoformat(),
                    data.get("updated_at") or datetime.now(timezone.utc).isoformat(),
                    _normalize_credential_name(data.get("credential_name")),
                ),
            )
        conn.execute("DROP TABLE e2ee_outbox_legacy")

    if _table_exists(conn, "contacts_legacy"):
        known_owner_dids = {did for did in credential_owner_dids.values() if did}
        rows = conn.execute("SELECT * FROM contacts_legacy").fetchall()
        for row in rows:
            data = dict(row)
            contact_did = str(data.get("did") or "")
            if not contact_did:
                continue
            owner_dids, ambiguous_owner = _infer_contact_owner_dids(
                conn,
                contact_did,
                known_owner_dids,
            )
            metadata = data.get("metadata")
            if ambiguous_owner:
                metadata = _merge_metadata(
                    metadata,
                    {"migration_note": "legacy_contact_owner_ambiguous"},
                )
            for owner_did in owner_dids:
                conn.execute(
                    """INSERT OR REPLACE INTO contacts
                       (owner_did, did, name, handle, nick_name, bio, profile_md, tags,
                        relationship, first_seen_at, last_seen_at, metadata)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        owner_did,
                        contact_did,
                        data.get("name"),
                        data.get("handle"),
                        data.get("nick_name"),
                        data.get("bio"),
                        data.get("profile_md"),
                        data.get("tags"),
                        data.get("relationship"),
                        data.get("first_seen_at"),
                        data.get("last_seen_at"),
                        metadata,
                    ),
                )
        conn.execute("DROP TABLE contacts_legacy")


def ensure_schema(conn: sqlite3.Connection) -> None:
    """Create tables, views, and indexes if they don't exist."""
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    if version >= _SCHEMA_VERSION:
        conn.executescript(_V6_TABLES_SQL)
        repaired_indexes = _ensure_v6_indexes(conn)
        repaired_views = _ensure_v6_views(conn)
        if repaired_indexes or repaired_views:
            conn.commit()
            logger.warning(
                "Repaired local schema objects version=%d indexes=%s views=%s",
                version,
                repaired_indexes,
                repaired_views,
            )
        else:
            logger.debug("Local schema already up to date version=%d", version)
        return

    if version == 0:
        _create_schema_v6(conn)
    else:
        _migrate_existing_schema_to_v6(conn, version)

    conn.execute(f"PRAGMA user_version = {_SCHEMA_VERSION}")
    conn.commit()
    logger.info("Local schema migration complete version=%d", _SCHEMA_VERSION)


def make_thread_id(
    my_did: str,
    *,
    peer_did: str | None = None,
    group_id: str | None = None,
) -> str:
    """Generate a deterministic thread ID."""
    if group_id:
        return f"group:{group_id}"
    if peer_did:
        pair = sorted([my_did, peer_did])
        return f"dm:{pair[0]}:{pair[1]}"
    return f"dm:{my_did}:unknown"


def store_message(
    conn: sqlite3.Connection,
    *,
    msg_id: str,
    thread_id: str,
    direction: int,
    sender_did: str,
    content: str,
    owner_did: str | None = None,
    receiver_did: str | None = None,
    group_id: str | None = None,
    group_did: str | None = None,
    content_type: str = "text",
    server_seq: int | None = None,
    sent_at: str | None = None,
    is_e2ee: bool = False,
    is_read: bool = False,
    sender_name: str | None = None,
    metadata: str | None = None,
    credential_name: str | None = None,
    title: str | None = None,
) -> None:
    """Store a single message. Duplicates are ignored per (msg_id, owner_did)."""
    now = datetime.now(timezone.utc).isoformat()
    normalized_owner_did = _normalize_owner_did(owner_did)
    normalized_credential_name = _normalize_credential_name(credential_name)
    conn.execute(
        """INSERT OR IGNORE INTO messages
           (msg_id, owner_did, thread_id, direction, sender_did, receiver_did,
            group_id, group_did, content_type, content, title, server_seq,
            sent_at, stored_at, is_e2ee, is_read, sender_name, metadata,
            credential_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            msg_id,
            normalized_owner_did,
            thread_id,
            direction,
            sender_did,
            receiver_did,
            group_id,
            group_did,
            content_type,
            content,
            title,
            server_seq,
            sent_at,
            now,
            int(is_e2ee),
            int(is_read),
            sender_name,
            metadata,
            normalized_credential_name,
        ),
    )
    conn.commit()
    logger.debug(
        "Stored message msg_id=%s owner_did=%s credential=%s direction=%d thread_id=%s",
        msg_id,
        normalized_owner_did,
        normalized_credential_name,
        direction,
        thread_id,
    )


def store_messages_batch(
    conn: sqlite3.Connection,
    batch: list[dict],
    owner_did: str | None = None,
    credential_name: str | None = None,
) -> None:
    """Store multiple messages in a single transaction."""
    if not batch:
        return

    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for msg in batch:
        rows.append((
            msg.get("msg_id", ""),
            _normalize_owner_did(msg.get("owner_did", owner_did)),
            msg.get("thread_id", ""),
            msg.get("direction", 0),
            msg.get("sender_did"),
            msg.get("receiver_did"),
            msg.get("group_id"),
            msg.get("group_did"),
            msg.get("content_type", "text"),
            msg.get("content", ""),
            msg.get("title"),
            msg.get("server_seq"),
            msg.get("sent_at"),
            now,
            int(msg.get("is_e2ee", False)),
            int(msg.get("is_read", False)),
            msg.get("sender_name"),
            msg.get("metadata"),
            _normalize_credential_name(msg.get("credential_name", credential_name)),
        ))

    conn.executemany(
        """INSERT OR IGNORE INTO messages
           (msg_id, owner_did, thread_id, direction, sender_did, receiver_did,
            group_id, group_did, content_type, content, title, server_seq,
            sent_at, stored_at, is_e2ee, is_read, sender_name, metadata,
            credential_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        rows,
    )
    conn.commit()
    logger.debug(
        "Stored message batch count=%d owner_did=%s credential=%s",
        len(rows),
        _normalize_owner_did(owner_did),
        _normalize_credential_name(credential_name),
    )


def queue_e2ee_outbox(
    conn: sqlite3.Connection,
    *,
    owner_did: str | None = None,
    peer_did: str,
    plaintext: str,
    session_id: str | None = None,
    original_type: str = "text",
    credential_name: str | None = None,
    metadata: str | None = None,
) -> str:
    """Create or replace a local E2EE outbox record and return its ID."""
    now = datetime.now(timezone.utc).isoformat()
    outbox_id = str(uuid.uuid4())
    conn.execute(
        """INSERT INTO e2ee_outbox
           (outbox_id, owner_did, peer_did, session_id, original_type, plaintext, local_status,
            attempt_count, metadata, last_attempt_at, created_at, updated_at, credential_name)
           VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?)""",
        (
            outbox_id,
            _normalize_owner_did(owner_did),
            peer_did,
            session_id,
            original_type,
            plaintext,
            metadata,
            now,
            now,
            now,
            _normalize_credential_name(credential_name),
        ),
    )
    conn.commit()
    return outbox_id


def mark_e2ee_outbox_sent(
    conn: sqlite3.Connection,
    *,
    outbox_id: str,
    owner_did: str | None = None,
    credential_name: str | None = None,
    session_id: str | None = None,
    sent_msg_id: str | None = None,
    sent_server_seq: int | None = None,
    metadata: str | None = None,
) -> None:
    """Mark an outbox record as successfully sent."""
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """UPDATE e2ee_outbox
           SET session_id = COALESCE(?, session_id),
               local_status = 'sent',
               attempt_count = attempt_count + 1,
               sent_msg_id = COALESCE(?, sent_msg_id),
               sent_server_seq = COALESCE(?, sent_server_seq),
               metadata = COALESCE(?, metadata),
               last_attempt_at = ?,
               updated_at = ?,
               last_error_code = NULL,
               retry_hint = NULL,
               failed_msg_id = NULL,
               failed_server_seq = NULL
           WHERE outbox_id = ? AND owner_did = ?""",
        (
            session_id,
            sent_msg_id,
            sent_server_seq,
            metadata,
            now,
            now,
            outbox_id,
            _normalize_owner_did(owner_did),
        ),
    )
    conn.commit()


def mark_e2ee_outbox_failed(
    conn: sqlite3.Connection,
    *,
    owner_did: str | None = None,
    credential_name: str | None = None,
    error_code: str,
    retry_hint: str | None = None,
    peer_did: str | None = None,
    session_id: str | None = None,
    failed_msg_id: str | None = None,
    failed_server_seq: int | None = None,
    metadata: str | None = None,
) -> str | None:
    """Mark the best matching E2EE outbox record as failed and return its ID."""
    normalized_owner_did = _normalize_owner_did(owner_did)

    row = None
    if failed_msg_id:
        row = conn.execute(
            """SELECT outbox_id FROM e2ee_outbox
               WHERE owner_did = ? AND sent_msg_id = ?
               ORDER BY updated_at DESC LIMIT 1""",
            (normalized_owner_did, failed_msg_id),
        ).fetchone()
    if row is None and failed_server_seq is not None and peer_did:
        row = conn.execute(
            """SELECT outbox_id FROM e2ee_outbox
               WHERE owner_did = ? AND peer_did = ? AND sent_server_seq = ?
               ORDER BY updated_at DESC LIMIT 1""",
            (normalized_owner_did, peer_did, failed_server_seq),
        ).fetchone()
    if row is None and session_id and peer_did:
        row = conn.execute(
            """SELECT outbox_id FROM e2ee_outbox
               WHERE owner_did = ? AND peer_did = ? AND session_id = ?
               ORDER BY updated_at DESC LIMIT 1""",
            (normalized_owner_did, peer_did, session_id),
        ).fetchone()
    if row is None and credential_name:
        normalized_credential_name = _normalize_credential_name(credential_name)
        if failed_msg_id:
            row = conn.execute(
                """SELECT outbox_id FROM e2ee_outbox
                   WHERE credential_name = ? AND sent_msg_id = ?
                   ORDER BY updated_at DESC LIMIT 1""",
                (normalized_credential_name, failed_msg_id),
            ).fetchone()
        if row is None and failed_server_seq is not None and peer_did:
            row = conn.execute(
                """SELECT outbox_id FROM e2ee_outbox
                   WHERE credential_name = ? AND peer_did = ? AND sent_server_seq = ?
                   ORDER BY updated_at DESC LIMIT 1""",
                (normalized_credential_name, peer_did, failed_server_seq),
            ).fetchone()
    if row is None:
        return None

    now = datetime.now(timezone.utc).isoformat()
    outbox_id = row["outbox_id"]
    conn.execute(
        """UPDATE e2ee_outbox
           SET local_status = 'failed',
               last_error_code = ?,
               retry_hint = COALESCE(?, retry_hint),
               failed_msg_id = COALESCE(?, failed_msg_id),
               failed_server_seq = COALESCE(?, failed_server_seq),
               metadata = COALESCE(?, metadata),
               updated_at = ?
           WHERE outbox_id = ?""",
        (
            error_code,
            retry_hint,
            failed_msg_id,
            failed_server_seq,
            metadata,
            now,
            outbox_id,
        ),
    )
    conn.commit()
    return outbox_id


def update_e2ee_outbox_status(
    conn: sqlite3.Connection,
    *,
    outbox_id: str,
    local_status: str,
    owner_did: str | None = None,
    credential_name: str | None = None,
) -> None:
    """Update an outbox record status without modifying send metadata."""
    now = datetime.now(timezone.utc).isoformat()
    if owner_did is not None:
        conn.execute(
            """UPDATE e2ee_outbox
               SET local_status = ?, updated_at = ?
               WHERE outbox_id = ? AND owner_did = ?""",
            (
                local_status,
                now,
                outbox_id,
                _normalize_owner_did(owner_did),
            ),
        )
    else:
        conn.execute(
            """UPDATE e2ee_outbox
               SET local_status = ?, updated_at = ?
               WHERE outbox_id = ? AND credential_name = ?""",
            (
                local_status,
                now,
                outbox_id,
                _normalize_credential_name(credential_name),
            ),
        )
    conn.commit()


def set_e2ee_outbox_failure_by_id(
    conn: sqlite3.Connection,
    *,
    outbox_id: str,
    owner_did: str | None = None,
    credential_name: str | None = None,
    error_code: str,
    retry_hint: str | None = None,
    metadata: str | None = None,
) -> None:
    """Mark one E2EE outbox record as failed by its outbox_id."""
    now = datetime.now(timezone.utc).isoformat()
    if owner_did is not None:
        conn.execute(
            """UPDATE e2ee_outbox
               SET local_status = 'failed',
                   last_error_code = ?,
                   retry_hint = COALESCE(?, retry_hint),
                   metadata = COALESCE(?, metadata),
                   updated_at = ?
               WHERE outbox_id = ? AND owner_did = ?""",
            (
                error_code,
                retry_hint,
                metadata,
                now,
                outbox_id,
                _normalize_owner_did(owner_did),
            ),
        )
    else:
        conn.execute(
            """UPDATE e2ee_outbox
               SET local_status = 'failed',
                   last_error_code = ?,
                   retry_hint = COALESCE(?, retry_hint),
                   metadata = COALESCE(?, metadata),
                   updated_at = ?
               WHERE outbox_id = ? AND credential_name = ?""",
            (
                error_code,
                retry_hint,
                metadata,
                now,
                outbox_id,
                _normalize_credential_name(credential_name),
            ),
        )
    conn.commit()


def get_e2ee_outbox(
    conn: sqlite3.Connection,
    *,
    outbox_id: str,
    owner_did: str | None = None,
    credential_name: str | None = None,
) -> dict[str, Any] | None:
    """Fetch one E2EE outbox record by ID."""
    if owner_did is not None:
        row = conn.execute(
            """SELECT * FROM e2ee_outbox
               WHERE outbox_id = ? AND owner_did = ?""",
            (outbox_id, _normalize_owner_did(owner_did)),
        ).fetchone()
    else:
        row = conn.execute(
            """SELECT * FROM e2ee_outbox
               WHERE outbox_id = ? AND credential_name = ?""",
            (outbox_id, _normalize_credential_name(credential_name)),
        ).fetchone()
    return dict(row) if row is not None else None


def list_e2ee_outbox(
    conn: sqlite3.Connection,
    *,
    owner_did: str | None = None,
    credential_name: str | None = None,
    local_status: str | None = None,
) -> list[dict[str, Any]]:
    """List E2EE outbox records, optionally filtered by status."""
    if owner_did is not None:
        if local_status is None:
            rows = conn.execute(
                """SELECT * FROM e2ee_outbox
                   WHERE owner_did = ?
                   ORDER BY updated_at DESC""",
                (_normalize_owner_did(owner_did),),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT * FROM e2ee_outbox
                   WHERE owner_did = ? AND local_status = ?
                   ORDER BY updated_at DESC""",
                (_normalize_owner_did(owner_did), local_status),
            ).fetchall()
    else:
        normalized_credential_name = _normalize_credential_name(credential_name)
        if local_status is None:
            rows = conn.execute(
                """SELECT * FROM e2ee_outbox
                   WHERE credential_name = ?
                   ORDER BY updated_at DESC""",
                (normalized_credential_name,),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT * FROM e2ee_outbox
                   WHERE credential_name = ? AND local_status = ?
                   ORDER BY updated_at DESC""",
                (normalized_credential_name, local_status),
            ).fetchall()
    return [dict(row) for row in rows]


def get_message_by_id(
    conn: sqlite3.Connection,
    *,
    msg_id: str,
    owner_did: str | None = None,
    credential_name: str | None = None,
) -> dict[str, Any] | None:
    """Fetch one locally stored message by message ID."""
    if owner_did is not None:
        row = conn.execute(
            """SELECT * FROM messages
               WHERE msg_id = ? AND owner_did = ?""",
            (msg_id, _normalize_owner_did(owner_did)),
        ).fetchone()
    else:
        row = conn.execute(
            """SELECT * FROM messages
               WHERE msg_id = ? AND credential_name = ?""",
            (msg_id, _normalize_credential_name(credential_name)),
        ).fetchone()
    return dict(row) if row is not None else None


def upsert_contact(
    conn: sqlite3.Connection,
    *,
    owner_did: str | None = None,
    did: str,
    **fields: Any,
) -> None:
    """Insert or update a contact record scoped to one local DID owner."""
    now = datetime.now(timezone.utc).isoformat()
    normalized_owner_did = _normalize_owner_did(owner_did)

    existing = conn.execute(
        "SELECT did FROM contacts WHERE owner_did = ? AND did = ?",
        (normalized_owner_did, did),
    ).fetchone()

    allowed_fields = {
        "name", "handle", "nick_name", "bio", "profile_md",
        "tags", "relationship", "first_seen_at", "last_seen_at", "metadata",
    }
    filtered = {k: v for k, v in fields.items() if k in allowed_fields and v is not None}

    if existing:
        if filtered:
            filtered["last_seen_at"] = now
            set_clause = ", ".join(f"{k} = ?" for k in filtered)
            values = list(filtered.values()) + [normalized_owner_did, did]
            conn.execute(
                f"UPDATE contacts SET {set_clause} WHERE owner_did = ? AND did = ?",
                values,
            )
    else:
        filtered.setdefault("first_seen_at", now)
        filtered.setdefault("last_seen_at", now)
        filtered["owner_did"] = normalized_owner_did
        filtered["did"] = did
        columns = ", ".join(filtered.keys())
        placeholders = ", ".join("?" for _ in filtered)
        conn.execute(
            f"INSERT INTO contacts ({columns}) VALUES ({placeholders})",
            list(filtered.values()),
        )

    conn.commit()


def rebind_owner_did(
    conn: sqlite3.Connection,
    *,
    old_owner_did: str,
    new_owner_did: str,
) -> dict[str, int]:
    """Move messages and contacts from one owner DID to another."""
    normalized_old_owner_did = _normalize_owner_did(old_owner_did)
    normalized_new_owner_did = _normalize_owner_did(new_owner_did)

    if (
        not normalized_old_owner_did
        or not normalized_new_owner_did
        or normalized_old_owner_did == normalized_new_owner_did
    ):
        return {"messages": 0, "contacts": 0}

    moved_message_count = conn.execute(
        "SELECT COUNT(*) FROM messages WHERE owner_did = ?",
        (normalized_old_owner_did,),
    ).fetchone()[0]
    moved_contact_count = conn.execute(
        "SELECT COUNT(*) FROM contacts WHERE owner_did = ?",
        (normalized_old_owner_did,),
    ).fetchone()[0]

    conn.execute(
        """
        INSERT OR IGNORE INTO messages
        (msg_id, owner_did, thread_id, direction, sender_did, receiver_did, group_id,
         group_did, content_type, content, title, server_seq, sent_at, stored_at, is_e2ee,
         is_read, sender_name, metadata, credential_name)
        SELECT msg_id, ?, thread_id, direction, sender_did, receiver_did, group_id,
               group_did, content_type, content, title, server_seq, sent_at, stored_at, is_e2ee,
               is_read, sender_name, metadata, credential_name
        FROM messages
        WHERE owner_did = ?
        """,
        (normalized_new_owner_did, normalized_old_owner_did),
    )
    conn.execute(
        "DELETE FROM messages WHERE owner_did = ?",
        (normalized_old_owner_did,),
    )

    conn.execute(
        """
        INSERT OR REPLACE INTO contacts
        (owner_did, did, name, handle, nick_name, bio, profile_md, tags,
         relationship, first_seen_at, last_seen_at, metadata)
        SELECT ?, did, name, handle, nick_name, bio, profile_md, tags,
               relationship, first_seen_at, last_seen_at, metadata
        FROM contacts
        WHERE owner_did = ?
        """,
        (normalized_new_owner_did, normalized_old_owner_did),
    )
    conn.execute(
        "DELETE FROM contacts WHERE owner_did = ?",
        (normalized_old_owner_did,),
    )

    conn.commit()
    return {"messages": moved_message_count, "contacts": moved_contact_count}


def clear_owner_e2ee_data(
    conn: sqlite3.Connection,
    *,
    owner_did: str,
    credential_name: str | None = None,
) -> dict[str, int]:
    """Delete owner-scoped E2EE outbox data after a DID recovery/reset."""
    normalized_owner_did = _normalize_owner_did(owner_did)
    if not normalized_owner_did:
        return {"e2ee_outbox": 0}

    row_count = conn.execute(
        "SELECT COUNT(*) FROM e2ee_outbox WHERE owner_did = ?",
        (normalized_owner_did,),
    ).fetchone()[0]
    conn.execute(
        "DELETE FROM e2ee_outbox WHERE owner_did = ?",
        (normalized_owner_did,),
    )
    conn.commit()
    return {"e2ee_outbox": row_count}


def execute_sql(
    conn: sqlite3.Connection,
    sql: str,
    params: tuple = (),
) -> list[dict[str, Any]]:
    """Execute a SQL statement with safety checks."""
    stripped = sql.strip().rstrip(";")

    if ";" in stripped:
        raise ValueError("Multiple statements are not allowed")

    for pattern in _FORBIDDEN_PATTERNS:
        if pattern.search(stripped):
            raise ValueError(f"Forbidden SQL operation: {pattern.pattern}")

    if re.match(r"\s*DELETE\b", stripped, re.IGNORECASE):
        if not re.search(r"\bWHERE\b", stripped, re.IGNORECASE):
            raise ValueError("DELETE without WHERE clause is not allowed")

    cursor = conn.execute(stripped, params)

    if stripped.upper().lstrip().startswith("SELECT"):
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        return [dict(zip(columns, row)) for row in cursor.fetchall()]

    conn.commit()
    return [{"rows_affected": cursor.rowcount}]


__all__ = [
    "ensure_schema",
    "execute_sql",
    "get_connection",
    "get_e2ee_outbox",
    "get_message_by_id",
    "list_e2ee_outbox",
    "make_thread_id",
    "mark_e2ee_outbox_failed",
    "mark_e2ee_outbox_sent",
    "queue_e2ee_outbox",
    "rebind_owner_did",
    "clear_owner_e2ee_data",
    "set_e2ee_outbox_failure_by_id",
    "store_message",
    "store_messages_batch",
    "update_e2ee_outbox_status",
    "upsert_contact",
]
