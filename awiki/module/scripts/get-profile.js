/**
 * View DID Profile (own or public).
 *
 * Node.js implementation based on Python version:
 * python/scripts/get_profile.py
 *
 * [INPUT]: SDK (RPC calls), credential_store (load identity credentials),
 *          logging_config
 * [OUTPUT]: Profile information as JSON output
 * [POS]: Profile query script
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

const { SDKConfig } = require('./utils/config');
const { configureLogging } = require('./utils/logging');
const { create_user_service_client } = require('./utils/client');
const { rpc_call, authenticated_rpc_call } = require('./utils/rpc');
const { create_authenticator } = require('./credential-store');

const PROFILE_RPC = '/user-service/did/profile/rpc';

/**
 * View own Profile.
 *
 * @param {string} [credential_name='default'] - Credential name
 * @returns {Promise<void>}
 */
async function get_my_profile(credential_name = 'default') {
  const config = SDKConfig.load();
  const authResult = create_authenticator(credential_name, config);
  if (authResult === null) {
    console.log(`Credential '${credential_name}' unavailable; please create an identity first`);
    process.exit(1);
  }

  const [auth, identityData] = authResult;

  const client = create_user_service_client(config);
  try {
    const me = await authenticated_rpc_call(
      client,
      PROFILE_RPC,
      'get_me',
      null, // params
      1, // request_id
      { auth: auth, credentialName: credential_name }
    );
    console.log(JSON.stringify(me, null, 2));
  } finally {
    // Client cleanup handled by caller
  }
}

/**
 * View public Profile of a specific DID or handle.
 *
 * @param {Object} options - Options
 * @param {string|null} [options.did] - DID to view
 * @param {string|null} [options.handle] - Handle to view
 * @returns {Promise<void>}
 */
async function get_public_profile({ did = null, handle = null } = {}) {
  if (!did && !handle) {
    console.log('Error: must provide --did or --handle');
    process.exit(1);
  }

  const params = {};
  if (did) {
    params.did = did;
  } else if (handle) {
    params.handle = handle;
  }

  const config = SDKConfig.load();
  const client = create_user_service_client(config);
  try {
    const profile = await rpc_call(
      client,
      PROFILE_RPC,
      'get_public_profile',
      params
    );
    console.log(JSON.stringify(profile, null, 2));
  } finally {
    // Client cleanup handled by caller
  }
}

/**
 * Resolve a DID document.
 *
 * @param {string} did - DID to resolve
 * @returns {Promise<void>}
 */
async function resolve_did(did) {
  const config = SDKConfig.load();
  const client = create_user_service_client(config);
  try {
    const resolved = await rpc_call(
      client,
      PROFILE_RPC,
      'resolve',
      { did: did }
    );
    console.log(JSON.stringify(resolved, null, 2));
  } finally {
    // Client cleanup handled by caller
  }
}

/**
 * CLI entry point.
 *
 * @param {string[]} [argv] - Command line arguments (default: process.argv)
 * @returns {void}
 */
function main(argv = process.argv) {
  configureLogging({ console_level: null, mirror_stdio: true });

  // Parse arguments manually (Node.js doesn't have argparse built-in)
  const args = {
    did: null,
    handle: null,
    resolve: null,
    credential: 'default'
  };

  // Skip node and script path
  const rawArgs = argv.slice(2);
  let i = 0;

  while (i < rawArgs.length) {
    const arg = rawArgs[i];

    if (arg === '--did' && i + 1 < rawArgs.length) {
      args.did = rawArgs[i + 1];
      i += 2;
    } else if (arg === '--handle' && i + 1 < rawArgs.length) {
      args.handle = rawArgs[i + 1];
      i += 2;
    } else if (arg === '--resolve' && i + 1 < rawArgs.length) {
      args.resolve = rawArgs[i + 1];
      i += 2;
    } else if (arg === '--credential' && i + 1 < rawArgs.length) {
      args.credential = rawArgs[i + 1];
      i += 2;
    } else {
      i += 1;
    }
  }

  // Execute action
  if (args.resolve) {
    resolve_did(args.resolve).catch((e) => {
      console.error(`Error resolving DID: ${e.message}`);
      process.exit(1);
    });
  } else if (args.did || args.handle) {
    get_public_profile({ did: args.did, handle: args.handle }).catch((e) => {
      console.error(`Error getting public profile: ${e.message}`);
      process.exit(1);
    });
  } else {
    get_my_profile(args.credential).catch((e) => {
      console.error(`Error getting own profile: ${e.message}`);
      process.exit(1);
    });
  }
}

module.exports = {
  get_my_profile,
  get_public_profile,
  resolve_did,
  main,
  // Alias for test compatibility
  get_profile: get_my_profile
};
