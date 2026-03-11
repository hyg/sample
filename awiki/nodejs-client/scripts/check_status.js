/**
 * Unified status check: identity verification + inbox categorized summary + E2EE auto-processing.
 *
 * Usage:
 *     node scripts/check_status.js                     # Status check with E2EE auto-processing
 *     node scripts/check_status.js --no-auto-e2ee      # Disable E2EE auto-processing
 *     node scripts/check_status.js --credential alice   # Specify credential
 *
 * [INPUT]: SDK (RPC calls, E2eeClient), credential_store (authenticator factory),
 *          e2ee_store, credential_migration, database_migration, logging_config
 * [OUTPUT]: Structured JSON status report (identity + inbox + e2ee_auto + e2ee_sessions),
 *           with inbox refreshed after optional auto-processing
 * [POS]: Unified status check entry point for Agent session startup and heartbeat calls
 *        with default-on, server_seq-aware E2EE auto-processing (HPKE E2EE scheme)
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

import { createSDKConfig } from './utils/config.js';
import { createUserServiceClient, createMoltMessageClient } from '../src/utils/client.js';
import { authenticatedRpcCall } from './utils/rpc.js';
import { ensureCredentialStorageReady } from './utils/credential_migration.js';
import { ensureLocalDatabaseReady } from './utils/database_migration.js';
import { loadIdentity, createAuthenticator } from './utils/credential_store.js';
import { loadE2eeState, saveE2eeState } from './utils/e2ee_store.js';
import { record_remote_failure } from './utils/e2ee_outbox.js';
import { E2eeClient } from '../src/e2ee.js';

const MESSAGE_RPC = '/message/rpc';
const AUTH_RPC = '/user-service/did-auth/rpc';

// E2EE protocol message types
const _E2EE_HANDSHAKE_TYPES = new Set(['e2ee_init', 'e2ee_ack', 'e2ee_rekey', 'e2ee_error']);
const _E2EE_SESSION_SETUP_TYPES = new Set(['e2ee_init', 'e2ee_rekey']);
const _E2EE_MSG_TYPES = new Set(['e2ee_init', 'e2ee_ack', 'e2ee_msg', 'e2ee_rekey', 'e2ee_error']);
const _E2EE_TYPE_ORDER = { 'e2ee_init': 0, 'e2ee_ack': 1, 'e2ee_rekey': 2, 'e2ee_msg': 3, 'e2ee_error': 4 };

/**
 * Build a stable E2EE inbox ordering key with server_seq priority inside a sender stream.
 * @param {Object} message - Message object
 * @returns {Array} Sorting key
 */
function _message_sort_key(message) {
    const sender_did = message.sender_did || '';
    const server_seq = message.server_seq;
    const has_server_seq = typeof server_seq === 'number' ? 0 : 1;
    const server_seq_value = typeof server_seq === 'number' ? server_seq : 0;
    return [
        sender_did,
        has_server_seq,
        server_seq_value,
        message.created_at || '',
        _E2EE_TYPE_ORDER[message.type] || 99
    ];
}

/**
 * Return whether a message type should be exposed to end users.
 * @param {string} msgType - Message type
 * @returns {boolean} True if user visible
 */
function _is_user_visible_message_type(msgType) {
    return !_E2EE_MSG_TYPES.has(msgType);
}

/**
 * Load existing E2EE client state from disk, or create a new client if absent.
 * @param {string} localDid - Local DID
 * @param {string} credentialName - Credential name
 * @returns {E2eeClient} E2EE client
 */
function _load_or_create_e2ee_client(localDid, credentialName) {
    // Load E2EE keys from credential
    const cred = loadIdentity(credentialName);
    let signingPem = null;
    let x25519Pem = null;
    if (cred !== null) {
        signingPem = cred.e2ee_signing_private_pem;
        x25519Pem = cred.e2ee_agreement_private_pem;
    }

    const state = loadE2eeState(credentialName);
    if (state !== null && state.local_did === localDid) {
        if (signingPem !== null) {
            state.signing_pem = signingPem;
        }
        if (x25519Pem !== null) {
            state.x25519_pem = x25519Pem;
        }
        return E2eeClient.from_state(state);
    }

    return new E2eeClient(localDid, signingPem, x25519Pem);
}

/**
 * Save E2EE client state to disk.
 * @param {E2eeClient} client - E2EE client
 * @param {string} credentialName - Credential name
 */
function _save_e2ee_client(client, credentialName) {
    saveE2eeState(client.export_state(), credentialName);
}

/**
 * Send a message (E2EE or plain).
 * @param {Object} httpClient - HTTP client
 * @param {string} senderDid - Sender DID
 * @param {string} receiverDid - Receiver DID
 * @param {string} msgType - Message type
 * @param {string|Object} content - Message content
 * @param {Object} auth - Authentication object
 * @param {string} credentialName - Credential name
 * @returns {Promise} RPC call result
 */
async function _send_msg(httpClient, senderDid, receiverDid, msgType, content, auth, credentialName = 'default') {
    const contentStr = typeof content === 'object' ? JSON.stringify(content) : content;
    return await authenticatedRpcCall(
        httpClient,
        MESSAGE_RPC,
        'send',
        {
            sender_did: senderDid,
            receiver_did: receiverDid,
            content: contentStr,
            type: msgType
        },
        auth,
        credentialName
    );
}

/**
 * Check identity status; automatically refresh expired JWT.
 * @param {string} credentialName - Credential name
 * @returns {Promise<Object>} Identity status
 */
async function check_identity(credentialName = 'default') {
    const data = loadIdentity(credentialName);
    if (data === null) {
        return { status: 'no_identity', did: null, name: null, jwt_valid: false };
    }

    const result = {
        status: 'ok',
        did: data.did,
        name: data.name,
        jwt_valid: false
    };

    if (!data.jwt_token) {
        result.status = 'no_jwt';
        return result;
    }

    const config = createSDKConfig();
    const authResult = await createAuthenticator(credentialName, config);
    if (authResult === null) {
        result.status = 'no_did_document';
        result.error = 'Credential missing DID document; please recreate identity';
        return result;
    }

    const [auth] = authResult;
    const oldToken = data.jwt_token;

    try {
        const client = await createUserServiceClient(config);
        try {
            await authenticatedRpcCall(
                client,
                AUTH_RPC,
                'get_me',
                {},
                auth,
                credentialName
            );
            result.jwt_valid = true;
            
            // Check if token was refreshed
            const refreshedData = loadIdentity(credentialName);
            if (refreshedData && refreshedData.jwt_token !== oldToken) {
                result.jwt_refreshed = true;
            }
        } finally {
            await client.close();
        }
    } catch (error) {
        result.status = 'jwt_refresh_failed';
        result.error = error.message;
    }

    return result;
}

/**
 * Fetch inbox and compute categorized statistics.
 * @param {string} credentialName - Credential name
 * @returns {Promise<Object>} Inbox summary
 */
async function summarize_inbox(credentialName = 'default') {
    const config = createSDKConfig();
    const authResult = await createAuthenticator(credentialName, config);
    if (authResult === null) {
        return { status: 'no_identity', total: 0 };
    }

    const [auth, data] = authResult;
    try {
        const client = await createMoltMessageClient(config);
        try {
            const inbox = await authenticatedRpcCall(
                client,
                MESSAGE_RPC,
                'get_inbox',
                { user_did: data.did, limit: 50 },
                auth,
                credentialName
            );
            
            const messages = inbox.messages || [];
            
            // Count only user-visible messages. Protocol and encrypted transport
            // messages are internal and should not be surfaced directly to users.
            const byType = {};
            const textBySender = {};
            let textCount = 0;
            let visibleTotal = 0;
            
            for (const msg of messages) {
                const msgType = msg.type || 'unknown';
                if (!_is_user_visible_message_type(msgType)) {
                    continue;
                }
                
                visibleTotal += 1;
                const senderDid = msg.sender_did || 'unknown';
                const createdAt = msg.created_at || '';
                
                byType[msgType] = (byType[msgType] || 0) + 1;
                
                if (msgType === 'text') {
                    textCount += 1;
                    if (!textBySender[senderDid]) {
                        textBySender[senderDid] = { count: 0, latest: '' };
                    }
                    textBySender[senderDid].count += 1;
                    if (createdAt > textBySender[senderDid].latest) {
                        textBySender[senderDid].latest = createdAt;
                    }
                }
            }
            
            return {
                status: 'ok',
                total: visibleTotal,
                by_type: byType,
                text_messages: textCount,
                text_by_sender: textBySender
            };
        } finally {
            await client.close();
        }
    } catch (error) {
        return { status: 'error', error: error.message, total: 0 };
    }
}

/**
 * Automatically process E2EE protocol messages (init/rekey/error) in inbox.
 * @param {string} credentialName - Credential name
 * @returns {Promise<Object>} Processing results
 */
async function auto_process_e2ee(credentialName = 'default') {
    const config = createSDKConfig();
    const authResult = await createAuthenticator(credentialName, config);
    if (authResult === null) {
        return { status: 'no_identity', processed: 0, details: [] };
    }

    const [auth, data] = authResult;
    try {
        const client = await createMoltMessageClient(config);
        try {
            // Get inbox
            const inbox = await authenticatedRpcCall(
                client,
                MESSAGE_RPC,
                'get_inbox',
                { user_did: data.did, limit: 50 },
                auth,
                credentialName
            );
            const messages = inbox.messages || [];
            
            // Filter E2EE protocol messages (excluding encrypted messages themselves)
            const e2eeMsgs = messages.filter(m => _E2EE_HANDSHAKE_TYPES.has(m.type));
            
            if (e2eeMsgs.length === 0) {
                return { status: 'ok' };
            }
            
            // Sort by sender stream + server_seq, fallback to created_at
            e2eeMsgs.sort((a, b) => {
                const keyA = _message_sort_key(a);
                const keyB = _message_sort_key(b);
                for (let i = 0; i < keyA.length; i++) {
                    if (keyA[i] < keyB[i]) return -1;
                    if (keyA[i] > keyB[i]) return 1;
                }
                return 0;
            });
            
            const e2eeClient = _load_or_create_e2ee_client(data.did, credentialName);
            const processedIds = [];
            
            for (const msg of e2eeMsgs) {
                const msgType = msg.type;
                const senderDid = msg.sender_did || '';
                const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : (msg.content || {});
                
                try {
                    if (msgType === 'e2ee_error') {
                        record_remote_failure(
                            credentialName,
                            senderDid,
                            content
                        );
                    }
                    
                    const responses = await e2eeClient.process_e2ee_message(msgType, content);
                    let sessionReady = true;
                    const terminalErrorNotified = responses.some(([respType]) => respType === 'e2ee_error');
                    
                    if (_E2EE_SESSION_SETUP_TYPES.has(msgType)) {
                        sessionReady = e2eeClient.has_session_id(content.session_id);
                    }
                    
                    // Route responses to sender_did
                    for (const [respType, respContent] of responses) {
                        await _send_msg(
                            client, data.did, senderDid, respType, respContent,
                            auth, credentialName
                        );
                    }
                    
                    if (sessionReady) {
                        processedIds.push(msg.id);
                    } else if (terminalErrorNotified) {
                        processedIds.push(msg.id);
                    }
                } catch (error) {
                    console.warn(
                        `E2EE auto-processing failed type=${msgType} sender=${senderDid} error=${error.message}`
                    );
                }
            }
            
            // Mark processed messages as read
            if (processedIds.length > 0) {
                await authenticatedRpcCall(
                    client,
                    MESSAGE_RPC,
                    'mark_read',
                    { user_did: data.did, message_ids: processedIds },
                    auth,
                    credentialName
                );
            }
            
            // Save E2EE state
            _save_e2ee_client(e2eeClient, credentialName);
            
            return { status: 'ok' };
        } finally {
            await client.close();
        }
    } catch (error) {
        return { status: 'error', error: error.message };
    }
}

/**
 * Unified status check orchestrator.
 * @param {string} credentialName - Credential name
 * @param {boolean} autoE2ee - Whether to auto-process E2EE messages
 * @returns {Promise<Object>} Status report
 */
async function check_status(credentialName = 'default', autoE2ee = true) {
    const report = {
        timestamp: new Date().toISOString()
    };
    
    // Check local database
    report.local_database = ensureLocalDatabaseReady();
    if (report.local_database.status === 'error') {
        report.identity = {
            status: 'local_database_migration_failed',
            did: null,
            name: null,
            jwt_valid: false,
            error: 'Local database migration failed'
        };
        report.inbox = { status: 'skipped', total: 0 };
        report.e2ee_sessions = { active: 0 };
        return report;
    }
    
    // Check credential storage layout
    report.credential_layout = ensureCredentialStorageReady(credentialName);
    if (!report.credential_layout.credential_ready) {
        report.identity = {
            status: 'storage_migration_required',
            did: null,
            name: null,
            jwt_valid: false,
            error: 'Credential storage migration failed or is incomplete'
        };
        report.inbox = { status: 'skipped', total: 0 };
        report.e2ee_sessions = { active: 0 };
        return report;
    }
    
    // Check identity
    report.identity = await check_identity(credentialName);
    
    // Return early if identity does not exist
    if (report.identity.status === 'no_identity') {
        report.inbox = { status: 'skipped', total: 0 };
        report.e2ee_sessions = { active: 0 };
        return report;
    }
    
    // Inbox summary
    report.inbox = await summarize_inbox(credentialName);
    
    // E2EE auto-processing (optional)
    if (autoE2ee) {
        report.e2ee_auto = await auto_process_e2ee(credentialName);
        // Refresh inbox so the report reflects the post-processing state
        report.inbox = await summarize_inbox(credentialName);
    }
    
    // E2EE session status
    const e2eeState = loadE2eeState(credentialName);
    if (e2eeState !== null) {
        const sessions = e2eeState.sessions || [];
        report.e2ee_sessions = { active: sessions.length };
    } else {
        report.e2ee_sessions = { active: 0 };
    }
    
    return report;
}

/**
 * Main function.
 */
async function main() {
    const args = process.argv.slice(2);
    const credentialName = args.includes('--credential') ? args[args.indexOf('--credential') + 1] : 'default';
    const autoE2ee = !args.includes('--no-auto-e2ee');
    
    console.debug(`check_status CLI started credential=${credentialName} auto_e2ee=${autoE2ee}`);
    
    const report = await check_status(credentialName, autoE2ee);
    console.log(JSON.stringify(report, null, 2));
}

// Run if called directly
// Normalize paths for comparison (handle both forward and backward slashes)
const scriptPath = import.meta.url;
const argvPath = `file://${process.argv[1]}`.replace(/\\/g, '/');
// Convert to normalized paths for comparison (normalize file:// protocol)
const normalizePath = (p) => p.replace(/\\/g, '/').replace(/^file:\/\/+/, 'file://').toLowerCase();
if (normalizePath(scriptPath) === normalizePath(argvPath)) {
    main().catch(error => {
        console.error(error);
        process.exit(1);
    });
}

export {
    check_status,
    check_identity,
    summarize_inbox,
    auto_process_e2ee
};
