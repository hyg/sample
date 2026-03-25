/**
 * Transparent E2EE handler for the WebSocket listener.
 *
 * Node.js implementation based on Python version:
 * python/scripts/e2ee_handler.py
 *
 * [INPUT]: credential_store (E2EE keys), SQLite-backed session store,
 *          E2eeClient (encrypt/decrypt), build_e2ee_error (error response builder)
 * [OUTPUT]: E2eeHandler class (protocol message handling + encrypted message decryption),
 *           DecryptResult NamedTuple (decrypted params + structured error responses)
 * [POS]: E2EE processing module for ws_listener.py, intercepts E2EE messages before
 *        classify_message, keeps SQLite as the single session truth source, and
 *        emits sender-facing e2ee_error notifications with failed message identifiers
 */

const { load_identity } = require('./credential-store');
const { E2eeStateTransaction, load_e2ee_client } = require('./e2ee-session-store');
const { record_remote_failure } = require('./e2ee-outbox');
const {
  SUPPORTED_E2EE_VERSION,
  build_e2ee_error_content,
  build_e2ee_error_message
} = require('./utils/e2ee');

const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warning: (...args) => console.warn('[WARNING]', ...args),
  exception: (...args) => console.error('[ERROR]', ...args)
};

const _E2EE_USER_NOTICE = "This is an encrypted message.";

// E2EE message type sets
const _E2EE_ALL_TYPES = new Set(["e2ee_init", "e2ee_ack", "e2ee_msg", "e2ee_rekey", "e2ee_error"]);
const _E2EE_PROTOCOL_TYPES = new Set(["e2ee_init", "e2ee_ack", "e2ee_rekey", "e2ee_error"]);

/**
 * Result of decrypt_message: decrypted params + error responses to send.
 * @typedef {Object} DecryptResult
 * @property {Object|null} params - Decrypted params or null
 * @property {Array<[string, Object]>} error_responses - Error responses to send
 */

/**
 * E2EE handler for the WebSocket listener.
 *
 * Responsibilities:
 * - Protocol messages (init/rekey/error): handled internally, not forwarded to webhook
 * - Encrypted messages (e2ee_msg): decrypted and returned as plaintext params for routing
 */
class E2eeHandler {
  /**
   * Initialize E2EE handler.
   *
   * @param {string} credentialName - Credential name
   * @param {number} [saveInterval=30.0] - State save interval (seconds)
   * @param {string} [decryptFailAction="drop"] - Decrypt fail action ("drop" or "forward_raw")
   */
  constructor(credentialName, saveInterval = 30.0, decryptFailAction = "drop") {
    this._credential_name = credentialName;
    this._save_interval = saveInterval;
    this._decrypt_fail_action = decryptFailAction;

    this._local_did = null;
    this._lock = null; // Node.js doesn't need explicit asyncio.Lock for single-threaded execution
  }

  /**
   * Initialize: validate E2EE keys and ensure SQLite-backed state is loadable.
   *
   * @param {string} localDid - Local DID identifier.
   * @returns {Promise<boolean>} Whether initialization was successful.
   */
  async initialize(localDid) {
    try {
      const cred = load_identity(this._credential_name);
      let signingPem = null;
      let x25519Pem = null;
      if (cred !== null) {
        signingPem = cred.e2ee_signing_private_pem || null;
        x25519Pem = cred.e2ee_agreement_private_pem || null;
      }

      if (signingPem === null || x25519Pem === null) {
        logger.warning(`Credential '${this._credential_name}' is missing E2EE keys`);
        return false;
      }

      load_e2ee_client(localDid, this._credential_name);
      this._local_did = localDid;
      logger.info(`E2EE handler initialized successfully, DID=${localDid}`);
      return true;

    } catch (exc) {
      logger.exception(`E2EE handler initialization failed: ${exc.message}`);
      return false;
    }
  }

  /**
   * Whether the E2EE client is ready.
   * @returns {boolean} True if ready.
   */
  get is_ready() {
    return this._local_did !== null;
  }

  /**
   * Check whether the message type belongs to the E2EE category.
   *
   * @param {string} msgType - Message type.
   * @returns {boolean} True if E2EE type.
   */
  is_e2ee_type(msgType) {
    return _E2EE_ALL_TYPES.has(msgType);
  }

  /**
   * Check whether the message type is an E2EE protocol message (handled internally, not forwarded).
   *
   * @param {string} msgType - Message type.
   * @returns {boolean} True if protocol type.
   */
  is_protocol_type(msgType) {
    return _E2EE_PROTOCOL_TYPES.has(msgType);
  }

  /**
   * Handle E2EE protocol messages (init/rekey/error).
   *
   * @param {Object} params - The params field from the WebSocket push notification.
   * @returns {Promise<Array<[string, Object]>>} List of responses to send (usually empty for the HPKE scheme).
   */
  async handle_protocol_message(params) {
    if (this._local_did === null) {
      return [];
    }

    const msgType = params.type || "";
    const senderDid = params.sender_did || "";
    const rawContent = params.content || "";

    let content;
    try {
      content = typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;
    } catch (exc) {
      logger.warning(`Failed to parse E2EE protocol message content: type=${msgType}`);
      return [];
    }

    if (msgType === "e2ee_error" && typeof content === "object" && content !== null && senderDid) {
      content = { ...content };
      if (!content.sender_did) {
        content.sender_did = senderDid;
      }
    }

    try {
      const stateTx = new E2eeStateTransaction({ localDid: this._local_did, credentialName: this._credential_name });
      try {
        const client = stateTx.client;
        if (msgType === "e2ee_error") {
          const matchedOutbox = record_remote_failure({
            credential_name: this._credential_name,
            peer_did: senderDid,
            content: content
          });
          if (matchedOutbox) {
            logger.info(`Updated failed E2EE outbox record: ${matchedOutbox}`);
          }
        }
        const responses = await client.process_e2ee_message(msgType, content);
        stateTx.commit();
        logger.info(
          `E2EE protocol message processed: type=${msgType} sender=${senderDid.substring(0, 20)} responses=${responses.length}`
        );
        return responses;
      } finally {
        if (!stateTx._closed) {
          stateTx.close();
        }
      }
    } catch (exc) {
      logger.exception(
        `E2EE protocol message processing error: type=${msgType} sender=${senderDid.substring(0, 20)}: ${exc.message}`
      );
      return [];
    }
  }

  /**
   * Decrypt an e2ee_msg message.
   *
   * On success, returns DecryptResult with plaintext params and no error responses.
   * On failure, returns DecryptResult with fallback params and an e2ee_error response
   * to notify the sender.
   *
   * @param {Object} params - The params field from the WebSocket push notification.
   * @returns {Promise<DecryptResult>} DecryptResult with decrypted params and error responses.
   */
  async decrypt_message(params) {
    if (this._local_did === null) {
      return new DecryptResult(this._on_decrypt_fail(params), []);
    }

    const rawContent = params.content || "";
    let content;
    try {
      content = typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;
    } catch (exc) {
      logger.warning("Failed to parse E2EE message content");
      return new DecryptResult(this._on_decrypt_fail(params), []);
    }

    let stateTx;
    try {
      stateTx = new E2eeStateTransaction({ localDid: this._local_did, credentialName: this._credential_name });
      const client = stateTx.client;
      let originalType, plaintext;
      try {
        [originalType, plaintext] = client.decrypt_message(content);
        stateTx.commit();
      } catch (exc) {
        stateTx.close();
        logger.exception(
          `E2EE message decryption failed: sender=${(params.sender_did || "").substring(0, 20)}: ${exc.message}`
        );
        const [errorCode, retryHint] = this._classify_error(exc);
        const errorContent = build_e2ee_error_content(
          errorCode,
          {
            sessionId: typeof content === "object" && content !== null ? content.session_id : null,
            failedMsgId: params.id,
            failedServerSeq: params.server_seq,
            retryHint: retryHint,
            requiredE2eeVersion: errorCode === "unsupported_version" ? SUPPORTED_E2EE_VERSION : null,
            message: build_e2ee_error_message(
              errorCode,
              {
                requiredE2eeVersion: errorCode === "unsupported_version" ? SUPPORTED_E2EE_VERSION : null,
                detail: String(exc)
              }
            )
          }
        );
        return new DecryptResult(
          this._on_decrypt_fail(params),
          [["e2ee_error", errorContent]]
        );
      }

      // Build plaintext params: replace type and content, add _e2ee marker
      const decryptedParams = { ...params };
      decryptedParams.type = originalType;
      decryptedParams.content = plaintext;
      decryptedParams._e2ee = true;
      decryptedParams._e2ee_notice = _E2EE_USER_NOTICE;
      logger.info(
        `E2EE message decrypted successfully: sender=${(params.sender_did || "").substring(0, 20)} original_type=${originalType}`
      );
      return new DecryptResult(decryptedParams, []);
    } finally {
      if (stateTx && !stateTx._closed) {
        stateTx.close();
      }
    }
  }

  /**
   * Compatibility no-op: state is persisted immediately after each mutation.
   * @returns {Promise<void>}
   */
  async maybe_save_state() {
    return null;
  }

  /**
   * Compatibility no-op: state is persisted immediately after each mutation.
   * @returns {Promise<void>}
   */
  async force_save_state() {
    return null;
  }

  /**
   * Compatibility no-op: state is persisted immediately after each mutation.
   * @returns {Promise<void>}
   */
  async _do_save() {
    return null;
  }

  /**
   * Map a decryption exception to an E2EE error code and retry hint.
   *
   * @param {Error} exc - Exception object.
   * @returns {[string, string]} [error_code, retry_hint] tuple.
   */
  _classify_error(exc) {
    const msg = String(exc.message || exc).toLowerCase();
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
   *
   * @param {Object} params - Original params.
   * @returns {Object|null} Fallback params or null.
   */
  _on_decrypt_fail(params) {
    if (this._decrypt_fail_action === "forward_raw") {
      return params;
    }
    return null;
  }
}

/**
 * DecryptResult NamedTuple implementation.
 */
class DecryptResult {
  /**
   * Create a DecryptResult.
   *
   * @param {Object|null} params - Decrypted params or null.
   * @param {Array<[string, Object]>} errorResponses - Error responses to send.
   */
  constructor(params, errorResponses) {
    this.params = params;
    this.error_responses = errorResponses;
  }
}

module.exports = {
  E2eeHandler,
  DecryptResult
};
