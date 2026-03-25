/**
 * Query credit balance, transactions, and rules.
 *
 * Node.js implementation based on Python version:
 * python/scripts/manage_credits.py
 *
 * Usage:
 *   # View credit balance
 *   node scripts/manage-credits.js --balance
 *
 *   # View credit transaction history
 *   node scripts/manage-credits.js --transactions
 *   node scripts/manage-credits.js --transactions --limit 20 --offset 0
 *
 *   # View all credit rules (no auth required)
 *   node scripts/manage-credits.js --rules
 *
 * [INPUT]: SDK (RPC calls), credential_store (load identity credentials),
 *          logging_config
 * [OUTPUT]: Credits information as JSON output
 * [POS]: Credits query script for balance, transactions, and rules
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

const CREDITS_RPC = '/user-service/credits/rpc';

/**
 * View current credit balance.
 *
 * @param {string} [credential_name='default'] - Credential name
 * @returns {Promise<void>}
 */
async function get_balance(credential_name = 'default') {
  const config = SDKConfig.load();
  const authResult = create_authenticator(credential_name, config);
  if (authResult === null) {
    console.log(JSON.stringify({
      status: 'error',
      error: `Credential '${credential_name}' unavailable`,
      hint: 'Please create an identity first with setup_identity.py or register_handle.py',
    }, null, 2));
    process.exit(1);
  }

  const [auth, identityData] = authResult;
  const client = create_user_service_client(config);
  try {
    const result = await authenticated_rpc_call(
      client,
      CREDITS_RPC,
      'get_balance',
      {},
      1,
      { auth: auth, credentialName: credential_name }
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    // Client cleanup handled by caller
  }
}

/**
 * View credit transaction history.
 *
 * @param {string} [credential_name='default'] - Credential name
 * @param {number} [limit=20] - Transaction list limit
 * @param {number} [offset=0] - Transaction list offset
 * @returns {Promise<void>}
 */
async function get_transactions(credential_name = 'default', limit = 20, offset = 0) {
  const config = SDKConfig.load();
  const authResult = create_authenticator(credential_name, config);
  if (authResult === null) {
    console.log(JSON.stringify({
      status: 'error',
      error: `Credential '${credential_name}' unavailable`,
      hint: 'Please create an identity first with setup_identity.py or register_handle.py',
    }, null, 2));
    process.exit(1);
  }

  const [auth, identityData] = authResult;
  const client = create_user_service_client(config);
  try {
    const result = await authenticated_rpc_call(
      client,
      CREDITS_RPC,
      'get_transactions',
      { limit: limit, offset: offset },
      1,
      { auth: auth, credentialName: credential_name }
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    // Client cleanup handled by caller
  }
}

/**
 * View all credit rules (public, no auth required).
 *
 * @returns {Promise<void>}
 */
async function get_rules() {
  const config = SDKConfig.load();
  const client = create_user_service_client(config);
  try {
    const result = await rpc_call(
      client,
      CREDITS_RPC,
      'get_rules',
      {}
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
    balance: false,
    transactions: false,
    rules: false,
    credential: 'default',
    limit: 20,
    offset: 0
  };

  // Skip node and script path
  const rawArgs = argv.slice(2);
  let i = 0;

  while (i < rawArgs.length) {
    const arg = rawArgs[i];

    if (arg === '--balance') {
      args.balance = true;
      i += 1;
    } else if (arg === '--transactions') {
      args.transactions = true;
      i += 1;
    } else if (arg === '--rules') {
      args.rules = true;
      i += 1;
    } else if (arg === '--credential' && i + 1 < rawArgs.length) {
      args.credential = rawArgs[i + 1];
      i += 2;
    } else if (arg === '--limit' && i + 1 < rawArgs.length) {
      args.limit = parseInt(rawArgs[i + 1], 10);
      i += 2;
    } else if (arg === '--offset' && i + 1 < rawArgs.length) {
      args.offset = parseInt(rawArgs[i + 1], 10);
      i += 2;
    } else {
      i += 1;
    }
  }

  // Validate mutually exclusive options
  const actionCount = [args.balance, args.transactions, args.rules].filter(Boolean).length;
  if (actionCount === 0) {
    console.error('Error: one of --balance, --transactions, or --rules is required');
    process.exit(1);
  }
  if (actionCount > 1) {
    console.error('Error: only one of --balance, --transactions, or --rules can be specified');
    process.exit(1);
  }

  // Execute action
  if (args.balance) {
    get_balance(args.credential).catch((e) => {
      console.error(`Error getting balance: ${e.message}`);
      process.exit(1);
    });
  } else if (args.transactions) {
    get_transactions(args.credential, args.limit, args.offset).catch((e) => {
      console.error(`Error getting transactions: ${e.message}`);
      process.exit(1);
    });
  } else if (args.rules) {
    get_rules().catch((e) => {
      console.error(`Error getting rules: ${e.message}`);
      process.exit(1);
    });
  }
}

module.exports = {
  get_balance,
  get_transactions,
  get_rules,
  main
};

// CLI entry
if (require.main === module) {
  main();
}
