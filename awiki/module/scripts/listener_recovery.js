/**
 * WebSocket listener runtime monitoring and recovery.
 *
 * Node.js implementation based on Python version:
 * python/scripts/listener_recovery.py
 *
 * [INPUT]: SDKConfig, service_manager, ws_listener runtime state
 * [OUTPUT]: Listener runtime status and auto-recovery actions
 * [POS]: WebSocket listener runtime monitoring and recovery
 */

const fs = require('fs');
const path = require('path');
const { SDKConfig } = require('./utils/config');
const { is_local_daemon_available } = require('./message_daemon');

const _MAX_AUTO_RESTART_FAILURES = 3;
const _STATE_FILE_NAME = 'listener_recovery.json';

/**
 * Return the persisted listener recovery state file path
 * @param {SDKConfig|null} config - SDK configuration
 * @returns {string} State file path
 */
function _statePath(config = null) {
  const resolved = config || SDKConfig.load();
  return path.join(resolved.data_dir, 'runtime', _STATE_FILE_NAME);
}

/**
 * Return the default on-disk state structure
 * @returns {Object} Default state
 */
function _defaultState() {
  return { credentials: {} };
}

/**
 * Normalize one credential entry loaded from disk
 * @param {Object|null} entry - Entry to normalize
 * @returns {Object} Normalized entry
 */
function _normalizeEntry(entry) {
  const data = entry || {};
  let consecutiveFailures = data.consecutive_restart_failures || 0;
  
  if (typeof consecutiveFailures !== 'number' || consecutiveFailures < 0) {
    consecutiveFailures = 0;
  }
  
  let lastResult = data.last_restart_result || 'not_needed';
  if (typeof lastResult !== 'string' || !lastResult) {
    lastResult = 'not_needed';
  }
  
  let lastAttemptAt = data.last_restart_attempt_at || null;
  if (typeof lastAttemptAt !== 'string' || !lastAttemptAt) {
    lastAttemptAt = null;
  }
  
  let lastError = data.last_error || null;
  if (typeof lastError !== 'string' || !lastError) {
    lastError = null;
  }
  
  const autoRestartPaused = Boolean(
    data.auto_restart_paused || consecutiveFailures >= _MAX_AUTO_RESTART_FAILURES
  );
  
  return {
    consecutive_restart_failures: consecutiveFailures,
    last_restart_attempt_at: lastAttemptAt,
    last_restart_result: lastResult,
    last_error: lastError,
    auto_restart_paused: autoRestartPaused
  };
}

/**
 * Load the full persisted runtime state from disk
 * @param {SDKConfig|null} config - SDK configuration
 * @returns {Object} State data
 */
function _loadState(config = null) {
  const statePath = _statePath(config);
  
  if (!fs.existsSync(statePath)) {
    return _defaultState();
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    if (typeof data !== 'object' || data === null) {
      return _defaultState();
    }
    
    const credentials = data.credentials;
    if (typeof credentials !== 'object' || credentials === null) {
      return _defaultState();
    }
    
    return { credentials };
  } catch (error) {
    return _defaultState();
  }
}

/**
 * Persist the runtime state to disk
 * @param {Object} data - State data
 * @param {SDKConfig|null} config - SDK configuration
 */
function _saveState(data, config = null) {
  const statePath = _statePath(config);
  const dir = path.dirname(statePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(statePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Persist one credential entry and return its normalized representation
 * @param {string} credentialName - Credential name
 * @param {Object} entry - Entry to save
 * @param {SDKConfig|null} config - SDK configuration
 * @returns {Object} Normalized entry
 */
function _updateEntry(credentialName, entry, { config = null } = {}) {
  const data = _loadState(config);
  if (!data.credentials) {
    data.credentials = {};
  }
  data.credentials[credentialName] = entry;
  _saveState(data, config);
  return _normalizeEntry(entry);
}

/**
 * Return the persisted recovery state for one credential
 * @param {string} credentialName - Credential name
 * @param {Object} options - Options
 * @param {SDKConfig|null} [options.config] - SDK configuration
 * @returns {Object} Recovery state
 */
function get_listener_recovery_state(credentialName, { config = null } = {}) {
  const data = _loadState(config);
  const entry = data.credentials?.[credentialName];
  return _normalizeEntry(typeof entry === 'object' && entry !== null ? entry : null);
}

/**
 * Clear backoff counters after a healthy listener check
 * @param {string} credentialName - Credential name
 * @param {Object} options - Options
 * @param {SDKConfig|null} [options.config] - SDK configuration
 * @param {string} [options.result='not_needed'] - Result
 * @returns {Object} Updated state
 */
function note_listener_healthy(credentialName, { config = null, result = 'not_needed' } = {}) {
  const current = get_listener_recovery_state(credentialName, { config });
  
  if (
    current.consecutive_restart_failures === 0 &&
    !current.auto_restart_paused &&
    current.last_restart_result === result &&
    current.last_error === null
  ) {
    return current;
  }
  
  const entry = {
    consecutive_restart_failures: 0,
    last_restart_attempt_at: current.last_restart_attempt_at,
    last_restart_result: result,
    last_error: null,
    auto_restart_paused: false
  };
  
  return _updateEntry(credentialName, entry, { config });
}

/**
 * Increment the persisted restart failure counter for one credential
 * @param {string} credentialName - Credential name
 * @param {string} error - Error message
 * @param {Object} options - Options
 * @param {SDKConfig|null} [options.config] - SDK configuration
 * @returns {Object} Updated state
 */
function record_listener_restart_failure(credentialName, error, { config = null } = {}) {
  const current = get_listener_recovery_state(credentialName, { config });
  const consecutiveFailures = current.consecutive_restart_failures + 1;
  
  const entry = {
    consecutive_restart_failures: consecutiveFailures,
    last_restart_attempt_at: new Date().toISOString(),
    last_restart_result: 'failed',
    last_error: error,
    auto_restart_paused: consecutiveFailures >= _MAX_AUTO_RESTART_FAILURES
  };
  
  return _updateEntry(credentialName, entry, { config });
}

/**
 * Probe the current listener runtime state without mutating it
 * @param {Object} options - Options
 * @param {SDKConfig|null} [options.config] - SDK configuration
 * @returns {Object} Probe result
 */
function probe_listener_runtime({ config = null } = {}) {
  const resolved = config || SDKConfig.load();
  let serviceStatus = {};
  
  try {
    const { get_service_manager } = require('./service_manager');
    serviceStatus = get_service_manager().status();
  } catch (error) {
    serviceStatus = {
      installed: false,
      running: false,
      error: String(error.message || error)
    };
  }
  
  const serviceRunning = Boolean(serviceStatus.running);
  const installed = Boolean(serviceStatus.installed);
  const daemonAvailable = is_local_daemon_available({ config: resolved });
  
  return {
    installed,
    running: serviceRunning || daemonAvailable,
    service_running: serviceRunning,
    daemon_available: daemonAvailable,
    service_status: serviceStatus
  };
}

/**
 * Merge probe and persisted state into one caller-facing report
 * @param {Object} options - Options
 * @param {Object} options.state - Persisted state
 * @param {Object} options.probe - Probe result
 * @param {boolean} options.wasRunning - Was running flag
 * @param {boolean} options.degraded - Degraded flag
 * @param {boolean} [options.restartAttempted] - Restart attempted flag
 * @param {boolean} [options.restartSucceeded] - Restart succeeded flag
 * @returns {Object} Runtime report
 */
function _buildRuntimeReport({ state, probe, wasRunning, degraded, restartAttempted = false, restartSucceeded = false }) {
  return {
    installed: probe.installed,
    running: probe.running,
    service_running: probe.service_running,
    daemon_available: probe.daemon_available,
    service_status: probe.service_status,
    was_running: wasRunning,
    degraded,
    restart_attempted: restartAttempted,
    restart_succeeded: restartSucceeded,
    ...state
  };
}

/**
 * Return the current listener runtime report without auto-restart
 * @param {string} credentialName - Credential name
 * @param {Object} options - Options
 * @param {SDKConfig|null} [options.config] - SDK configuration
 * @returns {Object} Runtime report
 */
function get_listener_runtime_report(credentialName, { config = null } = {}) {
  const probe = probe_listener_runtime({ config });
  const state = get_listener_recovery_state(credentialName, { config });
  
  if (probe.running) {
    note_listener_healthy(credentialName, { config });
  }
  
  return _buildRuntimeReport({
    state,
    probe,
    wasRunning: probe.running,
    degraded: false
  });
}

/**
 * Ensure the listener runtime is healthy, with persisted restart backoff
 * @param {string} credentialName - Credential name
 * @param {Object} options - Options
 * @param {SDKConfig|null} [options.config] - SDK configuration
 * @returns {Object} Runtime report
 */
function ensure_listener_runtime(credentialName, { config = null } = {}) {
  const resolved = config || SDKConfig.load();
  const initialProbe = probe_listener_runtime({ config: resolved });
  
  if (initialProbe.running) {
    const state = note_listener_healthy(credentialName, { config: resolved });
    return _buildRuntimeReport({
      state,
      probe: initialProbe,
      wasRunning: true,
      degraded: false
    });
  }
  
  const currentState = get_listener_recovery_state(credentialName, { config: resolved });
  
  if (currentState.auto_restart_paused) {
    return _buildRuntimeReport({
      state: currentState,
      probe: initialProbe,
      wasRunning: false,
      degraded: true
    });
  }
  
  if (!initialProbe.installed) {
    const state = record_listener_restart_failure(
      credentialName,
      'Listener service is not installed',
      { config: resolved }
    );
    const finalProbe = probe_listener_runtime({ config: resolved });
    return _buildRuntimeReport({
      state,
      probe: finalProbe,
      wasRunning: false,
      degraded: true,
      restartAttempted: true,
      restartSucceeded: false
    });
  }
  
  try {
    const { get_service_manager } = require('./service_manager');
    get_service_manager().start();
  } catch (error) {
    const state = record_listener_restart_failure(
      credentialName,
      String(error.message || error),
      { config: resolved }
    );
    const finalProbe = probe_listener_runtime({ config: resolved });
    return _buildRuntimeReport({
      state,
      probe: finalProbe,
      wasRunning: false,
      degraded: true,
      restartAttempted: true,
      restartSucceeded: false
    });
  }
  
  // Wait for service to start (up to 5 attempts, 200ms each)
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  for (let i = 0; i < 5; i++) {
    sleep(200);
    const finalProbe = probe_listener_runtime({ config: resolved });
    
    if (finalProbe.running) {
      const state = note_listener_healthy(credentialName, {
        config: resolved,
        result: 'restarted'
      });
      return _buildRuntimeReport({
        state,
        probe: finalProbe,
        wasRunning: false,
        degraded: true,
        restartAttempted: true,
        restartSucceeded: true
      });
    }
  }
  
  const state = record_listener_restart_failure(
    credentialName,
    'Listener restart attempt did not become healthy',
    { config: resolved }
  );
  const finalProbe = probe_listener_runtime({ config: resolved });
  return _buildRuntimeReport({
    state,
    probe: finalProbe,
    wasRunning: false,
    degraded: true,
    restartAttempted: true,
    restartSucceeded: false
  });
}

module.exports = {
  get_listener_runtime_report,
  probe_listener_runtime,
  get_listener_recovery_state,
  note_listener_healthy,
  record_listener_restart_failure,
  ensure_listener_runtime,
  _statePath,
  _defaultState,
  _normalizeEntry,
  _loadState,
  _saveState,
  _updateEntry,
  _buildRuntimeReport
};
