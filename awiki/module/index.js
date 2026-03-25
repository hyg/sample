/**
 * awiki-agent-id-message module exports
 *
 * Node.js implementation based on Python version:
 * python/scripts/__init__.py
 */

// Utils
const { SDKConfig } = require('./scripts/utils/config');
const auth = require('./scripts/utils/auth');
const identity = require('./scripts/utils/identity');
const handle = require('./scripts/utils/handle');
const e2ee = require('./scripts/utils/e2ee');
const resolve = require('./scripts/utils/resolve');
const ws = require('./scripts/utils/ws');
const rpc = require('./scripts/utils/rpc');
const client = require('./scripts/utils/client');
const logging = require('./scripts/utils/logging');

// Core modules
const credentialStore = require('./scripts/credential_store');
const messageTransport = require('./scripts/message_transport');
const messageDaemon = require('./scripts/message_daemon');
const listenerRecovery = require('./scripts/listener_recovery');
const setupRealtime = require('./scripts/setup_realtime');
const e2eeSessionStore = require('./scripts/e2ee_session_store');

module.exports = {
  // Config
  SDKConfig,

  // Utils
  ...auth,
  ...identity,
  ...handle,
  ...e2ee,
  ...resolve,
  ...ws,
  ...rpc,
  ...client,
  ...logging,

  // Credential management
  ...credentialStore,

  // Message transport
  ...messageTransport,

  // Message daemon
  ...messageDaemon,

  // Listener recovery
  ...listenerRecovery,

  // Setup realtime
  ...setupRealtime,

  // E2EE session store
  ...e2eeSessionStore
};
