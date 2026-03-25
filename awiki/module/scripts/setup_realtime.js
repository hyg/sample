/**
 * One-click setup for message transport mode and real-time delivery.
 *
 * Node.js implementation based on Python version:
 * python/scripts/setup_realtime.py
 *
 * [INPUT]: SDKConfig, service_manager, credential_store, secrets, json
 * [OUTPUT]: Configured settings.json + openclaw.json + HEARTBEAT.md + installed or removed
 *           ws_listener service according to the selected message transport mode
 * [POS]: Automation script that bridges the gap between Skill installation and real-time
 *        message delivery — configures transport mode, OpenClaw hooks, listener settings,
 *        heartbeat checklist, and background service
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const { SDKConfig } = require('./utils/config');
const { get_service_manager } = require('./service-manager');
const { write_receive_mode, RECEIVE_MODE_HTTP, RECEIVE_MODE_WEBSOCKET } = require('./message_transport');

// Module constants
const DEFAULT_LOCAL_DAEMON_HOST = '127.0.0.1';
const DEFAULT_LOCAL_DAEMON_PORT = 18790;

// Template token placeholder (from settings.example.json)
const _TOKEN_PLACEHOLDER = '<run: echo awiki_$(openssl rand -hex 32)>';

// OpenClaw default gateway port
const _OPENCLAW_GATEWAY_PORT = 18789;

// Marker lines used to find the awiki section in HEARTBEAT.md
const _HEARTBEAT_SECTION_START = '<!-- awiki-heartbeat-start -->';
const _HEARTBEAT_SECTION_END = '<!-- awiki-heartbeat-end -->';

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
 * Return the path to OpenClaw's config file
 * @returns {string} Path to openclaw.json
 */
function _openclaw_config_path() {
  return path.join(os.homedir(), '.openclaw', 'openclaw.json');
}

/**
 * Load a JSON file, returning empty dict if missing or invalid
 * @param {string} filePath - Path to JSON file
 * @returns {Object} Parsed JSON data or empty object
 */
function _load_json(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (exc) {
    console.warn(`Failed to read ${filePath}: ${exc.message}`);
    return {};
  }
}

/**
 * Save a JSON file, creating parent directories as needed
 * @param {string} filePath - Path to JSON file
 * @param {Object} data - JSON data to save
 * @param {boolean} secure - Whether to set secure permissions (0o600)
 */
function _save_json(filePath, data, secure = false) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  if (secure) {
    fs.chmodSync(filePath, 0o600);
  }
}

/**
 * Resolve the webhook token: reuse existing or generate new
 * Priority: settings.json listener.webhook_token > openclaw.json hooks.token > generate new
 * @param {Object} settingsData - Settings.json data
 * @param {Object} openclawData - OpenClaw.json data
 * @returns {string} Resolved or generated token
 */
function _resolve_token(settingsData, openclawData) {
  // Check settings.json
  const listener = settingsData.listener || {};
  let token = listener.webhook_token || '';
  if (token && !_is_placeholder_token(token)) {
    return token;
  }

  // Check openclaw.json
  const hooks = openclawData.hooks || {};
  token = hooks.token || '';
  if (token && !_is_placeholder_token(token)) {
    return token;
  }

  // Generate new
  return _generate_token();
}

/**
 * Resolve the local daemon token from settings or generate a new one
 * @param {Object} settingsData - Settings.json data
 * @returns {string} Resolved or generated local daemon token
 */
function _resolve_local_daemon_token(settingsData) {
  const messageTransport = settingsData.message_transport || {};
  const token = messageTransport.local_daemon_token || '';
  if (token && !_is_placeholder_token(token)) {
    return token;
  }
  return _generate_local_daemon_token();
}

/**
 * Create or update <DATA_DIR>/config/settings.json with listener config
 * @param {SDKConfig} config - SDK configuration
 * @param {string} token - Webhook token
 * @param {string} receive_mode - Receive mode ('http' or 'websocket')
 * @param {string} local_daemon_token - Local daemon token
 * @returns {Object} Status dict
 */
function setup_settings(config, token, receive_mode, local_daemon_token) {
  const settingsPath = path.join(config.data_dir, 'config', 'settings.json');
  const data = _load_json(settingsPath);
  const created = !fs.existsSync(settingsPath);

  // Set top-level service URLs if missing
  if (!data.user_service_url) {
    data.user_service_url = config.user_service_url;
  }
  if (!data.molt_message_url) {
    data.molt_message_url = config.molt_message_url;
  }
  if (!data.did_domain) {
    data.did_domain = config.did_domain;
  }

  // Merge listener config
  if (!data.listener) {
    data.listener = {};
  }
  const listener = data.listener;

  if (!listener.mode) {
    listener.mode = 'smart';
  }
  if (!listener.agent_webhook_url) {
    listener.agent_webhook_url = `http://127.0.0.1:${_OPENCLAW_GATEWAY_PORT}/hooks/agent`;
  }
  if (!listener.wake_webhook_url) {
    listener.wake_webhook_url = `http://127.0.0.1:${_OPENCLAW_GATEWAY_PORT}/hooks/wake`;
  }
  listener.webhook_token = token; // Always sync token
  if (!listener.agent_hook_name) {
    listener.agent_hook_name = 'IM';
  }
  if (!listener.routing) {
    listener.routing = {
      whitelist_dids: [],
      private_always_agent: true,
      command_prefix: '/',
      keywords: ['urgent', 'approval', 'payment', 'alert'],
      bot_names: [],
      blacklist_dids: []
    };
  }
  if (listener.e2ee_save_interval === undefined) {
    listener.e2ee_save_interval = 30.0;
  }
  if (!listener.e2ee_decrypt_fail_action) {
    listener.e2ee_decrypt_fail_action = 'drop';
  }
  data.listener = listener;

  // Merge message_transport config
  const existingTransport = data.message_transport || {};
  data.message_transport = {
    ...existingTransport,
    receive_mode: receive_mode,
    local_daemon_host: existingTransport.local_daemon_host || DEFAULT_LOCAL_DAEMON_HOST,
    local_daemon_port: parseInt(existingTransport.local_daemon_port || DEFAULT_LOCAL_DAEMON_PORT, 10),
    local_daemon_token: local_daemon_token
  };

  _save_json(settingsPath, data);

  return {
    status: 'ok',
    action: created ? 'created' : 'updated',
    path: settingsPath
  };
}

/**
 * Create or update ~/.openclaw/openclaw.json with hooks config
 * @param {string} token - Webhook token
 * @returns {Object} Status dict
 */
function setup_openclaw_hooks(token) {
  const configPath = _openclaw_config_path();
  const data = _load_json(configPath);
  const created = !fs.existsSync(configPath);

  // Merge hooks config (preserve other top-level keys)
  if (!data.hooks) {
    data.hooks = {};
  }
  const hooks = data.hooks;
  hooks.enabled = true;
  hooks.token = token;
  if (!hooks.path) {
    hooks.path = '/hooks';
  }
  if (!hooks.defaultSessionKey) {
    hooks.defaultSessionKey = 'hook:ingress';
  }
  if (!hooks.allowRequestSessionKey) {
    hooks.allowRequestSessionKey = false;
  }
  if (!hooks.allowedAgentIds) {
    hooks.allowedAgentIds = ['*'];
  }
  data.hooks = hooks;

  _save_json(configPath, data);

  return {
    status: 'ok',
    action: created ? 'created' : 'updated',
    path: configPath
  };
}

/**
 * Install and start the ws_listener background service
 * @param {string} credential - Credential name
 * @returns {Object} Status dict
 */
function setup_listener_service(credential) {
  const mgr = get_service_manager();
  const current = mgr.status();

  if (current.running) {
    return {
      status: 'ok',
      action: 'already_running',
      detail: current
    };
  }

  if (current.installed) {
    // Installed but not running — start it
    mgr.start();
    const newStatus = mgr.status();
    return {
      status: 'ok',
      action: 'started',
      detail: newStatus
    };
  }

  // Not installed — install (which also starts)
  mgr.install(credential, null, null);
  const newStatus = mgr.status();
  return {
    status: 'ok',
    action: 'installed',
    detail: newStatus
  };
}

/**
 * Stop and uninstall the ws_listener background service
 * @returns {Object} Status dict
 */
function disable_listener_service() {
  const mgr = get_service_manager();
  const current = mgr.status();

  if (!current.installed) {
    return {
      status: 'ok',
      action: 'already_disabled',
      detail: current
    };
  }

  try {
    if (current.running) {
      mgr.stop();
    }
  } catch (e) {
    // Ignore stop errors
  }

  mgr.uninstall();
  return {
    status: 'ok',
    action: 'disabled',
    detail: mgr.status()
  };
}

/**
 * Return the absolute path to the skill root (one level above scripts/)
 * @returns {string} Skill root directory path
 */
function _resolve_skill_dir() {
  return path.resolve(__dirname, '..');
}

/**
 * Build the awiki heartbeat section content
 * @param {string} skillDir - Skill root directory
 * @returns {string} Heartbeat section content
 */
function _build_heartbeat_section(skillDir) {
  return `${_HEARTBEAT_SECTION_START}
## awiki — DID messaging (every heartbeat)

- Run: \`cd ${skillDir} && node scripts/check-status.js\`
- If \`inbox.messages\` has items: surface unread messages to user.
- If \`identity.status != "ok"\`: alert user.
- If \`realtime_listener.running == false\`: run \`cd ${skillDir} && node scripts/setup_realtime.js\` to restart.
${_HEARTBEAT_SECTION_END}`;
}

/**
 * Return the OpenClaw workspace directory
 * Priority: OPENCLAW_WORKSPACE env > ~/.openclaw/workspace
 * @returns {string} OpenClaw workspace directory path
 */
function _openclaw_workspace_dir() {
  const env = process.env.OPENCLAW_WORKSPACE;
  if (env) {
    return env;
  }
  return path.join(os.homedir(), '.openclaw', 'workspace');
}

/**
 * Create or update HEARTBEAT.md in the OpenClaw workspace
 * @returns {Object} Status dict
 */
function setup_heartbeat() {
  const workspace = _openclaw_workspace_dir();
  const heartbeatPath = path.join(workspace, 'HEARTBEAT.md');
  const skillDir = _resolve_skill_dir();
  const newSection = _build_heartbeat_section(skillDir);

  if (!fs.existsSync(heartbeatPath)) {
    // Create new file
    if (!fs.existsSync(workspace)) {
      fs.mkdirSync(workspace, { recursive: true });
    }
    const content = `# Heartbeat checklist\n\n${newSection}\n`;
    fs.writeFileSync(heartbeatPath, content, 'utf-8');
    return {
      status: 'ok',
      action: 'created',
      path: heartbeatPath
    };
  }

  // File exists — read and update
  const existing = fs.readFileSync(heartbeatPath, 'utf-8');

  if (existing.includes(_HEARTBEAT_SECTION_START) && existing.includes(_HEARTBEAT_SECTION_END)) {
    // Replace existing awiki section
    const startIdx = existing.indexOf(_HEARTBEAT_SECTION_START);
    const endIdx = existing.indexOf(_HEARTBEAT_SECTION_END) + _HEARTBEAT_SECTION_END.length;
    const updated = existing.slice(0, startIdx) + newSection + existing.slice(endIdx);
    fs.writeFileSync(heartbeatPath, updated, 'utf-8');
    return {
      status: 'ok',
      action: 'updated',
      path: heartbeatPath
    };
  }

  // No marker found — append
  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(heartbeatPath, existing + separator + newSection + '\n', 'utf-8');
  return {
    status: 'ok',
    action: 'appended',
    path: heartbeatPath
  };
}

/**
 * Run the full message transport setup pipeline
 *
 * Steps:
 * 1. Resolve or generate webhook token
 * 2. Create/update settings.json with transport mode
 * 3. Create/update openclaw.json
 * 4. Install/start or disable ws_listener service
 * 5. Create/update HEARTBEAT.md in OpenClaw workspace
 *
 * @param {string} credential_name - Credential name (default: 'default')
 * @param {string} receive_mode - Receive mode (default: RECEIVE_MODE_WEBSOCKET)
 * @returns {Object} JSON-serializable report
 */
function setup_realtime(credential_name = 'default', receive_mode = RECEIVE_MODE_WEBSOCKET) {
  const config = SDKConfig.load();
  const report = {};

  if (![RECEIVE_MODE_HTTP, RECEIVE_MODE_WEBSOCKET].includes(receive_mode)) {
    throw new Error(`Unsupported receive mode: ${receive_mode}`);
  }

  // Load existing configs to resolve token
  const settingsPath = path.join(config.data_dir, 'config', 'settings.json');
  const settingsData = _load_json(settingsPath);
  const openclawData = _load_json(_openclaw_config_path());

  // 1. Resolve token
  const token = _resolve_token(settingsData, openclawData);
  const local_daemon_token = _resolve_local_daemon_token(settingsData);

  // Determine token action
  const existingSettingsToken = (settingsData.listener || {}).webhook_token || '';
  const existingOpenclawToken = (openclawData.hooks || {}).token || '';
  if (!_is_placeholder_token(existingSettingsToken) || !_is_placeholder_token(existingOpenclawToken)) {
    report.token_action = 'reused_existing';
  } else {
    report.token_action = 'generated_new';
  }

  // 2. Settings
  report.settings = setup_settings(config, token, receive_mode, local_daemon_token);
  write_receive_mode(receive_mode, config, {
    local_daemon_host: DEFAULT_LOCAL_DAEMON_HOST,
    local_daemon_port: DEFAULT_LOCAL_DAEMON_PORT,
    local_daemon_token: local_daemon_token
  });

  // 3. OpenClaw hooks
  report.openclaw_hooks = setup_openclaw_hooks(token);

  // 4. Listener service
  if (receive_mode === RECEIVE_MODE_WEBSOCKET) {
    report.listener_service = setup_listener_service(credential_name);
  } else {
    report.listener_service = disable_listener_service();
  }

  // 5. HEARTBEAT.md
  report.heartbeat = setup_heartbeat();

  report.status = 'ok';
  if (receive_mode === RECEIVE_MODE_WEBSOCKET) {
    report.summary = 'Message transport is configured for WebSocket mode. The WebSocket listener will receive messages instantly and forward them to OpenClaw.';
  } else {
    report.summary = 'Message transport is configured for HTTP mode. The background WebSocket listener is disabled and message inbox flows will use HTTP RPC.';
  }

  return report;
}

module.exports = {
  // Constants
  DEFAULT_LOCAL_DAEMON_HOST,
  DEFAULT_LOCAL_DAEMON_PORT,
  RECEIVE_MODE_HTTP,
  RECEIVE_MODE_WEBSOCKET,

  // Helper functions
  _generate_token,
  _generate_local_daemon_token,
  _is_placeholder_token,
  _resolve_token,
  _resolve_local_daemon_token,

  // Setup functions
  setup_settings,
  setup_openclaw_hooks,
  setup_listener_service,
  disable_listener_service,
  setup_heartbeat,
  setup_realtime
};
