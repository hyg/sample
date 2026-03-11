/**
 * Transparent E2EE handler for the WebSocket listener.
 *
 * [INPUT]: credential_store (E2EE keys), e2ee_store (state persistence), E2eeClient (encrypt/decrypt),
 *          buildE2eeErrorContent (error response builder)
 * [OUTPUT]: E2eeHandler class (protocol message handling + encrypted message decryption),
 *           DecryptResult (decrypted params + structured error responses)
 * [POS]: E2EE processing module for ws_listener.js, intercepts E2EE messages before classify_message
 *        and emits sender-facing e2ee_error notifications with failed message identifiers
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

import { loadIdentity } from './credential_store.js';
import { loadE2eeState, saveE2eeState } from './e2ee_store.js';
import { record_remote_failure } from './e2ee_outbox.js';
import { E2eeClient, SUPPORTED_E2EE_VERSION } from '../../src/e2ee.js';

const _E2EE_USER_NOTICE = "This is an encrypted message.";

// E2EE message type sets
const _E2EE_ALL_TYPES = new Set(["e2ee_init", "e2ee_ack", "e2ee_msg", "e2ee_rekey", "e2ee_error"]);
const _E2EE_PROTOCOL_TYPES = new Set(["e2ee_init", "e2ee_ack", "e2ee_rekey", "e2ee_error"]);

/**
 * Build an E2EE error payload without relying on a newer ANP package release.
 * @param {Object} params - Parameters
 * @param {string} params.error_code - Error code
 * @param {string|null} params.session_id - Session ID
 * @param {string|null} params.failed_msg_id - Failed message ID
 * @param {number|null} params.failed_server_seq - Failed server sequence
 * @param {string|null} params.retry_hint - Retry hint
 * @param {string|null} params.required_e2ee_version - Required E2EE version
 * @param {string|null} params.message - Error message
 * @returns {Object} E2EE error content
 */
export function buildE2eeErrorContent({
    error_code,
    session_id = null,
    failed_msg_id = null,
    failed_server_seq = null,
    retry_hint = null,
    required_e2ee_version = null,
    message = null
}) {
    const content = {
        e2ee_version: SUPPORTED_E2EE_VERSION,
        error_code: error_code,
    };
    if (session_id !== null) content.session_id = session_id;
    if (failed_msg_id !== null) content.failed_msg_id = failed_msg_id;
    if (failed_server_seq !== null) content.failed_server_seq = failed_server_seq;
    if (retry_hint !== null) content.retry_hint = retry_hint;
    if (required_e2ee_version !== null) content.required_e2ee_version = required_e2ee_version;
    if (message !== null) content.message = message;
    return content;
}

/**
 * Build a consistent human-readable e2ee_error message.
 * @param {string} error_code - Error code
 * @param {Object} params - Additional parameters
 * @param {string|null} params.required_e2ee_version - Required E2EE version
 * @param {string|null} params.detail - Error detail
 * @returns {string} Error message
 */
export function buildE2eeErrorMessage(error_code, { required_e2ee_version = null, detail = null } = {}) {
    const version = required_e2ee_version || SUPPORTED_E2EE_VERSION;
    const baseMessages = {
        "unsupported_version": `Peer E2EE content version is unsupported. Please upgrade to e2ee_version=${version}.`,
        "session_not_found": "E2EE session was not found on the receiver. Please rekey or re-initialize before resending.",
        "session_expired": "E2EE session has expired. Please rekey and resend the message.",
        "invalid_seq": "Message sequence is invalid. Please rekey and resend the message.",
        "decryption_failed": "Message decryption failed. Please resend the message.",
    };
    let message = baseMessages[error_code] || `E2EE error: ${error_code}`;
    if (detail) {
        message += ` Detail: ${detail}`;
    }
    return message;
}

/**
 * Result of decrypt_message: decrypted params + error responses to send.
 * @typedef {Object} DecryptResult
 * @property {Object|null} params - Decrypted parameters
 * @property {Array<[string, Object]>} error_responses - Error responses to send
 */

/**
 * E2EE handler for the WebSocket listener.
 * 
 * Responsibilities:
 * - Protocol messages (init/rekey/error): handled internally, not forwarded to webhook
 * - Encrypted messages (e2ee_msg): decrypted and returned as plaintext params for routing
 */
export class E2eeHandler {
    /**
     * Create E2EE handler.
     * @param {string} credentialName - Credential name
     * @param {number} saveInterval - Save interval in seconds (default: 30)
     * @param {string} decryptFailAction - Action on decryption failure (default: "drop")
     */
    constructor(credentialName, saveInterval = 30.0, decryptFailAction = "drop") {
        this._credentialName = credentialName;
        this._saveInterval = saveInterval;
        this._decryptFailAction = decryptFailAction;

        this._client = null;
        this._lock = false;
        this._dirty = false;
        this._lastSaveTime = 0.0;
    }

    /**
     * Initialize: load E2EE keys from credential + restore session state from disk.
     * @param {string} localDid - Local DID identifier
     * @returns {Promise<boolean>} Whether initialization was successful
     */
    async initialize(localDid) {
        try {
            const cred = loadIdentity(this._credentialName);
            let signingPem = null;
            let x25519Pem = null;
            if (cred !== null) {
                signingPem = cred.e2ee_signing_private_pem;
                x25519Pem = cred.e2ee_agreement_private_pem;
            }

            if (!signingPem || !x25519Pem) {
                console.warn(`Credential '${this._credentialName}' is missing E2EE keys`);
                return false;
            }

            const state = loadE2eeState(this._credentialName);
            if (state !== null && state.local_did === localDid) {
                state.signing_pem = signingPem;
                state.x25519_pem = x25519Pem;
                this._client = E2eeClient.from_state(state);
            } else {
                this._client = new E2eeClient(localDid, signingPem, x25519Pem);
            }

            this._lastSaveTime = Date.now() / 1000;
            console.log(`E2EE handler initialized successfully, DID=${localDid}`);
            return true;
        } catch (error) {
            console.error('E2EE handler initialization failed:', error);
            return false;
        }
    }

    /**
     * Whether the E2EE client is ready.
     * @returns {boolean} Ready status
     */
    get isReady() {
        return this._client !== null;
    }

    /**
     * Check whether the message type belongs to the E2EE category.
     * @param {string} msgType - Message type
     * @returns {boolean} True if E2EE type
     */
    isE2eeType(msgType) {
        return _E2EE_ALL_TYPES.has(msgType);
    }

    /**
     * Check whether the message type is an E2EE protocol message.
     * @param {string} msgType - Message type
     * @returns {boolean} True if protocol type
     */
    isProtocolType(msgType) {
        return _E2EE_PROTOCOL_TYPES.has(msgType);
    }

    /**
     * Handle E2EE protocol messages (init/rekey/error).
     * @param {Object} params - The params field from the WebSocket push notification
     * @returns {Promise<Array<[string, Object]>>} List of responses to send
     */
    async handleProtocolMessage(params) {
        if (this._client === null) {
            return [];
        }

        const msgType = params.type || "";
        const senderDid = params.sender_did || "";
        const rawContent = params.content || "";

        let content;
        try {
            content = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
        } catch (error) {
            console.warn(`Failed to parse E2EE protocol message content: type=${msgType}`);
            return [];
        }

        // Simple lock implementation
        while (this._lock) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        this._lock = true;

        try {
            if (msgType === "e2ee_error") {
                const matchedOutbox = record_remote_failure(
                    this._credentialName,
                    senderDid,
                    content
                );
                if (matchedOutbox) {
                    console.log(`Updated failed E2EE outbox record: ${matchedOutbox}`);
                }
            }
            const responses = await this._client.process_e2ee_message(msgType, content);
            this._dirty = true;
            console.log(
                `E2EE protocol message processed: type=${msgType} sender=${senderDid.substring(0, 20)} responses=${responses.length}`
            );
            return responses;
        } catch (error) {
            console.error(
                `E2EE protocol message processing error: type=${msgType} sender=${senderDid.substring(0, 20)}:`,
                error
            );
            return [];
        } finally {
            this._lock = false;
        }
    }

    /**
     * Decrypt an e2ee_msg message.
     * On success, returns DecryptResult with plaintext params and no error responses.
     * On failure, returns DecryptResult with fallback params and an e2ee_error response.
     * @param {Object} params - The params field from the WebSocket push notification
     * @returns {Promise<DecryptResult>} DecryptResult with decrypted params and error responses
     */
    async decryptMessage(params) {
        if (this._client === null) {
            return { params: this._onDecryptFail(params), error_responses: [] };
        }

        const rawContent = params.content || "";
        let content;
        try {
            content = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
        } catch (error) {
            console.warn("Failed to parse E2EE message content");
            return { params: this._onDecryptFail(params), error_responses: [] };
        }

        // Simple lock implementation
        while (this._lock) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        this._lock = true;

        try {
            let originalType, plaintext;
            try {
                [originalType, plaintext] = await this._client.decrypt_message(content);
                this._dirty = true;
            } catch (exc) {
                console.error(
                    `E2EE message decryption failed: sender=${(params.sender_did || "").substring(0, 20)}:`,
                    exc
                );
                const [error_code, retry_hint] = this._classifyError(exc);
                const errorContent = buildE2eeErrorContent({
                    error_code: error_code,
                    session_id: typeof content === 'object' && content !== null ? content.session_id : null,
                    failed_msg_id: params.id,
                    failed_server_seq: params.server_seq,
                    retry_hint: retry_hint,
                    required_e2ee_version: error_code === "unsupported_version" ? SUPPORTED_E2EE_VERSION : null,
                    message: buildE2eeErrorMessage(error_code, {
                        required_e2ee_version: error_code === "unsupported_version" ? SUPPORTED_E2EE_VERSION : null,
                        detail: exc.message
                    })
                });
                return {
                    params: this._onDecryptFail(params),
                    error_responses: [["e2ee_error", errorContent]]
                };
            }

            // Build plaintext params: replace type and content, add _e2ee marker
            const decryptedParams = { ...params };
            decryptedParams.type = originalType;
            decryptedParams.content = plaintext;
            decryptedParams._e2ee = true;
            decryptedParams._e2ee_notice = _E2EE_USER_NOTICE;
            console.log(
                `E2EE message decrypted successfully: sender=${(params.sender_did || "").substring(0, 20)} original_type=${originalType}`
            );
            return { params: decryptedParams, error_responses: [] };
        } finally {
            this._lock = false;
        }
    }

    /**
     * Periodic save: write to disk when dirty and save_interval has elapsed.
     */
    async maybeSaveState() {
        if (!this._dirty || this._client === null) {
            return;
        }
        const now = Date.now() / 1000;
        if (now - this._lastSaveTime < this._saveInterval) {
            return;
        }
        await this._doSave();
    }

    /**
     * Force save: used during shutdown and disconnection.
     */
    async forceSaveState() {
        if (!this._dirty || this._client === null) {
            return;
        }
        await this._doSave();
    }

    /**
     * Execute state save.
     */
    async _doSave() {
        if (this._client === null) {
            return;
        }
        try {
            // Simple lock implementation
            while (this._lock) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            this._lock = true;

            const state = this._client.exportState();
            saveE2eeState(state, this._credentialName);
            this._dirty = false;
            this._lastSaveTime = Date.now() / 1000;
            console.debug("E2EE state saved");
        } catch (error) {
            console.error("E2EE state save failed:", error);
        } finally {
            this._lock = false;
        }
    }

    /**
     * Map a decryption exception to an E2EE error code and retry hint.
     * @param {Error} exc - Exception
     * @returns {[string, string]} Error code and retry hint
     */
    _classifyError(exc) {
        const msg = exc.message.toLowerCase();
        if (msg.includes("unsupported_version")) {
            return ["unsupported_version", "drop"];
        }
        if (msg.includes("session") && (msg.includes("not found") || msg.includes("find session"))) {
            return ["session_not_found", "rekey_then_resend"];
        }
        if (msg.includes("expired")) {
            return ["session_expired", "rekey_then_resend"];
        }
        if (msg.includes("seq") || msg.includes("sequence")) {
            return ["invalid_seq", "rekey_then_resend"];
        }
        return ["decryption_failed", "resend"];
    }

    /**
     * Fallback strategy on decryption failure.
     * @param {Object} params - Original params
     * @returns {Object|null} Fallback params or null
     */
    _onDecryptFail(params) {
        if (this._decryptFailAction === "forward_raw") {
            return params;
        }
        return null;
    }
}

// DecryptResult is a JSDoc type definition, not a class
