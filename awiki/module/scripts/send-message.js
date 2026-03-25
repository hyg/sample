/**
 * Send a message to a specified DID.
 *
 * Node.js implementation based on Python version:
 * python/scripts/send_message.py
 *
 * [INPUT]: SDK (RPC calls), credential_store (load identity credentials),
 *          local_store (local persistence), logging_config
 * [OUTPUT]: Send result (with server_seq and client_msg_id) plus local contact/event updates
 * [POS]: Message sending script, auto-generates client_msg_id for idempotent delivery.
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

const crypto = require('crypto');
const { SDKConfig } = require('./utils/config');
const { resolve_to_did } = require('./utils/resolve');
const { create_authenticator } = require('./credential-store');
const { message_rpc_call } = require('./message_transport');
const local_store = require('./local-store');

const MESSAGE_RPC = '/message/rpc';

/**
 * Remove fields intentionally hidden from user-facing CLI output.
 *
 * @param {Object} result - Result object
 * @returns {Object} Result object with hidden fields removed
 */
function _strip_hidden_result_fields(result) {
  const rendered = { ...result };
  delete rendered.title;
  return rendered;
}

/**
 * Send a message to a specified DID or handle.
 *
 * @param {string} receiver - Receiver DID or handle
 * @param {string} content - Message content
 * @param {string} [msg_type='text'] - Message type
 * @param {string} [credential_name='default'] - Credential name
 * @param {string|null} [title=null] - Message title
 * @returns {Promise<void>}
 */
async function send_message(receiver, content, msg_type = 'text', credential_name = 'default', title = null) {
  const config = new SDKConfig();
  const receiver_did = await resolve_to_did(receiver, config);

  console.error(`Sending message credential=${credential_name} receiver=${receiver} resolved_receiver=${receiver_did} type=${msg_type} content_length=${content.length}`);

  const auth_result = create_authenticator(credential_name, config);
  if (auth_result === null) {
    console.error(`Credential '${credential_name}' unavailable; please create an identity first`);
    process.exit(1);
  }

  const [_auth, data] = auth_result;

  // Generate client_msg_id for idempotent delivery
  const client_msg_id = crypto.randomUUID();

  // Build params, excluding null values
  const params = {};
  if (data.did !== null && data.did !== undefined) {
    params.sender_did = data.did;
  }
  if (receiver_did !== null && receiver_did !== undefined) {
    params.receiver_did = receiver_did;
  }
  if (content !== null && content !== undefined) {
    params.content = content;
  }
  if (title !== null && title !== undefined) {
    params.title = title;
  }
  if (msg_type !== null && msg_type !== undefined) {
    params.type = msg_type;
  }
  if (client_msg_id !== null && client_msg_id !== undefined) {
    params.client_msg_id = client_msg_id;
  }

  const result = await message_rpc_call('send', params, credential_name, config);

  // Store sent message locally
  try {
    const conn = local_store.get_connection();
    local_store.ensure_schema(conn);

    const thread_id = local_store.make_thread_id(data.did, { peerDid: receiver_did });

    local_store.store_message(conn, {
      msgId: result.id || crypto.randomUUID(),
      ownerDid: data.did,
      threadId: thread_id,
      direction: 1,
      senderDid: data.did,
      receiverDid: receiver_did,
      contentType: msg_type,
      content: content,
      title: title,
      serverSeq: result.server_seq,
      sentAt: result.sent_at,
      credentialName: credential_name,
    });

    // Record receiver in contacts
    const contact_fields = {};
    if (receiver !== receiver_did) {
      contact_fields.handle = receiver;
    }

    local_store.upsert_contact(conn, {
      ownerDid: data.did,
      did: receiver_did,
      messaged: true,
      ...contact_fields,
    });

    local_store.append_relationship_event(conn, {
      ownerDid: data.did,
      targetDid: receiver_did,
      targetHandle: receiver !== receiver_did ? receiver : null,
      eventType: 'messaged',
      status: 'applied',
      credentialName: credential_name,
    });

    conn.close();
  } catch (error) {
    console.error('Failed to persist sent message locally', error);
  }

  console.error('Message sent successfully:');
  console.log(JSON.stringify(_strip_hidden_result_fields(result), null, 2));
  console.error(`Message sent credential=${credential_name} msg_id=${result.id} server_seq=${result.server_seq}`);
}

/**
 * CLI entry point.
 * @returns {void}
 */
function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const parsedArgs = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--to' && args[i + 1]) {
      parsedArgs.to = args[i + 1];
      i++;
    } else if (args[i] === '--content' && args[i + 1]) {
      parsedArgs.content = args[i + 1];
      i++;
    } else if (args[i] === '--type' && args[i + 1]) {
      parsedArgs.type = args[i + 1];
      i++;
    } else if (args[i] === '--title' && args[i + 1]) {
      parsedArgs.title = args[i + 1];
      i++;
    } else if (args[i] === '--credential' && args[i + 1]) {
      parsedArgs.credential = args[i + 1];
      i++;
    }
  }

  // Validate required arguments
  if (!parsedArgs.to) {
    console.error('Error: --to is required');
    process.exit(1);
  }
  if (!parsedArgs.content) {
    console.error('Error: --content is required');
    process.exit(1);
  }

  console.error(`send_message CLI started credential=${parsedArgs.credential || 'default'} receiver=${parsedArgs.to} type=${parsedArgs.type || 'text'}`);

  send_message(
    parsedArgs.to,
    parsedArgs.content,
    parsedArgs.type || 'text',
    parsedArgs.credential || 'default',
    parsedArgs.title || null
  ).catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

module.exports = {
  send_message,
  main,
  _strip_hidden_result_fields,
};

// 也导出为 send_message 以兼容测试文件
module.exports.send_message = send_message;
