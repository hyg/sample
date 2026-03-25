/**
 * WebSocket listener config: webhook endpoints + routing rules + routing modes + E2EE transparent handling.
 *
 * Node.js implementation based on Python version:
 * python/scripts/listener_config.py
 *
 * [INPUT]: Environment variables, JSON config file, settings.json (unified config)
 * [OUTPUT]: ListenerConfig, RoutingRules, ROUTING_MODES using current-protocol
 *           E2EE ignore types
 * [POS]: Configuration module for ws_listener.js, defines routing rules, webhook targets, and E2EE handling parameters
 */

const fs = require('fs');
const path = require('path');
const { SDKConfig } = require('./utils/config');

// Routing mode constants
const ROUTING_MODES = ['agent-all', 'smart', 'wake-all'];

/**
 * Message routing rules.
 *
 * Controls how messages are classified into agent (high priority) or wake (low priority) mode.
 * Only effective when mode="smart".
 */
class RoutingRules {
  /**
   * Create routing rules.
   *
   * @param {Object} options - Routing options
   * @param {string[]} [options.whitelist_dids=[]] - Whitelist DID list
   * @param {boolean} [options.private_always_agent=true] - Private messages always agent
   * @param {string} [options.command_prefix='/'] - Command prefix
   * @param {string[]} [options.keywords=['urgent', 'approval', 'payment', 'alert']] - Keywords
   * @param {string[]} [options.bot_names=[]] - Bot names
   * @param {string[]} [options.blacklist_dids=[]] - Blacklist DID list (drop directly)
   */
  constructor({
    whitelist_dids = [],
    private_always_agent = true,
    command_prefix = '/',
    keywords = ['urgent', 'approval', 'payment', 'alert'],
    bot_names = [],
    blacklist_dids = []
  } = {}) {
    this.whitelist_dids = new Set(whitelist_dids);
    this.private_always_agent = private_always_agent;
    this.command_prefix = command_prefix;
    this.keywords = keywords;
    this.bot_names = bot_names;
    this.blacklist_dids = new Set(blacklist_dids);

    // Freeze object to simulate Python's frozen=True
    Object.freeze(this);
  }
}

/**
 * WebSocket listener configuration.
 */
class ListenerConfig {
  /**
   * Create listener configuration.
   *
   * @param {Object} options - Configuration options
   * @param {string} [options.mode='smart'] - Routing mode: agent-all / smart / wake-all
   * @param {string} [options.agent_webhook_url='http://127.0.0.1:18789/hooks/agent'] - Agent webhook URL
   * @param {string} [options.wake_webhook_url='http://127.0.0.1:18789/hooks/wake'] - Wake webhook URL
   * @param {string} [options.webhook_token=''] - Webhook token (must match OpenClaw hooks.token)
   * @param {string} [options.agent_hook_name='IM'] - Agent webhook name field for OpenClaw hooks/agent
   * @param {RoutingRules} [options.routing] - Routing rules (only effective when mode="smart")
   * @param {number} [options.e2ee_save_interval=30.0] - E2EE state save interval (seconds)
   * @param {string} [options.e2ee_decrypt_fail_action='drop'] - Decryption failure action: "drop" / "forward_raw"
   * @param {number} [options.reconnect_base_delay=1.0] - Reconnect base delay (seconds)
   * @param {number} [options.reconnect_max_delay=60.0] - Reconnect max delay (seconds)
   * @param {number} [options.heartbeat_interval=120.0] - Heartbeat interval (seconds, must be < ws_idle_timeout=300s)
   */
  constructor({
    mode = 'smart',
    agent_webhook_url = 'http://127.0.0.1:18789/hooks/agent',
    wake_webhook_url = 'http://127.0.0.1:18789/hooks/wake',
    webhook_token = '',
    agent_hook_name = 'IM',
    routing = new RoutingRules(),
    e2ee_save_interval = 30.0,
    e2ee_decrypt_fail_action = 'drop',
    reconnect_base_delay = 1.0,
    reconnect_max_delay = 60.0,
    heartbeat_interval = 120.0
  } = {}) {
    // Validate mode
    if (!ROUTING_MODES.includes(mode)) {
      throw new Error(`mode must be one of ${ROUTING_MODES}, got: ${mode}`);
    }

    // Validate webhook URLs (must be localhost)
    if (!agent_webhook_url.startsWith('http://127.0.0.1') &&
        !agent_webhook_url.startsWith('http://localhost')) {
      throw new Error(`webhook_url must be localhost: ${agent_webhook_url}`);
    }
    if (!wake_webhook_url.startsWith('http://127.0.0.1') &&
        !wake_webhook_url.startsWith('http://localhost')) {
      throw new Error(`webhook_url must be localhost: ${wake_webhook_url}`);
    }

    // Validate e2ee_decrypt_fail_action
    if (!['drop', 'forward_raw'].includes(e2ee_decrypt_fail_action)) {
      throw new Error(`e2ee_decrypt_fail_action must be 'drop' or 'forward_raw', got: ${e2ee_decrypt_fail_action}`);
    }

    this.mode = mode;
    this.agent_webhook_url = agent_webhook_url;
    this.wake_webhook_url = wake_webhook_url;
    this.webhook_token = webhook_token;
    this.agent_hook_name = agent_hook_name;
    this.routing = routing;
    this.e2ee_save_interval = e2ee_save_interval;
    this.e2ee_decrypt_fail_action = e2ee_decrypt_fail_action;
    this.reconnect_base_delay = reconnect_base_delay;
    this.reconnect_max_delay = reconnect_max_delay;
    this.heartbeat_interval = heartbeat_interval;

    // Current E2EE protocol message types (intercepted by the E2EE handler
    // before classify_message; legacy types are dropped by ws_listener guards).
    this.ignore_types = new Set([
      'e2ee_init', 'e2ee_ack', 'e2ee_msg', 'e2ee_rekey', 'e2ee_error'
    ]);

    // Freeze object to simulate Python's frozen=True
    Object.freeze(this);
  }

  /**
   * Load configuration from JSON file + settings.json + environment variables.
   *
   * Priority: CLI --mode > environment variables > config file > settings.json > defaults.
   *
   * When config_path is null/undefined, automatically reads <DATA_DIR>/config/settings.json
   * and extracts the "listener" sub-object. Supports both unified format
   * (with "listener" key) and legacy flat format.
   *
   * @param {string|null} [config_path=null] - JSON config file path. Falls back to settings.json when null.
   * @param {string|null} [mode_override=null] - Mode override value passed from CLI.
   * @returns {ListenerConfig} ListenerConfig instance.
   */
  static load(config_path = null, mode_override = null) {
    console.log(`Loading listener config config_path=${config_path} mode_override=${mode_override}`);

    let data = {};

    // 1. Read from config file or settings.json
    if (config_path) {
      const pathObj = path.resolve(config_path);
      if (fs.existsSync(pathObj)) {
        const content = fs.readFileSync(pathObj, 'utf-8');
        data = JSON.parse(content);
        // Support unified format: extract "listener" sub-object
        if ('listener' in data) {
          data = data.listener;
        }
      }
    } else {
      // Auto-read from <DATA_DIR>/config/settings.json
      const sdkConfig = SDKConfig.load();
      const settingsPath = path.join(sdkConfig.data_dir, 'config', 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        if ('listener' in settings) {
          data = settings.listener;
        }
      }
    }

    // 2. Environment variable overrides
    const envAgent = process.env.LISTENER_AGENT_WEBHOOK_URL;
    const envWake = process.env.LISTENER_WAKE_WEBHOOK_URL;
    const envToken = process.env.LISTENER_WEBHOOK_TOKEN;
    const envMode = process.env.LISTENER_MODE;

    if (envAgent) {
      data.agent_webhook_url = envAgent;
    }
    if (envWake) {
      data.wake_webhook_url = envWake;
    }
    if (envToken) {
      data.webhook_token = envToken;
    }
    if (envMode) {
      data.mode = envMode;
    }

    // 3. CLI arguments take highest priority
    if (mode_override) {
      data.mode = mode_override;
    }

    // 4. Build RoutingRules
    const routingData = data.routing || {};
    const routing = new RoutingRules({
      whitelist_dids: routingData.whitelist_dids || [],
      private_always_agent: routingData.private_always_agent !== undefined ? routingData.private_always_agent : true,
      command_prefix: routingData.command_prefix || '/',
      keywords: routingData.keywords || ['urgent', 'approval', 'payment', 'alert'],
      bot_names: routingData.bot_names || [],
      blacklist_dids: routingData.blacklist_dids || []
    });

    // 5. Build ListenerConfig
    const result = new ListenerConfig({
      mode: data.mode || 'smart',
      agent_webhook_url: data.agent_webhook_url || 'http://127.0.0.1:18789/hooks/agent',
      wake_webhook_url: data.wake_webhook_url || 'http://127.0.0.1:18789/hooks/wake',
      webhook_token: data.webhook_token || '',
      agent_hook_name: data.agent_hook_name || 'IM',
      routing: routing,
      e2ee_save_interval: data.e2ee_save_interval !== undefined ? parseFloat(data.e2ee_save_interval) : 30.0,
      e2ee_decrypt_fail_action: data.e2ee_decrypt_fail_action || 'drop',
      reconnect_base_delay: data.reconnect_base_delay !== undefined ? parseFloat(data.reconnect_base_delay) : 1.0,
      reconnect_max_delay: data.reconnect_max_delay !== undefined ? parseFloat(data.reconnect_max_delay) : 60.0,
      heartbeat_interval: data.heartbeat_interval !== undefined ? parseFloat(data.heartbeat_interval) : 120.0
    });

    console.log(`Loaded listener config mode=${result.mode} agent_webhook=${result.agent_webhook_url} wake_webhook=${result.wake_webhook_url}`);
    return result;
  }
}

module.exports = {
  ROUTING_MODES,
  RoutingRules,
  ListenerConfig
};
