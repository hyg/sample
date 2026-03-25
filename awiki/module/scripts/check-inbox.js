/**
 * Check inbox, view private/group history, and mark messages as read.
 *
 * Node.js implementation based on Python version:
 * python/scripts/check_inbox.py
 *
 * [INPUT]: SDK (RPC calls), credential_store (load identity credentials), local_store,
 *          E2EE runtime helpers, group RPC history reads, outbox tracking,
 *          listener recovery helpers, logging_config
 * [OUTPUT]: Inbox message list / private-or-group history / mark-read result,
 *          with optional auto-mark-read during inbox fetches, immediate private
 *          E2EE protocol processing, plaintext decryption when possible, local
 *          group snapshot persistence, automatic local incremental cursors for
 *          group history reads, HTTP fallback when WebSocket mode is degraded,
 *          and best-effort HTTP inbox sync even while WebSocket local-cache mode
 *          is active
 * [POS]: Unified message receiving and history script for private chats and
 *       discovery-group reads
 */

const fs = require('fs');
const path = require('path');
const { SDKConfig } = require('./utils/config');
const { E2eeClient } = require('./utils/e2ee');
const { create_molt_message_client, create_user_service_client } = require('./utils/client');
const { authenticated_rpc_call } = require('./utils/rpc');
const { resolve_to_did } = require('./utils/resolve');
const { create_authenticator, load_identity } = require('./credential-store');
const { record_remote_failure } = require('./e2ee-outbox');
const { load_e2ee_client, save_e2ee_client } = require('./e2ee-session-store');
const { ensure_listener_runtime } = require('./listener_recovery');
const { is_websocket_mode, MESSAGE_RPC } = require('./message_transport');
const {
  SUPPORTED_E2EE_VERSION,
  build_e2ee_error_content,
  build_e2ee_error_message,
} = require('./utils/e2ee');
const local_store = require('./local-store');
const { _persist_group_messages } = require('./manage-group');

const GROUP_RPC = '/group/rpc';
const _E2EE_MSG_TYPES = new Set(['e2ee_init', 'e2ee_ack', 'e2ee_msg', 'e2ee_rekey', 'e2ee_error']);
const _E2EE_SESSION_SETUP_TYPES = new Set(['e2ee_init', 'e2ee_rekey']);
const _E2EE_TYPE_ORDER = { e2ee_init: 0, e2ee_ack: 1, e2ee_rekey: 2, e2ee_msg: 3, e2ee_error: 4 };
const _E2EE_USER_NOTICE = 'This is an encrypted message.';
const _MESSAGE_SCOPES = new Set(['all', 'direct', 'group']);

/**
 * Return one stable message ID if present.
 * @param {object} message - Message object
 * @returns {string|null} Message ID or null
 */
function _message_id(message) {
  for (const key of ['id', 'msg_id']) {
    const value = message[key];
    if (typeof value === 'string' && value) {
      return value;
    }
  }
  return null;
}

/**
 * Merge message IDs while preserving their first-seen order.
 * @param  {...string[]} message_id_groups - Groups of message IDs
 * @returns {string[]} Merged message IDs
 */
function _merge_message_ids(...message_id_groups) {
  const merged = [];
  const seen = new Set();
  for (const group of message_id_groups) {
    for (const message_id of group) {
      if (!message_id || seen.has(message_id)) {
        continue;
      }
      seen.add(message_id);
      merged.push(message_id);
    }
  }
  return merged;
}

/**
 * Collect incoming message IDs that can be marked as read.
 * @param {object[]} messages - Messages
 * @param {object} options - Options
 * @param {string|null} [options.local_did] - Local DID
 * @returns {string[]} Collectable message IDs
 */
function _collect_readable_message_ids(messages, { local_did = null } = {}) {
  const collected = [];
  for (const message of messages) {
    const message_id = _message_id(message);
    if (!message_id) {
      continue;
    }
    const sender_did = message.sender_did;
    if (local_did && typeof sender_did === 'string' && sender_did === local_did) {
      continue;
    }
    collected.push(message_id);
  }
  return _merge_message_ids(collected);
}

/**
 * Return a sortable timestamp string for one message.
 * @param {object} message - Message object
 * @returns {string} Timestamp string
 */
function _message_time_value(message) {
  const timestamp = message.sent_at || message.created_at;
  return typeof timestamp === 'string' ? timestamp : '';
}

/**
 * Build a stable E2EE inbox ordering key with server_seq priority inside a sender stream.
 * @param {object} message - Message object
 * @returns {any[]} Sort key tuple
 */
function _message_sort_key(message) {
  const sender_did_raw = message.sender_did;
  const sender_did = typeof sender_did_raw === 'string' ? sender_did_raw : '';
  const server_seq = message.server_seq;
  const has_server_seq = typeof server_seq === 'number' ? 0 : 1;
  const server_seq_value = typeof server_seq === 'number' ? server_seq : 0;
  return [
    sender_did,
    has_server_seq,
    server_seq_value,
    _message_time_value(message),
    _E2EE_TYPE_ORDER[message.type] || 99,
  ];
}

/**
 * Decorate a decrypted E2EE message for user-facing output.
 * @param {object} message - Message object
 * @param {object} options - Options
 * @param {string} options.original_type - Original message type
 * @param {string} options.plaintext - Decrypted plaintext
 * @returns {object} Decorated message
 */
function _decorate_user_visible_e2ee_message(message, { original_type, plaintext }) {
  const rendered = { ...message };
  rendered.type = original_type;
  rendered.content = plaintext;
  rendered._e2ee = true;
  rendered._e2ee_notice = _E2EE_USER_NOTICE;
  delete rendered.title;
  return rendered;
}

/**
 * Remove fields intentionally hidden from user-facing output.
 * @param {object} message - Message object
 * @returns {object} Stripped message
 */
function _strip_hidden_user_fields(message) {
  const rendered = { ...message };
  delete rendered.title;
  return rendered;
}

/**
 * Filter mixed inbox messages by the requested scope.
 * @param {object[]} messages - Messages
 * @param {string} scope - Scope ('all', 'direct', 'group')
 * @returns {object[]} Filtered messages
 */
function _filter_messages_by_scope(messages, scope) {
  if (!_MESSAGE_SCOPES.has(scope) || scope === 'all') {
    return messages;
  }
  if (scope === 'group') {
    return messages.filter(msg => msg.group_id);
  }
  return messages.filter(msg => !msg.group_id);
}

/**
 * Build a stable deduplication key for merged inbox messages.
 * @param {object} message - Message object
 * @returns {any[]} Deduplication key tuple
 */
function _message_dedup_key(message) {
  const message_id = _message_id(message);
  if (message_id) {
    return ['id', message_id];
  }
  return [
    'fallback',
    message.sender_did,
    message.receiver_did,
    message.group_id,
    message.type,
    message.content,
    _message_time_value(message),
  ];
}

/**
 * Build a descending-friendly display key for merged inbox messages.
 * @param {object} message - Message object
 * @returns {any[]} Display sort key tuple
 */
function _message_display_sort_key(message) {
  const server_seq = message.server_seq;
  const has_server_seq = typeof server_seq === 'number' ? 1 : 0;
  const server_seq_value = typeof server_seq === 'number' ? server_seq : -1;
  return [
    has_server_seq,
    server_seq_value,
    _message_time_value(message),
    String(message.id || message.msg_id || ''),
  ];
}

/**
 * Merge local unread cache with remote HTTP inbox messages.
 * @param {object[]} local_messages - Local messages
 * @param {object[]} remote_messages - Remote messages
 * @param {object} options - Options
 * @param {number} options.limit - Limit
 * @returns {object[]} Merged messages
 */
function _merge_inbox_messages(local_messages, remote_messages, { limit }) {
  const merged_by_key = new Map();
  for (const message of remote_messages) {
    merged_by_key.set(JSON.stringify(_message_dedup_key(message)), { ...message });
  }
  for (const message of local_messages) {
    merged_by_key.set(JSON.stringify(_message_dedup_key(message)), { ...message });
  }
  const merged = Array.from(merged_by_key.values());
  merged.sort((a, b) => {
    const key_a = _message_display_sort_key(a);
    const key_b = _message_display_sort_key(b);
    for (let i = 0; i < key_a.length; i++) {
      if (key_a[i] < key_b[i]) return 1;
      if (key_a[i] > key_b[i]) return -1;
    }
    return 0;
  });
  return merged.slice(0, limit);
}

/**
 * Best-effort HTTP inbox sync used while websocket local-cache mode is active.
 * @param {object} options - Options
 * @param {string} options.credential_name - Credential name
 * @param {any} options.auth - Authenticator
 * @param {string} options.owner_did - Owner DID
 * @param {number} options.limit - Limit
 * @param {string} options.scope - Scope
 * @param {SDKConfig} options.config - SDK config
 * @returns {Promise<object>} Sync result
 */
async function _sync_remote_inbox_messages({ credential_name, auth, owner_did, limit, scope, config }) {
  const result = {
    attempted: true,
    status: 'ok',
    messages: [],
    total: 0,
  };

  let inbox;
  try {
    const client = create_molt_message_client(config);
    inbox = await authenticated_rpc_call(
      client,
      MESSAGE_RPC,
      'get_inbox',
      { user_did: owner_did, limit },
      1,
      { auth, credentialName: credential_name }
    );
  } catch (exc) {
    console.warn(`HTTP inbox sync failed in websocket mode credential=${credential_name} error=${exc}`);
    result.status = 'error';
    result.error = String(exc);
    return result;
  }

  _store_inbox_messages(credential_name, owner_did, inbox);
  const visible_messages = inbox.messages
    .filter(message => !_E2EE_MSG_TYPES.has(String(message.type || '')))
    .map(message => _strip_hidden_user_fields(message));
  const filtered_messages = _filter_messages_by_scope(visible_messages, scope);
  result.messages = filtered_messages;
  result.total = filtered_messages.length;
  return result;
}

/**
 * Load messages from local SQLite for WebSocket-owned inbox mode.
 * @param {object} options - Options
 * @param {string} options.owner_did - Owner DID
 * @param {number} options.limit - Limit
 * @param {string} [options.scope='all'] - Scope
 * @param {string|null} [options.peer_did] - Peer DID
 * @param {string|null} [options.group_id] - Group ID
 * @param {boolean} [options.incoming_only=true] - Incoming only
 * @returns {object[]} Local messages
 */
function _load_local_messages({ owner_did, limit, scope = 'all', peer_did = null, group_id = null, incoming_only = true }) {
  const conn = local_store.get_connection();
  try {
    local_store.ensure_schema(conn);
    const conditions = ['m.owner_did = ?'];
    const args = [owner_did];

    if (peer_did) {
      conditions.push('(m.sender_did = ? OR m.receiver_did = ?)');
      args.push(peer_did, peer_did);
    }
    if (group_id) {
      conditions.push('m.group_id = ?');
      args.push(group_id);
    }
    if (incoming_only) {
      conditions.push('m.direction = 0');
      conditions.push('m.is_read = 0');
    }
    if (scope === 'group') {
      conditions.push('m.group_id IS NOT NULL');
    } else if (scope === 'direct') {
      conditions.push('m.group_id IS NULL');
    }

    const rows = conn.execute(`
      SELECT
        m.msg_id AS id,
        m.sender_did,
        m.sender_name,
        m.receiver_did,
        m.group_id,
        m.group_did,
        g.name AS group_name,
        m.content_type AS type,
        m.content,
        m.title,
        m.server_seq,
        m.sent_at,
        m.stored_at AS created_at,
        m.is_read,
        m.is_e2ee
      FROM messages m
      LEFT JOIN groups g
        ON g.owner_did = m.owner_did
       AND g.group_id = m.group_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY COALESCE(m.server_seq, -1) DESC,
               COALESCE(m.sent_at, m.stored_at) DESC,
               m.stored_at DESC
      LIMIT ?
    `, [...args, limit]).fetchall();

    const messages = [];
    for (const row of rows) {
      const message = _strip_hidden_user_fields({ ...row });
      if (parseInt(message.is_e2ee || 0)) {
        message._e2ee = true;
        message._e2ee_notice = _E2EE_USER_NOTICE;
      }
      messages.push(message);
    }
    return messages;
  } finally {
    conn.close();
  }
}

/**
 * Parse a group-prefixed history target into a group ID.
 * @param {string} target - Target string
 * @returns {string|null} Group ID or null
 */
function _parse_group_history_target(target) {
  const prefix = 'group:';
  if (typeof target !== 'string' || !target.startsWith(prefix)) {
    return null;
  }
  const group_id = target.slice(prefix.length).trim();
  return group_id || null;
}

/**
 * Resolve the incremental cursor for one group history read.
 * @param {object} options - Options
 * @param {string} options.owner_did - Owner DID
 * @param {string} options.group_id - Group ID
 * @param {number|null} [options.explicit_since_seq] - Explicit since_seq
 * @returns {[number|null, string]} Tuple of (since_seq, cursor_source)
 */
function _resolve_group_since_seq({ owner_did, group_id, explicit_since_seq = null }) {
  if (explicit_since_seq !== null) {
    return [explicit_since_seq, 'argument'];
  }

  const conn = local_store.get_connection();
  try {
    local_store.ensure_schema(conn);
    const group_row = conn.execute(`
      SELECT last_synced_seq
      FROM groups
      WHERE owner_did = ? AND group_id = ?
    `, [owner_did, group_id]).fetchone();

    if (group_row !== null && typeof group_row.last_synced_seq === 'number') {
      return [group_row.last_synced_seq, 'group_snapshot'];
    }

    const message_row = conn.execute(`
      SELECT MAX(server_seq) AS max_server_seq
      FROM messages
      WHERE owner_did = ? AND group_id = ? AND server_seq IS NOT NULL
    `, [owner_did, group_id]).fetchone();

    const max_server_seq = message_row ? message_row.max_server_seq : null;
    if (typeof max_server_seq === 'number') {
      return [max_server_seq, 'message_cache'];
    }
    return [null, 'none'];
  } finally {
    conn.close();
  }
}

/**
 * Send an E2EE protocol/error message.
 * @param {any} http_client - HTTP client
 * @param {string} sender_did - Sender DID
 * @param {string} receiver_did - Receiver DID
 * @param {string} msg_type - Message type
 * @param {string|object} content - Content
 * @param {object} options - Options
 * @param {any} options.auth - Authenticator
 * @param {string} [options.credential_name='default'] - Credential name
 * @returns {Promise<object>} RPC result
 */
async function _send_msg(http_client, sender_did, receiver_did, msg_type, content, { auth, credential_name = 'default' } = {}) {
  if (typeof content === 'object') {
    content = JSON.stringify(content);
  }
  return await authenticated_rpc_call(
    http_client,
    MESSAGE_RPC,
    'send',
    {
      sender_did,
      receiver_did,
      content,
      type: msg_type,
    },
    1,
    { auth, credentialName: credential_name }
  );
}

/**
 * Run one authenticated discovery-group RPC call.
 * @param {object} options - Options
 * @param {string} options.credential_name - Credential name
 * @param {string} options.method - Method name
 * @param {object} options.params - Parameters
 * @param {any} options.auth - Authenticator
 * @returns {Promise<object>} RPC result
 */
async function _group_rpc_call({ credential_name, method, params, auth }) {
  const client = create_user_service_client(new SDKConfig());
  return await authenticated_rpc_call(
    client,
    GROUP_RPC,
    method,
    params,
    1,
    { auth, credentialName: credential_name }
  );
}

/**
 * Map decryption failures to e2ee_error code and retry hint.
 * @param {Error} exc - Exception
 * @returns {[string, string]} Tuple of (error_code, retry_hint)
 */
function _classify_decrypt_error(exc) {
  const msg = String(exc).toLowerCase();
  if (msg.includes('unsupported_version')) {
    return ['unsupported_version', 'drop'];
  }
  if (msg.includes('session') && (msg.includes('not found') || msg.includes('find session'))) {
    return ['session_not_found', 'rekey_then_resend'];
  }
  if (msg.includes('expired')) {
    return ['session_expired', 'rekey_then_resend'];
  }
  if (msg.includes('seq') || msg.includes('sequence')) {
    return ['invalid_seq', 'rekey_then_resend'];
  }
  return ['decryption_failed', 'resend'];
}

/**
 * Immediately process E2EE protocol messages and decrypt plaintext when possible.
 * @param {object[]} messages - Messages
 * @param {object} options - Options
 * @param {string} options.local_did - Local DID
 * @param {any} options.auth - Authenticator
 * @param {string} options.credential_name - Credential name
 * @returns {Promise<[object[], string[], E2eeClient]>} Tuple of (rendered_messages, processed_ids, e2ee_client)
 */
async function _auto_process_e2ee_messages(messages, { local_did, auth, credential_name }) {
  const e2ee_client = _load_or_create_e2ee_client(local_did, credential_name);
  const processed_ids = [];
  const rendered_messages = [];

  const client = create_molt_message_client(new SDKConfig());

  for (const msg of messages) {
    const msg_type = msg.type || '';
    const sender_did = msg.sender_did || '';

    if (!_E2EE_MSG_TYPES.has(msg_type)) {
      rendered_messages.push(_strip_hidden_user_fields(msg));
      continue;
    }

    let content;
    try {
      content = JSON.parse(msg.content || '');
    } catch (e) {
      rendered_messages.push(_strip_hidden_user_fields(msg));
      continue;
    }

    if (msg_type === 'e2ee_msg') {
      if (sender_did === local_did) {
        const rendered = _render_local_outgoing_e2ee_message(credential_name, msg);
        rendered_messages.push(rendered || _strip_hidden_user_fields(msg));
        continue;
      }
      try {
        const [original_type, plaintext] = e2ee_client.decrypt_message(content);
        const rendered = _decorate_user_visible_e2ee_message(msg, { original_type, plaintext });
        rendered_messages.push(rendered);
        processed_ids.push(msg.id);
      } catch (exc) {
        const [error_code, retry_hint] = _classify_decrypt_error(exc);
        const error_content = build_e2ee_error_content({
          error_code,
          session_id: content.session_id,
          failed_msg_id: msg.id,
          failed_server_seq: msg.server_seq,
          retry_hint,
          required_e2ee_version: error_code === 'unsupported_version' ? SUPPORTED_E2EE_VERSION : null,
          message: build_e2ee_error_message(
            error_code,
            error_code === 'unsupported_version' ? SUPPORTED_E2EE_VERSION : null,
            String(exc)
          ),
        });
        await _send_msg(client, local_did, sender_did, 'e2ee_error', error_content, { auth, credential_name });
      }
      continue;
    }

    if (msg_type === 'e2ee_error') {
      if (sender_did === local_did) {
        continue;
      }
      record_remote_failure({ credential_name, peer_did: sender_did, content });
    }

    if (sender_did === local_did) {
      continue;
    }

    const responses = await e2ee_client.process_e2ee_message(msg_type, content);
    for (const [resp_type, resp_content] of responses) {
      await _send_msg(client, local_did, sender_did, resp_type, resp_content, { auth, credential_name });
    }

    if (_E2EE_SESSION_SETUP_TYPES.has(msg_type)) {
      if (e2ee_client.has_session_id(content.session_id)) {
        processed_ids.push(msg.id);
      }
    } else {
      processed_ids.push(msg.id);
    }
  }

  save_e2ee_client(e2ee_client, credential_name);
  return [rendered_messages, processed_ids, e2ee_client];
}

/**
 * Replace an outgoing encrypted history item with local plaintext when available.
 * @param {string} credential_name - Credential name
 * @param {object} message - Message object
 * @returns {object|null} Decorated message or null
 */
function _render_local_outgoing_e2ee_message(credential_name, message) {
  const msg_id = message.id || message.msg_id;
  if (!msg_id) {
    return null;
  }

  const credential = load_identity(credential_name);
  const conn = local_store.get_connection();
  try {
    local_store.ensure_schema(conn);
    const stored = local_store.get_message_by_id(
      conn,
      msg_id,
      credential ? credential.did : null,
      credential_name
    );
  } catch (e) {
    console.debug('Failed to load local plaintext for outgoing E2EE message');
    return null;
  } finally {
    conn.close();
  }

  if (stored === null || !stored.is_e2ee) {
    return null;
  }

  return _decorate_user_visible_e2ee_message(message, {
    original_type: stored.content_type || message.type || 'text',
    plaintext: stored.content || message.content || '',
  });
}

/**
 * Mark locally cached messages as read on a best-effort basis.
 * @param {object} options - Options
 * @param {string} options.credential_name - Credential name
 * @param {string} options.owner_did - Owner DID
 * @param {string[]} options.message_ids - Message IDs
 */
function _mark_local_messages_read({ credential_name, owner_did, message_ids }) {
  const normalized_message_ids = _merge_message_ids(message_ids);
  if (normalized_message_ids.length === 0) {
    return;
  }

  let conn = null;
  try {
    conn = local_store.get_connection();
    local_store.ensure_schema(conn);
    const placeholders = normalized_message_ids.map(() => '?').join(', ');
    conn.execute(`
      UPDATE messages
      SET is_read = 1
      WHERE owner_did = ?
        AND credential_name = ?
        AND msg_id IN (${placeholders})
    `, [owner_did, credential_name, ...normalized_message_ids]);
    conn.commit();
  } catch (e) {
    console.debug('Failed to mark local messages as read');
  } finally {
    if (conn !== null) {
      conn.close();
    }
  }
}

/**
 * Store inbox messages locally (best-effort, non-critical).
 * @param {string} credential_name - Credential name
 * @param {string} my_did - My DID
 * @param {any} inbox - Inbox result
 */
function _store_inbox_messages(credential_name, my_did, inbox) {
  try {
    const messages = Array.isArray(inbox) ? inbox : (inbox.messages || []);
    if (messages.length === 0) {
      return;
    }

    const conn = local_store.get_connection();
    try {
      local_store.ensure_schema(conn);
      const batch = [];
      for (const msg of messages) {
        const sender_did = msg.sender_did || '';
        batch.push({
          msg_id: msg.id || msg.msg_id || '',
          thread_id: local_store.make_thread_id(my_did, { peer_did: sender_did, group_id: msg.group_id }),
          direction: 0,
          sender_did,
          receiver_did: msg.receiver_did,
          group_id: msg.group_id,
          group_did: msg.group_did,
          content_type: msg.type || 'text',
          content: String(msg.content || ''),
          title: msg.title,
          server_seq: msg.server_seq,
          sent_at: msg.sent_at || msg.created_at,
          is_e2ee: !!(msg._e2ee || msg.is_e2ee),
          is_read: !!msg.is_read,
          sender_name: msg.sender_name,
          metadata: msg.system_event !== undefined
            ? JSON.stringify({ system_event: msg.system_event })
            : null,
        });
      }
      local_store.store_messages_batch(conn, batch, my_did, credential_name);

      const group_snapshots = {};
      for (const msg of messages) {
        const group_id = String(msg.group_id || '');
        if (!group_id) {
          continue;
        }
        const current = group_snapshots[group_id];
        const current_seq = current ? current.server_seq : null;
        const next_seq = msg.server_seq;
        if (current !== undefined && typeof current_seq === 'number' && typeof next_seq === 'number') {
          if (next_seq <= current_seq) {
            continue;
          }
        }
        group_snapshots[group_id] = msg;
      }

      for (const [group_id, msg] of Object.entries(group_snapshots)) {
        local_store.upsert_group(conn, {
          owner_did: my_did,
          group_id,
          group_did: msg.group_did,
          name: msg.group_name,
          membership_status: 'active',
          last_synced_seq: msg.server_seq,
          last_message_at: msg.sent_at || msg.created_at,
          credential_name,
        });
      }

      for (const msg of messages) {
        const group_id = String(msg.group_id || '');
        const system_event = msg.system_event;
        if (!group_id || typeof system_event !== 'object') {
          continue;
        }
        local_store.sync_group_member_from_system_event(conn, {
          owner_did: my_did,
          group_id,
          system_event,
          credential_name,
        });
      }

      const seen_dids = new Set();
      for (const msg of messages) {
        const s = msg.sender_did || '';
        if (s && !seen_dids.has(s)) {
          seen_dids.add(s);
          local_store.upsert_contact(conn, { owner_did: my_did, did: s, name: msg.sender_name });
        }
      }
    } finally {
      conn.close();
    }
  } catch (e) {
    console.debug('Failed to store inbox messages locally');
  }
}

/**
 * Store chat history messages locally (best-effort, non-critical).
 * @param {string} credential_name - Credential name
 * @param {string} my_did - My DID
 * @param {string} peer_did - Peer DID
 * @param {any} history - History result
 */
function _store_history_messages(credential_name, my_did, peer_did, history) {
  try {
    const messages = Array.isArray(history) ? history : (history.messages || []);
    if (messages.length === 0) {
      return;
    }

    const conn = local_store.get_connection();
    try {
      local_store.ensure_schema(conn);
      const batch = [];
      for (const msg of messages) {
        const sender_did = msg.sender_did || '';
        const is_outgoing = sender_did === my_did;
        batch.push({
          msg_id: msg.id || msg.msg_id || '',
          thread_id: local_store.make_thread_id(my_did, { peer_did, group_id: msg.group_id }),
          direction: is_outgoing ? 1 : 0,
          sender_did,
          receiver_did: msg.receiver_did,
          group_id: msg.group_id,
          group_did: msg.group_did,
          content_type: msg.type || 'text',
          content: String(msg.content || ''),
          title: msg.title,
          server_seq: msg.server_seq,
          sent_at: msg.sent_at || msg.created_at,
          is_e2ee: !!(msg._e2ee || msg.is_e2ee),
          is_read: !!msg.is_read,
          sender_name: msg.sender_name,
        });
      }
      local_store.store_messages_batch(conn, batch, my_did, credential_name);

      const seen_dids = new Set();
      for (const msg of messages) {
        const s = msg.sender_did || '';
        if (s && !seen_dids.has(s)) {
          seen_dids.add(s);
          local_store.upsert_contact(conn, { owner_did: my_did, did: s, name: msg.sender_name });
        }
      }
    } finally {
      conn.close();
    }
  } catch (e) {
    console.debug('Failed to store history messages locally');
  }
}

/**
 * Load the latest disk-first E2EE state from SQLite.
 * @param {string} local_did - Local DID
 * @param {string} credential_name - Credential name
 * @returns {E2eeClient} E2EE client
 */
function _load_or_create_e2ee_client(local_did, credential_name) {
  return load_e2ee_client(local_did, credential_name);
}

/**
 * View inbox and optionally mark returned messages as read.
 * @param {string} [credential_name='default'] - Credential name
 * @param {number} [limit=20] - Limit
 * @param {string} [scope='all'] - Scope
 * @param {boolean} [mark_read=false] - Mark read
 * @returns {Promise<void>}
 */
async function check_inbox(credential_name = 'default', limit = 20, scope = 'all', mark_read = false) {
  const config = new SDKConfig();
  const websocket_mode = is_websocket_mode(config);

  const auth_result = create_authenticator(credential_name, config);
  if (auth_result === null) {
    console.log(`Credential '${credential_name}' unavailable; please create an identity first`);
    process.exit(1);
  }

  const [auth, data] = auth_result;

  if (websocket_mode) {
    const listener_status = ensure_listener_runtime(credential_name, config);
    if (listener_status && listener_status.was_running) {
      const local_messages = _load_local_messages({
        owner_did: data.did,
        limit,
        scope,
      });

      const remote_sync = await _sync_remote_inbox_messages({
        credential_name,
        auth,
        owner_did: String(data.did),
        limit,
        scope,
        config,
      });

      const messages = _merge_inbox_messages(local_messages, remote_sync.messages || [], { limit });

      if (mark_read) {
        const message_ids = _collect_readable_message_ids(messages, { local_did: String(data.did) });
        if (message_ids.length > 0) {
          const client = create_molt_message_client(config);
          await authenticated_rpc_call(
            client,
            MESSAGE_RPC,
            'mark_read',
            { user_did: data.did, message_ids },
            1,
            { auth, credentialName: credential_name }
          );
          _mark_local_messages_read({ credential_name, owner_did: String(data.did), message_ids });
        }
      }

      const inbox = {
        messages,
        total: messages.length,
        scope,
        source: 'local_ws_cache',
        http_sync: {
          attempted: true,
          status: remote_sync.status || 'error',
          total: remote_sync.total || 0,
        },
      };
      if (typeof remote_sync.error === 'string') {
        inbox.http_sync.error = remote_sync.error;
      }
      console.log(JSON.stringify(inbox, null, 2));
      return;
    }
    console.warn(`WebSocket receive mode is degraded, using HTTP inbox fallback credential=${credential_name} running=${listener_status?.running || false} paused=${listener_status?.auto_restart_paused || false} failures=${listener_status?.consecutive_restart_failures || 0}`);
  }

  const client = create_molt_message_client(config);
  const inbox = await authenticated_rpc_call(
    client,
    MESSAGE_RPC,
    'get_inbox',
    { user_did: data.did, limit },
    1,
    { auth, credentialName: credential_name }
  );

  _store_inbox_messages(credential_name, data.did, inbox);

  const messages = inbox.messages || [];
  messages.sort((a, b) => {
    const key_a = _message_sort_key(a);
    const key_b = _message_sort_key(b);
    for (let i = 0; i < key_a.length; i++) {
      if (key_a[i] < key_b[i]) return -1;
      if (key_a[i] > key_b[i]) return 1;
    }
    return 0;
  });

  const [rendered_messages, processed_ids] = await _auto_process_e2ee_messages(messages, {
    local_did: data.did,
    auth,
    credential_name,
  });

  const filtered_messages = _filter_messages_by_scope(rendered_messages, scope);
  inbox.messages = filtered_messages;
  inbox.total = filtered_messages.length;
  inbox.scope = scope;
  inbox.source = websocket_mode ? 'remote_http_fallback' : 'remote_http';

  let ids_to_mark = processed_ids;
  if (mark_read) {
    ids_to_mark = _merge_message_ids(
      processed_ids,
      _collect_readable_message_ids(rendered_messages, { local_did: String(data.did) })
    );
  }

  if (ids_to_mark.length > 0) {
    await authenticated_rpc_call(
      client,
      MESSAGE_RPC,
      'mark_read',
      { user_did: data.did, message_ids: ids_to_mark },
      1,
      { auth, credentialName: credential_name }
    );
    _mark_local_messages_read({ credential_name, owner_did: String(data.did), message_ids: ids_to_mark });
  }

  console.log(JSON.stringify(inbox, null, 2));
}

/**
 * View chat history with a specific DID and immediately render E2EE plaintext when possible.
 * @param {string} peer_did - Peer DID
 * @param {string} [credential_name='default'] - Credential name
 * @param {number} [limit=50] - Limit
 * @returns {Promise<void>}
 */
async function get_history(peer_did, credential_name = 'default', limit = 50) {
  const config = new SDKConfig();
  const websocket_mode = is_websocket_mode(config);

  const auth_result = create_authenticator(credential_name, config);
  if (auth_result === null) {
    console.log(`Credential '${credential_name}' unavailable; please create an identity first`);
    process.exit(1);
  }

  const [auth, data] = auth_result;

  if (websocket_mode) {
    const listener_status = ensure_listener_runtime(credential_name, config);
    if (listener_status && listener_status.was_running) {
      const messages = _load_local_messages({
        owner_did: data.did,
        limit,
        peer_did,
        incoming_only: false,
      });
      const history = {
        messages,
        total: messages.length,
        source: 'local_ws_cache',
      };
      console.log(JSON.stringify(history, null, 2));
      return;
    }
    console.warn(`WebSocket receive mode is degraded, using HTTP history fallback credential=${credential_name} peer=${peer_did} running=${listener_status?.running || false} paused=${listener_status?.auto_restart_paused || false} failures=${listener_status?.consecutive_restart_failures || 0}`);
  }

  const client = create_molt_message_client(config);
  const history = await authenticated_rpc_call(
    client,
    MESSAGE_RPC,
    'get_history',
    { user_did: data.did, peer_did, limit },
    1,
    { auth, credentialName: credential_name }
  );

  _store_history_messages(credential_name, data.did, peer_did, history);

  const messages = history.messages || [];
  messages.sort((a, b) => {
    const key_a = _message_sort_key(a);
    const key_b = _message_sort_key(b);
    for (let i = 0; i < key_a.length; i++) {
      if (key_a[i] < key_b[i]) return -1;
      if (key_a[i] > key_b[i]) return 1;
    }
    return 0;
  });

  const [rendered_messages] = await _auto_process_e2ee_messages(messages, {
    local_did: data.did,
    auth,
    credential_name,
  });

  history.messages = rendered_messages;
  history.total = rendered_messages.length;
  history.source = websocket_mode ? 'remote_http_fallback' : 'remote_http';

  console.log(JSON.stringify(history, null, 2));
}

/**
 * View one discovery group's message history.
 * @param {string} group_id - Group ID
 * @param {string} [credential_name='default'] - Credential name
 * @param {number} [limit=50] - Limit
 * @param {number|null} [since_seq=null] - Since seq
 * @returns {Promise<void>}
 */
async function get_group_history(group_id, credential_name = 'default', limit = 50, since_seq = null) {
  const config = new SDKConfig();

  const auth_result = create_authenticator(credential_name, config);
  if (auth_result === null) {
    console.log(`Credential '${credential_name}' unavailable; please create an identity first`);
    process.exit(1);
  }

  const [auth, data] = auth_result;

  const [resolved_since_seq, cursor_source] = _resolve_group_since_seq({
    owner_did: String(data.did),
    group_id,
    explicit_since_seq: since_seq,
  });

  const params = { group_id, limit };
  if (resolved_since_seq !== null) {
    params.since_seq = resolved_since_seq;
  }

  const history = await _group_rpc_call({
    credential_name,
    method: 'list_messages',
    params,
    auth,
  });

  _persist_group_messages({
    credential_name,
    identity_data: data,
    group_id,
    payload: history,
  });

  history.messages = (history.messages || []).map(message => _strip_hidden_user_fields(message));
  history.total = history.messages.length;
  history.group_id = group_id;
  history.since_seq = resolved_since_seq;
  history.cursor_source = cursor_source;

  console.log(JSON.stringify(history, null, 2));
}

/**
 * Mark messages as read.
 * @param {string[]} message_ids - Message IDs
 * @param {string} [credential_name='default'] - Credential name
 * @returns {Promise<void>}
 */
async function mark_read(message_ids, credential_name = 'default') {
  const config = new SDKConfig();

  const auth_result = create_authenticator(credential_name, config);
  if (auth_result === null) {
    console.log(`Credential '${credential_name}' unavailable; please create an identity first`);
    process.exit(1);
  }

  const [auth, data] = auth_result;

  const client = create_molt_message_client(config);
  const result = await authenticated_rpc_call(
    client,
    MESSAGE_RPC,
    'mark_read',
    { user_did: data.did, message_ids },
    1,
    { auth, credentialName: credential_name }
  );

  _mark_local_messages_read({ credential_name, owner_did: String(data.did), message_ids });

  console.error('Marked as read successfully:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Main entry point for CLI.
 */
function main() {
  const args = process.argv.slice(2);
  const argMap = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        const value = args[i + 1];
        if (key === 'mark-read') {
          argMap[key] = argMap[key] || [];
          argMap[key].push(value);
        } else {
          argMap[key] = value;
        }
        i += 2;
      } else {
        if (key === 'mark-read') {
          argMap[key] = [];
        } else {
          argMap[key] = true;
        }
        i++;
      }
    } else {
      i++;
    }
  }

  const credential = argMap.credential || 'default';
  const limit = parseInt(argMap.limit || '20', 10);
  const scope = argMap.scope || 'all';
  const sinceSeq = argMap['since-seq'] !== undefined ? parseInt(argMap['since-seq'], 10) : null;

  if (argMap['mark-read'] !== undefined) {
    if (sinceSeq !== null) {
      console.error('--since-seq only supports group history reads');
      process.exit(1);
    }
    if (Array.isArray(argMap['mark-read']) && argMap['mark-read'].length > 0) {
      mark_read(argMap['mark-read'], credential);
    } else {
      check_inbox(credential, limit, scope, true);
    }
  } else if (argMap['group-id']) {
    get_group_history(argMap['group-id'], credential, limit, sinceSeq);
  } else if (argMap.history) {
    const group_id = _parse_group_history_target(argMap.history);
    if (group_id !== null) {
      get_group_history(group_id, credential, limit, sinceSeq);
    } else {
      if (sinceSeq !== null) {
        console.error('--since-seq only supports group history reads');
        process.exit(1);
      }
      resolve_to_did(argMap.history).then(peer_did => {
        get_history(peer_did, credential, limit);
      });
    }
  } else {
    if (sinceSeq !== null) {
      console.error('--since-seq only supports group history reads');
      process.exit(1);
    }
    check_inbox(credential, limit, scope);
  }
}

module.exports = {
  check_inbox,
  get_history,
  get_group_history,
  mark_read,
  _message_id,
  _merge_message_ids,
  _collect_readable_message_ids,
  _message_time_value,
  _message_sort_key,
  _decorate_user_visible_e2ee_message,
  _strip_hidden_user_fields,
  _filter_messages_by_scope,
  _message_dedup_key,
  _message_display_sort_key,
  _merge_inbox_messages,
  _parse_group_history_target,
  _resolve_group_since_seq,
  _classify_decrypt_error,
  _load_or_create_e2ee_client,
  _render_local_outgoing_e2ee_message,
  _mark_local_messages_read,
  _store_inbox_messages,
  _store_history_messages,
};
