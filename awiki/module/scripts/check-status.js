/**
 * Unified status check: local upgrade + identity verification + inbox/group summary.
 *
 * Node.js implementation based on Python version:
 * python/scripts/check_status.py
 *
 * [INPUT]: SDK (RPC calls, E2eeClient), credential_store (authenticator factory),
 *          SQLite-backed E2EE session store, credential_migration,
 *          database_migration, local_store, listener recovery helpers,
 *          logging_config
 * [OUTPUT]: Structured JSON status report (local upgrade + identity + inbox +
 *          group_watch + e2ee_sessions + realtime listener runtime), with
 *          automatic E2EE protocol handling, plaintext delivery for unread
 *          encrypted messages, listener auto-restart backoff, and incremental
 *          group message fetching with classification (text / member events),
 *          plus listener-coordinated database upgrade support for explicit
 *          ``--upgrade-only`` runs
 * [POS]: Unified status check entry point for Agent session startup and heartbeat calls
 *       with mandatory, server_seq-aware E2EE auto-processing, plaintext
 *       delivery for unread encrypted messages, local discovery-group watch
 *       summaries, and incremental group message fetching with per-group
 *       new_messages classification
 */

const { SDKConfig } = require('./utils/config');
const { E2eeClient } = require('./utils/e2ee');
const { rpc_call } = require('./utils/rpc');
const { create_user_service_client, create_molt_message_client } = require('./utils/client');
const { authenticated_rpc_call } = require('./utils/rpc');
const {
  SUPPORTED_E2EE_VERSION,
  build_e2ee_error_content,
  build_e2ee_error_message
} = require('./utils/e2ee');
const local_store = require('./local-store');
const { ensure_credential_storage_ready } = require('./credential_migration');
const {
  ensure_local_database_ready,
  ensure_local_database_ready_for_upgrade
} = require('./database_migration');
const { load_identity, create_authenticator } = require('./credential-store');
const { load_e2ee_client, save_e2ee_client } = require('./e2ee-session-store');
const { record_remote_failure } = require('./e2ee-outbox');
const {
  ensure_listener_runtime,
  get_listener_runtime_report
} = require('./listener_recovery');
const { is_websocket_mode } = require('./message_transport');

// Constants
const MESSAGE_RPC = '/message/rpc';
const AUTH_RPC = '/user-service/did-auth/rpc';
const GROUP_RPC_ENDPOINT = '/group/rpc';
const PROFILE_RPC = '/user-service/did/profile/rpc';
const _GROUP_MSG_FETCH_LIMIT = 50;
const _E2EE_USER_NOTICE = 'This is an encrypted message.';
const _INBOX_FETCH_LIMIT = 50;
const _INBOX_MESSAGE_LIMIT = 10;

// E2EE protocol message types
const _E2EE_SESSION_SETUP_TYPES = new Set(['e2ee_init', 'e2ee_rekey']);
const _E2EE_MSG_TYPES = new Set(['e2ee_init', 'e2ee_ack', 'e2ee_msg', 'e2ee_rekey', 'e2ee_error']);
const _E2EE_TYPE_ORDER = {
  'e2ee_init': 0,
  'e2ee_ack': 1,
  'e2ee_rekey': 2,
  'e2ee_msg': 3,
  'e2ee_error': 4
};

/**
 * Return a sortable timestamp string for one message
 * @param {Object} message - Message dictionary
 * @returns {string} Timestamp string
 */
function _message_time_value(message) {
  const timestamp = message.sent_at || message.created_at;
  return typeof timestamp === 'string' ? timestamp : '';
}

/**
 * Build a stable E2EE inbox ordering key with server_seq priority inside a sender stream
 * @param {Object} message - Message dictionary
 * @returns {Array} Sort key tuple
 */
function _message_sort_key(message) {
  const senderDidRaw = message.sender_did;
  const senderDid = typeof senderDidRaw === 'string' ? senderDidRaw : '';
  const serverSeq = message.server_seq;
  const hasServerSeq = typeof serverSeq === 'number' ? 0 : 1;
  const serverSeqValue = typeof serverSeq === 'number' ? serverSeq : 0;
  
  return [
    senderDid,
    hasServerSeq,
    serverSeqValue,
    _message_time_value(message),
    _E2EE_TYPE_ORDER[message.type] || 99
  ];
}

/**
 * Return whether a message type should be exposed to end users
 * @param {string} msgType - Message type
 * @returns {boolean} Whether visible
 */
function _is_user_visible_message_type(msgType) {
  return !_E2EE_MSG_TYPES.has(msgType);
}

/**
 * Decorate a decrypted E2EE message for status output
 * @param {Object} message - Message dictionary
 * @param {Object} options - Options
 * @param {string} options.originalType - Original message type
 * @param {string} options.plaintext - Plaintext content
 * @returns {Object} Decorated message
 */
function _decorate_user_visible_e2ee_message(message, { originalType, plaintext }) {
  const rendered = { ...message };
  rendered.type = originalType;
  rendered.content = plaintext;
  rendered.is_e2ee = true;
  rendered.e2ee_notice = _E2EE_USER_NOTICE;
  delete rendered.title;
  return rendered;
}

/**
 * Remove fields intentionally hidden from user-facing output
 * @param {Object} message - Message dictionary
 * @returns {Object} Stripped message
 */
function _strip_hidden_user_fields(message) {
  const rendered = { ...message };
  delete rendered.title;
  return rendered;
}

/**
 * Map decrypt failures to stable sender-visible error metadata
 * @param {Error} exc - Exception
 * @returns {[string, string]} Error code and retry hint tuple
 */
function _classify_decrypt_error(exc) {
  const msg = String(exc.message || exc).toLowerCase();
  
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
 * Build the status-friendly inbox report from user-visible messages
 * @param {Array} visibleMessages - List of visible messages
 * @returns {Object} Inbox report
 */
function _build_visible_inbox_report(visibleMessages) {
  const orderedMessages = [...visibleMessages].sort((a, b) => {
    const timeA = _message_time_value(a);
    const timeB = _message_time_value(b);
    const seqA = typeof a.server_seq === 'number' ? a.server_seq : -1;
    const seqB = typeof b.server_seq === 'number' ? b.server_seq : -1;
    
    // Sort by time, then by server_seq, descending
    if (timeA !== timeB) {
      return timeB.localeCompare(timeA);
    }
    return seqB - seqA;
  });

  const byType = {};
  const textBySender = {};
  let textCount = 0;

  for (const message of orderedMessages) {
    const msgType = String(message.type || 'unknown');
    byType[msgType] = (byType[msgType] || 0) + 1;

    if (msgType !== 'text') {
      continue;
    }
    
    textCount += 1;
    const senderDid = String(message.sender_did || 'unknown');
    const messageTime = _message_time_value(message);
    
    if (!textBySender[senderDid]) {
      textBySender[senderDid] = { count: 0, latest: '' };
    }
    textBySender[senderDid].count += 1;
    if (messageTime > textBySender[senderDid].latest) {
      textBySender[senderDid].latest = messageTime;
    }
  }

  return {
    status: 'ok',
    total: orderedMessages.length,
    by_type: byType,
    text_messages: textCount,
    text_by_sender: textBySender,
    messages: orderedMessages.slice(0, _INBOX_MESSAGE_LIMIT)
  };
}

/**
 * Return one stable message identifier when available
 * @param {Object} message - Message dictionary
 * @returns {string|null} Message ID
 */
function _message_id_value(message) {
  for (const key of ['id', 'msg_id']) {
    const value = message[key];
    if (typeof value === 'string' && value) {
      return value;
    }
  }
  return null;
}

/**
 * Build a stable deduplication key for merged local/remote inbox results
 * @param {Object} message - Message dictionary
 * @returns {Array} Dedup key tuple
 */
function _message_dedup_key(message) {
  const messageId = _message_id_value(message);
  if (messageId) {
    return ['id', messageId];
  }
  return [
    'fallback',
    message.sender_did,
    message.receiver_did,
    message.group_id,
    message.type,
    message.content,
    _message_time_value(message)
  ];
}

/**
 * Build a descending-friendly display key for merged visible inbox messages
 * @param {Object} message - Message dictionary
 * @returns {Array} Display sort key
 */
function _message_display_sort_key(message) {
  const serverSeq = message.server_seq;
  const hasServerSeq = typeof serverSeq === 'number' ? 1 : 0;
  const serverSeqValue = typeof serverSeq === 'number' ? serverSeq : -1;
  
  return [
    hasServerSeq,
    serverSeqValue,
    _message_time_value(message),
    String(message.id || message.msg_id || '')
  ];
}

/**
 * Merge visible local-cache and HTTP inbox messages with deduplication
 * @param {Array} localMessages - Local messages
 * @param {Array} remoteMessages - Remote messages
 * @param {Object} options - Options
 * @param {number} options.limit - Result limit
 * @returns {Array} Merged messages
 */
function _merge_visible_inbox_messages(localMessages, remoteMessages, { limit }) {
  const mergedByKey = new Map();
  
  for (const message of remoteMessages) {
    mergedByKey.set(JSON.stringify(_message_dedup_key(message)), { ...message });
  }
  for (const message of localMessages) {
    mergedByKey.set(JSON.stringify(_message_dedup_key(message)), { ...message });
  }
  
  const merged = Array.from(mergedByKey.values());
  merged.sort((a, b) => {
    const keyA = _message_display_sort_key(a);
    const keyB = _message_display_sort_key(b);
    
    for (let i = 0; i < Math.max(keyA.length, keyB.length); i++) {
      if (keyA[i] !== keyB[i]) {
        return keyB[i] > keyA[i] ? 1 : -1;
      }
    }
    return 0;
  });
  
  return merged.slice(0, limit);
}

/**
 * Load visible unread inbox messages from local SQLite cache
 * @param {string|null} ownerDid - Owner DID
 * @returns {Array} Visible messages
 */
function _load_local_visible_inbox_messages(ownerDid) {
  if (!ownerDid) {
    return [];
  }
  
  const conn = local_store.get_connection();
  try {
    local_store.ensure_schema(conn);
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
        m.server_seq,
        m.sent_at,
        m.stored_at AS created_at,
        m.is_e2ee
      FROM messages m
      LEFT JOIN groups g
        ON g.owner_did = m.owner_did
       AND g.group_id = m.group_id
      WHERE m.owner_did = ?
        AND m.direction = 0
        AND m.is_read = 0
      ORDER BY COALESCE(m.server_seq, -1) DESC,
               COALESCE(m.sent_at, m.stored_at) DESC,
               m.stored_at DESC
      LIMIT ?
    `, [ownerDid, _INBOX_FETCH_LIMIT]).all();
    
    const visibleMessages = [];
    for (const row of rows) {
      const message = { ...row };
      const msgType = String(message.type || '');
      
      if (!_is_user_visible_message_type(msgType)) {
        continue;
      }
      
      if (message.is_e2ee) {
        message.is_e2ee = true;
        message.e2ee_notice = _E2EE_USER_NOTICE;
      }
      visibleMessages.push(message);
    }
    
    return visibleMessages;
  } finally {
    conn.close();
  }
}

/**
 * Build one inbox report from local SQLite cache only
 * @param {string|null} ownerDid - Owner DID
 * @returns {Object} Inbox report
 */
function _build_local_inbox_report(ownerDid) {
  if (!ownerDid) {
    return {
      status: 'no_identity',
      total: 0,
      by_type: {},
      text_messages: 0,
      text_by_sender: {},
      messages: []
    };
  }
  
  try {
    const visibleMessages = _load_local_visible_inbox_messages(ownerDid);
    const report = _build_visible_inbox_report(visibleMessages);
    report.source = 'local_ws_cache';
    return report;
  } catch (exc) {
    return {
      status: 'error',
      error: String(exc.message || exc),
      total: 0,
      by_type: {},
      text_messages: 0,
      text_by_sender: {},
      messages: []
    };
  }
}

/**
 * Best-effort HTTP inbox sync used while websocket local cache is active
 * @param {Object} options - Options
 * @param {string} options.credentialName - Credential name
 * @param {Object} options.auth - Authenticator
 * @param {string} options.ownerDid - Owner DID
 * @param {SDKConfig} options.config - SDK config
 * @returns {Promise<Object>} Sync result
 */
async function _sync_remote_visible_inbox_messages({ credentialName, auth, ownerDid, config }) {
  const result = {
    attempted: true,
    status: 'ok',
    messages: [],
    total: 0
  };
  
  try {
    const client = create_molt_message_client(config);
    try {
      const inbox = await authenticated_rpc_call(
        client,
        MESSAGE_RPC,
        'get_inbox',
        { user_did: ownerDid, limit: _INBOX_FETCH_LIMIT },
        1,
        { auth, credentialName }
      );
    } finally {
      // Client cleanup
    }
  } catch (exc) {
    result.status = 'error';
    result.error = String(exc.message || exc);
    return result;
  }

  const visibleMessages = (inbox.messages || [])
    .filter(message => _is_user_visible_message_type(String(message.type || '')))
    .map(message => _strip_hidden_user_fields(message));
  
  result.messages = visibleMessages;
  result.total = visibleMessages.length;
  return result;
}

/**
 * Summarize locally tracked groups for heartbeat decisions
 * @param {string|null} ownerDid - Owner DID
 * @returns {Object} Group watch summary
 */
function summarize_group_watch(ownerDid) {
  if (!ownerDid) {
    return { status: 'no_identity', active_groups: 0, groups: [] };
  }

  try {
    const conn = local_store.get_connection();
    try {
      local_store.ensure_schema(conn);
      const groupRows = conn.execute(`
        SELECT
          group_id,
          name,
          group_mode,
          slug,
          my_role,
          member_count,
          group_owner_did,
          group_owner_handle,
          last_synced_seq,
          last_read_seq,
          last_message_at,
          stored_at
        FROM groups
        WHERE owner_did = ? AND membership_status = 'active'
        ORDER BY COALESCE(last_message_at, stored_at) DESC, stored_at DESC
        LIMIT 20
      `, [ownerDid]).all();

      const groups = [];
      let groupsWithPendingRecommendations = 0;

      for (const row of groupRows) {
        const groupId = row.group_id;
        
        const trackedMembersRow = conn.execute(`
          SELECT
            COUNT(*) AS cnt,
            MAX(joined_at) AS latest_joined_at
          FROM group_members
          WHERE owner_did = ? AND group_id = ? AND status = 'active'
        `, [ownerDid, groupId]).get();
        
        const ownerMessageRow = conn.execute(`
          SELECT
            COUNT(*) AS cnt,
            MAX(sent_at) AS latest_sent_at
          FROM messages
          WHERE owner_did = ?
            AND group_id = ?
            AND content_type = 'group_user'
            AND sender_did = COALESCE(?, '')
        `, [ownerDid, groupId, row.group_owner_did]).get();
        
        const localUserMessageRow = conn.execute(`
          SELECT COUNT(*) AS cnt
          FROM messages
          WHERE owner_did = ? AND group_id = ? AND content_type = 'group_user'
        `, [ownerDid, groupId]).get();
        
        const recommendationRow = conn.execute(`
          SELECT
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
            MAX(created_at) AS last_recommended_at
          FROM relationship_events
          WHERE owner_did = ?
            AND source_group_id = ?
            AND event_type = 'ai_recommended'
        `, [ownerDid, groupId]).get();
        
        const savedContactRow = conn.execute(`
          SELECT COUNT(*) AS cnt
          FROM contacts
          WHERE owner_did = ? AND source_group_id = ?
        `, [ownerDid, groupId]).get();

        const pendingRecommendations = parseInt(recommendationRow.pending_count || 0, 10);
        if (pendingRecommendations > 0) {
          groupsWithPendingRecommendations += 1;
        }

        const localGroupUserMessages = parseInt(localUserMessageRow.cnt || 0, 10);
        const trackedActiveMembers = parseInt(trackedMembersRow.cnt || 0, 10);
        
        groups.push({
          group_id: groupId,
          name: row.name,
          group_mode: row.group_mode,
          slug: row.slug,
          my_role: row.my_role,
          member_count: row.member_count,
          tracked_active_members: trackedActiveMembers,
          group_owner_did: row.group_owner_did,
          group_owner_handle: row.group_owner_handle,
          local_group_user_messages: localGroupUserMessages,
          local_owner_messages: parseInt(ownerMessageRow.cnt || 0, 10),
          latest_owner_message_at: ownerMessageRow.latest_sent_at,
          latest_member_joined_at: trackedMembersRow.latest_joined_at,
          pending_recommendations: pendingRecommendations,
          last_recommended_at: recommendationRow.last_recommended_at,
          saved_contacts: parseInt(savedContactRow.cnt || 0, 10),
          recommendation_signal_ready: trackedActiveMembers >= 1 || localGroupUserMessages >= 1,
          last_synced_seq: row.last_synced_seq,
          last_read_seq: row.last_read_seq,
          last_message_at: row.last_message_at,
          stored_at: row.stored_at
        });
      }

      return {
        status: 'ok',
        active_groups: groups.length,
        groups_with_pending_recommendations: groupsWithPendingRecommendations,
        groups: groups
      };
    } finally {
      conn.close();
    }
  } catch (exc) {
    return {
      status: 'error',
      active_groups: 0,
      groups: [],
      error: String(exc.message || exc)
    };
  }
}

/**
 * Classify group messages into text / member_joined / member_left / member_kicked buckets
 * @param {Array} messages - Messages to classify
 * @returns {Object} Classified buckets
 */
function _classify_group_messages(messages) {
  const buckets = {
    text: [],
    member_joined: [],
    member_left: [],
    member_kicked: []
  };
  
  for (const msg of messages) {
    const contentType = msg.type || msg.content_type || '';
    const systemEvent = msg.system_event;
    
    if (typeof systemEvent === 'object' && systemEvent !== null) {
      const kind = systemEvent.kind || '';
      if (kind in buckets) {
        buckets[kind].push(msg);
        continue;
      }
    }
    
    if (contentType === 'group_user' || contentType === 'text') {
      buckets.text.push(msg);
    }
  }
  
  return buckets;
}

/**
 * Persist fetched group messages and return classified buckets
 * @param {Object} options - Options
 * @param {string} options.ownerDid - Owner DID
 * @param {string} options.groupId - Group ID
 * @param {Object} options.payload - Payload with messages
 * @param {string} options.credentialName - Credential name
 * @returns {Object} Classified result
 */
function _persist_and_classify_group_messages({ ownerDid, groupId, payload, credentialName }) {
  const messages = payload.messages || [];
  
  if (!messages || messages.length === 0) {
    return {
      total: 0,
      text: [],
      member_joined: [],
      member_left: [],
      member_kicked: []
    };
  }

  const batch = [];
  let maxServerSeq = null;
  let lastMessageAt = null;
  
  for (const msg of messages) {
    const senderDid = String(msg.sender_did || '');
    const direction = senderDid && senderDid === ownerDid ? 1 : 0;
    const sentAt = msg.sent_at || msg.created_at;
    const serverSeq = msg.server_seq;
    
    if (typeof serverSeq === 'number') {
      maxServerSeq = maxServerSeq === null ? serverSeq : Math.max(maxServerSeq, serverSeq);
    }
    if (sentAt) {
      lastMessageAt = String(sentAt);
    }
    
    batch.push({
      msg_id: msg.id || '',
      thread_id: local_store.make_thread_id(ownerDid, { groupId }),
      direction: direction,
      sender_did: senderDid,
      receiver_did: null,
      group_id: groupId,
      group_did: msg.group_did,
      content_type: msg.type || 'group_user',
      content: String(msg.content || ''),
      title: msg.title,
      server_seq: serverSeq,
      sent_at: sentAt,
      sender_name: msg.sender_name,
      metadata: msg.system_event !== undefined && msg.system_event !== null
        ? JSON.stringify({ system_event: msg.system_event })
        : null,
      credential_name: credentialName,
      owner_did: ownerDid
    });
  }

  const conn = local_store.get_connection();
  try {
    local_store.ensure_schema(conn);
    local_store.store_messages_batch(conn, batch, { ownerDid, credentialName });
    
    for (const msg of messages) {
      const systemEvent = msg.system_event;
      if (typeof systemEvent !== 'object' || systemEvent === null) {
        continue;
      }
      local_store.sync_group_member_from_system_event(conn, {
        ownerDid,
        groupId,
        systemEvent,
        credentialName
      });
    }
    
    local_store.upsert_group(conn, {
      ownerDid,
      groupId,
      membershipStatus: 'active',
      lastSyncedSeq: payload.next_since_seq || maxServerSeq,
      lastMessageAt: lastMessageAt,
      credentialName
    });
  } finally {
    conn.close();
  }

  const classified = _classify_group_messages(messages);
  classified.total = messages.length;
  return classified;
}

/**
 * Fetch incremental messages for one group and return classified results
 * @param {Object} client - HTTP client
 * @param {Object} options - Options
 * @param {string} options.groupId - Group ID
 * @param {number|null} options.sinceSeq - Since sequence number
 * @param {string} options.ownerDid - Owner DID
 * @param {string} options.credentialName - Credential name
 * @param {Object} options.auth - Authenticator
 * @returns {Promise<Object>} Classified result
 */
async function _fetch_one_group_messages(client, { groupId, sinceSeq, ownerDid, credentialName, auth }) {
  const empty = {
    total: 0,
    text: [],
    member_joined: [],
    member_left: [],
    member_kicked: []
  };
  
  try {
    const params = {
      group_id: groupId,
      limit: _GROUP_MSG_FETCH_LIMIT
    };
    if (sinceSeq !== null && sinceSeq !== undefined) {
      params.since_seq = sinceSeq;
    }
    
    const payload = await authenticated_rpc_call(
      client,
      GROUP_RPC_ENDPOINT,
      'list_messages',
      params,
      1,
      { auth, credentialName }
    );
    
    return _persist_and_classify_group_messages({
      ownerDid,
      groupId,
      payload,
      credentialName
    });
  } catch (exc) {
    return { ...empty, error: String(exc.message || exc) };
  }
}

/**
 * Fetch incremental messages for all active groups in the watch set
 * @param {Object} groupWatch - Group watch summary
 * @param {Object} options - Options
 * @param {string} options.ownerDid - Owner DID
 * @param {string} options.credentialName - Credential name
 * @returns {Promise<Object>} Fetch summary
 */
async function fetch_group_messages(groupWatch, { ownerDid, credentialName }) {
  const groups = groupWatch.groups || [];
  
  if (!groups || groups.length === 0) {
    return { fetched_groups: 0, total_new_messages: 0, errors: [] };
  }

  const config = new SDKConfig();
  const authResult = create_authenticator(credentialName, config);
  
  if (authResult === null) {
    return {
      fetched_groups: 0,
      total_new_messages: 0,
      errors: ['no_authenticator']
    };
  }

  const [auth] = authResult;

  // Note: Node.js doesn't have the same async context manager pattern as Python
  // We'll need to handle client lifecycle differently
  const client = create_user_service_client(config);
  try {
    // Parallel fetch for all groups
    const tasks = groups.map(group =>
      _fetch_one_group_messages(client, {
        groupId: group.group_id,
        sinceSeq: group.last_synced_seq,
        ownerDid,
        credentialName,
        auth
      })
    );
    
    const results = await Promise.all(tasks);

    // Attach results to group entries and collect profile backfill targets
    const errors = [];
    let totalNew = 0;
    const profileBackfill = [];

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const result = results[i];
      
      if ('error' in result) {
        errors.push(`${group.group_id}: ${result.error}`);
      }
      totalNew += result.total || 0;
      group.new_messages = result;

      // Collect member_joined events missing profile_url
      for (const event of result.member_joined || []) {
        const se = event.system_event || {};
        const subject = se.subject || {};
        if (subject.handle && !subject.profile_url) {
          profileBackfill.push([group.group_id, event]);
        }
      }
    }

    // Best-effort profile_url backfill for new members
    for (const [groupId, event] of profileBackfill) {
      const se = event.system_event || {};
      const subject = se.subject || {};
      const handle = subject.handle || '';
      const localPart = handle.includes('.') ? handle.split('.')[0] : handle;
      
      if (!localPart) {
        continue;
      }
      
      try {
        const profile = await rpc_call(
          client,
          PROFILE_RPC,
          'get_public_profile',
          { handle: localPart }
        );
        const profileUrl = profile.profile_url;
        
        if (profileUrl) {
          subject.profile_url = profileUrl;
          const userId = se.subject?.user_id || '';
          
          if (userId) {
            const conn = local_store.get_connection();
            try {
              local_store.ensure_schema(conn);
              local_store.upsert_group_member(conn, {
                ownerDid,
                groupId,
                userId,
                profileUrl,
                credentialName
              });
            } finally {
              conn.close();
            }
          }
        }
      } catch (exc) {
        // Best-effort, silently ignore
      }
    }

    return {
      fetched_groups: groups.length,
      total_new_messages: totalNew,
      errors: errors
    };
  } finally {
    // Client cleanup if needed
  }
}

/**
 * Send a message (E2EE or plain)
 * @param {Object} httpClient - HTTP client
 * @param {string} senderDid - Sender DID
 * @param {string} receiverDid - Receiver DID
 * @param {string} msgType - Message type
 * @param {string|Object} content - Content
 * @param {Object} options - Options
 * @param {Object} options.auth - Authenticator
 * @param {string} options.credentialName - Credential name
 * @returns {Promise<Object>} Send result
 */
async function _send_msg(httpClient, senderDid, receiverDid, msgType, content, { auth, credentialName = 'default' }) {
  if (typeof content === 'object') {
    content = JSON.stringify(content);
  }
  
  return authenticated_rpc_call(
    httpClient,
    MESSAGE_RPC,
    'send',
    {
      sender_did: senderDid,
      receiver_did: receiverDid,
      content: content,
      type: msgType
    },
    1,
    { auth, credentialName }
  );
}

/**
 * Check identity status; bootstrap missing JWT and refresh expired JWT
 * @param {string} credentialName - Credential name
 * @returns {Promise<Object>} Identity status
 */
async function check_identity(credentialName = 'default') {
  const data = load_identity(credentialName);
  
  if (data === null) {
    return { status: 'no_identity', did: null, name: null, jwt_valid: false };
  }

  const result = {
    status: 'ok',
    did: data.did,
    name: data.name,
    jwt_valid: false
  };

  const config = new SDKConfig();
  const authResult = create_authenticator(credentialName, config);
  
  if (authResult === null) {
    result.status = 'no_did_document';
    result.error = 'Credential missing DID document; please recreate identity';
    return result;
  }

  const [auth] = authResult;
  const oldToken = data.jwt_token;

  try {
    const client = create_user_service_client(config);
    try {
      await authenticated_rpc_call(
        client,
        AUTH_RPC,
        'get_me',
        null,
        1,
        { auth, credentialName }
      );
      result.jwt_valid = true;
      
      // Check if token was refreshed
      const refreshedData = load_identity(credentialName);
      if (refreshedData && refreshedData.jwt_token !== oldToken) {
        result.jwt_refreshed = true;
      }
    } finally {
      // Client cleanup
    }
  } catch (e) {
    result.status = 'jwt_refresh_failed';
    result.error = String(e.message || e);
  }

  return result;
}

/**
 * Fetch inbox and summarize user-visible unread messages
 * @param {string} credentialName - Credential name
 * @returns {Promise<Object>} Inbox summary
 */
async function summarize_inbox(credentialName = 'default') {
  const config = new SDKConfig();
  const authResult = create_authenticator(credentialName, config);
  
  if (authResult === null) {
    return {
      status: 'no_identity',
      total: 0,
      by_type: {},
      text_messages: 0,
      text_by_sender: {},
      messages: []
    };
  }

  const [auth, data] = authResult;
  
  try {
    const client = create_molt_message_client(config);
    try {
      const inbox = await authenticated_rpc_call(
        client,
        MESSAGE_RPC,
        'get_inbox',
        { user_did: data.did, limit: _INBOX_FETCH_LIMIT },
        1,
        { auth, credentialName }
      );
      
      const messages = inbox.messages || [];
      const visibleMessages = messages
        .filter(message => _is_user_visible_message_type(String(message.type || '')))
        .map(message => _strip_hidden_user_fields(message));
      
      return _build_visible_inbox_report(visibleMessages);
    } finally {
      // Client cleanup
    }
  } catch (exc) {
    return {
      status: 'error',
      error: String(exc.message || exc),
      total: 0,
      by_type: {},
      text_messages: 0,
      text_by_sender: {},
      messages: []
    };
  }
}

/**
 * Fetch inbox, auto-handle E2EE, and return the surfaced messages
 * @param {string} credentialName - Credential name
 * @param {Object} options - Options
 * @param {Object|null} options.listenerStatus - Listener status
 * @returns {Promise<Object>} Inbox report
 */
async function _build_inbox_report_with_auto_e2ee(credentialName = 'default', { listenerStatus = null } = {}) {
  const config = new SDKConfig();
  const authResult = create_authenticator(credentialName, config);
  
  if (authResult === null) {
    return {
      status: 'no_identity',
      total: 0,
      by_type: {},
      text_messages: 0,
      text_by_sender: {},
      messages: []
    };
  }

  const websocketMode = is_websocket_mode(config);
  let listenerOwnedInbox = false;
  
  if (websocketMode) {
    const resolvedListenerStatus = listenerStatus || ensure_listener_runtime(credentialName, config);
    listenerOwnedInbox = !!resolvedListenerStatus.was_running;
  }

  const [auth, data] = authResult;
  
  if (websocketMode && listenerOwnedInbox) {
    const report = _build_local_inbox_report(data.did);
    const localMessages = [...(report.messages || [])];
    
    const remoteSync = await _sync_remote_visible_inbox_messages({
      credentialName,
      auth,
      ownerDid: String(data.did),
      config
    });
    
    const mergedMessages = _merge_visible_inbox_messages(
      localMessages,
      remoteSync.messages || [],
      { limit: _INBOX_FETCH_LIMIT }
    );
    
    const newReport = _build_visible_inbox_report(mergedMessages);
    newReport.source = 'local_ws_cache';
    newReport.http_sync = {
      attempted: true,
      status: remoteSync.status || 'error',
      total: remoteSync.total || 0
    };
    if (typeof remoteSync.error === 'string') {
      newReport.http_sync.error = remoteSync.error;
    }
    return newReport;
  }
  
  try {
    const client = create_molt_message_client(config);
    try {
      const inbox = await authenticated_rpc_call(
        client,
        MESSAGE_RPC,
        'get_inbox',
        { user_did: data.did, limit: _INBOX_FETCH_LIMIT },
        1,
        { auth, credentialName }
      );
      
      let messages = [...(inbox.messages || [])];
      messages.sort((a, b) => {
        const keyA = _message_sort_key(a);
        const keyB = _message_sort_key(b);
        
        for (let i = 0; i < Math.max(keyA.length, keyB.length); i++) {
          if (keyA[i] !== keyB[i]) {
            return keyB[i] > keyA[i] ? 1 : -1;
          }
        }
        return 0;
      });

      const e2eeClient = _load_or_create_e2ee_client(data.did, credentialName);
      const processedIds = [];
      const processedIdSet = new Set();
      const renderedDecryptedMessages = [];

      if (listenerOwnedInbox) {
        // ws_listener owns E2EE state — skip processing to avoid
        // state conflicts (race condition on session seq numbers).
      } else {
        for (const message of messages) {
          const msgType = String(message.type || '');
          
          if (!_E2EE_MSG_TYPES.has(msgType)) {
            continue;
          }

          const senderDid = String(message.sender_did || '');
          
          let content;
          try {
            content = typeof message.content === 'string'
              ? JSON.parse(message.content)
              : (message.content || {});
          } catch (e) {
            continue;
          }

          if (msgType === 'e2ee_msg') {
            try {
              const [originalType, plaintext] = e2eeClient.decrypt_message(content);
              renderedDecryptedMessages.push(
                _decorate_user_visible_e2ee_message(message, {
                  originalType,
                  plaintext
                })
              );
              
              if (typeof message.id === 'string' && message.id) {
                processedIds.push(message.id);
                processedIdSet.add(message.id);
              }
            } catch (exc) {
              const [errorCode, retryHint] = _classify_decrypt_error(exc);
              const errorContent = build_e2ee_error_content(errorCode, {
                sessionId: content.session_id,
                failedMsgId: message.id,
                failedServerSeq: message.server_seq,
                retryHint,
                requiredE2eeVersion: errorCode === 'unsupported_version' ? SUPPORTED_E2EE_VERSION : null,
                message: build_e2ee_error_message(errorCode, {
                  requiredE2eeVersion: errorCode === 'unsupported_version' ? SUPPORTED_E2EE_VERSION : null,
                  detail: String(exc.message || exc)
                })
              });
              
              await _send_msg(
                client,
                data.did,
                senderDid,
                'e2ee_error',
                errorContent,
                { auth, credentialName }
              );
            }
            continue;
          }

          try {
            if (msgType === 'e2ee_error') {
              record_remote_failure({
                credentialName,
                peerDid: senderDid,
                content
              });
            }
            
            const responses = await e2eeClient.process_e2ee_message(msgType, content);
            let sessionReady = true;
            const terminalErrorNotified = responses.some(
              ([responseType]) => responseType === 'e2ee_error'
            );
            
            if (_E2EE_SESSION_SETUP_TYPES.has(msgType)) {
              sessionReady = e2eeClient.has_session_id(content.session_id);
            }
            
            for (const [responseType, responseContent] of responses) {
              await _send_msg(
                client,
                data.did,
                senderDid,
                responseType,
                responseContent,
                { auth, credentialName }
              );
            }

            if (sessionReady || terminalErrorNotified) {
              if (typeof message.id === 'string' && message.id) {
                processedIds.push(message.id);
                processedIdSet.add(message.id);
              }
            }
          } catch (exc) {
            // E2EE auto-processing failed
          }
        }
      }

      if (processedIds.length > 0) {
        await authenticated_rpc_call(
          client,
          MESSAGE_RPC,
          'mark_read',
          { user_did: data.did, message_ids: processedIds },
          1,
          { auth, credentialName }
        );
      }

      if (!listenerOwnedInbox) {
        _save_e2ee_client(e2eeClient, credentialName);
      }

      const remainingMessages = messages.filter(
        message => !processedIdSet.has(String(message.id || ''))
      );
      
      const visibleMessages = [
        ...renderedDecryptedMessages,
        ...remainingMessages
          .filter(message => _is_user_visible_message_type(String(message.type || '')))
          .map(message => _strip_hidden_user_fields(message))
      ];
      
      const report = _build_visible_inbox_report(visibleMessages);
      report.source = websocketMode ? 'remote_http_fallback' : 'remote_http';
      return report;
    } finally {
      // Client cleanup
    }
  } catch (exc) {
    return {
      status: 'error',
      error: String(exc.message || exc),
      total: 0,
      by_type: {},
      text_messages: 0,
      text_by_sender: {},
      messages: []
    };
  }
}

/**
 * Unified status check orchestrator
 * @param {string} credentialName - Credential name
 * @returns {Promise<Object>} Status report
 */
async function check_status(credentialName = 'default') {
  const report = {
    timestamp: new Date().toISOString()
  };

  report.local_upgrade = ensure_local_upgrade_ready(credentialName);
  report.credential_layout = report.local_upgrade.credential_layout;
  report.local_database = report.local_upgrade.local_database;
  
  if (!report.credential_layout.credential_ready) {
    report.identity = {
      status: 'storage_migration_required',
      did: null,
      name: null,
      jwt_valid: false,
      error: 'Credential storage migration failed or is incomplete'
    };
    report.inbox = { status: 'skipped', total: 0 };
    report.group_watch = { status: 'skipped', active_groups: 0, groups: [] };
    report.e2ee_sessions = { active: 0 };
    return report;
  }

  if (report.local_database.status === 'error') {
    report.identity = {
      status: 'local_database_migration_failed',
      did: null,
      name: null,
      jwt_valid: false,
      error: 'Local database migration failed'
    };
    report.inbox = { status: 'skipped', total: 0 };
    report.group_watch = { status: 'skipped', active_groups: 0, groups: [] };
    report.e2ee_sessions = { active: 0 };
    return report;
  }

  // 1. Identity check
  report.identity = await check_identity(credentialName);

  // Return early if identity does not exist
  if (report.identity.status === 'no_identity') {
    report.inbox = { status: 'skipped', total: 0 };
    report.group_watch = { status: 'no_identity', active_groups: 0, groups: [] };
    report.e2ee_sessions = { active: 0 };
    return report;
  }

  // 2. Local discovery-group watch summary
  const ownerDid = report.identity.did;
  report.group_watch = summarize_group_watch(ownerDid);

  // 2b. Fetch incremental group messages for active groups
  if (
    report.group_watch.status === 'ok' &&
    (report.group_watch.active_groups || 0) > 0 &&
    ownerDid
  ) {
    report.group_watch.fetch_summary = await fetch_group_messages(
      report.group_watch,
      { ownerDid, credentialName }
    );
  }

  const config = new SDKConfig();
  const websocketMode = is_websocket_mode(config);
  
  let listenerRuntime;
  if (websocketMode) {
    listenerRuntime = ensure_listener_runtime(credentialName, config);
  } else {
    listenerRuntime = get_listener_runtime_report(credentialName, config);
  }

  // 3. Inbox summary / delivery
  report.inbox = await _build_inbox_report_with_auto_e2ee(credentialName, {
    listenerStatus: listenerRuntime
  });

  // 4. E2EE session status
  try {
    const e2eeClient = load_e2ee_client(ownerDid, credentialName);
    report.e2ee_sessions = {
      active: (e2eeClient.export_state().sessions || []).length
    };
  } catch (exc) {
    report.e2ee_sessions = { active: 0 };
  }

  // 5. Real-time listener status
  report.realtime_listener = {
    mode: websocketMode ? 'websocket' : 'http',
    installed: listenerRuntime.installed || false,
    running: listenerRuntime.running || false,
    service_running: listenerRuntime.service_running || false,
    daemon_available: listenerRuntime.daemon_available || false,
    degraded: listenerRuntime.degraded || false,
    auto_restart_paused: listenerRuntime.auto_restart_paused || false,
    consecutive_restart_failures: listenerRuntime.consecutive_restart_failures || 0,
    last_restart_attempt_at: listenerRuntime.last_restart_attempt_at,
    last_restart_result: listenerRuntime.last_restart_result
  };
  
  const lastError = listenerRuntime.last_error;
  if (typeof lastError === 'string' && lastError) {
    report.realtime_listener.last_error = lastError;
  }
  
  if (!listenerRuntime.installed) {
    report.realtime_listener.hint = `Run: python scripts/setup_realtime.py --credential ${credentialName}`;
  }

  return report;
}

/**
 * Run local credential/database upgrades needed by the current skill version
 * @param {string} credentialName - Credential name
 * @param {Object} options - Options
 * @param {boolean} options.coordinateListenerDuringDatabaseUpgrade - Coordinate listener
 * @returns {Object} Upgrade result
 */
function ensure_local_upgrade_ready(
  credentialName = 'default',
  { coordinateListenerDuringDatabaseUpgrade = false } = {}
) {
  const credentialLayout = ensure_credential_storage_ready(credentialName);
  
  let localDatabase;
  if (coordinateListenerDuringDatabaseUpgrade) {
    localDatabase = ensure_local_database_ready_for_upgrade();
  } else {
    localDatabase = ensure_local_database_ready();
  }
  
  const ready = (
    credentialLayout.credential_ready &&
    localDatabase.status !== 'error'
  );

  const performed = [];
  const migration = credentialLayout.migration;
  
  if (typeof migration === 'object' && migration !== null && 
      migration.status !== null && migration.status !== 'not_needed') {
    performed.push('credential_layout');
  }
  if (localDatabase.status === 'migrated') {
    performed.push('local_database');
  }

  return {
    status: ready ? 'ready' : 'error',
    credential_ready: credentialLayout.credential_ready,
    database_ready: localDatabase.status !== 'error',
    performed: performed,
    credential_layout: credentialLayout,
    local_database: localDatabase
  };
}

/**
 * Load the latest disk-first E2EE state from SQLite
 * @param {string} localDid - Local DID
 * @param {string} credentialName - Credential name
 * @returns {E2eeClient} E2EE client
 */
function _load_or_create_e2ee_client(localDid, credentialName) {
  return load_e2ee_client(localDid, credentialName);
}

/**
 * Persist the latest E2EE state into SQLite
 * @param {E2eeClient} client - E2EE client
 * @param {string} credentialName - Credential name
 */
function _save_e2ee_client(client, credentialName) {
  save_e2ee_client(client, credentialName);
}

module.exports = {
  check_status,
  check_identity,
  summarize_inbox,
  summarize_group_watch,
  fetch_group_messages,
  ensure_local_upgrade_ready,
  // Internal helpers (exported for testing)
  _message_time_value,
  _message_sort_key,
  _is_user_visible_message_type,
  _decorate_user_visible_e2ee_message,
  _strip_hidden_user_fields,
  _classify_decrypt_error,
  _build_visible_inbox_report,
  _message_id_value,
  _message_dedup_key,
  _message_display_sort_key,
  _merge_visible_inbox_messages,
  _load_local_visible_inbox_messages,
  _build_local_inbox_report,
  _sync_remote_visible_inbox_messages,
  _classify_group_messages,
  _persist_and_classify_group_messages,
  _fetch_one_group_messages,
  _send_msg,
  _build_inbox_report_with_auto_e2ee,
  _load_or_create_e2ee_client,
  _save_e2ee_client
};
