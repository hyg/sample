# Local Store Schema Reference

SQLite local storage schema for offline message persistence and contact management.

Database path: `<DATA_DIR>/database/awiki.db` (WAL mode, `check_same_thread=False`).
Single shared database for all credentials.

## Tables

### contacts

Stores contact information indexed by DID. Contacts are global (DID is unique across credentials).

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| did | TEXT | PRIMARY KEY | Contact's DID |
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

Stores all messages (incoming and outgoing). The `credential_name` column distinguishes which identity sent/received a message, and the composite primary key `(msg_id, credential_name)` allows the same server message to be stored for multiple local identities.

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| msg_id | TEXT | PRIMARY KEY (with `credential_name`) | Message identifier scoped by credential owner |
| thread_id | TEXT | NOT NULL | Thread identifier (see Thread ID Format) |
| direction | INTEGER | NOT NULL, DEFAULT 0 | 0 = incoming, 1 = outgoing |
| sender_did | TEXT | | Sender's DID |
| receiver_did | TEXT | | Receiver's DID |
| group_id | TEXT | | Group ID (for group messages) |
| group_did | TEXT | | Group DID (for group messages) |
| content_type | TEXT | DEFAULT 'text' | Content MIME type |
| content | TEXT | | Message content |
| server_seq | INTEGER | | Server-assigned sequence number |
| sent_at | TEXT | | Server-side send timestamp (ISO 8601) |
| stored_at | TEXT | NOT NULL | Local storage timestamp (ISO 8601) |
| is_e2ee | INTEGER | DEFAULT 0 | 1 if message was E2EE encrypted |
| is_read | INTEGER | DEFAULT 0 | 1 if message has been read |
| sender_name | TEXT | | Display name of sender |
| metadata | TEXT | | JSON metadata |
| credential_name | TEXT | NOT NULL, DEFAULT '' | Credential identity that owns this message |

#### Indexes

- `idx_messages_thread`: `(thread_id, sent_at)` — efficient thread query
- `idx_messages_direction`: `(direction)` — inbox/outbox filtering
- `idx_messages_sender`: `(sender_did)` — sender lookup
- `idx_messages_credential`: `(credential_name)` — credential-based filtering

## Views

### threads

Aggregated thread summary.

| Column | Type | Description |
|--------|------|-------------|
| thread_id | TEXT | Thread identifier |
| message_count | INTEGER | Total messages in thread |
| unread_count | INTEGER | Unread incoming messages |
| last_message_at | TEXT | Most recent message timestamp |
| last_content | TEXT | Content of most recent message |

### inbox

All incoming messages (`direction = 0`), ordered by timestamp descending.

### outbox

All outgoing messages (`direction = 1`), ordered by timestamp descending.

## Thread ID Format

Thread IDs are deterministic and symmetric:

- **Private chat**: `dm:{min_did}:{max_did}` — DIDs sorted alphabetically for symmetry
- **Group chat**: `group:{group_id}`

## Schema Versioning

Schema version tracked via `PRAGMA user_version`. Current version: **3**.

Migration history:
- v1 → v2: adds `credential_name TEXT` column and `idx_messages_credential` index
- v2 → v3: rebuilds `messages` so deduplication happens per `(msg_id, credential_name)`

## Safety Rules (execute_sql)

The `execute_sql()` function enforces:

- **Allowed**: SELECT, INSERT, UPDATE, DELETE (with WHERE), REPLACE, ALTER, CREATE
- **Forbidden**: DROP, TRUNCATE, DELETE without WHERE, multiple statements (`;` separated)
