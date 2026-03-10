/**
 * E2EE outbox helpers for resendable private encrypted messages.
 *
 * [INPUT]: local_store (SQLite persistence), outgoing encrypted message context,
 *          incoming e2ee_error payloads
 * [OUTPUT]: beginSendAttempt(), markSendSuccess(), recordRemoteFailure(),
 *           listFailedRecords(), getRecord(), markDropped()
 * [POS]: Persistence helper layer between E2EE messaging scripts/listener and SQLite
 *        outbox state, enabling user-driven resend decisions after peer-side failures
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

import { loadIdentity } from './credential_store.js';
import * as localStore from './local_store.js';

/**
 * Open database connection and ensure schema.
 * @returns {Object} Database connection
 */
function _openDb() {
    const conn = localStore.get_connection();
    localStore.ensure_schema(conn);
    return conn;
}

/**
 * Resolve owner_did from credential storage.
 * @param {string} credentialName - Credential name
 * @returns {string} Owner DID
 */
function _loadOwnerDid(credentialName) {
    const credential = loadIdentity(credentialName);
    if (credential === null || !credential.did) {
        throw new Error(`Credential '${credentialName}' is unavailable`);
    }
    return credential.did;
}

/**
 * Create or reset an E2EE outbox entry before attempting network send.
 * @param {Object} params - Parameters
 * @param {string} params.peer_did - Peer DID
 * @param {string} params.plaintext - Plaintext message
 * @param {string} params.original_type - Original message type
 * @param {string} params.credential_name - Credential name
 * @param {string|null} params.session_id - Session ID
 * @param {string|null} params.outbox_id - Outbox ID
 * @returns {string} Outbox ID
 */
export function beginSendAttempt({
    peer_did,
    plaintext,
    original_type,
    credential_name,
    session_id,
    outbox_id = null
}) {
    const ownerDid = _loadOwnerDid(credential_name);
    const conn = _openDb();
    try {
        if (outbox_id === null) {
            return localStore.queue_e2ee_outbox({
                owner_did: ownerDid,
                peer_did: peer_did,
                plaintext: plaintext,
                session_id: session_id,
                original_type: original_type
            }, credential_name);
        }
        
        // Update existing outbox entry
        const now = new Date().toISOString();
        const stmt = conn.prepare(`
            UPDATE e2ee_outbox
            SET local_status = 'queued',
                updated_at = @updated_at
            WHERE outbox_id = @outbox_id
                AND owner_did = @owner_did
                AND credential_name = @credential_name
        `);
        
        stmt.run({
            outbox_id: outbox_id,
            owner_did: ownerDid,
            credential_name: credential_name,
            updated_at: now
        });
        
        return outbox_id;
    } finally {
        conn.close();
    }
}

/**
 * Persist a successful encrypted send into outbox and local messages.
 * @param {Object} params - Parameters
 * @param {string} params.outbox_id - Outbox ID
 * @param {string} params.credential_name - Credential name
 * @param {string} params.local_did - Local DID
 * @param {string} params.peer_did - Peer DID
 * @param {string} params.plaintext - Plaintext message
 * @param {string} params.original_type - Original message type
 * @param {string|null} params.session_id - Session ID
 * @param {string|null} params.sent_msg_id - Sent message ID
 * @param {number|null} params.sent_server_seq - Sent server sequence
 * @param {string|null} params.sent_at - Sent timestamp
 * @param {string} params.client_msg_id - Client message ID
 * @param {string|null} params.title - Message title
 */
export function markSendSuccess({
    outbox_id,
    credential_name,
    local_did,
    peer_did,
    plaintext,
    original_type,
    session_id,
    sent_msg_id,
    sent_server_seq,
    sent_at,
    client_msg_id,
    title = null
}) {
    const conn = _openDb();
    try {
        const metadata = JSON.stringify({
            outbox_id: outbox_id,
            session_id: session_id,
            client_msg_id: client_msg_id
        });
        
        localStore.mark_e2ee_outbox_sent(outbox_id, sent_server_seq, sent_msg_id);
        
        // Store the message in local messages
        const now = new Date().toISOString();
        const threadId = localStore.make_thread_id(local_did, peer_did);
        
        localStore.store_message({
            msg_id: sent_msg_id || client_msg_id,
            owner_did: local_did,
            thread_id: threadId,
            direction: 1, // outgoing
            sender_did: local_did,
            receiver_did: peer_did,
            content_type: original_type,
            content: plaintext,
            title: title,
            server_seq: sent_server_seq,
            sent_at: sent_at || now,
            is_e2ee: 1,
            is_read: 1,
            metadata: metadata
        }, credential_name);
    } finally {
        conn.close();
    }
}

/**
 * Record a remote failure (e.g., peer decryption failed, session expired).
 * @param {string} credentialName - Credential name
 * @param {string} peerDid - Peer DID
 * @param {Object} content - Error content
 */
export function record_remote_failure(credentialName, peerDid, content) {
    const conn = _openDb();
    try {
        const errorCode = content.error_code || content.code || 'unknown_error';
        const retryHint = content.retry_hint || null;
        
        // Find the most recent outbox entry for this peer
        const stmt = conn.prepare(`
            SELECT outbox_id FROM e2ee_outbox
            WHERE owner_did = ?
                AND peer_did = ?
                AND credential_name = ?
                AND local_status != 'sent'
            ORDER BY updated_at DESC
            LIMIT 1
        `);
        
        const ownerDid = _loadOwnerDid(credentialName);
        const row = stmt.get(ownerDid, peerDid, credentialName);
        
        if (row) {
            localStore.mark_e2ee_outbox_failed(row.outbox_id, errorCode, retryHint);
        }
    } finally {
        conn.close();
    }
}

/**
 * Record a local failure (e.g., encryption error, no session).
 * @param {string} outboxId - Outbox ID
 * @param {string} error - Error message
 */
export function recordLocalFailure(outboxId, error) {
    localStore.mark_e2ee_outbox_failed(outboxId, 'local_error', error);
}

/**
 * Get outbox record by ID.
 * @param {string} outboxId - Outbox ID
 * @returns {Object|null} Outbox record or null
 */
export function getRecord(outboxId) {
    return localStore.get_e2ee_outbox(outboxId);
}

/**
 * List all failed records (local or remote failures).
 * @param {string} ownerDid - Owner DID
 * @param {number} limit - Limit
 * @returns {Object[]} List of failed records
 */
export function listFailedRecords(ownerDid, limit = 50) {
    const conn = localStore.get_connection();
    try {
        localStore.ensure_schema(conn);
        
        const stmt = conn.prepare(`
            SELECT * FROM e2ee_outbox
            WHERE owner_did = ?
                AND (local_status = 'local_failure' OR local_status = 'remote_failure' OR local_status = 'queued')
            ORDER BY updated_at DESC
            LIMIT ?
        `);
        
        return stmt.all(ownerDid, limit);
    } finally {
        conn.close();
    }
}

/**
 * Mark message as dropped (undeliverable).
 * @param {string} outboxId - Outbox ID
 */
export function markDropped(outboxId) {
    const conn = localStore.get_connection();
    try {
        localStore.ensure_schema(conn);
        
        const now = new Date().toISOString();
        const stmt = conn.prepare(`
            UPDATE e2ee_outbox
            SET local_status = 'dropped',
                updated_at = @updated_at
            WHERE outbox_id = @outbox_id
        `);
        
        stmt.run({
            outbox_id: outboxId,
            updated_at: now
        });
    } finally {
        conn.close();
    }
}

/**
 * Clear old sent records (older than 7 days).
 */
export function clearOldRecords() {
    const conn = localStore.get_connection();
    try {
        localStore.ensure_schema(conn);
        
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const stmt = conn.prepare(`
            DELETE FROM e2ee_outbox
            WHERE (local_status = 'sent' AND updated_at < ?)
                OR (local_status = 'dropped' AND updated_at < ?)
        `);
        
        stmt.run(cutoff, cutoff);
    } finally {
        conn.close();
    }
}

export default {
    beginSendAttempt,
    markSendSuccess,
    record_remote_failure,
    recordLocalFailure,
    getRecord,
    listFailedRecords,
    markDropped,
    clearOldRecords
};
