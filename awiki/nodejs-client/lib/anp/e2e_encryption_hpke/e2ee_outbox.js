/**
 * E2EE outbox for managing failed message send attempts.
 * 
 * Compatible with Python's e2ee_outbox.py.
 * 
 * Provides:
 * - Record send attempts
 * - Track failures (local/remote)
 * - Retry failed messages
 * - Drop undeliverable messages
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTBOX_PATH = join(__dirname, '..', '.e2ee_outbox.json');

/**
 * Load outbox from disk.
 * @private
 */
function loadOutbox() {
    if (existsSync(OUTBOX_PATH)) {
        try {
            const data = readFileSync(OUTBOX_PATH, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.warn('Failed to load outbox:', error.message);
        }
    }
    return { messages: {} };
}

/**
 * Save outbox to disk.
 * @private
 */
function saveOutbox(outbox) {
    try {
        writeFileSync(OUTBOX_PATH, JSON.stringify(outbox, null, 2), 'utf-8');
    } catch (error) {
        console.warn('Failed to save outbox:', error.message);
    }
}

/**
 * Begin a send attempt for an E2EE message.
 * 
 * @param {string} peerDid - Peer DID identifier.
 * @param {string} plaintext - Plaintext message content.
 * @param {string} originalType - Original message type.
 * @returns {string} Outbox record ID.
 */
export function beginSendAttempt(peerDid, plaintext, originalType = 'text') {
    const outbox = loadOutbox();
    const id = `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    outbox.messages[id] = {
        id,
        peer_did: peerDid,
        plaintext,
        original_type: originalType,
        status: 'pending',
        created_at: new Date().toISOString(),
        attempts: 0,
        last_attempt: null,
        last_error: null,
        retry_after: null
    };
    
    saveOutbox(outbox);
    return id;
}

/**
 * Get outbox record by ID.
 * 
 * @param {string} id - Outbox record ID.
 * @returns {Object|null} Outbox record or null.
 */
export function getRecord(id) {
    const outbox = loadOutbox();
    return outbox.messages[id] || null;
}

/**
 * Mark message as successfully sent.
 * 
 * @param {string} id - Outbox record ID.
 * @param {number} serverSeq - Server-assigned sequence number.
 */
export function markSendSuccess(id, serverSeq) {
    const outbox = loadOutbox();
    
    if (outbox.messages[id]) {
        outbox.messages[id].status = 'sent';
        outbox.messages[id].server_seq = serverSeq;
        outbox.messages[id].sent_at = new Date().toISOString();
        saveOutbox(outbox);
    }
}

/**
 * Record a local failure (e.g., encryption error, no session).
 * 
 * @param {string} id - Outbox record ID.
 * @param {string} error - Error message.
 */
export function recordLocalFailure(id, error) {
    const outbox = loadOutbox();
    
    if (outbox.messages[id]) {
        outbox.messages[id].attempts++;
        outbox.messages[id].last_attempt = new Date().toISOString();
        outbox.messages[id].last_error = error;
        outbox.messages[id].status = 'local_failure';
        outbox.messages[id].retry_hint = 'fix_local_then_resend';
        saveOutbox(outbox);
    }
}

/**
 * Record a remote failure (e.g., peer decryption failed, session expired).
 * 
 * @param {string} id - Outbox record ID.
 * @param {string} errorCode - E2EE error code from peer.
 */
export function recordRemoteFailure(id, errorCode) {
    const outbox = loadOutbox();
    
    if (outbox.messages[id]) {
        outbox.messages[id].attempts++;
        outbox.messages[id].last_attempt = new Date().toISOString();
        outbox.messages[id].last_error = `Remote error: ${errorCode}`;
        
        // Determine retry hint based on error code
        const retryHints = {
            'decryption_failed': 'rekey_then_resend',
            'session_not_found': 'rekey_then_resend',
            'session_expired': 'rekey_then_resend',
            'invalid_seq': 'rekey_then_resend',
            'unsupported_version': 'drop'
        };
        
        outbox.messages[id].retry_hint = retryHints[errorCode] || 'retry_later';
        outbox.messages[id].status = 'remote_failure';
        saveOutbox(outbox);
    }
}

/**
 * Mark message as dropped (undeliverable).
 * 
 * @param {string} id - Outbox record ID.
 */
export function markDropped(id) {
    const outbox = loadOutbox();
    
    if (outbox.messages[id]) {
        outbox.messages[id].status = 'dropped';
        outbox.messages[id].dropped_at = new Date().toISOString();
        saveOutbox(outbox);
    }
}

/**
 * List all failed records (local or remote failures).
 * 
 * @returns {Array<Object>} List of failed outbox records.
 */
export function listFailedRecords() {
    const outbox = loadOutbox();
    
    return Object.values(outbox.messages).filter(
        msg => msg.status === 'local_failure' || msg.status === 'remote_failure' || msg.status === 'pending'
    );
}

/**
 * List records ready for retry.
 * 
 * @returns {Array<Object>} List of retryable records.
 */
export function listRetryableRecords() {
    const outbox = loadOutbox();
    const now = new Date().toISOString();
    
    return Object.values(outbox.messages).filter(
        msg => (msg.status === 'remote_failure' || msg.status === 'pending') &&
               (!msg.retry_after || msg.retry_after < now)
    );
}

/**
 * Delete outbox record.
 * 
 * @param {string} id - Outbox record ID.
 */
export function deleteRecord(id) {
    const outbox = loadOutbox();
    
    if (outbox.messages[id]) {
        delete outbox.messages[id];
        saveOutbox(outbox);
    }
}

/**
 * Clear old sent records (older than 7 days).
 */
export function clearOldRecords() {
    const outbox = loadOutbox();
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    for (const id of Object.keys(outbox.messages)) {
        const msg = outbox.messages[id];
        if (msg.status === 'sent' && msg.sent_at < cutoff) {
            delete outbox.messages[id];
        } else if (msg.status === 'dropped' && msg.dropped_at < cutoff) {
            delete outbox.messages[id];
        }
    }
    
    saveOutbox(outbox);
}

export default {
    beginSendAttempt,
    getRecord,
    markSendSuccess,
    recordLocalFailure,
    recordRemoteFailure,
    markDropped,
    listFailedRecords,
    listRetryableRecords,
    deleteRecord,
    clearOldRecords
};
