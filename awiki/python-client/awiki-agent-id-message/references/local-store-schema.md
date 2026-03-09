# Local Store Schema Reference

SQLite local storage schema for offline message persistence and contact management.

Database path: `<DATA_DIR>/database/awiki.db` (WAL mode, `check_same_thread=False`).
Single shared database for all credentials and local DIDs.

## Tables

### contacts

Stores contact information scoped by the local owner DID.

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| owner_did | TEXT | PRIMARY KEY (with `did`) | Local DID that owns this contact record |
| did | TEXT | PRIMARY KEY (with `owner_did`) | Contact's DID |
| name | TEXT | | Display name |
| handle | TEXT | | Short name (handle) |
| nick_name | TEXT | | Nickname |
| bio | TEXT | | Short biography |
| profile_md | TEXT | | Markdown profile content |
| tags | TEXT | | Comma-separated tags |
| relationship | TEXT | | Relationship type (following, follower, etc.) |
| first_seen_at | TEXT | | ISO 8601 timestamp of first encounter |
| last_seen_at | TEXT | | ISO 8601 timestamp of last encounter |
| metadata | TEXT | | JSON metadata |

### messages

Stores all messages (incoming and outgoing). The `owner_did` column isolates data
per local DID identity, and the composite primary key `(msg_id, owner_did)`
allows the same server message to be stored for multiple local identities.

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| msg_id | TEXT | PRIMARY KEY (with `owner_did`) | Message identifier scoped by local DID owner |
| owner_did | TEXT | NOT NULL | Local DID that owns this message |
| thread_id | TEXT | NOT NULL | Thread identifier (see Thread ID Format) |
| direction | INTEGER | NOT NULL, DEFAULT 0 | 0 = incoming, 1 = outgoing |
| sender_did | TEXT | | Sender's DID |
| receiver_did | TEXT | | Receiver's DID |
| group_id | TEXT | | Group ID (for group messages) |
| group_did | TEXT | | Group DID (for group messages) |
| content_type | TEXT | DEFAULT 'text' | Content MIME type |
| content | TEXT | | Message content |
| title | TEXT | | Message title (optional, plaintext even for E2EE) |
| server_seq | INTEGER | | Server-assigned sequence number |
| sent_at | TEXT | | Server-side send timestamp (ISO 8601) |
| stored_at | TEXT | NOT NULL | Local storage timestamp (ISO 8601) |
| is_e2ee | INTEGER | DEFAULT 0 | 1 if message was E2EE encrypted |
| is_read | INTEGER | DEFAULT 0 | 1 if message has been read |
| sender_name | TEXT | | Display name of sender |
| metadata | TEXT | | JSON metadata |
| credential_name | TEXT | NOT NULL, DEFAULT '' | Credential alias used when the message was stored |

#### Indexes

- `idx_messages_owner_thread`: `(owner_did, thread_id, sent_at)` — owner-scoped thread query
- `idx_messages_owner_direction`: `(owner_did, direction)` — owner-scoped inbox/outbox filtering
- `idx_messages_owner_sender`: `(owner_did, sender_did)` — owner-scoped sender lookup
- `idx_messages_credential`: `(credential_name)` — credential-based filtering

## Views

### threads

Aggregated thread summary.

| Column | Type | Description |
|--------|------|-------------|
| owner_did | TEXT | Local DID owner |
| thread_id | TEXT | Thread identifier |
| message_count | INTEGER | Total messages in thread |
| unread_count | INTEGER | Unread incoming messages |
| last_message_at | TEXT | Most recent message timestamp |
| last_content | TEXT | Content of most recent message |

### inbox

All incoming messages (`direction = 0`), with `owner_did` preserved.

### outbox

All outgoing messages (`direction = 1`), with `owner_did` preserved.

## Thread ID Format

Thread IDs are deterministic and symmetric:

- **Private chat**: `dm:{min_did}:{max_did}` — DIDs sorted alphabetically for symmetry
- **Group chat**: `group:{group_id}`

## Schema Versioning

Schema version tracked via `PRAGMA user_version`. Current version: **6**.

Migration history:
- v1 → v2: adds `credential_name TEXT` column and `idx_messages_credential` index
- v2 → v3: rebuilds `messages` so deduplication happens per `(msg_id, credential_name)`
- v3 → v4: adds `e2ee_outbox` table for encrypted send tracking
- v4 → v5: adds `title TEXT` column to `messages` table
- v5 → v6: adds explicit `owner_did` isolation to `contacts`, `messages`, and
  `e2ee_outbox`, and rebuilds views to group by owner DID

## Safety Rules (execute_sql)

The `execute_sql()` function enforces:

- **Allowed**: SELECT, INSERT, UPDATE, DELETE (with WHERE), REPLACE, ALTER, CREATE
- **Forbidden**: DROP, TRUNCATE, DELETE without WHERE, multiple statements (`;` separated)
