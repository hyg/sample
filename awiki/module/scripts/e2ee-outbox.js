/**
 * E2EE outbox helpers for resendable private encrypted messages.
 *
 * Node.js implementation based on Python version:
 * python/scripts/e2ee_outbox.py
 *
 * [INPUT]: local_store (SQLite persistence), outgoing encrypted message context,
 *          incoming e2ee_error payloads
 * [OUTPUT]: begin_send_attempt(), mark_send_success(), record_remote_failure(),
 *          list_failed_records(), get_record(), mark_dropped()
 * [POS]: Persistence helper layer between E2EE messaging scripts/listener and SQLite
 *       outbox state, enabling user-driven resend decisions after peer-side failures
 */

const { load_identity } = require('./credential-store');
const local_store = require('./local-store');

/**
 * Open database connection.
 * @returns {object} Database connection
 * @private
 */
function _open_db() {
  const conn = local_store.get_connection();
  local_store.ensure_schema(conn);
  return conn;
}

/**
 * Resolve owner_did from credential storage.
 * @param {string} credential_name - Credential name
 * @returns {string} Owner DID
 * @private
 */
function _load_owner_did(credential_name) {
  const credential = load_identity(credential_name);
  if (credential === null || !credential.did) {
    throw new Error(`Credential '${credential_name}' is unavailable`);
  }
  return String(credential.did);
}

/**
 * Create or reset an E2EE outbox entry before attempting network send.
 *
 * @param {object} options - Options
 * @param {string} options.peer_did - Peer DID
 * @param {string} options.plaintext - Plaintext content
 * @param {string} options.original_type - Original message type
 * @param {string} options.credential_name - Credential name
 * @param {string|null} [options.session_id] - Session ID
 * @param {string|null} [options.outbox_id] - Outbox ID (for reset)
 * @returns {string} Outbox ID
 */
function begin_send_attempt({
  peer_did,
  plaintext,
  original_type,
  credential_name,
  session_id = null,
  outbox_id = null,
}) {
  const owner_did = _load_owner_did(credential_name);
  const conn = _open_db();
  try {
    if (outbox_id === null) {
      return local_store.queue_e2ee_outbox(conn, {
        owner_did,
        peer_did,
        plaintext,
        session_id,
        original_type,
        credential_name,
      });
    }
    local_store.update_e2ee_outbox_status(conn, {
      outbox_id,
      local_status: 'queued',
      owner_did,
      credential_name,
    });
    return outbox_id;
  } finally {
    conn.close();
  }
}

/**
 * Persist a successful encrypted send into outbox and local messages.
 *
 * @param {object} options - Options
 * @param {string} options.outbox_id - Outbox ID
 * @param {string} options.credential_name - Credential name
 * @param {string} options.local_did - Local DID
 * @param {string} options.peer_did - Peer DID
 * @param {string} options.plaintext - Plaintext content
 * @param {string} options.original_type - Original message type
 * @param {string|null} [options.session_id] - Session ID
 * @param {string|null} [options.sent_msg_id] - Sent message ID
 * @param {number|null} [options.sent_server_seq] - Sent server sequence
 * @param {string|null} [options.sent_at] - Sent timestamp
 * @param {string} options.client_msg_id - Client message ID
 * @param {string|null} [options.title] - Title
 */
function mark_send_success({
  outbox_id,
  credential_name,
  local_did,
  peer_did,
  plaintext,
  original_type,
  session_id = null,
  sent_msg_id = null,
  sent_server_seq = null,
  sent_at = null,
  client_msg_id,
  title = null,
}) {
  const conn = _open_db();
  try {
    const metadata = JSON.stringify({
      outbox_id,
      session_id,
      client_msg_id,
    });

    local_store.mark_e2ee_outbox_sent(conn, {
      outbox_id,
      owner_did: local_did,
      credential_name,
      session_id,
      sent_msg_id,
      sent_server_seq,
      metadata,
    });

    local_store.store_message(conn, {
      msg_id: sent_msg_id || outbox_id,
      owner_did: local_did,
      thread_id: local_store.make_thread_id(local_did, { peer_did }),
      direction: 1,
      sender_did: local_did,
      receiver_did: peer_did,
      content_type: original_type,
      content: plaintext,
      title,
      server_seq: sent_server_seq,
      sent_at,
      is_e2ee: true,
      credential_name,
      metadata,
    });

    local_store.upsert_contact(conn, {
      owner_did: local_did,
      did: peer_did,
    });
  } finally {
    conn.close();
  }
}

/**
 * Update the best matching outbox entry from a received e2ee_error payload.
 *
 * @param {object} options - Options
 * @param {string} options.credential_name - Credential name
 * @param {string} options.peer_did - Peer DID
 * @param {object} options.content - E2EE error content
 * @returns {string|null} Outbox ID or null
 */
function record_remote_failure({ credential_name, peer_did, content }) {
  const owner_did = _load_owner_did(credential_name);
  const conn = _open_db();
  try {
    return local_store.mark_e2ee_outbox_failed(conn, {
      owner_did,
      credential_name,
      peer_did,
      session_id: content.session_id,
      failed_msg_id: content.failed_msg_id,
      failed_server_seq: content.failed_server_seq,
      error_code: String(content.error_code || 'unknown'),
      retry_hint: content.retry_hint,
      metadata: JSON.stringify(content),
    });
  } finally {
    conn.close();
  }
}

/**
 * List failed E2EE outbox entries for the credential.
 *
 * @param {string} credential_name - Credential name
 * @returns {object[]} List of failed outbox records
 */
function list_failed_records(credential_name) {
  const owner_did = _load_owner_did(credential_name);
  const conn = _open_db();
  try {
    return local_store.list_e2ee_outbox(conn, {
      owner_did,
      credential_name,
      local_status: 'failed',
    });
  } finally {
    conn.close();
  }
}

/**
 * Fetch one E2EE outbox record.
 *
 * @param {string} outbox_id - Outbox ID
 * @param {string} credential_name - Credential name
 * @returns {object|null} Outbox record or null
 */
function get_record(outbox_id, credential_name) {
  const owner_did = _load_owner_did(credential_name);
  const conn = _open_db();
  try {
    return local_store.get_e2ee_outbox(conn, {
      outbox_id,
      owner_did,
      credential_name,
    });
  } finally {
    conn.close();
  }
}

/**
 * Mark an E2EE outbox record as dropped by the local user.
 *
 * @param {string} outbox_id - Outbox ID
 * @param {string} credential_name - Credential name
 */
function mark_dropped(outbox_id, credential_name) {
  const owner_did = _load_owner_did(credential_name);
  const conn = _open_db();
  try {
    local_store.update_e2ee_outbox_status(conn, {
      outbox_id,
      local_status: 'dropped',
      owner_did,
      credential_name,
    });
  } finally {
    conn.close();
  }
}

/**
 * Mark a local send attempt as failed before any peer response exists.
 *
 * @param {object} options - Options
 * @param {string} options.outbox_id - Outbox ID
 * @param {string} options.credential_name - Credential name
 * @param {string} options.error_code - Error code
 * @param {string|null} [options.retry_hint] - Retry hint
 * @param {string|null} [options.metadata] - Metadata
 */
function record_local_failure({
  outbox_id,
  credential_name,
  error_code,
  retry_hint = null,
  metadata = null,
}) {
  const owner_did = _load_owner_did(credential_name);
  const conn = _open_db();
  try {
    local_store.set_e2ee_outbox_failure_by_id(conn, {
      outbox_id,
      owner_did,
      credential_name,
      error_code,
      retry_hint,
      metadata,
    });
  } finally {
    conn.close();
  }
}

module.exports = {
  begin_send_attempt,
  mark_send_success,
  record_remote_failure,
  record_local_failure,
  list_failed_records,
  get_record,
  mark_dropped,
};
