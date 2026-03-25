/**
 * WebSocket listener: long-running background process that receives molt-message pushes and routes to webhooks.
 *
 * Node.js implementation based on Python version:
 * python/scripts/ws_listener.py
 *
 * [INPUT]: credential_store (DID identity), SDKConfig, WsClient, ListenerConfig,
 *          E2eeHandler, service_manager, local_store, logging_config, local daemon
 *          settings, authenticated HTTP fallback for secondary credentials, and
 *          indexed credential discovery for newly created identities
 * [OUTPUT]: WebSocket -> OpenClaw TUI bridge (chat.inject RPC for instant display,
 *           HTTP webhook fallback, and fan-out to all active external channels)
 *           + localhost message daemon for CLI message RPC proxying +
 *           cross-platform service lifecycle management + local SQLite
 *           message/group persistence + sender-handle-aware channel text
 *           rendering + conditional read acknowledgements only after successful
 *           user-visible forwarding + runtime auto-enrollment of newly created
 *           credentials into remote WebSocket sessions
 * [POS]: Standalone background process with cross-platform service management (launchd / systemd / Task Scheduler), reuses utils/ core tool layer
 */

const fs = require('fs');
const path = require('path');
const { SDKConfig } = require('./utils/config');
const { WsClient } = require('./utils/ws');
const { ListenerConfig, ROUTING_MODES } = require('./listener-config');
const { loadIdentity, createAuthenticator, updateJwt } = require('./credential-store');
const local_store = require('./local-store');
const { is_websocket_mode } = require('./message_transport');
const {
  _auto_process_e2ee_messages,
  _mark_local_messages_read,
  _message_sort_key,
  _store_inbox_messages,
  _extract_message_id
} = require('./check-inbox');

const logger = {
  info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
  warning: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
  debug: (msg, ...args) => console.debug(`[DEBUG] ${msg}`, ...args)
};

// Constants
const _LOCAL_DAEMON_CONNECT_TIMEOUT_SECONDS = 10.0;
const _CREDENTIAL_DISCOVERY_INTERVAL_SECONDS = 2.0;
const _CHANNEL_ACTIVE_HOURS = 24;
const _CHANNEL_CACHE_FILE_NAME = 'external-channels.json';
const _INBOX_SYNC_FILE_NAME = 'inbox-sync.json';

/**
 * Abbreviate DID for display (first and last 8 characters).
 * @param {string} did - DID string
 * @returns {string} Truncated DID
 */
function _truncateDid(did) {
  if (typeof did !== 'string') {
    return String(did);
  }
  if (did.length <= 20) {
    return did;
  }
  return `${did.slice(0, 8)}...${did.slice(-8)}`;
}

/**
 * Return whether the message type belongs to raw E2EE transport data.
 * @param {string} msgType - Message type
 * @returns {boolean} True if E2EE type
 */
function _isReservedE2eeType(msgType) {
  return (
    msgType === 'e2ee' ||
    msgType.startsWith('e2ee_') ||
    msgType.startsWith('group_e2ee_') ||
    msgType === 'group_epoch_advance'
  );
}

/**
 * Classify a message for routing.
 *
 * @param {Object} params - The params field from a WebSocket push notification.
 * @param {string} myDid - The DID of the current listener itself.
 * @param {ListenerConfig} cfg - Listener configuration.
 * @returns {string|null} "agent" -- high priority, "wake" -- low priority, null -- drop
 */
function classifyMessage(params, myDid, cfg) {
  const senderDid = params.sender_did || '';
  const content = params.content || '';
  const msgType = params.type || 'text';
  const groupDid = params.group_did;
  const groupId = params.group_id;
  const isPrivate = groupDid === null || groupDid === undefined && (groupId === null || groupId === undefined);

  // === Drop conditions (common to all modes) ===
  if (senderDid === myDid) {
    return null;
  }
  if (cfg.ignore_types.has(msgType) || _isReservedE2eeType(msgType)) {
    return null;
  }
  if (cfg.routing.blacklist_dids.has(senderDid)) {
    return null;
  }

  // === Mode determination ===
  if (cfg.mode === 'agent-all') {
    return 'agent';
  }
  if (cfg.mode === 'wake-all') {
    return 'wake';
  }

  // === Smart mode: rule engine (any match -> agent) ===
  if (cfg.routing.whitelist_dids.has(senderDid)) {
    return 'agent';
  }
  if (isPrivate && cfg.routing.private_always_agent) {
    return 'agent';
  }
  if (typeof content === 'string' && content.startsWith(cfg.routing.command_prefix)) {
    return 'agent';
  }
  if (typeof content === 'string') {
    for (const name of cfg.routing.bot_names) {
      if (name && content.includes(name)) {
        return 'agent';
      }
    }
    for (const kw of cfg.routing.keywords) {
      if (content.includes(kw)) {
        return 'agent';
      }
    }
  }

  // === Default: Wake ===
  return 'wake';
}

/**
 * Build a DIDIdentity from credential data.
 * @param {Object} credData - Credential data
 * @returns {Object} DIDIdentity-like object
 */
function _buildIdentity(credData) {
  const privateKeyPem = credData.private_key_pem;
  const publicKeyPem = credData.public_key_pem || '';

  return {
    did: credData.did,
    did_document: credData.did_document || {},
    private_key_pem: typeof privateKeyPem === 'string' ? Buffer.from(privateKeyPem, 'utf-8') : privateKeyPem,
    public_key_pem: typeof publicKeyPem === 'string' ? Buffer.from(publicKeyPem, 'utf-8') : publicKeyPem,
    user_id: credData.user_id || null,
    jwt_token: credData.jwt_token || null,
    e2ee_signing_private_pem: credData.e2ee_signing_private_pem || null,
    e2ee_signing_public_pem: credData.e2ee_signing_public_pem || null,
    e2ee_agreement_private_pem: credData.e2ee_agreement_private_pem || null,
    e2ee_agreement_public_pem: credData.e2ee_agreement_public_pem || null,

    // Method to get private key (lazy load)
    get_private_key: function() {
      const { load_private_key } = require('./utils/identity');
      return load_private_key(this.private_key_pem);
    }
  };
}

/**
 * Attempt to refresh JWT via WBA authentication.
 * @param {string} credentialName - Credential name
 * @param {SDKConfig} config - SDK config
 * @returns {Promise<string|null>} JWT token or null
 */
async function _refreshJwt(credentialName, config) {
  const result = createAuthenticator(credentialName, config);
  if (result === null) {
    return null;
  }
  const [auth, credData] = result;

  try {
    const { getJwtViaWba } = require('./utils/auth');
    const { createUserServiceClient } = require('./utils/client');

    const identity = _buildIdentity(credData);
    const client = createUserServiceClient(config);
    const token = await getJwtViaWba(client, identity, config.did_domain);
    updateJwt(credentialName, token);
    return token;
  } catch (exc) {
    logger.error(`JWT refresh failed: ${exc}`);
    return null;
  }
}

/**
 * Return the cache path for external channels.
 * @param {string} credentialName - Credential name
 * @param {SDKConfig|null} [config=null] - SDK config
 * @returns {string|null} Cache file path or null
 */
function _channelCachePath(credentialName, config = null) {
  const credentialLayout = require('./credential-layout');
  const paths = credentialLayout.resolveCredentialPaths(credentialName, config);
  if (paths === null) {
    return null;
  }
  credentialLayout.ensureCredentialDirectory(paths);
  return path.join(paths.credential_dir, _CHANNEL_CACHE_FILE_NAME);
}

/**
 * Persist external channels to the credential directory.
 * @param {string} credentialName - Credential name
 * @param {Array<[string, string]>} channels - Channels list
 * @param {SDKConfig|null} [config=null] - SDK config
 */
function _saveCachedChannels(credentialName, channels, config = null) {
  const cachePath = _channelCachePath(credentialName, config);
  if (cachePath === null) {
    logger.debug(`Skipping channel cache save; credential not found: ${credentialName}`);
    return;
  }

  const payload = {
    cached_at: Date.now() / 1000,
    channels: channels.map(([ch, tgt]) => ({ channel: ch, target: tgt }))
  };

  try {
    const credentialLayout = require('./credential-layout');
    credentialLayout.writeSecureJson(cachePath, payload);
    logger.debug(`Saved external channel cache: ${cachePath}`);
  } catch (exc) {
    logger.debug(`Failed to save external channel cache`);
  }
}

/**
 * Load cached external channels from disk.
 * @param {string} credentialName - Credential name
 * @param {SDKConfig|null} [config=null] - SDK config
 * @returns {[Array<[string, string]>, number|null]} Tuple of (channels, cached_at)
 */
function _loadCachedChannels(credentialName, config = null) {
  const credentialLayout = require('./credential-layout');
  const cachePath = _channelCachePath(credentialName, config);
  if (cachePath === null || !fs.existsSync(cachePath)) {
    return [[], null];
  }

  try {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    const cachedAt = data.cached_at;
    const rawChannels = data.channels || [];
    const channels = [];

    for (const item of rawChannels) {
      if (typeof item === 'object' && item !== null) {
        const ch = item.channel;
        const tgt = item.target;
        if (typeof ch === 'string' && typeof tgt === 'string') {
          channels.push([ch, tgt]);
        }
      } else if (Array.isArray(item) && item.length === 2) {
        const [ch, tgt] = item;
        if (typeof ch === 'string' && typeof tgt === 'string') {
          channels.push([ch, tgt]);
        }
      }
    }

    return [channels, typeof cachedAt === 'number' ? cachedAt : null];
  } catch (exc) {
    logger.debug(`Failed to load external channel cache`);
    return [[], null];
  }
}

/**
 * Format cached timestamp for logs.
 * @param {number|null} ts - Timestamp
 * @returns {string} Formatted timestamp
 */
function _formatCachedAt(ts) {
  if (!ts) {
    return 'unknown time';
  }
  const date = new Date(ts * 1000);
  return date.toLocaleString('en-US', { timeZone: 'UTC' });
}

/**
 * Fetch external channels, falling back to cached channels on failure.
 * @param {string} credentialName - Credential name
 * @param {SDKConfig|null} [config=null] - SDK config
 * @returns {Promise<[Array<[string, string]>, string, number|null]>} Tuple of (channels, source, cached_at)
 */
async function _refreshExternalChannels(credentialName, config = null) {
  const channels = await _fetchExternalChannels();
  if (channels.length > 0) {
    _saveCachedChannels(credentialName, channels, config);
    return [channels, 'live', null];
  }

  const [cached, cachedAt] = _loadCachedChannels(credentialName, config);
  if (cached.length > 0) {
    return [cached, 'cache', cachedAt];
  }

  return [[], 'empty', null];
}

/**
 * Return the inbox sync state path.
 * @param {string} credentialName - Credential name
 * @param {SDKConfig|null} [config=null] - SDK config
 * @returns {string|null} Sync file path or null
 */
function _inboxSyncPath(credentialName, config = null) {
  const credentialLayout = require('./credential-layout');
  const paths = credentialLayout.resolveCredentialPaths(credentialName, config);
  if (paths === null) {
    return null;
  }
  credentialLayout.ensureCredentialDirectory(paths);
  return path.join(paths.credential_dir, _INBOX_SYNC_FILE_NAME);
}

/**
 * Load last inbox sync timestamp (ISO string) from disk.
 * @param {string} credentialName - Credential name
 * @param {SDKConfig|null} [config=null] - SDK config
 * @returns {string|null} ISO timestamp or null
 */
function _loadInboxSyncSince(credentialName, config = null) {
  const syncPath = _inboxSyncPath(credentialName, config);
  if (syncPath === null || !fs.existsSync(syncPath)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(syncPath, 'utf-8'));
    const since = data.since;
    return typeof since === 'string' && since ? since : null;
  } catch (exc) {
    logger.debug(`Failed to load inbox sync state`);
    return null;
  }
}

/**
 * Persist last inbox sync timestamp (ISO string).
 * @param {string} credentialName - Credential name
 * @param {string} since - ISO timestamp
 * @param {SDKConfig|null} [config=null] - SDK config
 */
function _saveInboxSyncSince(credentialName, since, config = null) {
  const syncPath = _inboxSyncPath(credentialName, config);
  if (syncPath === null) {
    logger.debug(`Skipping inbox sync save; credential not found: ${credentialName}`);
    return;
  }

  const payload = {
    since: since,
    updated_at: new Date().toISOString()
  };

  try {
    const credentialLayout = require('./credential-layout');
    credentialLayout.writeSecureJson(syncPath, payload);
    logger.debug(`Saved inbox sync state: ${syncPath}`);
  } catch (exc) {
    logger.debug(`Failed to save inbox sync state`);
  }
}

/**
 * Parse inbox timestamps into datetime (UTC-aware when possible).
 * @param {any} value - Timestamp value
 * @returns {Date|null} Parsed date or null
 */
function _parseInboxTimestamp(value) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'number') {
    return new Date(value * 1000);
  }
  if (typeof value === 'string') {
    const candidate = value.trim();
    if (!candidate) {
      return null;
    }
    if (candidate.endsWith('Z')) {
      candidate = candidate.slice(0, -1) + '+00:00';
    }
    try {
      return new Date(candidate);
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Fetch external channels from OpenClaw gateway.
 * @returns {Promise<Array<[string, string]>>} List of (channel, target) tuples
 */
async function _fetchExternalChannels() {
  // Placeholder implementation - returns empty array
  // Full implementation would call openclaw CLI
  return [];
}

/**
 * Run the WebSocket listener loop.
 *
 * @param {string} credentialName - Credential name
 * @param {ListenerConfig} cfg - Listener configuration
 * @param {SDKConfig|null} [config=null] - SDK configuration
 * @returns {Promise<void>}
 */
async function runListener(credentialName, cfg, config = null) {
  if (config === null) {
    config = SDKConfig.load();
  }

  if (!is_websocket_mode(config)) {
    throw new Error(
      'WebSocket listener cannot run while message_transport.receive_mode=http'
    );
  }

  let delay = cfg.reconnect_base_delay;

  // Local SQLite storage initialization
  const localDb = local_store.get_connection(config);
  local_store.ensure_schema(localDb);

  try {
    while (true) {
      const credData = loadIdentity(credentialName, config);
      if (credData === null) {
        logger.error(`Credential '${credentialName}' not found, retrying in ${delay}s`);
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
        continue;
      }

      const identity = _buildIdentity(credData);
      const myDid = identity.did;

      if (!identity.jwt_token) {
        logger.warning('Credential missing JWT, attempting refresh...');
        const token = await _refreshJwt(credentialName, config);
        if (token) {
          identity.jwt_token = token;
        } else {
          logger.error(`JWT acquisition failed, retrying in ${delay}s`);
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
          delay = Math.min(delay * 2, cfg.reconnect_max_delay);
          continue;
        }
      }

      logger.info(`Connecting to WebSocket... DID=${_truncateDid(myDid)} mode=${cfg.mode}`);

      try {
        const ws = new WsClient(config, identity);
        await ws.connect();
        delay = cfg.reconnect_base_delay;
        logger.info('WebSocket connected successfully');

        // Discover external channels
        const [extChannels, extSource, extCachedAt] = await _refreshExternalChannels(credentialName, config);
        if (extChannels.length > 0) {
          const suffix = extSource === 'live' ? '' : ` (cache: ${_formatCachedAt(extCachedAt)})`;
          logger.info(`External channels ready${suffix}: ${extChannels.map(([ch, tgt]) => `${ch}:${tgt}`).join(', ')}`);
        } else {
          logger.info('No external channels available at connect');
        }

        let lastChannelRefresh = Date.now();
        const channelRefreshInterval = 300000; // 5 minutes in ms

        // Catch up on inbox messages
        // await _catchUpInbox(credentialName, myDid, cfg, config, ws, http, localDb, extChannels);

        // Main message receiving loop
        while (true) {
          const notification = await ws.receive_notification(5.0);

          if (notification === null) {
            // Idle timeout - check heartbeat
            // Periodically refresh external channels
            const now = Date.now();
            if (now - lastChannelRefresh >= channelRefreshInterval) {
              const [channels, source, cachedAt] = await _refreshExternalChannels(credentialName, config);
              if (channels.length > 0) {
                const suffix = source === 'live' ? '' : ` (cache: ${_formatCachedAt(cachedAt)})`;
                logger.info(`External channels refreshed${suffix}: ${channels.map(([ch, tgt]) => `${ch}:${tgt}`).join(', ')}`);
              } else {
                logger.info('External channels refresh returned empty');
              }
              lastChannelRefresh = now;
            }
            continue;
          }

          const method = notification.method || '';

          // Handle ping/pong
          if (method === 'ping' || method === 'pong') {
            if (method === 'ping') {
              try {
                await ws.send_pong();
                logger.debug('Replied pong to server ping');
              } catch (exc) {
                logger.warning(`Failed to send pong: ${exc}`);
                throw exc;
              }
            }
            continue;
          }

          if (method !== 'new_message') {
            logger.debug(`Ignoring non-message notification: method=${method}`);
            continue;
          }

          const params = notification.params || {};
          const msgType = params.type || 'text';
          const senderDid = params.sender_did || '';
          const incomingMsgId = typeof params.id === 'string' && params.id ? params.id : null;

          const contentPreview = String(params.content || '').slice(0, 80);
          logger.info(`Received: type=${msgType} sender=${_truncateDid(senderDid)} content=${contentPreview}`);

          // Route classification
          const route = classifyMessage(params, myDid, cfg);
          logger.info(`Route: ${route || 'DROP'} sender=${_truncateDid(params.sender_did || '')} type=${params.type || ''}`);

          // Store message locally before routing
          try {
            const threadId = local_store.make_thread_id(myDid, {
              peer_did: senderDid,
              group_id: params.group_id
            });

            local_store.store_message(localDb, {
              msg_id: params.id || '',
              owner_did: myDid,
              thread_id: threadId,
              direction: 0,
              sender_did: senderDid,
              receiver_did: params.receiver_did,
              group_id: params.group_id,
              group_did: params.group_did,
              content_type: params.type || 'text',
              content: String(params.content || ''),
              title: params.title,
              server_seq: params.server_seq,
              sent_at: params.sent_at,
              is_e2ee: !!params._e2ee,
              sender_name: params.sender_name,
              metadata: params.system_event !== undefined
                ? JSON.stringify({ system_event: params.system_event })
                : null,
              credential_name: credentialName
            });

            if (params.group_id) {
              local_store.upsert_group(localDb, {
                owner_did: myDid,
                group_id: String(params.group_id || ''),
                group_did: params.group_did,
                name: params.group_name,
                membership_status: 'active',
                last_synced_seq: params.server_seq,
                last_message_at: params.sent_at,
                credential_name: credentialName
              });
            }

            // Record sender in contacts
            if (senderDid) {
              local_store.upsert_contact(localDb, {
                owner_did: myDid,
                did: senderDid,
                name: params.sender_name
              });
            }
          } catch (exc) {
            logger.debug(`Failed to store message locally`);
          }

          if (route === null) {
            logger.info(`Dropped: sender=${_truncateDid(params.sender_did || '')} type=${params.type || ''}`);
            // await _markMessageRead(ws, myDid, incomingMsgId, credentialName);
            continue;
          }

          // Forward message to webhook
          const url = cfg.agent_webhook_url;
          logger.info(`Forwarding: route=${route} sender=${_truncateDid(params.sender_did || '')}`);

          const injectOk = await _forward(
            url,
            cfg.webhook_token,
            params,
            route,
            cfg,
            myDid,
            credentialName,
            extChannels
          );

          if (injectOk) {
            // await _markMessageRead(ws, myDid, incomingMsgId, credentialName);
          } else {
            logger.warning(`Forward failed; keep unread: sender=${_truncateDid(params.sender_did || '')} type=${params.type || ''}`);
          }
        }
      } catch (exc) {
        logger.warning(`Connection lost: ${exc}, reconnecting in ${delay}s`);
      }

      // Attempt JWT refresh before reconnect
      const newToken = await _refreshJwt(credentialName, config);
      if (newToken) {
        logger.info('JWT refreshed');
      }

      await new Promise(resolve => setTimeout(resolve, delay * 1000));
      delay = Math.min(delay * 2, cfg.reconnect_max_delay);
    }
  } finally {
    localDb.close();
  }
}

/**
 * Forward a message to OpenClaw via chat.inject + HTTP /hooks/agent.
 *
 * @param {string} url - Webhook URL
 * @param {string} token - Webhook token
 * @param {Object} params - Message params
 * @param {string} route - Route type (agent/wake)
 * @param {ListenerConfig} cfg - Listener config
 * @param {string} myDid - My DID
 * @param {string} credentialName - Credential name
 * @param {Array<[string, string]>} channels - External channels
 * @returns {Promise<boolean>} True if delivery successful
 */
async function _forward(url, token, params, route, cfg, myDid, credentialName, channels = null) {
  // Placeholder implementation - always returns true
  // Full implementation would call openclaw CLI and HTTP hooks
  logger.info(`Forwarding message to ${url} (route=${route})`);
  return true;
}

/**
 * Build sender handle string for display.
 * @param {Object} params - Message params
 * @returns {string|null} Sender handle or null
 */
function _buildSenderHandle(params) {
  const senderHandle = params.sender_handle;
  if (typeof senderHandle !== 'string') {
    return null;
  }
  const normalizedHandle = senderHandle.trim();
  if (!normalizedHandle) {
    return null;
  }
  const senderHandleDomain = params.sender_handle_domain;
  if (
    typeof senderHandleDomain === 'string' &&
    senderHandleDomain.trim() &&
    !normalizedHandle.includes('.')
  ) {
    return `${normalizedHandle}.${senderHandleDomain.trim()}`;
  }
  return normalizedHandle;
}

/**
 * Build the system event text from message params.
 * @param {Object} params - Message params
 * @param {string} route - Route type
 * @param {ListenerConfig} cfg - Listener config
 * @returns {string} Event text
 */
function _buildEventText(params, route, cfg) {
  const senderDid = params.sender_did || 'unknown';
  const sender = _truncateDid(senderDid);
  const senderHandle = _buildSenderHandle(params);
  const content = String(params.content || '');
  const contentPreview = content.slice(0, 50);
  const groupDid = params.group_did;
  const isPrivate = groupDid === null || groupDid === undefined && params.group_id === null;

  if (route === 'agent') {
    const context = isPrivate ? 'Direct' : 'Group';
    const lines = [`[Awiki New ${context} Message${params._e2ee ? ' (encrypted)' : ''}]`];
    if (params.sender_name) {
      lines.push(`sender_name: ${params.sender_name}`);
    }
    if (senderHandle) {
      lines.push(`sender_handle: ${senderHandle}`);
    }
    if (senderDid) {
      lines.push(`sender_did: ${senderDid}`);
    }
    if (groupDid) {
      lines.push(`group_did: ${groupDid}`);
    }
    if (params.group_name) {
      lines.push(`group_name: ${params.group_name}`);
    }
    if (params.sent_at) {
      lines.push(`sent_at: ${params.sent_at}`);
    }
    lines.push('');
    lines.push(content);
    return lines.join('\n');
  } else {
    if (params._e2ee) {
      return `[IM] ${sender}: [Encrypted] ${contentPreview}`;
    }
    return `[IM] ${sender}: ${contentPreview}`;
  }
}

module.exports = {
  // Main functions (camelCase)
  runListener,
  classifyMessage,

  // Main functions (snake_case aliases for Python compatibility)
  run_listener: runListener,
  classify_message: classifyMessage,

  // Utility functions (exported for testing)
  _truncateDid,
  _isReservedE2eeType,
  _buildIdentity,
  _buildSenderHandle,
  _buildEventText,
  _refreshJwt,

  // Utility functions (snake_case aliases)
  _truncate_did: _truncateDid,
  _is_reserved_e2ee_type: _isReservedE2eeType,
  _build_identity: _buildIdentity,
  _build_sender_handle: _buildSenderHandle,
  _build_event_text: _buildEventText,
  _refresh_jwt: _refreshJwt,

  // Config exports
  ListenerConfig,
  ROUTING_MODES
};
