/**
 * WebSocket listener config: webhook endpoints + routing rules + routing modes + E2EE transparent handling.
 *
 * [INPUT]: Environment variables, JSON config file, settings.json (unified config)
 * [OUTPUT]: ListenerConfig, RoutingRules, ROUTING_MODES using current-protocol
 *           E2EE ignore types
 * [POS]: Configuration module for ws_listener.js, defines routing rules, webhook targets, and E2EE handling parameters
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createSDKConfig } from './config.js';

// Routing mode constants
export const ROUTING_MODES = ["agent-all", "smart", "wake-all"];

/**
 * Message routing rules.
 * Controls how messages are classified into agent (high priority) or wake (low priority) mode.
 * Only effective when mode="smart".
 */
export class RoutingRules {
    constructor(options = {}) {
        // Agent mode trigger conditions
        this.whitelist_dids = new Set(options.whitelist_dids || []);
        this.private_always_agent = options.private_always_agent !== false;
        this.command_prefix = options.command_prefix || '/';
        this.keywords = options.keywords || ("urgent", "approval", "payment", "alert");
        this.bot_names = options.bot_names || [];

        // Blacklist (drop directly, do not forward)
        this.blacklist_dids = new Set(options.blacklist_dids || []);
    }
}

/**
 * WebSocket listener configuration.
 */
export class ListenerConfig {
    constructor(options = {}) {
        // Routing mode: agent-all / smart / wake-all
        this.mode = options.mode || "smart";

        // Dual webhook endpoints (OpenClaw Gateway default port 18789)
        this.agent_webhook_url = options.agent_webhook_url || "http://127.0.0.1:18789/hooks/agent";
        this.wake_webhook_url = options.wake_webhook_url || "http://127.0.0.1:18789/hooks/wake";
        this.webhook_token = options.webhook_token || "";  // Must match OpenClaw hooks.token

        // Agent webhook additional parameters
        this.agent_hook_name = options.agent_hook_name || "IM";  // name field for OpenClaw hooks/agent

        // Routing rules (only effective when mode="smart")
        this.routing = options.routing || new RoutingRules();

        // Current E2EE protocol message types (intercepted by the E2EE handler
        // before classify_message; legacy types are dropped by ws_listener guards).
        this.ignore_types = new Set([
            "e2ee_init", "e2ee_ack", "e2ee_msg", "e2ee_rekey", "e2ee_error",
        ]);

        // E2EE transparent handling (always enabled)
        this.e2ee_save_interval = options.e2ee_save_interval || 30.0;        // E2EE state save interval (seconds)
        this.e2ee_decrypt_fail_action = options.e2ee_decrypt_fail_action || "drop";  // Decryption failure action: "drop" / "forward_raw"

        // Reconnect backoff
        this.reconnect_base_delay = options.reconnect_base_delay || 1.0;
        this.reconnect_max_delay = options.reconnect_max_delay || 60.0;

        // Heartbeat interval (must be < ws_idle_timeout=300s)
        this.heartbeat_interval = options.heartbeat_interval || 120.0;

        // Validate configuration
        this.validate();
    }

    validate() {
        if (!ROUTING_MODES.includes(this.mode)) {
            throw new Error(`mode must be one of ${ROUTING_MODES}, got: ${this.mode}`);
        }
        for (const url of [this.agent_webhook_url, this.wake_webhook_url]) {
            if (!url.startsWith("http://127.0.0.1") && !url.startsWith("http://localhost")) {
                throw new Error(`webhook_url must be localhost: ${url}`);
            }
        }
        if (!["drop", "forward_raw"].includes(this.e2ee_decrypt_fail_action)) {
            throw new Error(
                `e2ee_decrypt_fail_action must be 'drop' or 'forward_raw', got: ${this.e2ee_decrypt_fail_action}`
            );
        }
    }

    /**
     * Load configuration from JSON file + settings.json + environment variables.
     * Priority: CLI --mode > environment variables > config file > settings.json > defaults.
     */
    static load(configPath = null, modeOverride = null) {
        console.log(`Loading listener config config_path=${configPath} mode_override=${modeOverride}`);

        let data = {};

        // 1. Read from config file or settings.json
        if (configPath && existsSync(configPath)) {
            try {
                const fileContent = readFileSync(configPath, 'utf-8');
                data = JSON.parse(fileContent);
                // Support unified format: extract "listener" sub-object
                if (data.listener) {
                    data = data.listener;
                }
            } catch (error) {
                console.error(`Failed to read config file: ${error.message}`);
            }
        } else {
            // Auto-read from <DATA_DIR>/config/settings.json
            const config = createSDKConfig();
            const settingsPath = join(config.data_dir, 'config', 'settings.json');
            if (existsSync(settingsPath)) {
                try {
                    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
                    if (settings.listener) {
                        data = settings.listener;
                    }
                } catch (error) {
                    console.error(`Failed to read settings file: ${error.message}`);
                }
            }
        }

        // 2. Environment variable overrides
        const envAgent = process.env.LISTENER_AGENT_WEBHOOK_URL;
        const envWake = process.env.LISTENER_WAKE_WEBHOOK_URL;
        const envToken = process.env.LISTENER_WEBHOOK_TOKEN;
        const envMode = process.env.LISTENER_MODE;
        if (envAgent) data.agent_webhook_url = envAgent;
        if (envWake) data.wake_webhook_url = envWake;
        if (envToken) data.webhook_token = envToken;
        if (envMode) data.mode = envMode;

        // 3. CLI arguments take highest priority
        if (modeOverride) data.mode = modeOverride;

        // 4. Build RoutingRules
        const routingData = data.routing || {};
        const routing = new RoutingRules({
            whitelist_dids: routingData.whitelist_dids || [],
            private_always_agent: routingData.private_always_agent !== false,
            command_prefix: routingData.command_prefix || '/',
            keywords: routingData.keywords || ["urgent", "approval", "payment", "alert"],
            bot_names: routingData.bot_names || [],
            blacklist_dids: routingData.blacklist_dids || []
        });

        // 5. Build ListenerConfig
        const result = new ListenerConfig({
            mode: data.mode || "smart",
            agent_webhook_url: data.agent_webhook_url || "http://127.0.0.1:18789/hooks/agent",
            wake_webhook_url: data.wake_webhook_url || "http://127.0.0.1:18789/hooks/wake",
            webhook_token: data.webhook_token || "",
            agent_hook_name: data.agent_hook_name || "IM",
            routing: routing,
            e2ee_save_interval: parseFloat(data.e2ee_save_interval || 30.0),
            e2ee_decrypt_fail_action: data.e2ee_decrypt_fail_action || "drop"
        });

        console.log(`Loaded listener config mode=${result.mode} agent_webhook=${result.agent_webhook_url} wake_webhook=${result.wake_webhook_url}`);

        return result;
    }
}

export default {
    ListenerConfig,
    ROUTING_MODES,
    RoutingRules
};
