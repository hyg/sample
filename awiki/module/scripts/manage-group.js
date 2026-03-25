/**
 * Manage AWiki groups.
 *
 * Node.js implementation based on Python version:
 * python/scripts/manage_group.py
 *
 * [INPUT]: SDK group RPC calls, credential_store authenticator, local_store SQLite cache,
 *          public markdown URLs, logging_config
 * [OUTPUT]: Group operation results, local group/message persistence,
 *          and public markdown fetches with local X-Handle fallback
 * [POS]: Group management CLI
 */

const local_store = require('./local-store');
const { SDKConfig } = require('./utils/config');
const { JsonRpcError, authenticated_rpc_call } = require('./utils/rpc');
const { create_user_service_client } = require('./utils/client');
const { create_authenticator } = require('./credential-store');
const { configureLogging } = require('./utils/logging');

const { URL } = require('url');
const httpx = require('undici');

const GROUP_RPC_ENDPOINT = '/group/rpc';
const JOIN_GUIDANCE = 'Discovery groups can only be joined with the global 6-digit join-code. Use --join --join-code <code>.';

/**
 * Return persisted local identity data for the active credential.
 *
 * @param {string} credential_name - Credential name
 * @param {SDKConfig} config - SDK configuration
 * @returns {object} Identity data
 */
function _get_identity_data_or_exit(credential_name, config) {
  const authResult = _get_authenticator_or_exit(credential_name, config);
  return authResult[1];
}

/**
 * Persist a local snapshot of one group.
 *
 * @param {object} options - Options
 * @param {string} options.credential_name - Credential name
 * @param {object} options.identity_data - Identity data
 * @param {object} options.group_payload - Group payload
 * @param {string|null} [options.my_role] - My role
 * @param {string|null} [options.membership_status] - Membership status
 * @param {number|null} [options.last_synced_seq] - Last synced sequence
 * @param {string|null} [options.last_message_at] - Last message timestamp
 */
function _persist_group_snapshot({
  credential_name,
  identity_data,
  group_payload,
  my_role = null,
  membership_status = null,
  last_synced_seq = null,
  last_message_at = null,
}) {
  const group_id = String(group_payload.group_id || '');
  if (!group_id) {
    return;
  }

  const conn = local_store.get_connection();
  try {
    local_store.ensure_schema(conn);
    local_store.upsert_group(conn, {
      owner_did: String(identity_data.did || ''),
      group_id,
      group_did: group_payload.group_did,
      name: group_payload.name,
      group_mode: group_payload.group_mode || 'general',
      slug: group_payload.slug,
      description: group_payload.description,
      goal: group_payload.goal,
      rules: group_payload.rules,
      message_prompt: group_payload.message_prompt,
      doc_url: group_payload.doc_url,
      group_owner_did: group_payload.owner_did,
      group_owner_handle: group_payload.owner_handle,
      my_role,
      membership_status,
      join_enabled: group_payload.join_enabled,
      join_code: group_payload.join_code,
      join_code_expires_at: group_payload.join_code_expires_at,
      member_count: group_payload.member_count,
      last_synced_seq,
      last_message_at,
      remote_created_at: group_payload.created_at,
      remote_updated_at: group_payload.updated_at,
      metadata: group_payload.metadata,
      credential_name,
    });
  } finally {
    conn.close();
  }
}

/**
 * Replace the cached active-member snapshot for one group.
 *
 * @param {object} options - Options
 * @param {string} options.credential_name - Credential name
 * @param {object} options.identity_data - Identity data
 * @param {string} options.group_id - Group ID
 * @param {object[]} options.members - Member list
 */
function _persist_group_member_snapshot({ credential_name, identity_data, group_id, members }) {
  const conn = local_store.get_connection();
  try {
    local_store.ensure_schema(conn);
    local_store.replace_group_members(conn, {
      owner_did: String(identity_data.did || ''),
      group_id,
      members,
      credential_name,
    });
    local_store.upsert_group(conn, {
      owner_did: String(identity_data.did || ''),
      group_id,
      member_count: members.length,
      credential_name,
    });
  } finally {
    conn.close();
  }
}

/**
 * Persist a fetched group history batch into the local message cache.
 *
 * @param {object} options - Options
 * @param {string} options.credential_name - Credential name
 * @param {object} options.identity_data - Identity data
 * @param {string} options.group_id - Group ID
 * @param {object} options.payload - Group payload with messages
 */
function _persist_group_messages({ credential_name, identity_data, group_id, payload }) {
  const messages = payload.messages || [];
  if (messages.length === 0) {
    return;
  }

  const my_did = String(identity_data.did || '');
  const batch = [];
  let max_server_seq = null;
  let last_message_at = null;

  for (const message of messages) {
    const sender_did = String(message.sender_did || '');
    const direction = sender_did && sender_did === my_did ? 1 : 0;
    const sent_at = message.sent_at || message.created_at;
    const server_seq = message.server_seq;

    if (typeof server_seq === 'number') {
      max_server_seq = max_server_seq === null ? server_seq : Math.max(max_server_seq, server_seq);
    }
    if (sent_at) {
      last_message_at = String(sent_at);
    }

    batch.push({
      msg_id: message.id || '',
      thread_id: local_store.make_thread_id(my_did, { group_id }),
      direction,
      sender_did,
      receiver_did: null,
      group_id,
      group_did: message.group_did,
      content_type: message.type || 'group_user',
      content: String(message.content || ''),
      title: message.title,
      server_seq,
      sent_at,
      sender_name: message.sender_name,
      metadata: message.system_event !== undefined
        ? JSON.stringify({ system_event: message.system_event })
        : null,
      credential_name,
      owner_did: my_did,
    });
  }

  const conn = local_store.get_connection();
  try {
    local_store.ensure_schema(conn);
    local_store.store_messages_batch(conn, batch, my_did, credential_name);

    for (const message of messages) {
      const system_event = message.system_event;
      if (typeof system_event !== 'object' || system_event === null) {
        continue;
      }
      local_store.sync_group_member_from_system_event(conn, {
        owner_did: my_did,
        group_id,
        system_event,
        credential_name,
      });
    }

    local_store.upsert_group(conn, {
      owner_did: my_did,
      group_id,
      membership_status: 'active',
      last_synced_seq: payload.next_since_seq || max_server_seq,
      last_message_at,
      credential_name,
    });
  } finally {
    conn.close();
  }
}

/**
 * Persist one successful outgoing group message locally.
 *
 * @param {object} options - Options
 * @param {string} options.credential_name - Credential name
 * @param {object} options.identity_data - Identity data
 * @param {string} options.group_id - Group ID
 * @param {string} options.content - Content
 * @param {string|null} [options.client_msg_id] - Client message ID
 * @param {object} options.payload - Send response payload
 */
function _persist_outgoing_group_message({
  credential_name,
  identity_data,
  group_id,
  content,
  client_msg_id = null,
  payload,
}) {
  const my_did = String(identity_data.did || '');
  const sender_name = identity_data.handle || identity_data.name;
  const msg_id = String(payload.message_id || payload.id || '');
  if (!msg_id) {
    return;
  }

  const conn = local_store.get_connection();
  try {
    local_store.ensure_schema(conn);
    local_store.store_message(conn, {
      msg_id,
      owner_did: my_did,
      thread_id: local_store.make_thread_id(my_did, { group_id }),
      direction: 1,
      sender_did: my_did,
      receiver_did: null,
      group_id,
      group_did: null,
      content_type: 'group_user',
      content,
      server_seq: payload.server_seq,
      sent_at: payload.created_at,
      sender_name: sender_name ? String(sender_name) : null,
      credential_name,
    });
    local_store.upsert_group(conn, {
      owner_did: my_did,
      group_id,
      membership_status: 'active',
      last_synced_seq: payload.server_seq,
      last_message_at: payload.created_at,
      credential_name,
      metadata: client_msg_id ? { last_post_client_msg_id: client_msg_id } : null,
    });
  } finally {
    conn.close();
  }
}

/**
 * Parse a CLI boolean value.
 *
 * @param {string} value - String value to parse
 * @returns {boolean} Parsed boolean
 * @throws {Error} If value cannot be parsed as boolean
 */
function _parse_bool(value) {
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  throw new Error('Boolean values must be true or false');
}

/**
 * Return an authenticator or terminate with a user-facing error.
 *
 * @param {string} credential_name - Credential name
 * @param {SDKConfig} config - SDK configuration
 * @returns {[object, object]} Tuple of [auth, identity_data]
 */
function _get_authenticator_or_exit(credential_name, config) {
  const authResult = create_authenticator(credential_name, config);
  if (authResult === null) {
    console.error(`Credential '${credential_name}' unavailable; please create an identity first`);
    process.exit(1);
  }
  return authResult;
}

/**
 * Run an authenticated group RPC call.
 *
 * @param {string} credential_name - Credential name
 * @param {string} method - RPC method name
 * @param {object|null} [params] - RPC parameters
 * @returns {Promise<object>} RPC result
 */
async function _authenticated_group_call(credential_name, method, params = null) {
  const config = new SDKConfig();
  const [auth, _] = _get_authenticator_or_exit(credential_name, config);
  
  const client = create_user_service_client(config);
  try {
    return await authenticated_rpc_call(
      client,
      GROUP_RPC_ENDPOINT,
      method,
      params || {},
      1,
      { auth, credentialName: credential_name }
    );
  } finally {
    // Client cleanup handled by garbage collector
  }
}

/**
 * Create a group.
 *
 * @param {object} options - Options
 * @param {string} options.name - Group name
 * @param {string} options.slug - Group slug
 * @param {string} options.description - Group description
 * @param {string} options.goal - Group goal
 * @param {string} options.rules - Group rules
 * @param {string|null} [options.message_prompt] - Message prompt
 * @param {number|null} [options.member_max_messages] - Member max messages
 * @param {number|null} [options.member_max_total_chars] - Member max total chars
 * @param {boolean} options.join_enabled - Join enabled
 * @param {string} options.credential_name - Credential name
 */
async function create_group({
  name,
  slug,
  description,
  goal,
  rules,
  message_prompt = null,
  member_max_messages = null,
  member_max_total_chars = null,
  join_enabled,
  credential_name,
}) {
  const config = new SDKConfig();
  const identity_data = _get_identity_data_or_exit(credential_name, config);
  
  console.log(`Creating group credential=${credential_name} slug=${slug}`);
  
  const params = {
    name,
    slug,
    description,
    goal,
    rules,
    join_enabled,
  };
  
  if (message_prompt !== null) {
    params.message_prompt = message_prompt;
  }
  if (member_max_messages !== null) {
    params.member_max_messages = member_max_messages;
  }
  if (member_max_total_chars !== null) {
    params.member_max_total_chars = member_max_total_chars;
  }
  
  let result;
  try {
    result = await _authenticated_group_call(credential_name, 'create', params);
  } catch (exc) {
    if (exc instanceof JsonRpcError && exc.code === -32004) {
      console.error(`Slug '${slug}' is already taken. Please choose a different slug.`);
    }
    throw exc;
  }
  
  _persist_group_snapshot({
    credential_name,
    identity_data,
    group_payload: result,
    my_role: 'owner',
    membership_status: 'active',
  });
  
  console.error('Group created successfully:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Get group detail.
 *
 * @param {object} options - Options
 * @param {string} options.group_id - Group ID
 * @param {string} options.credential_name - Credential name
 */
async function get_group({ group_id, credential_name }) {
  const config = new SDKConfig();
  const identity_data = _get_identity_data_or_exit(credential_name, config);
  
  console.log(`Fetching group detail credential=${credential_name} group_id=${group_id}`);
  
  const result = await _authenticated_group_call(credential_name, 'get', { group_id });
  
  _persist_group_snapshot({
    credential_name,
    identity_data,
    group_payload: result,
    membership_status: 'active',
  });
  
  console.error('Group detail:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Update mutable group metadata.
 *
 * @param {object} options - Options
 * @param {string} options.group_id - Group ID
 * @param {string|null} [options.name] - Group name
 * @param {string|null} [options.description] - Description
 * @param {string|null} [options.goal] - Goal
 * @param {string|null} [options.rules] - Rules
 * @param {string|null} [options.message_prompt] - Message prompt
 * @param {number|null} [options.member_max_messages] - Member max messages
 * @param {number|null} [options.member_max_total_chars] - Member max total chars
 * @param {string} options.credential_name - Credential name
 */
async function update_group({
  group_id,
  name = null,
  description = null,
  goal = null,
  rules = null,
  message_prompt = null,
  member_max_messages = null,
  member_max_total_chars = null,
  credential_name,
}) {
  const config = new SDKConfig();
  const identity_data = _get_identity_data_or_exit(credential_name, config);
  
  console.log(`Updating group credential=${credential_name} group_id=${group_id}`);
  
  const params = { group_id };
  if (name !== null) params.name = name;
  if (description !== null) params.description = description;
  if (goal !== null) params.goal = goal;
  if (rules !== null) params.rules = rules;
  if (message_prompt !== null) params.message_prompt = message_prompt;
  if (member_max_messages !== null) params.member_max_messages = member_max_messages;
  if (member_max_total_chars !== null) params.member_max_total_chars = member_max_total_chars;
  
  const result = await _authenticated_group_call(credential_name, 'update', params);
  
  _persist_group_snapshot({
    credential_name,
    identity_data,
    group_payload: result,
    my_role: 'owner',
    membership_status: 'active',
  });
  
  console.error('Group updated successfully:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Refresh the active join-code.
 *
 * @param {object} options - Options
 * @param {string} options.group_id - Group ID
 * @param {string} options.credential_name - Credential name
 */
async function refresh_join_code({ group_id, credential_name }) {
  const config = new SDKConfig();
  const identity_data = _get_identity_data_or_exit(credential_name, config);
  
  console.log(`Refreshing group join-code credential=${credential_name} group_id=${group_id}`);
  
  const result = await _authenticated_group_call(credential_name, 'refresh_join_code', { group_id });
  
  _persist_group_snapshot({
    credential_name,
    identity_data,
    group_payload: result,
    my_role: 'owner',
    membership_status: 'active',
  });
  
  console.error('Join-code refreshed successfully:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Get the active join-code.
 *
 * @param {object} options - Options
 * @param {string} options.group_id - Group ID
 * @param {string} options.credential_name - Credential name
 */
async function get_join_code({ group_id, credential_name }) {
  const config = new SDKConfig();
  const identity_data = _get_identity_data_or_exit(credential_name, config);
  
  console.log(`Fetching group join-code credential=${credential_name} group_id=${group_id}`);
  
  const result = await _authenticated_group_call(credential_name, 'get_join_code', { group_id });
  
  _persist_group_snapshot({
    credential_name,
    identity_data,
    group_payload: result,
    my_role: 'owner',
    membership_status: 'active',
  });
  
  console.error('Current join-code:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Enable or disable group joining.
 *
 * @param {object} options - Options
 * @param {string} options.group_id - Group ID
 * @param {boolean} options.join_enabled - Join enabled
 * @param {string} options.credential_name - Credential name
 */
async function set_join_enabled({ group_id, join_enabled, credential_name }) {
  const config = new SDKConfig();
  const identity_data = _get_identity_data_or_exit(credential_name, config);
  
  console.log(`Updating group join switch credential=${credential_name} group_id=${group_id} join_enabled=${join_enabled}`);
  
  const result = await _authenticated_group_call(credential_name, 'set_join_enabled', {
    group_id,
    join_enabled,
  });
  
  _persist_group_snapshot({
    credential_name,
    identity_data,
    group_payload: result,
    my_role: 'owner',
    membership_status: 'active',
  });
  
  console.error('Join switch updated successfully:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Join a group with the only supported global 6-digit join-code.
 *
 * @param {object} options - Options
 * @param {string} options.join_code - Join code
 * @param {string} options.credential_name - Credential name
 */
async function join_group({ join_code, credential_name }) {
  const config = new SDKConfig();
  const identity_data = _get_identity_data_or_exit(credential_name, config);
  
  console.log(`Joining group credential=${credential_name}`);
  
  const result = await _authenticated_group_call(credential_name, 'join', {
    passcode: join_code,
  });
  
  const detail = await _authenticated_group_call(credential_name, 'get', {
    group_id: result.group_id,
  });
  
  if (!detail.group_id) {
    detail.group_id = result.group_id;
  }
  if (!detail.message_prompt) {
    detail.message_prompt = result.message_prompt;
  }
  
  _persist_group_snapshot({
    credential_name,
    identity_data,
    group_payload: detail,
    my_role: 'member',
    membership_status: String(result.status || 'active'),
  });
  
  console.error('Joined group successfully:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Leave a group.
 *
 * @param {object} options - Options
 * @param {string} options.group_id - Group ID
 * @param {string} options.credential_name - Credential name
 */
async function leave_group({ group_id, credential_name }) {
  const config = new SDKConfig();
  const identity_data = _get_identity_data_or_exit(credential_name, config);
  
  console.log(`Leaving group credential=${credential_name} group_id=${group_id}`);
  
  const result = await _authenticated_group_call(credential_name, 'leave', { group_id });
  
  const conn = local_store.get_connection();
  try {
    local_store.ensure_schema(conn);
    local_store.upsert_group(conn, {
      owner_did: String(identity_data.did || ''),
      group_id,
      membership_status: 'left',
      credential_name,
    });
    local_store.delete_group_members(conn, {
      owner_did: String(identity_data.did || ''),
      group_id,
    });
  } finally {
    conn.close();
  }
  
  console.error('Left group successfully:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Kick a member from a group.
 *
 * @param {object} options - Options
 * @param {string} options.group_id - Group ID
 * @param {string|null} [options.target_did] - Target DID
 * @param {string|null} [options.target_user_id] - Target user ID
 * @param {string} options.credential_name - Credential name
 */
async function kick_member({ group_id, target_did = null, target_user_id = null, credential_name }) {
  const config = new SDKConfig();
  const identity_data = _get_identity_data_or_exit(credential_name, config);
  
  console.log(`Kicking group member credential=${credential_name} group_id=${group_id}`);
  
  const params = { group_id };
  if (target_did !== null) params.target_did = target_did;
  if (target_user_id !== null) params.target_user_id = target_user_id;
  
  const result = await _authenticated_group_call(credential_name, 'kick_member', params);
  
  const conn = local_store.get_connection();
  try {
    local_store.ensure_schema(conn);
    local_store.delete_group_members(conn, {
      owner_did: String(identity_data.did || ''),
      group_id,
      target_did,
      target_user_id,
    });
  } finally {
    conn.close();
  }
  
  console.error('Member removed successfully:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * View group members.
 *
 * @param {object} options - Options
 * @param {string} options.group_id - Group ID
 * @param {string} options.credential_name - Credential name
 */
async function get_group_members({ group_id, credential_name }) {
  const config = new SDKConfig();
  const identity_data = _get_identity_data_or_exit(credential_name, config);
  
  console.log(`Fetching group members credential=${credential_name} group_id=${group_id}`);
  
  const result = await _authenticated_group_call(credential_name, 'list_members', { group_id });
  
  _persist_group_member_snapshot({
    credential_name,
    identity_data,
    group_id,
    members: result.members || [],
  });
  
  console.error('Group members:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Post a group message.
 *
 * @param {object} options - Options
 * @param {string} options.group_id - Group ID
 * @param {string} options.content - Message content
 * @param {string|null} [options.client_msg_id] - Client message ID
 * @param {string} options.credential_name - Credential name
 */
async function post_message({ group_id, content, client_msg_id = null, credential_name }) {
  const config = new SDKConfig();
  const identity_data = _get_identity_data_or_exit(credential_name, config);
  
  console.log(`Posting group message credential=${credential_name} group_id=${group_id}`);
  
  const params = { group_id, content };
  if (client_msg_id !== null) params.client_msg_id = client_msg_id;
  
  const result = await _authenticated_group_call(credential_name, 'post_message', params);
  
  _persist_outgoing_group_message({
    credential_name,
    identity_data,
    group_id,
    content,
    client_msg_id,
    payload: result,
  });
  
  console.error('Group message posted successfully:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * List group messages.
 *
 * @param {object} options - Options
 * @param {string} options.group_id - Group ID
 * @param {number|null} [options.since_seq] - Since sequence
 * @param {number} options.limit - Message limit
 * @param {string} options.credential_name - Credential name
 */
async function list_messages({ group_id, since_seq = null, limit, credential_name }) {
  const config = new SDKConfig();
  const identity_data = _get_identity_data_or_exit(credential_name, config);
  
  console.log(`Listing group messages credential=${credential_name} group_id=${group_id} since_seq=${since_seq} limit=${limit}`);
  
  const params = { group_id, limit };
  if (since_seq !== null) params.since_seq = since_seq;
  
  const result = await _authenticated_group_call(credential_name, 'list_messages', params);
  
  _persist_group_messages({
    credential_name,
    identity_data,
    group_id,
    payload: result,
  });
  
  console.error('Group messages:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Fetch a public group markdown document.
 *
 * @param {object} options - Options
 * @param {string} options.doc_url - Document URL
 */
async function fetch_doc({ doc_url }) {
  console.log(`Fetching group markdown doc_url=${doc_url}`);
  
  const config = new SDKConfig();
  const client = create_user_service_client(config);
  
  let public_fetch_error = null;
  let response = null;
  
  try {
    response = await client.get(doc_url);
  } catch (exc) {
    public_fetch_error = exc;
    console.log(`Public group markdown fetch failed, trying X-Handle fallback: ${exc.message}`);
  }
  
  if (response !== null && response.status_code === 200) {
    const text = await response.text();
    console.log(text);
    return;
  }
  
  const parsed = new URL(doc_url);
  const hostname = (parsed.hostname || '').trim();
  const path = parsed.pathname || '';
  const handle = hostname.includes('.') ? hostname.split('.')[0].trim() : '';
  
  if (handle && path) {
    const fallback_response = await client.get(path, {
      headers: { 'X-Handle': handle },
    });
    if (fallback_response.status_code === 200) {
      const text = await fallback_response.text();
      console.log(text);
      return;
    }
    if (fallback_response.status_code >= 400) {
      throw new Error(`HTTP ${fallback_response.status_code}`);
    }
  }
  
  if (response !== null && response.status_code >= 400) {
    throw new Error(`HTTP ${response.status_code}`);
  }
  if (public_fetch_error !== null) {
    throw public_fetch_error;
  }
}

module.exports = {
  create_group,
  get_group,
  update_group,
  refresh_join_code,
  get_join_code,
  set_join_enabled,
  join_group,
  leave_group,
  kick_member,
  get_group_members,
  post_message,
  list_messages,
  fetch_doc,
  _persist_group_snapshot,
  _persist_group_member_snapshot,
  _persist_group_messages,
  _persist_outgoing_group_message,
  _parse_bool,
  _get_authenticator_or_exit,
  _authenticated_group_call,
  _get_identity_data_or_exit,
};
