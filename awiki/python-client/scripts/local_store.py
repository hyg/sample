"""SQLite local storage for messages, contacts, and E2EE outbox state.

[INPUT]: SDKConfig (data_dir for database path)
[OUTPUT]: get_connection(), ensure_schema(), store_message(), store_messages_batch(),
         queue_e2ee_outbox(), mark_e2ee_outbox_sent(), mark_e2ee_outbox_failed(),
         list_e2ee_outbox(), get_e2ee_outbox(), get_message_by_id(), make_thread_id(),
         upsert_contact(), execute_sql()
[POS]: Persistence layer — single shared SQLite database for offline message storage,
       contact management, and resendable E2EE outbox tracking with per-credential ownership

[PROTOCOL]:
1. Update this header when logic changes
2. Check the folder's CLAUDE.md after updating
"""

from __future__ import annotations

import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from utils.config import SDKConfig

# Current schema version (bump when schema changes)
_SCHEMA_VERSION = 4

# SQL patterns that are always forbidden
_FORBIDDEN_PATTERNS = [
    re.compile(r"\bDROP\b", re.IGNORECASE),
    re.compile(r"\bTRUNCATE\b", re.IGNORECASE),
]

# DELETE without WHERE is forbidden
_DELETE_NO_WHERE = re.compile(
    r"\bDELETE\s+FROM\s+\S+\s*$", re.IGNORECASE,
)


def get_connection() -> sqlite3.Connection:
    """Open (or create) the shared SQLite database.

    Path: <DATA_DIR>/database/awiki.db
    Uses WAL mode for concurrent read/write.

    Returns:
        sqlite3.Connection with check_same_thread=False.
    """
    config = SDKConfig()
    db_dir = config.data_dir / "database"
    db_dir.mkdir(parents=True, exist_ok=True)

    db_path = db_dir / "awiki.db"
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


def ensure_schema(conn: sqlite3.Connection) -> None:
    """Create tables, views, and indexes if they don't exist.

    Idempotent — safe to call on every connection open.
    Handles migration from schema v1/v2 to per-credential message ownership.
    """
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    if version >= _SCHEMA_VERSION:
        return

    conn.executescript("""
        CREATE TABLE IF NOT EXISTS contacts (
            did             TEXT PRIMARY KEY,
            name            TEXT,
            handle          TEXT,
            nick_name       TEXT,
            bio             TEXT,
            profile_md      TEXT,
            tags            TEXT,
            relationship    TEXT,
            first_seen_at   TEXT,
            last_seen_at    TEXT,
            metadata        TEXT
        );

        CREATE TABLE IF NOT EXISTS messages (
            msg_id          TEXT NOT NULL,
            thread_id       TEXT NOT NULL,
            direction       INTEGER NOT NULL DEFAULT 0,
            sender_did      TEXT,
            receiver_did    TEXT,
            group_id        TEXT,
            group_did       TEXT,
            content_type    TEXT DEFAULT 'text',
            content         TEXT,
            server_seq      INTEGER,
            sent_at         TEXT,
            stored_at       TEXT NOT NULL,
            is_e2ee         INTEGER DEFAULT 0,
            is_read         INTEGER DEFAULT 0,
            sender_name     TEXT,
            metadata        TEXT,
            credential_name TEXT NOT NULL DEFAULT '',
            PRIMARY KEY (msg_id, credential_name)
        );

        CREATE TABLE IF NOT EXISTS e2ee_outbox (
            outbox_id            TEXT PRIMARY KEY,
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

        CREATE INDEX IF NOT EXISTS idx_messages_thread
            ON messages(thread_id, sent_at);
        CREATE INDEX IF NOT EXISTS idx_messages_direction
            ON messages(direction);
        CREATE INDEX IF NOT EXISTS idx_messages_sender
            ON messages(sender_did);
        CREATE INDEX IF NOT EXISTS idx_messages_credential
            ON messages(credential_name);
        CREATE INDEX IF NOT EXISTS idx_e2ee_outbox_status
            ON e2ee_outbox(credential_name, local_status, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_e2ee_outbox_sent_msg
            ON e2ee_outbox(credential_name, sent_msg_id);
        CREATE INDEX IF NOT EXISTS idx_e2ee_outbox_sent_seq
            ON e2ee_outbox(credential_name, peer_did, sent_server_seq);
    """)

    # Migration to v3: rebuild messages table so msg_id is deduplicated per credential.
    if version in (1, 2):
        columns = {
            row[1]
            for row in conn.execute("PRAGMA table_info(messages)").fetchall()
        }
        if "credential_name" not in columns:
            conn.execute(
                "ALTER TABLE messages ADD COLUMN credential_name TEXT"
            )

        conn.executescript("""
            DROP VIEW IF EXISTS threads;
            DROP VIEW IF EXISTS inbox;
            DROP VIEW IF EXISTS outbox;

            CREATE TABLE IF NOT EXISTS messages_v3 (
                msg_id          TEXT NOT NULL,
                thread_id       TEXT NOT NULL,
                direction       INTEGER NOT NULL DEFAULT 0,
                sender_did      TEXT,
                receiver_did    TEXT,
                group_id        TEXT,
                group_did       TEXT,
                content_type    TEXT DEFAULT 'text',
                content         TEXT,
                server_seq      INTEGER,
                sent_at         TEXT,
                stored_at       TEXT NOT NULL,
                is_e2ee         INTEGER DEFAULT 0,
                is_read         INTEGER DEFAULT 0,
                sender_name     TEXT,
                metadata        TEXT,
                credential_name TEXT NOT NULL DEFAULT '',
                PRIMARY KEY (msg_id, credential_name)
            );

            INSERT OR IGNORE INTO messages_v3 (
                msg_id, thread_id, direction, sender_did, receiver_did,
                group_id, group_did, content_type, content, server_seq,
                sent_at, stored_at, is_e2ee, is_read, sender_name, metadata,
                credential_name
            )
            SELECT
                msg_id, thread_id, direction, sender_did, receiver_did,
                group_id, group_did, content_type, content, server_seq,
                sent_at, stored_at, is_e2ee, is_read, sender_name, metadata,
                COALESCE(credential_name, '')
            FROM messages;

            DROP TABLE messages;
            ALTER TABLE messages_v3 RENAME TO messages;

            CREATE INDEX IF NOT EXISTS idx_messages_thread
                ON messages(thread_id, sent_at);
            CREATE INDEX IF NOT EXISTS idx_messages_direction
                ON messages(direction);
            CREATE INDEX IF NOT EXISTS idx_messages_sender
                ON messages(sender_did);
            CREATE INDEX IF NOT EXISTS idx_messages_credential
                ON messages(credential_name);
        """)

    # Views (DROP + CREATE to allow schema evolution)
    conn.executescript("""
        DROP VIEW IF EXISTS threads;
        CREATE VIEW threads AS
        SELECT
            thread_id,
            COUNT(*)                                        AS message_count,
            SUM(CASE WHEN is_read = 0 AND direction = 0
                     THEN 1 ELSE 0 END)                    AS unread_count,
            MAX(COALESCE(sent_at, stored_at))               AS last_message_at,
            (SELECT m2.content FROM messages m2
             WHERE m2.thread_id = m.thread_id
             ORDER BY COALESCE(m2.sent_at, m2.stored_at) DESC
             LIMIT 1)                                       AS last_content
        FROM messages m
        GROUP BY thread_id;

        DROP VIEW IF EXISTS inbox;
        CREATE VIEW inbox AS
        SELECT * FROM messages WHERE direction = 0
        ORDER BY COALESCE(sent_at, stored_at) DESC;

        DROP VIEW IF EXISTS outbox;
        CREATE VIEW outbox AS
        SELECT * FROM messages WHERE direction = 1
        ORDER BY COALESCE(sent_at, stored_at) DESC;
    """)

    conn.execute(f"PRAGMA user_version = {_SCHEMA_VERSION}")
    conn.commit()


def _normalize_credential_name(credential_name: str | None) -> str:
    """Normalize credential_name for composite primary-key storage."""
    return credential_name or ""


def make_thread_id(
    my_did: str,
    *,
    peer_did: str | None = None,
    group_id: str | None = None,
) -> str:
    """Generate a deterministic thread ID.

    - Private chat: dm:{min_did}:{max_did} (sorted for symmetry)
    - Group chat: group:{group_id}

    Args:
        my_did: Current user's DID.
        peer_did: Peer's DID (for private chats).
        group_id: Group ID (for group chats).

    Returns:
        Thread identifier string.
    """
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
) -> None:
    """Store a single message. Duplicates are ignored per (msg_id, credential_name).

    Args:
        conn: SQLite connection.
        msg_id: Unique message identifier within a credential owner.
        thread_id: Thread identifier (from make_thread_id).
        direction: 0 = incoming, 1 = outgoing.
        sender_did: Sender's DID.
        content: Message content text.
        receiver_did: Receiver's DID (optional).
        group_id: Group ID (optional).
        group_did: Group DID (optional).
        content_type: Content type (default: "text").
        server_seq: Server sequence number (optional).
        sent_at: Server-side send timestamp (optional).
        is_e2ee: Whether this message was E2EE encrypted.
        is_read: Whether this message has been read.
        sender_name: Display name of sender (optional).
        metadata: JSON metadata string (optional).
        credential_name: Credential name that owns this message. None is stored
            as an empty owner key for backward compatibility.
    """
    now = datetime.now(timezone.utc).isoformat()
    normalized_credential_name = _normalize_credential_name(credential_name)
    conn.execute(
        """INSERT OR IGNORE INTO messages
           (msg_id, thread_id, direction, sender_did, receiver_did,
            group_id, group_did, content_type, content, server_seq,
            sent_at, stored_at, is_e2ee, is_read, sender_name, metadata,
            credential_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            msg_id, thread_id, direction, sender_did, receiver_did,
            group_id, group_did, content_type, content, server_seq,
            sent_at, now, int(is_e2ee), int(is_read), sender_name, metadata,
            normalized_credential_name,
        ),
    )
    conn.commit()


def store_messages_batch(
    conn: sqlite3.Connection,
    batch: list[dict],
    credential_name: str | None = None,
) -> None:
    """Store multiple messages in a single transaction.

    Each dict in batch should contain the same keyword arguments as store_message().
    Duplicates are silently ignored.

    Args:
        conn: SQLite connection.
        batch: List of message dicts.
        credential_name: Default credential name applied to all messages in batch
            (individual messages can override via "credential_name" key).
    """
    if not batch:
        return

    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for msg in batch:
        rows.append((
            msg.get("msg_id", ""),
            msg.get("thread_id", ""),
            msg.get("direction", 0),
            msg.get("sender_did"),
            msg.get("receiver_did"),
            msg.get("group_id"),
            msg.get("group_did"),
            msg.get("content_type", "text"),
            msg.get("content", ""),
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
           (msg_id, thread_id, direction, sender_did, receiver_did,
            group_id, group_did, content_type, content, server_seq,
            sent_at, stored_at, is_e2ee, is_read, sender_name, metadata,
            credential_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        rows,
    )
    conn.commit()


def queue_e2ee_outbox(
    conn: sqlite3.Connection,
    *,
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
           (outbox_id, peer_did, session_id, original_type, plaintext, local_status,
            attempt_count, metadata, last_attempt_at, created_at, updated_at, credential_name)
           VALUES (?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?)""",
        (
            outbox_id,
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
    credential_name: str | None = None,
    session_id: str | None = None,
    sent_msg_id: str | None = None,
    sent_server_seq: int | None = None,
    metadata: str | None = None,
) -> None:
    """Mark an outbox record as successfully sent."""
    now = datetime.now(timezone.utc).isoformat()
    normalized_credential_name = _normalize_credential_name(credential_name)
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
           WHERE outbox_id = ? AND credential_name = ?""",
        (
            session_id,
            sent_msg_id,
            sent_server_seq,
            metadata,
            now,
            now,
            outbox_id,
            normalized_credential_name,
        ),
    )
    conn.commit()


def mark_e2ee_outbox_failed(
    conn: sqlite3.Connection,
    *,
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
    normalized_credential_name = _normalize_credential_name(credential_name)

    row = None
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
    if row is None and session_id and peer_did:
        row = conn.execute(
            """SELECT outbox_id FROM e2ee_outbox
               WHERE credential_name = ? AND peer_did = ? AND session_id = ?
               ORDER BY updated_at DESC LIMIT 1""",
            (normalized_credential_name, peer_did, session_id),
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
           WHERE outbox_id = ? AND credential_name = ?""",
        (
            error_code,
            retry_hint,
            failed_msg_id,
            failed_server_seq,
            metadata,
            now,
            outbox_id,
            normalized_credential_name,
        ),
    )
    conn.commit()
    return outbox_id


def update_e2ee_outbox_status(
    conn: sqlite3.Connection,
    *,
    outbox_id: str,
    local_status: str,
    credential_name: str | None = None,
) -> None:
    """Update an outbox record status without modifying send metadata."""
    now = datetime.now(timezone.utc).isoformat()
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
    credential_name: str | None = None,
    error_code: str,
    retry_hint: str | None = None,
    metadata: str | None = None,
) -> None:
    """Mark one E2EE outbox record as failed by its outbox_id."""
    now = datetime.now(timezone.utc).isoformat()
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
    credential_name: str | None = None,
) -> dict[str, Any] | None:
    """Fetch one E2EE outbox record by ID."""
    row = conn.execute(
        """SELECT * FROM e2ee_outbox
           WHERE outbox_id = ? AND credential_name = ?""",
        (outbox_id, _normalize_credential_name(credential_name)),
    ).fetchone()
    return dict(row) if row is not None else None


def list_e2ee_outbox(
    conn: sqlite3.Connection,
    *,
    credential_name: str | None = None,
    local_status: str | None = None,
) -> list[dict[str, Any]]:
    """List E2EE outbox records, optionally filtered by status."""
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
    credential_name: str | None = None,
) -> dict[str, Any] | None:
    """Fetch one locally stored message by message ID."""
    row = conn.execute(
        """SELECT * FROM messages
           WHERE msg_id = ? AND credential_name = ?""",
        (msg_id, _normalize_credential_name(credential_name)),
    ).fetchone()
    return dict(row) if row is not None else None


def upsert_contact(
    conn: sqlite3.Connection,
    *,
    did: str,
    **fields: Any,
) -> None:
    """Insert or update a contact record.

    Args:
        conn: SQLite connection.
        did: Contact's DID (primary key).
        **fields: Optional fields to set (name, handle, nick_name, bio, etc.).
    """
    now = datetime.now(timezone.utc).isoformat()

    # Check if contact exists
    existing = conn.execute(
        "SELECT did FROM contacts WHERE did = ?", (did,),
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
            values = list(filtered.values()) + [did]
            conn.execute(
                f"UPDATE contacts SET {set_clause} WHERE did = ?", values,
            )
    else:
        filtered.setdefault("first_seen_at", now)
        filtered.setdefault("last_seen_at", now)
        filtered["did"] = did
        columns = ", ".join(filtered.keys())
        placeholders = ", ".join("?" for _ in filtered)
        conn.execute(
            f"INSERT INTO contacts ({columns}) VALUES ({placeholders})",
            list(filtered.values()),
        )

    conn.commit()


def execute_sql(
    conn: sqlite3.Connection,
    sql: str,
    params: tuple = (),
) -> list[dict[str, Any]]:
    """Execute a SQL statement with safety checks.

    Allowed: SELECT, INSERT, UPDATE, DELETE (with WHERE), REPLACE, ALTER, CREATE.
    Forbidden: DROP, TRUNCATE, DELETE without WHERE, multiple statements.

    Args:
        conn: SQLite connection.
        sql: SQL statement to execute.
        params: Query parameters.

    Returns:
        For SELECT: list of row dicts.
        For write operations: [{"rows_affected": N}].

    Raises:
        ValueError: If the SQL violates safety rules.
    """
    stripped = sql.strip().rstrip(";")

    # Reject multiple statements
    if ";" in stripped:
        raise ValueError("Multiple statements are not allowed")

    # Reject forbidden patterns
    for pattern in _FORBIDDEN_PATTERNS:
        if pattern.search(stripped):
            raise ValueError(f"Forbidden SQL operation: {pattern.pattern}")

    # Reject DELETE without WHERE
    if re.match(r"\s*DELETE\b", stripped, re.IGNORECASE):
        if not re.search(r"\bWHERE\b", stripped, re.IGNORECASE):
            raise ValueError("DELETE without WHERE clause is not allowed")

    cursor = conn.execute(stripped, params)

    if stripped.upper().lstrip().startswith("SELECT"):
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        return [dict(zip(columns, row)) for row in cursor.fetchall()]

    conn.commit()
    return [{"rows_affected": cursor.rowcount}]
