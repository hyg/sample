/**
 * Message transport selection and RPC helpers.
 *
 * Node.js implementation based on Python version:
 * python/scripts/message_transport.py
 *
 * [INPUT]: settings.json, credential_store, SDKConfig, HTTP RPC helpers
 * [OUTPUT]: receive-mode helpers plus credential-aware message RPC call helpers
 * [POS]: Shared transport abstraction for message-domain scripts
 */

const fs = require('fs');
const path = require('path');
const { SDKConfig } = require('./utils/config');
const { create_authenticator } = require('./credential-store');
const { create_molt_message_client } = require('./utils/client');
const { authenticated_rpc_call } = require('./utils/rpc');

const MESSAGE_RPC = '/message/rpc';
const RECEIVE_MODE_HTTP = 'http';
const RECEIVE_MODE_WEBSOCKET = 'websocket';
const VALID_RECEIVE_MODES = new Set([RECEIVE_MODE_HTTP, RECEIVE_MODE_WEBSOCKET]);

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
 * Defaults to HTTP mode when no explicit config is present.
 * 
 * @param {SDKConfig} config - SDK configuration (optional)
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
    const mode = data.receive_mode || data.message_transport?.receive_mode || RECEIVE_MODE_HTTP;
    
    if (!VALID_RECEIVE_MODES.has(mode)) {
      return RECEIVE_MODE_HTTP;
    }
    
    return mode;
  } catch (error) {
    return RECEIVE_MODE_HTTP;
  }
}

/**
 * Write message transport mode to settings.json
 * 
 * @param {string} mode - Receive mode ('http' or 'websocket')
 * @param {SDKConfig} config - SDK configuration (optional)
 */
function write_receive_mode(mode, config) {
  if (!VALID_RECEIVE_MODES.has(mode)) {
    throw new Error(`Invalid receive mode: ${mode}. Must be one of: ${Array.from(VALID_RECEIVE_MODES).join(', ')}`);
  }
  
  const resolved = config || SDKConfig.load();
  const settingsPath = getSettingsPath(resolved);
  
  // Load existing settings or create new
  let data = {};
  if (fs.existsSync(settingsPath)) {
    try {
      data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch (error) {
      data = {};
    }
  }
  
  // Update receive mode
  data.receive_mode = mode;
  
  // Ensure directory exists
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Write settings
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
}

/**
 * Check if WebSocket mode is enabled
 *
 * @param {SDKConfig} config - SDK configuration (optional)
 * @returns {boolean} True if WebSocket mode is enabled
 */
function is_websocket_mode(config) {
  return load_receive_mode(config) === RECEIVE_MODE_WEBSOCKET;
}

/**
 * Call one message RPC method over HTTP JSON-RPC.
 * @param {string} method - Method name
 * @param {Object} [params] - Method parameters
 * @param {string} [credentialName='default'] - Credential name
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {Promise<Object>} RPC result
 */
async function http_message_rpc_call(method, params = null, { credentialName = 'default', config = null } = {}) {
  const resolved = config || new SDKConfig();
  const authResult = create_authenticator(credentialName, resolved);
  if (authResult === null) {
    throw new Error(`Credential '${credentialName}' unavailable; please create an identity first`);
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
 * Call one message RPC method using the configured transport mode.
 * @param {string} method - Method name
 * @param {Object} [params] - Method parameters
 * @param {string} [credentialName='default'] - Credential name
 * @param {SDKConfig} [config] - SDK configuration
 * @param {string} [forceMode] - Force transport mode
 * @returns {Promise<Object>} RPC result
 */
async function message_rpc_call(method, params = null, credentialName = 'default', config = null, forceMode = null) {
  const resolved = config || new SDKConfig();
  const mode = forceMode || load_receive_mode(resolved);
  
  // For now, always use HTTP mode (WebSocket mode not yet implemented)
  return await http_message_rpc_call(method, params, { credentialName, config: resolved });
}

module.exports = {
  MESSAGE_RPC,
  RECEIVE_MODE_HTTP,
  RECEIVE_MODE_WEBSOCKET,
  load_receive_mode,
  write_receive_mode,
  is_websocket_mode,
  getSettingsPath,
  http_message_rpc_call,
  message_rpc_call,
};
