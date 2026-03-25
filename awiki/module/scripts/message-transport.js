/**
 * Message transport selection and RPC helpers.
 *
 * Node.js implementation based on Python version:
 * python/scripts/message_transport.py
 *
 * [INPUT]: settings.json, credential_store, SDKConfig, HTTP RPC helpers,
 *          local daemon, listener recovery helpers
 * [OUTPUT]: receive-mode helpers plus credential-aware message RPC call helpers
 *           over HTTP or the local WebSocket-mode daemon with automatic HTTP
 *           fallback for WebSocket transport failures
 * [POS]: Shared transport abstraction for message-domain scripts, centralizing whether
 *        message RPC traffic should use direct HTTP JSON-RPC or the localhost daemon
 *        that owns the single remote WebSocket connection.
 */

const fs = require('fs');
const path = require('path');
const { SDKConfig } = require('./utils/config');
const { create_authenticator } = require('./credential-store');
const { create_molt_message_client } = require('./utils/client');
const { authenticated_rpc_call } = require('./utils/rpc');
const { call_local_daemon, load_local_daemon_settings } = require('./message-daemon');
const { note_listener_healthy, ensure_listener_runtime } = require('./listener_recovery');

// 常量定义
const MESSAGE_RPC = '/message/rpc';
const RECEIVE_MODE_HTTP = 'http';
const RECEIVE_MODE_WEBSOCKET = 'websocket';
const VALID_RECEIVE_MODES = new Set([RECEIVE_MODE_HTTP, RECEIVE_MODE_WEBSOCKET]);

// WebSocket 降级错误标记
const WEBSOCKET_FALLBACK_ERROR_MARKERS = [
  'Local message daemon token is missing',
  'Local message daemon request timed out',
  'Local message daemon is unavailable',
  'Remote WebSocket transport is not connected',
  'WebSocket not connected',
  'WebSocket reader failed',
  'WebSocket reader stopped',
  'WebSocket closed'
];

/**
 * Get the settings.json path
 * @param {SDKConfig} config - SDK configuration
 * @returns {string} Path to settings.json
 */
function getSettingsPath(config) {
  const resolved = config || SDKConfig.load();
  return path.join(resolved.data_dir, 'config', 'settings.json');
}

/**
 * Load the configured message receive mode.
 * Defaults to HTTP mode when no explicit config is present to keep the
 * non-realtime CLI flow available in fresh environments.
 *
 * @param {SDKConfig} [config] - SDK configuration (optional)
 * @returns {string} Receive mode ('http' or 'websocket')
 */
function load_receive_mode(config) {
  const resolved = config || SDKConfig.load();
  const settingsPath = getSettingsPath(resolved);

  if (!fs.existsSync(settingsPath)) {
    return RECEIVE_MODE_HTTP;
  }

  try {
    const data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    const mode = (
      data.message_transport?.receive_mode ||
      data.receive_mode ||
      RECEIVE_MODE_HTTP
    );

    if (!VALID_RECEIVE_MODES.has(mode)) {
      return RECEIVE_MODE_HTTP;
    }

    return mode;
  } catch (error) {
    return RECEIVE_MODE_HTTP;
  }
}

/**
 * Check if WebSocket mode is enabled
 *
 * @param {SDKConfig} [config] - SDK configuration (optional)
 * @returns {boolean} True if WebSocket mode is enabled
 */
function is_websocket_mode(config) {
  return load_receive_mode(config) === RECEIVE_MODE_WEBSOCKET;
}

/**
 * Call one message RPC method over HTTP JSON-RPC.
 *
 * @param {string} method - Method name
 * @param {Object} [params] - Method parameters
 * @param {Object} options - Options
 * @param {string} [options.credentialName='default'] - Credential name
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {Promise<Object>} RPC result
 */
async function http_message_rpc_call(method, params = null, { credentialName = 'default', config = null } = {}) {
  const resolved = config || SDKConfig.load();
  const authResult = create_authenticator(credentialName, resolved);
  if (authResult === null) {
    throw new Error(
      `Credential '${credentialName}' unavailable; please create an identity first`
    );
  }
  const [auth, _] = authResult;
  const client = await create_molt_message_client(resolved).__aenter__();
  try {
    return await authenticated_rpc_call(
      client,
      MESSAGE_RPC,
      method,
      params,
      1,
      { auth, credentialName }
    );
  } finally {
    await client.__aexit__(null, null, null);
  }
}

/**
 * Call one message RPC method via the local WebSocket-mode daemon.
 *
 * @param {string} method - Method name
 * @param {Object} [params] - Method parameters
 * @param {Object} options - Options
 * @param {string} [options.credentialName='default'] - Credential name
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {Promise<Object>} RPC result
 */
async function websocket_message_rpc_call(method, params = null, { credentialName = 'default', config = null } = {}) {
  const resolved = config || SDKConfig.load();
  return await call_local_daemon(
    method,
    params,
    { credential_name: credentialName, config: resolved }
  );
}

/**
 * Return whether one WebSocket RPC failure should fall back to HTTP.
 *
 * @param {Error} exc - Error exception
 * @returns {boolean} True if should fallback to HTTP
 */
function _should_fallback_to_http(exc) {
  const message = exc.message || '';
  if (!message) {
    return false;
  }
  if (message.startsWith('JSON-RPC error')) {
    return false;
  }
  return WEBSOCKET_FALLBACK_ERROR_MARKERS.some(marker => message.includes(marker));
}

/**
 * Call one message RPC method using the configured transport mode.
 *
 * @param {string} method - Method name
 * @param {Object} [params] - Method parameters
 * @param {Object} options - Options
 * @param {string} [options.credentialName='default'] - Credential name
 * @param {SDKConfig} [config] - SDK configuration
 * @param {string} [forceMode] - Force transport mode
 * @returns {Promise<Object>} RPC result
 */
async function message_rpc_call(method, params = null, { credentialName = 'default', config = null, forceMode = null } = {}) {
  const resolved = config || SDKConfig.load();
  const mode = forceMode || load_receive_mode(resolved);

  if (mode === RECEIVE_MODE_WEBSOCKET) {
    try {
      const result = await websocket_message_rpc_call(
        method,
        params,
        { credentialName, config: resolved }
      );
      note_listener_healthy(credentialName, { config: resolved });
      return result;
    } catch (exc) {
      if (!_should_fallback_to_http(exc)) {
        throw exc;
      }
      console.warn(
        `WebSocket message RPC unavailable, falling back to HTTP ` +
        `credential=${credentialName} method=${method} error=${exc.message}`
      );
      try {
        ensure_listener_runtime(credentialName, { config: resolved });
      } catch (error) {
        // Failed to run listener recovery after WebSocket RPC error
      }
      return await http_message_rpc_call(
        method,
        params,
        { credentialName, config: resolved }
      );
    }
  }

  return await http_message_rpc_call(
    method,
    params,
    { credentialName, config: resolved }
  );
}

/**
 * Persist one receive mode into settings.json.
 *
 * @param {string} mode - Receive mode ('http' or 'websocket')
 * @param {Object} options - Options
 * @param {SDKConfig} [config] - SDK configuration
 * @param {Object} [extraTransportFields] - Extra transport fields to merge
 * @returns {string} Path to settings.json
 */
function write_receive_mode(mode, { config = null, extraTransportFields = null } = {}) {
  if (!VALID_RECEIVE_MODES.has(mode)) {
    throw new Error(`Unsupported receive mode: ${mode}`);
  }

  const resolved = config || SDKConfig.load();
  const settingsPath = getSettingsPath(resolved);

  // Ensure directory exists
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Load existing settings or create new
  let data = {};
  if (fs.existsSync(settingsPath)) {
    try {
      data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch (error) {
      data = {};
    }
  }

  // Update transport settings
  let transport = data.message_transport || {};
  transport.receive_mode = mode;
  if (extraTransportFields) {
    Object.assign(transport, extraTransportFields);
  }
  data.message_transport = transport;

  // Write settings
  fs.writeFileSync(
    settingsPath,
    JSON.stringify(data, null, 2) + '\n',
    'utf-8'
  );

  return settingsPath;
}

module.exports = {
  MESSAGE_RPC,
  RECEIVE_MODE_HTTP,
  RECEIVE_MODE_WEBSOCKET,
  VALID_RECEIVE_MODES,
  WEBSOCKET_FALLBACK_ERROR_MARKERS,
  load_receive_mode,
  is_websocket_mode,
  http_message_rpc_call,
  websocket_message_rpc_call,
  message_rpc_call,
  write_receive_mode,
  load_local_daemon_settings,
  getSettingsPath,
  _should_fallback_to_http
};
