/**
 * User Search (用户搜索) — search users by semantic matching.
 *
 * Node.js implementation based on Python version:
 * python/scripts/search_users.py
 *
 * [INPUT]: SDK (RPC calls), credential_store (load identity credentials),
 *          logging_config
 * [OUTPUT]: Search results as JSON output
 * [POS]: User search script — calls search-service /search/rpc
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

const { SDKConfig } = require('./utils/config');
const { create_user_service_client } = require('./utils/client');
const { authenticated_rpc_call } = require('./utils/rpc');
const { configureLogging } = require('./utils/logging');
const { create_authenticator } = require('./credential-store');

// Constants
const SEARCH_RPC = '/search/rpc';

/**
 * Search users by semantic matching.
 *
 * @param {string} query - Search query
 * @param {string} [credential_name='default'] - Credential name
 * @returns {Promise<void>}
 */
async function search_users(query, credential_name = 'default') {
  const config = SDKConfig.load();
  const authResult = create_authenticator(credential_name, config);
  
  if (authResult === null) {
    console.log(`Credential '${credential_name}' unavailable; please create an identity first`);
    process.exit(1);
  }

  const [auth] = authResult;
  
  const client = create_user_service_client(config);
  try {
    const result = await authenticated_rpc_call(
      client,
      SEARCH_RPC,
      'search.users',
      { type: 'keyword', q: query },
      1,
      { auth, credentialName: credential_name }
    );
    console.log(JSON.stringify(result, null, 2));
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
    query: null,
    credential: 'default'
  };

  // Skip node and script path
  const rawArgs = argv.slice(2);
  let i = 0;

  while (i < rawArgs.length) {
    const arg = rawArgs[i];

    if (arg === '--credential' && i + 1 < rawArgs.length) {
      args.credential = rawArgs[i + 1];
      i += 2;
    } else if (!arg.startsWith('--') && args.query === null) {
      args.query = arg;
      i += 1;
    } else {
      i += 1;
    }
  }

  // Validate query parameter
  if (args.query === null) {
    console.error('Error: query parameter is required');
    console.error('Usage: node scripts/search_users.js <query> [--credential <name>]');
    process.exit(1);
  }

  search_users(args.query, args.credential).catch((e) => {
    console.error(`Error searching users: ${e.message}`);
    process.exit(1);
  });
}

module.exports = {
  search_users,
  main
};
