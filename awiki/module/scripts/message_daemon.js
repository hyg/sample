/**
 * Local message daemon configuration and helpers.
 * 
 * Node.js implementation based on Python version:
 * python/scripts/message_daemon.py
 * 
 * [INPUT]: SDKConfig, settings.json
 * [OUTPUT]: Local daemon settings and availability check
 * [POS]: Local message daemon configuration for HTTP polling fallback
 */

const fs = require('fs');
const path = require('path');
const { SDKConfig } = require('./utils/config');

const DEFAULT_LOCAL_DAEMON_HOST = '127.0.0.1';
const DEFAULT_LOCAL_DAEMON_PORT = 18790;

/**
 * Get the daemon settings path
 * @param {SDKConfig} config - SDK configuration
 * @returns {string} Path to settings.json
 */
function getSettingsPath(config) {
  const resolved = config || SDKConfig.load();
  return path.join(resolved.data_dir, 'config', 'settings.json');
}

/**
 * Load local daemon settings from settings.json
 * 
 * @param {SDKConfig} config - SDK configuration
 * @returns {Object|null} Local daemon settings or null if not configured
 */
function load_local_daemon_settings(config) {
  const resolved = config || SDKConfig.load();
  const settingsPath = getSettingsPath(resolved);
  
  if (!fs.existsSync(settingsPath)) {
    return null;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    const listener = data.listener || {};
    const localDaemon = listener.local_daemon || {};
    
    return {
      host: localDaemon.host || DEFAULT_LOCAL_DAEMON_HOST,
      port: localDaemon.port || DEFAULT_LOCAL_DAEMON_PORT,
      token: localDaemon.token || listener.webhook_token || null
    };
  } catch (error) {
    return null;
  }
}

/**
 * Check if local daemon is configured and available
 * 
 * @returns {boolean} True if local daemon is available
 */
function is_local_daemon_available() {
  try {
    const config = SDKConfig.load();
    const settings = load_local_daemon_settings(config);
    
    if (!settings || !settings.token) {
      return false;
    }
    
    // In a full implementation, we would also check if the daemon is running
    // For now, we just check if it's configured
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Call local daemon via HTTP RPC
 * 
 * @param {string} method - RPC method name
 * @param {Object} params - RPC parameters
 * @param {string} token - Daemon authentication token
 * @returns {Promise<Object>} RPC response
 */
async function call_local_daemon(method, params, token) {
  const settings = load_local_daemon_settings();
  
  if (!settings || !settings.token) {
    throw new Error('Local message daemon token is missing');
  }
  
  if (!token || token !== settings.token) {
    throw new Error('Invalid daemon token');
  }
  
  const url = `http://${settings.host}:${settings.port}/rpc`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: method,
      params: params || {},
      id: 1
    })
  });
  
  if (!response.ok) {
    throw new Error(`Daemon request failed: ${response.status}`);
  }
  
  const result = await response.json();
  
  if (result.error) {
    throw new Error(result.error.message || 'Daemon error');
  }
  
  return result.result;
}

module.exports = {
  DEFAULT_LOCAL_DAEMON_HOST,
  DEFAULT_LOCAL_DAEMON_PORT,
  load_local_daemon_settings,
  is_local_daemon_available,
  call_local_daemon,
  getSettingsPath
};
