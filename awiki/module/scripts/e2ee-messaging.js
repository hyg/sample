/**
 * E2EE end-to-end encrypted messaging (HPKE scheme, with cross-process state persistence).
 *
 * Node.js implementation based on Python version:
 * python/scripts/e2ee_messaging.py
 *
 * [INPUT]: SDK (E2eeClient, RPC calls), credential_store (authenticated identity
 *          loading), SQLite-backed E2EE session store, logging_config
 * [OUTPUT]: E2EE operation results with failure-aware inbox processing, sender-facing
 *           e2ee_error notifications, and disk-first session persistence
 * [POS]: End-to-end encrypted messaging script, integrates SQLite-backed session
 *        persistence for cross-process E2EE communication (HPKE scheme)
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

const crypto = require('crypto');
const { SDKConfig } = require('./utils/config');
const { E2eeClient } = require('./utils/e2ee');
const { create_molt_message_client } = require('./utils/client');
const { authenticated_rpc_call } = require('./utils/rpc');
const { resolve_to_did } = require('./utils/resolve');
const {
  SUPPORTED_E2EE_VERSION,
  build_e2ee_error_content,
  build_e2ee_error_message,
} = require('./utils/e2ee');
const { create_authenticator } = require('./credential-store');
const {
  E2eeStateTransaction,
  load_e2ee_client,
  save_e2ee_client,
} = require('./e2ee-session-store');
const {
  is_websocket_mode,
  message_rpc_call,
} = require('./message_transport');
const {
  begin_send_attempt,
  get_record,
  list_failed_records,
  mark_dropped,
  record_local_failure,
  mark_send_success,
  record_remote_failure,
} = require('./e2ee-outbox');

const MESSAGE_RPC = '/message/rpc';

// E2EE related message types
const _E2EE_MSG_TYPES = new Set(['e2ee_init', 'e2ee_ack', 'e2ee_msg', 'e2ee_rekey', 'e2ee_error']);
const _E2EE_SESSION_SETUP_TYPES = new Set(['e2ee_init', 'e2ee_rekey']);
const _E2EE_USER_NOTICE = 'This is an encrypted message.';

// E2EE message type protocol order
const _E2EE_TYPE_ORDER = { 'e2ee_init': 0, 'e2ee_ack': 1, 'e2ee_rekey': 2, 'e2ee_msg': 3, 'e2ee_error': 4 };

/**
 * Return a sortable timestamp string for one message.
 * @param {Object} message - Message dictionary
 * @returns {string} Timestamp string
 */
function _message_time_value(message) {
  const timestamp = message.sent_at || message.created_at;
  return typeof timestamp === 'string' ? timestamp : '';
}

/**
 * Return a safe sender DID string for logging and user-facing output.
 * @param {Object} message - Message dictionary
 * @param {string} [fallback='?'] - Fallback value
 * @returns {string} Sender DID string
 */
function _sender_did_value(message, fallback = '?') {
  const senderDid = message.sender_did;
  return typeof senderDid === 'string' && senderDid ? senderDid : fallback;
}

/**
 * Build a stable inbox ordering key with server_seq priority inside a sender stream.
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
    _E2EE_TYPE_ORDER[message.type] || 99,
  ];
}

/**
 * Render the minimal user-facing text for a decrypted E2EE message.
 * @param {string} plaintext - Plaintext content
 * @returns {string} User-visible text
 */
function _render_user_visible_e2ee_text(plaintext) {
  return `${_E2EE_USER_NOTICE}\n${plaintext}`;
}

/**
 * Render the user-facing notice for the send-first auto-init flow.
 * @param {string} peerDid - Peer DID
 * @returns {string} Session notice text
 */
function _render_auto_session_notice(peerDid) {
  return (
    'No active E2EE session found; sent automatic init before the encrypted payload. ' +
    `Peer: ${peerDid}`
  );
}

/**
 * Map decryption failures to e2ee_error code and retry hint.
 * @param {Error} exc - Exception object
 * @returns {[string, string]} [error_code, retry_hint] tuple
 */
function _classify_decrypt_error(exc) {
  const msg = String(exc.message || exc).toLowerCase();
  if (msg.includes('unsupported_version')) {
    return ['unsupported_version', 'drop'];
  }
  if (msg.includes('session') && msg.includes('not found')) {
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
 * Load the latest disk-first E2EE client state from SQLite.
 * @param {string} localDid - Local DID
 * @param {string} credentialName - Credential name
 * @returns {E2eeClient} E2EE client
 */
function _load_or_create_e2ee_client(localDid, credentialName) {
  const client = load_e2ee_client(localDid, credentialName);
  if (client._signing_key === null || client._x25519_key === null) {
    console.warn('Warning: Credential missing E2EE keys (key-2/key-3); please recreate identity to enable HPKE E2EE');
  }
  return client;
}

/**
 * Persist the latest E2EE client state into SQLite.
 * @param {E2eeClient} client - E2EE client
 * @param {string} credentialName - Credential name
 */
function _save_e2ee_client(client, credentialName) {
  save_e2ee_client(client, credentialName);
}

/**
 * Send a message (E2EE or plain).
 * @param {Object} client - HTTP client
 * @param {string} senderDid - Sender DID
 * @param {string} receiverDid - Receiver DID
 * @param {string} msgType - Message type
 * @param {string|Object} content - Message content
 * @param {Object} options - Options
 * @param {Object} options.auth - Authenticator
 * @param {string} options.credentialName - Credential name
 * @param {string} [options.clientMsgId] - Client message ID
 * @param {string} [options.title] - Title
 * @returns {Promise<Object>} Send result
 * @private
 */
async function _send_msg(
  client,
  senderDid,
  receiverDid,
  msgType,
  content,
  { auth, credentialName = 'default', clientMsgId = null, title = null } = {}
) {
  if (typeof content === 'object') {
    content = JSON.stringify(content);
  }
  if (clientMsgId === null) {
    clientMsgId = crypto.randomUUID();
  }
  const params = {
    sender_did: senderDid,
    receiver_did: receiverDid,
    content: content,
    type: msgType,
    client_msg_id: clientMsgId,
  };
  if (title !== null) {
    params.title = title;
  }
  if (client === null) {
    return await message_rpc_call(
      'send',
      { params, credentialName }
    );
  }
  return await authenticated_rpc_call(
    client,
    MESSAGE_RPC,
    'send',
    params,
    1,
    { auth, credentialName }
  );
}

/**
 * Manually initiate an E2EE session (advanced/manual path).
 * @param {string} peerDid - Peer DID
 * @param {string} [credentialName='default'] - Credential name
 */
async function initiate_handshake(peerDid, credentialName = 'default') {
  const config = new SDKConfig();
  const authResult = create_authenticator(credentialName, config);
  if (authResult === null) {
    console.error(`Credential '${credentialName}' unavailable; please create an identity first`);
    process.exit(1);
  }

  const [auth, data] = authResult;
  const stateTx = new E2eeStateTransaction({ localDid: data.did, credentialName });
  try {
    const e2eeClient = stateTx.client;
    const [msgType, content] = await e2eeClient.initiate_handshake(peerDid);

    if (is_websocket_mode(config)) {
      await _send_msg(
        null,
        data.did,
        peerDid,
        msgType,
        content,
        { auth, credentialName }
      );
    } else {
      const moltClient = await create_molt_message_client(config).__aenter__();
      try {
        await _send_msg(
          moltClient,
          data.did,
          peerDid,
          msgType,
          content,
          { auth, credentialName }
        );
      } finally {
        await moltClient.__aexit__(null, null, null);
      }
    }

    stateTx.commit();
  } finally {
    stateTx.close();
  }

  console.log('E2EE session established (one-step initialization)');
  console.log(`  session_id: ${content.session_id}`);
  console.log(`  peer_did  : ${peerDid}`);
  console.log('Session is ACTIVE; you can send encrypted messages now');
  console.log('Tip: --send auto-initializes a session when needed; manual handshake is mainly for debugging or pre-warming.');
}

/**
 * Send an encrypted message through the normal send-first flow.
 * @param {string} peerDid - Peer DID
 * @param {string} plaintext - Plaintext content
 * @param {string} [credentialName='default'] - Credential name
 * @param {string} [originalType='text'] - Original message type
 * @param {string} [outboxId] - Outbox ID
 * @param {string} [title] - Title
 */
async function send_encrypted(
  peerDid,
  plaintext,
  credentialName = 'default',
  originalType = 'text',
  outboxId = null,
  title = null
) {
  const config = new SDKConfig();
  const authResult = create_authenticator(credentialName, config);
  if (authResult === null) {
    console.error(`Credential '${credentialName}' unavailable; please create an identity first`);
    process.exit(1);
  }

  const [auth, data] = authResult;
  let client = null;
  if (!is_websocket_mode(config)) {
    client = await create_molt_message_client(config).__aenter__();
  }

  try {
    const stateTx = new E2eeStateTransaction({ localDid: data.did, credentialName });
    try {
      const e2eeClient = stateTx.client;

      // Auto-handshake if session is missing or expired
      const initMsgs = await e2eeClient.ensure_active_session(peerDid);
      const [encType, encContent] = e2eeClient.encrypt_message(
        peerDid,
        plaintext,
        originalType
      );
      const sessionId = encContent.session_id;
      stateTx.commit();

      if (initMsgs.length > 0) {
        console.log(_render_auto_session_notice(peerDid));
      }
      for (const [initType, initContent] of initMsgs) {
        await _send_msg(
          client,
          data.did,
          peerDid,
          initType,
          initContent,
          { auth, credentialName }
        );
      }

      outboxId = begin_send_attempt({
        peer_did: peerDid,
        plaintext: plaintext,
        original_type: originalType,
        credential_name: credentialName,
        session_id: sessionId,
        outbox_id: outboxId,
      });

      const sendClientMsgId = crypto.randomUUID();
      let sendResult;
      try {
        sendResult = await _send_msg(
          client,
          data.did,
          peerDid,
          encType,
          encContent,
          { auth, credentialName, clientMsgId: sendClientMsgId, title }
        );
      } catch (exc) {
        record_local_failure({
          outbox_id: outboxId,
          credential_name: credentialName,
          error_code: 'send_request_failed',
          retry_hint: 'resend',
          metadata: JSON.stringify({ error: String(exc) }),
        });
        console.error(`Encrypted message send failed; outbox_id=${outboxId}`);
        throw exc;
      }

      mark_send_success({
        outbox_id: outboxId,
        credential_name: credentialName,
        local_did: data.did,
        peer_did: peerDid,
        plaintext: plaintext,
        original_type: originalType,
        session_id: sessionId,
        sent_msg_id: sendResult.id,
        sent_server_seq: sendResult.server_seq,
        sent_at: sendResult.sent_at,
        client_msg_id: sendClientMsgId,
        title: title,
      });
    } finally {
      stateTx.close();
    }
  } finally {
    if (client !== null) {
      await client.__aexit__(null, null, null);
    }
  }

  console.log('Encrypted message sent');
  console.log(`  Plaintext: ${plaintext}`);
  console.log(`  Receiver : ${peerDid}`);
  console.log(`  Outbox ID: ${outboxId}`);
}

/**
 * Process E2EE messages in inbox.
 * @param {string} peerDid - Peer DID
 * @param {string} [credentialName='default'] - Credential name
 */
async function process_inbox(peerDid, credentialName = 'default') {
  const config = new SDKConfig();
  const authResult = create_authenticator(credentialName, config);
  if (authResult === null) {
    console.error(`Credential '${credentialName}' unavailable; please create an identity first`);
    process.exit(1);
  }
  if (is_websocket_mode(config)) {
    console.error(
      'WebSocket receive mode is enabled; the background listener owns E2EE inbox processing. ' +
      'Use check_status/check_inbox or switch to HTTP mode for manual --process.'
    );
    process.exit(1);
  }

  const [auth, data] = authResult;
  const client = await create_molt_message_client(config).__aenter__();
  try {
    // Get inbox
    const inbox = await authenticated_rpc_call(
      client,
      MESSAGE_RPC,
      'get_inbox',
      { user_did: data.did, limit: 50 },
      1,
      { auth, credentialName }
    );
    const messages = inbox.messages || [];
    if (messages.length === 0) {
      console.log('Inbox is empty');
      return;
    }

    // Sort by sender stream + server_seq, fallback to created_at.
    messages.sort((a, b) => {
      const keyA = _message_sort_key(a);
      const keyB = _message_sort_key(b);
      for (let i = 0; i < Math.min(keyA.length, keyB.length); i++) {
        if (keyA[i] < keyB[i]) return -1;
        if (keyA[i] > keyB[i]) return 1;
      }
      return 0;
    });

    let e2eeClient = null;

    // Try to restore existing E2EE client from disk
    e2eeClient = _load_or_create_e2ee_client(data.did, credentialName);
    const processedIds = [];

    for (const msg of messages) {
      const msgType = msg.type;
      const senderDid = _sender_did_value(msg);
      let processedOk = false;

      if (_E2EE_MSG_TYPES.has(msgType)) {
        const content = JSON.parse(msg.content);

        if (msgType === 'e2ee_msg') {
          try {
            const [originalType, plaintext] = e2eeClient.decrypt_message(content);
            console.info(
              `Decrypted E2EE inbox message sender=${senderDid} original_type=${originalType}`
            );
            console.log(_render_user_visible_e2ee_text(plaintext));
            processedOk = true;
          } catch (e) {
            console.warn(
              `Failed to decrypt E2EE inbox message sender=${senderDid} error=${e.message}`
            );
            const [errorCode, retryHint] = _classify_decrypt_error(e);
            const errorContent = build_e2ee_error_content(
              errorCode,
              {
                sessionId: content.session_id,
                failedMsgId: msg.id,
                failedServerSeq: msg.server_seq,
                retryHint: retryHint,
                requiredE2eeVersion: errorCode === 'unsupported_version' ? SUPPORTED_E2EE_VERSION : null,
                message: build_e2ee_error_message(
                  errorCode,
                  {
                    requiredE2eeVersion: errorCode === 'unsupported_version' ? SUPPORTED_E2EE_VERSION : null,
                    detail: String(e),
                  }
                ),
              }
            );
            await _send_msg(
              client,
              data.did,
              senderDid,
              'e2ee_error',
              errorContent,
              { auth, credentialName }
            );
          }
        } else {
          if (msgType === 'e2ee_error') {
            const matchedOutboxId = record_remote_failure({
              credential_name: credentialName,
              peer_did: senderDid,
              content: content,
            });
            if (matchedOutboxId) {
              console.info(
                `Matched failed E2EE outbox sender=${senderDid} outbox_id=${matchedOutboxId}`
              );
            }
          }
          const responses = await e2eeClient.process_e2ee_message(msgType, content);
          let sessionReady = true;
          const terminalErrorNotified = responses.some(
            ([respType]) => respType === 'e2ee_error'
          );
          if (_E2EE_SESSION_SETUP_TYPES.has(msgType)) {
            sessionReady = e2eeClient.has_session_id(content.session_id);
          }
          console.info(
            `Processed E2EE protocol message type=${msgType} sender=${senderDid} responses=${responses.length} session_ready=${sessionReady} terminal_error_notified=${terminalErrorNotified}`
          );
          if (sessionReady) {
            processedOk = true;
          } else if (terminalErrorNotified) {
            processedOk = true;
          }
          for (const [respType, respContent] of responses) {
            await _send_msg(
              client,
              data.did,
              peerDid,
              respType,
              respContent,
              { auth, credentialName }
            );
          }
        }
      } else {
        console.log(`  [${msgType}] From ${senderDid.substring(0, 40)}...: ${msg.content}`);
        processedOk = true;
      }

      if (processedOk) {
        processedIds.push(msg.id);
      }
    }

    // Mark as read
    if (processedIds.length > 0) {
      await authenticated_rpc_call(
        client,
        MESSAGE_RPC,
        'mark_read',
        { user_did: data.did, message_ids: processedIds },
        1,
        { auth, credentialName }
      );
      console.info(`Marked ${processedIds.length} E2EE inbox message(s) as read`);
    }

    // Save E2EE client state to disk
    if (e2eeClient !== null) {
      _save_e2ee_client(e2eeClient, credentialName);
    }
  } finally {
    await client.__aexit__(null, null, null);
  }
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const argMap = {};
  let currentArg = null;

  for (const arg of args) {
    if (arg.startsWith('--')) {
      currentArg = arg;
      argMap[currentArg] = true;
    } else if (currentArg) {
      argMap[currentArg] = arg;
    }
  }

  const action = (
    argMap['--handshake'] ? 'handshake' :
    argMap['--send'] ? 'send' :
    argMap['--process'] ? 'process' :
    argMap['--list-failed'] ? 'list_failed' :
    argMap['--retry'] ? 'retry' :
    argMap['--drop'] ? 'drop' :
    null
  );

  const credentialName = argMap['--credential'] || 'default';

  console.info(
    `e2ee_messaging CLI started credential=${credentialName} action=${action}`
  );

  // Helper to resolve DID
  async function resolveDid(value) {
    return await resolve_to_did(value);
  }

  // Main CLI handler
  (async () => {
    if (argMap['--handshake']) {
      const peerDid = await resolveDid(argMap['--handshake']);
      await initiate_handshake(peerDid, credentialName);
    } else if (argMap['--send']) {
      if (!argMap['--content']) {
        console.error('Sending encrypted message requires --content');
        process.exit(1);
      }
      const peerDid = await resolveDid(argMap['--send']);
      await send_encrypted(
        peerDid,
        argMap['--content'],
        credentialName,
        'text',
        null,
        argMap['--title'] || null
      );
    } else if (argMap['--process']) {
      if (!argMap['--peer']) {
        console.error('Processing inbox requires --peer');
        process.exit(1);
      }
      const peerDid = await resolveDid(argMap['--peer']);
      await process_inbox(peerDid, credentialName);
    } else if (argMap['--list-failed']) {
      const records = list_failed_records(credentialName);
      console.log(JSON.stringify(records, null, 2));
    } else if (argMap['--retry']) {
      const record = get_record(argMap['--retry'], credentialName);
      if (record === null) {
        console.error(`Outbox record '${argMap['--retry']}' not found`);
        process.exit(1);
      }
      await send_encrypted(
        record.peer_did,
        record.plaintext,
        credentialName,
        record.original_type || 'text',
        record.outbox_id,
      );
    } else if (argMap['--drop']) {
      mark_dropped(argMap['--drop'], credentialName);
      console.log(`Dropped outbox record: ${argMap['--drop']}`);
    } else {
      console.error('No action specified. Use --help for usage.');
      process.exit(1);
    }
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  initiate_handshake,
  send_encrypted,
  process_inbox,
  // Internal helpers (exported for testing)
  _message_time_value,
  _sender_did_value,
  _message_sort_key,
  _render_user_visible_e2ee_text,
  _render_auto_session_notice,
  _classify_decrypt_error,
  _load_or_create_e2ee_client,
  _save_e2ee_client,
  _send_msg,
};
