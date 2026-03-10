/**
 * SQLite local storage for messages, contacts, and E2EE outbox state.
 *
 * [INPUT]: SDKConfig (data_dir for database path), credential_store (owner DID lookup
 *          during migration)
 * [OUTPUT]: get_connection(), ensure_schema(), store_message(), store_messages_batch(),
 *           queue_e2ee_outbox(), mark_e2ee_outbox_sent(), mark_e2ee_outbox_failed(),
 *           list_e2ee_outbox(), get_e2ee_outbox(), get_message_by_id(), make_thread_id(),
 *           upsert_contact(), rebind_owner_did(), clear_owner_e2ee_data(), execute_sql()
 * [POS]: Persistence layer — single shared SQLite database for offline message storage,
 *        contact management, and resendable E2EE outbox tracking with explicit
 *        owner_did isolation for multi-identity local environments
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { createSDKConfig } from './config.js';

const _SCHEMA_VERSION = 6;

const _V6_TABLES_SQL = `
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
`;

const _V6_INDEX_STATEMENTS = {
    idx_contacts_owner: `
        CREATE INDEX IF NOT EXISTS idx_contacts_owner
            ON contacts(owner_did, last_seen_at DESC)
    `,
    idx_messages_owner_thread: `
        CREATE INDEX IF NOT EXISTS idx_messages_owner_thread
            ON messages(owner_did, thread_id, sent_at)
    `,
    idx_messages_owner_direction: `
        CREATE INDEX IF NOT EXISTS idx_messages_owner_direction
            ON messages(owner_did, direction)
    `,
    idx_messages_owner_sender: `
        CREATE INDEX IF NOT EXISTS idx_messages_owner_sender
            ON messages(owner_did, sender_did)
    `,
    idx_messages_owner: `
        CREATE INDEX IF NOT EXISTS idx_messages_owner
            ON messages(owner_did)
    `,
    idx_messages_credential: `
        CREATE INDEX IF NOT EXISTS idx_messages_credential
            ON messages(credential_name)
    `,
    idx_e2ee_outbox_owner_status: `
        CREATE INDEX IF NOT EXISTS idx_e2ee_outbox_owner_status
            ON e2ee_outbox(owner_did, local_status, updated_at DESC)
    `,
    idx_e2ee_outbox_owner_sent_msg: `
        CREATE INDEX IF NOT EXISTS idx_e2ee_outbox_owner_sent_msg
            ON e2ee_outbox(owner_did, sent_msg_id)
    `,
    idx_e2ee_outbox_owner_sent_seq: `
        CREATE INDEX IF NOT EXISTS idx_e2ee_outbox_owner_sent_seq
            ON e2ee_outbox(owner_did, peer_did, sent_server_seq)
    `,
    idx_e2ee_outbox_credential: `
        CREATE INDEX IF NOT EXISTS idx_e2ee_outbox_credential
            ON e2ee_outbox(credential_name)
    `
};

/**
 * Open (or create) the shared SQLite database.
 * @returns {Database} SQLite database connection
 */
export function get_connection() {
    const config = createSDKConfig();
    const dbDir = path.join(config.data_dir, 'database');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = path.join(dbDir, 'awiki.db');
    const conn = new Database(dbPath);
    
    // Enable WAL mode and foreign keys
    conn.pragma('journal_mode = WAL');
    conn.pragma('foreign_keys = ON');
    
    console.debug(`Opened local SQLite database path=${dbPath}`);
    return conn;
}

/**
 * Return whether a table exists.
 * @param {Database} conn - Database connection
 * @param {string} tableName - Table name
 * @returns {boolean} True if table exists
 */
function _table_exists(conn, tableName) {
    const stmt = conn.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
    );
    const row = stmt.get(tableName);
    return row !== undefined;
}

/**
 * Normalize credential name to string.
 * @param {string|null} credentialName - Credential name
 * @returns {string} Normalized credential name
 */
function _normalize_credential_name(credentialName) {
    return credentialName || 'default';
}

/**
 * Normalize owner DID to string.
 * @param {string|null} ownerDid - Owner DID
 * @returns {string} Normalized owner DID
 */
function _normalize_owner_did(ownerDid) {
    return ownerDid || '';
}

/**
 * Ensure v6 indexes exist.
 * @param {Database} conn - Database connection
 * @returns {string[]} List of created indexes
 */
function _ensure_v6_indexes(conn) {
    const created = [];
    for (const [indexName, sql] of Object.entries(_V6_INDEX_STATEMENTS)) {
        try {
            conn.exec(sql);
            created.push(indexName);
        } catch (error) {
            console.warn(`Failed to create index ${indexName}:`, error.message);
        }
    }
    return created;
}

/**
 * Create schema v6.
 * @param {Database} conn - Database connection
 */
function _create_schema_v6(conn) {
    conn.exec(_V6_TABLES_SQL);
    _ensure_v6_indexes(conn);
}

/**
 * Ensure schema exists.
 * @param {Database} conn - Database connection
 */
export function ensure_schema(conn) {
    if (!_table_exists(conn, 'messages')) {
        _create_schema_v6(conn);
        conn.exec(`PRAGMA user_version = ${_SCHEMA_VERSION}`);
        return;
    }

    // Check schema version
    const stmt = conn.prepare('PRAGMA user_version');
    const result = stmt.get();
    const currentVersion = result.user_version || 0;

    if (currentVersion < _SCHEMA_VERSION) {
        // For now, just ensure indexes exist
        // In a full implementation, we would migrate schema versions
        _ensure_v6_indexes(conn);
        conn.exec(`PRAGMA user_version = ${_SCHEMA_VERSION}`);
    }
}

/**
 * Make a thread ID from two DIDs.
 * @param {string} did1 - First DID
 * @param {string} did2 - Second DID
 * @returns {string} Thread ID
 */
export function make_thread_id(did1, did2) {
    const sorted = [did1, did2].sort();
    return sorted.join('|');
}

/**
 * Store a message in the database.
 * @param {Object} message - Message object
 * @param {string} message.msg_id - Message ID
 * @param {string} message.owner_did - Owner DID
 * @param {string} message.thread_id - Thread ID
 * @param {number} message.direction - Direction (0=incoming, 1=outgoing)
 * @param {string} message.sender_did - Sender DID
 * @param {string} message.receiver_did - Receiver DID
 * @param {string} message.content_type - Content type
 * @param {string} message.content - Message content
 * @param {string} message.title - Message title
 * @param {number} message.server_seq - Server sequence number
 * @param {string} message.sent_at - Sent timestamp
 * @param {number} message.is_e2ee - Is E2EE flag
 * @param {number} message.is_read - Is read flag
 * @param {string} message.sender_name - Sender name
 * @param {Object} message.metadata - Metadata
 * @param {string} credentialName - Credential name
 */
export function store_message(message, credentialName = 'default') {
    const conn = get_connection();
    try {
        ensure_schema(conn);
        
        const now = new Date().toISOString();
        const stmt = conn.prepare(`
            INSERT OR REPLACE INTO messages (
                msg_id, owner_did, thread_id, direction, sender_did, receiver_did,
                content_type, content, title, server_seq, sent_at, stored_at,
                is_e2ee, is_read, sender_name, metadata, credential_name
            ) VALUES (
                @msg_id, @owner_did, @thread_id, @direction, @sender_did, @receiver_did,
                @content_type, @content, @title, @server_seq, @sent_at, @stored_at,
                @is_e2ee, @is_read, @sender_name, @metadata, @credential_name
            )
        `);
        
        stmt.run({
            ...message,
            stored_at: message.stored_at || now,
            credential_name: _normalize_credential_name(credentialName),
            metadata: message.metadata ? JSON.stringify(message.metadata) : null
        });
    } finally {
        conn.close();
    }
}

/**
 * Store multiple messages in a batch.
 * @param {Object[]} messages - Array of message objects
 * @param {string} credentialName - Credential name
 */
export function store_messages_batch(messages, credentialName = 'default') {
    const conn = get_connection();
    try {
        ensure_schema(conn);
        
        const now = new Date().toISOString();
        const stmt = conn.prepare(`
            INSERT OR REPLACE INTO messages (
                msg_id, owner_did, thread_id, direction, sender_did, receiver_did,
                content_type, content, title, server_seq, sent_at, stored_at,
                is_e2ee, is_read, sender_name, metadata, credential_name
            ) VALUES (
                @msg_id, @owner_did, @thread_id, @direction, @sender_did, @receiver_did,
                @content_type, @content, @title, @server_seq, @sent_at, @stored_at,
                @is_e2ee, @is_read, @sender_name, @metadata, @credential_name
            )
        `);
        
        const normalizedCredentialName = _normalize_credential_name(credentialName);
        
        conn.transaction(() => {
            for (const message of messages) {
                stmt.run({
                    ...message,
                    stored_at: message.stored_at || now,
                    credential_name: normalizedCredentialName,
                    metadata: message.metadata ? JSON.stringify(message.metadata) : null
                });
            }
        });
    } finally {
        conn.close();
    }
}

/**
 * Queue an E2EE message in the outbox.
 * @param {Object} params - Parameters
 * @param {string} params.outbox_id - Outbox ID
 * @param {string} params.owner_did - Owner DID
 * @param {string} params.peer_did - Peer DID
 * @param {string} params.session_id - Session ID
 * @param {string} params.original_type - Original message type
 * @param {string} params.plaintext - Plaintext message
 * @param {string} credentialName - Credential name
 * @returns {string} Outbox ID
 */
export function queue_e2ee_outbox({
    outbox_id,
    owner_did,
    peer_did,
    session_id,
    original_type = 'text',
    plaintext
}, credentialName = 'default') {
    const conn = get_connection();
    try {
        ensure_schema(conn);
        
        const now = new Date().toISOString();
        const stmt = conn.prepare(`
            INSERT INTO e2ee_outbox (
                outbox_id, owner_did, peer_did, session_id, original_type, plaintext,
                local_status, attempt_count, created_at, updated_at, credential_name
            ) VALUES (
                @outbox_id, @owner_did, @peer_did, @session_id, @original_type, @plaintext,
                'queued', 0, @created_at, @updated_at, @credential_name
            )
        `);
        
        stmt.run({
            outbox_id,
            owner_did: _normalize_owner_did(owner_did),
            peer_did,
            session_id,
            original_type,
            plaintext,
            created_at: now,
            updated_at: now,
            credential_name: _normalize_credential_name(credentialName)
        });
        
        return outbox_id;
    } finally {
        conn.close();
    }
}

/**
 * Mark an E2EE outbox message as sent.
 * @param {string} outboxId - Outbox ID
 * @param {number} serverSeq - Server sequence number
 * @param {string} sentMsgId - Sent message ID
 */
export function mark_e2ee_outbox_sent(outboxId, serverSeq, sentMsgId) {
    const conn = get_connection();
    try {
        ensure_schema(conn);
        
        const now = new Date().toISOString();
        const stmt = conn.prepare(`
            UPDATE e2ee_outbox
            SET local_status = 'sent',
                sent_server_seq = @server_seq,
                sent_msg_id = @sent_msg_id,
                updated_at = @updated_at
            WHERE outbox_id = @outbox_id
        `);
        
        stmt.run({
            outbox_id: outboxId,
            server_seq: serverSeq,
            sent_msg_id: sentMsgId,
            updated_at: now
        });
    } finally {
        conn.close();
    }
}

/**
 * Mark an E2EE outbox message as failed.
 * @param {string} outboxId - Outbox ID
 * @param {string} errorCode - Error code
 * @param {string} retryHint - Retry hint
 */
export function mark_e2ee_outbox_failed(outboxId, errorCode, retryHint = null) {
    const conn = get_connection();
    try {
        ensure_schema(conn);
        
        const now = new Date().toISOString();
        const stmt = conn.prepare(`
            UPDATE e2ee_outbox
            SET local_status = 'failed',
                last_error_code = @last_error_code,
                retry_hint = @retry_hint,
                attempt_count = attempt_count + 1,
                updated_at = @updated_at
            WHERE outbox_id = @outbox_id
        `);
        
        stmt.run({
            outbox_id: outboxId,
            last_error_code: errorCode,
            retry_hint: retryHint,
            updated_at: now
        });
    } finally {
        conn.close();
    }
}

/**
 * Get an E2EE outbox message by ID.
 * @param {string} outboxId - Outbox ID
 * @returns {Object|null} Outbox message or null
 */
export function get_e2ee_outbox(outboxId) {
    const conn = get_connection();
    try {
        ensure_schema(conn);
        
        const stmt = conn.prepare(`
            SELECT * FROM e2ee_outbox WHERE outbox_id = ?
        `);
        
        const row = stmt.get(outboxId);
        return row || null;
    } finally {
        conn.close();
    }
}

/**
 * List E2EE outbox messages.
 * @param {Object} params - Parameters
 * @param {string} params.owner_did - Owner DID
 * @param {string} params.local_status - Local status filter
 * @param {number} params.limit - Limit
 * @returns {Object[]} Array of outbox messages
 */
export function list_e2ee_outbox({ owner_did, local_status, limit = 50 }) {
    const conn = get_connection();
    try {
        ensure_schema(conn);
        
        let sql = 'SELECT * FROM e2ee_outbox WHERE owner_did = ?';
        const params = [_normalize_owner_did(owner_did)];
        
        if (local_status) {
            sql += ' AND local_status = ?';
            params.push(local_status);
        }
        
        sql += ' ORDER BY updated_at DESC LIMIT ?';
        params.push(limit);
        
        const stmt = conn.prepare(sql);
        return stmt.all(...params);
    } finally {
        conn.close();
    }
}

/**
 * Get a message by ID.
 * @param {string} msgId - Message ID
 * @param {string} ownerDid - Owner DID
 * @returns {Object|null} Message or null
 */
export function get_message_by_id(msgId, ownerDid) {
    const conn = get_connection();
    try {
        ensure_schema(conn);
        
        const stmt = conn.prepare(`
            SELECT * FROM messages WHERE msg_id = ? AND owner_did = ?
        `);
        
        const row = stmt.get(msgId, _normalize_owner_did(ownerDid));
        return row || null;
    } finally {
        conn.close();
    }
}

/**
 * Upsert a contact.
 * @param {Object} contact - Contact object
 * @param {string} credentialName - Credential name
 */
export function upsert_contact(contact, credentialName = 'default') {
    const conn = get_connection();
    try {
        ensure_schema(conn);
        
        const now = new Date().toISOString();
        const stmt = conn.prepare(`
            INSERT OR REPLACE INTO contacts (
                owner_did, did, name, handle, nick_name, bio, profile_md,
                tags, relationship, first_seen_at, last_seen_at, metadata
            ) VALUES (
                @owner_did, @did, @name, @handle, @nick_name, @bio, @profile_md,
                @tags, @relationship, @first_seen_at, @last_seen_at, @metadata
            )
        `);
        
        const normalizedCredentialName = _normalize_credential_name(credentialName);
        const ownerDid = contact.owner_did || '';
        
        stmt.run({
            ...contact,
            owner_did: ownerDid,
            first_seen_at: contact.first_seen_at || now,
            last_seen_at: contact.last_seen_at || now,
            metadata: contact.metadata ? JSON.stringify(contact.metadata) : null
        });
    } finally {
        conn.close();
    }
}

/**
 * Rebind owner DID (for migration).
 * @param {string} oldOwnerDid - Old owner DID
 * @param {string} newOwnerDid - New owner DID
 */
export function rebind_owner_did(oldOwnerDid, newOwnerDid) {
    const conn = get_connection();
    try {
        ensure_schema(conn);
        
        const stmt = conn.prepare(`
            UPDATE messages
            SET owner_did = @new_owner_did
            WHERE owner_did = @old_owner_did
        `);
        
        stmt.run({
            new_owner_did: newOwnerDid,
            old_owner_did: oldOwnerDid
        });
        
        const stmt2 = conn.prepare(`
            UPDATE contacts
            SET owner_did = @new_owner_did
            WHERE owner_did = @old_owner_did
        `);
        
        stmt2.run({
            new_owner_did: newOwnerDid,
            old_owner_did: oldOwnerDid
        });
        
        const stmt3 = conn.prepare(`
            UPDATE e2ee_outbox
            SET owner_did = @new_owner_did
            WHERE owner_did = @old_owner_did
        `);
        
        stmt3.run({
            new_owner_did: newOwnerDid,
            old_owner_did: oldOwnerDid
        });
    } finally {
        conn.close();
    }
}

/**
 * Clear E2EE data for an owner.
 * @param {string} ownerDid - Owner DID
 */
export function clear_owner_e2ee_data(ownerDid) {
    const conn = get_connection();
    try {
        ensure_schema(conn);
        
        const stmt = conn.prepare(`
            DELETE FROM e2ee_outbox WHERE owner_did = ?
        `);
        
        stmt.run(_normalize_owner_did(ownerDid));
    } finally {
        conn.close();
    }
}

/**
 * Execute raw SQL (for migrations).
 * @param {string} sql - SQL statement
 * @param {Array} params - Parameters
 * @returns {Object[]} Query results
 */
export function execute_sql(sql, params = []) {
    const conn = get_connection();
    try {
        ensure_schema(conn);
        
        const stmt = conn.prepare(sql);
        return stmt.all(...params);
    } finally {
        conn.close();
    }
}

export default {
    get_connection,
    ensure_schema,
    store_message,
    store_messages_batch,
    queue_e2ee_outbox,
    mark_e2ee_outbox_sent,
    mark_e2ee_outbox_failed,
    get_e2ee_outbox,
    list_e2ee_outbox,
    get_message_by_id,
    make_thread_id,
    upsert_contact,
    rebind_owner_did,
    clear_owner_e2ee_data,
    execute_sql
};
