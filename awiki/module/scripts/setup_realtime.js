/**
 * One-click setup for message transport mode and real-time delivery.
 * 
 * Node.js implementation based on Python version:
 * python/scripts/setup_realtime.py
 * 
 * [INPUT]: SDKConfig, service_manager, credential_store, secrets, json
 * [OUTPUT]: Configured settings.json + openclaw.json + HEARTBEAT.md
 * [POS]: Automation script for message transport mode configuration
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SDKConfig } = require('./utils/config');
const { write_receive_mode, RECEIVE_MODE_HTTP, RECEIVE_MODE_WEBSOCKET } = require('./message_transport');

const DEFAULT_LOCAL_DAEMON_HOST = '127.0.0.1';
const DEFAULT_LOCAL_DAEMON_PORT = 18790;

/**
 * Generate a secure webhook token with awiki_ prefix
 * @returns {string} Secure token
 */
function _generate_token() {
  return 'awiki_' + crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a secure token for localhost daemon requests
 * @returns {string} Secure local daemon token
 */
function _generate_local_daemon_token() {
  return 'awiki_local_' + crypto.randomBytes(24).toString('hex');
}

/**
 * Check if a token is a template placeholder rather than a real value
 * @param {string} token - Token to check
 * @returns {boolean} True if token is a placeholder
 */
function _is_placeholder_token(token) {
  if (!token || token.trim() === '') {
    return true;
  }
  if (token.startsWith('<') || token === 'changeme') {
    return true;
  }
  return false;
}

/**
 * Resolve the webhook token from existing configs or generate new
 * @param {Object} settingsData - Settings.json data
 * @param {Object} openclawData - OpenClaw.json data
 * @returns {string} Resolved or generated token
 */
function _resolve_token(settingsData, openclawData) {
  // Check settings.json
  const listener = settingsData.listener || {};
  let token = listener.webhook_token;
  
  if (token && !_is_placeholder_token(token)) {
    return token;
  }
  
  // Check openclaw.json
  const hooks = openclawData.hooks || {};
  token = hooks.token;
  
  if (token && !_is_placeholder_token(token)) {
    return token;
  }
  
  // Generate new token
  return _generate_token();
}

/**
 * Setup settings.json with listener configuration
 * @param {SDKConfig} config - SDK configuration
 * @param {string} mode - Receive mode ('http' or 'websocket')
 * @returns {Object} Settings data
 */
function setup_settings(config, mode) {
  const settingsPath = path.join(config.data_dir, 'config', 'settings.json');
  
  // Load existing settings
  let data = {};
  if (fs.existsSync(settingsPath)) {
    try {
      data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch (error) {
      data = {};
    }
  }
  
  // Initialize listener section
  if (!data.listener) {
    data.listener = {};
  }
  
  // Generate or reuse token
  data.listener.webhook_token = _resolve_token(data, {});
  
  // Setup local daemon settings
  data.listener.local_daemon = {
    host: DEFAULT_LOCAL_DAEMON_HOST,
    port: DEFAULT_LOCAL_DAEMON_PORT,
    token: _generate_local_daemon_token()
  };
  
  // Ensure directory exists
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Write settings
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
  
  // Write receive mode
  write_receive_mode(mode, config);
  
  return data;
}

/**
 * Setup OpenClaw hooks configuration
 * @returns {Object} OpenClaw configuration
 */
function setup_openclaw_hooks() {
  const openclawPath = path.join(require('os').homedir(), '.openclaw', 'openclaw.json');
  
  // Load existing config
  let data = {};
  if (fs.existsSync(openclawPath)) {
    try {
      data = JSON.parse(fs.readFileSync(openclawPath, 'utf-8'));
    } catch (error) {
      data = {};
    }
  }
  
  // Initialize hooks section
  if (!data.hooks) {
    data.hooks = {};
  }
  
  // Setup default webhook endpoints
  if (!data.hooks.agent) {
    data.hooks.agent = 'http://localhost:18789/hooks/agent';
  }
  if (!data.hooks.wake) {
    data.hooks.wake = 'http://localhost:18789/hooks/wake';
  }
  
  // Setup token if missing
  if (!data.hooks.token || _is_placeholder_token(data.hooks.token)) {
    data.hooks.token = _generate_token();
  }
  
  // Ensure directory exists
  const dir = path.dirname(openclawPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Write config
  fs.writeFileSync(openclawPath, JSON.stringify(data, null, 2));
  
  return data;
}

/**
 * Setup heartbeat checklist
 * @returns {string} Path to HEARTBEAT.md
 */
function setup_heartbeat() {
  const workspace = process.env.AWIKI_WORKSPACE || path.join(require('os').homedir(), '.openclaw', 'workspace');
  const heartbeatPath = path.join(workspace, 'HEARTBEAT.md');
  
  const content = `# awiki Heartbeat Checklist

## Session Start Checklist

- [ ] Run \`check_status.py\` to verify identity and inbox
- [ ] Check for unread messages
- [ ] Check E2EE handshake status
- [ ] Check real-time listener status

## Heartbeat Interval

Recommended: 15 minutes

\`\`\`jsonc
// openclaw.json — agents.defaults.heartbeat
{
  "every": "15m",
  "target": "last"
}
\`\`\`

## Actions on Heartbeat

1. Run \`check_status.py\`
2. Parse JSON output
3. Act on conditions:
   - \`identity.status == "no_identity"\`: Guide identity creation
   - \`inbox.messages.length > 0\`: Notify unread messages
   - \`realtime_listener.running == false\`: Restart listener

## Reference

- Full protocol: \`<SKILL_DIR>/references/HEARTBEAT.md\`
- WebSocket listener: \`<SKILL_DIR>/references/WEBSOCKET_LISTENER.md\`
`;
  
  // Ensure directory exists
  const dir = path.dirname(heartbeatPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Write checklist
  fs.writeFileSync(heartbeatPath, content);
  
  return heartbeatPath;
}

/**
 * Main setup function - one-click setup for realtime delivery
 * @param {Object} options - Setup options
 * @param {string} options.mode - Receive mode ('http' or 'websocket', default: 'websocket')
 * @param {SDKConfig} options.config - SDK configuration (optional)
 * @returns {Object} Setup results
 */
function setup_realtime(options = {}) {
  const { mode = RECEIVE_MODE_WEBSOCKET, config } = options;
  const resolvedConfig = config || SDKConfig.load();
  
  const results = {
    settings: null,
    openclaw: null,
    heartbeat: null,
    mode: mode
  };
  
  try {
    // Setup settings.json
    results.settings = setup_settings(resolvedConfig, mode);
    
    // Setup openclaw.json hooks
    results.openclaw = setup_openclaw_hooks();
    
    // Setup heartbeat checklist
    results.heartbeat = setup_heartbeat();
    
    return results;
  } catch (error) {
    results.error = error.message;
    return results;
  }
}

module.exports = {
  DEFAULT_LOCAL_DAEMON_HOST,
  DEFAULT_LOCAL_DAEMON_PORT,
  RECEIVE_MODE_HTTP,
  RECEIVE_MODE_WEBSOCKET,
  _generate_token,
  _generate_local_daemon_token,
  _is_placeholder_token,
  _resolve_token,
  setup_settings,
  setup_openclaw_hooks,
  setup_heartbeat,
  setup_realtime
};
