/**
 * Create or restore a DID identity.
 *
 * Create a new identity and save it locally on first use; reuse saved identities thereafter.
 *
 * Node.js implementation based on Python version:
 * python/scripts/setup_identity.py
 *
 * [INPUT]: SDK (identity creation, registration, authentication), credential_store
 *          (credential persistence + authenticator factory), logging_config
 * [OUTPUT]: Create/load/list/delete DID identities with automatic JWT
 *           bootstrap/refresh during load
 * [POS]: Identity management entry script; must be called before first use
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

const { SDKConfig } = require('./utils/config');
const { configureLogging } = require('./utils/logging');
const {
  create_identity,
  create_user_service_client,
  register_did,
  get_jwt_via_wba,
  create_authenticated_identity,
} = require('./utils/auth');
const { rpc_call, authenticated_rpc_call } = require('./utils/rpc');
const {
  save_identity,
  load_identity,
  list_identities,
  delete_identity,
  update_jwt,
  create_authenticator,
} = require('./credential_store');

/**
 * Create a new DID identity and save it.
 *
 * @param {string} name - Identity name
 * @param {string|null} [display_name=null] - Display name
 * @param {string} [credential_name='default'] - Credential storage name
 * @param {boolean} [is_agent=false] - Mark as AI Agent identity
 * @returns {Promise<void>}
 */
async function create_new_identity(
  name,
  display_name = null,
  credential_name = 'default',
  is_agent = false
) {
  const config = SDKConfig.load();
  console.log('Service configuration:');
  console.log(`  user-service: ${config.user_service_url}`);
  console.log(`  DID domain  : ${config.did_domain}`);

  const client = create_user_service_client(config);
  try {
    console.log('\nCreating DID identity...');
    const identity = await create_authenticated_identity(
      client,
      config,
      display_name || name,
      false, // isPublic
      is_agent,
      null, // role
      null, // endpointUrl
      null  // services
    );

    console.log(`  DID       : ${identity.did}`);
    console.log(`  unique_id : ${identity.unique_id}`);
    console.log(`  user_id   : ${identity.user_id}`);
    console.log(`  JWT token : ${identity.jwt_token.substring(0, 50)}...`);

    // Save credential
    const path = save_identity(
      {
        did: identity.did,
        unique_id: identity.unique_id,
        user_id: identity.user_id,
        private_key_pem: identity.private_key_pem,
        public_key_pem: identity.public_key_pem,
        jwt_token: identity.jwt_token,
        display_name: display_name || name,
        name: credential_name,
        did_document: identity.did_document,
        e2ee_signing_private_pem: identity.e2ee_signing_private_pem,
        e2ee_agreement_private_pem: identity.e2ee_agreement_private_pem,
      },
      config
    );
    console.log(`\nCredential saved to: ${path}`);
    console.log(`Credential name: ${credential_name}`);
  } finally {
    // Client cleanup handled by caller
  }
}

/**
 * Load a saved identity and verify it.
 *
 * @param {string} [credential_name='default'] - Credential storage name
 * @returns {Promise<void>}
 */
async function load_saved_identity(credential_name = 'default') {
  const data = load_identity(credential_name);
  if (data === null) {
    console.log(`Credential '${credential_name}' not found`);
    console.log(
      "Create an identity first: node scripts/setup-identity.js --name MyAgent"
    );
    process.exit(1);
  }

  console.log(`Loaded credential: ${credential_name}`);
  console.log(`  DID       : ${data.did}`);
  console.log(`  unique_id : ${data.unique_id}`);
  console.log(`  user_id   : ${data.user_id || 'N/A'}`);
  console.log(`  Created at: ${data.created_at || 'N/A'}`);

  const config = SDKConfig.load();

  // Try using DIDWbaAuthHeader for automatic authentication
  const authResult = create_authenticator(credential_name, config);
  if (authResult !== null) {
    const [auth, identityData] = authResult;
    const oldToken = data.jwt_token;

    const client = create_user_service_client(config);
    try {
      const me = await authenticated_rpc_call(
        client,
        '/user-service/did-auth/rpc',
        'get_me',
        null, // params
        1, // request_id
        { auth: auth, credentialName: credential_name }
      );

      const refreshedData = load_identity(credential_name) || {};
      const newToken = refreshedData.jwt_token;

      if (!oldToken && newToken) {
        console.log('\n  JWT bootstrap succeeded and was saved automatically.');
      } else if (oldToken && newToken && newToken !== oldToken) {
        console.log('\n  JWT refresh succeeded and was saved automatically.');
      } else {
        console.log('\n  JWT verification succeeded.');
      }
      console.log('  Current identity:');
      console.log(`    DID: ${me.did || 'N/A'}`);
      console.log(`    Name: ${me.name || 'N/A'}`);
    } catch (e) {
      console.log(`\n  JWT verification/refresh failed: ${e.message}`);
      console.log('  You may need to recreate the identity');
    } finally {
      // Client cleanup
    }
  } else {
    if (!data.jwt_token) {
      console.log('\n  No JWT token is saved and DID auth files are missing.');
      console.log('  Please recreate the identity to enable automatic authentication:');
      console.log(
        `    node scripts/setup-identity.js --name "${data.name || 'MyAgent'}" --credential ${credential_name}`
      );
      return;
    }

    // Legacy credential without did_document; fall back to direct verification
    const client = create_user_service_client(config);
    try {
      client.headers = client.headers || {};
      client.headers['Authorization'] = `Bearer ${data.jwt_token}`;

      const me = await rpc_call(client, '/user-service/did-auth/rpc', 'get_me');
      console.log('\n  JWT verification succeeded! Current identity:');
      console.log(`    DID: ${me.did || 'N/A'}`);
      console.log(`    Name: ${me.name || 'N/A'}`);
    } catch (e) {
      console.log('\n  JWT expired. Please recreate the identity to enable auto-refresh:');
      console.log(
        `    node scripts/setup-identity.js --name "${data.name || 'MyAgent'}" --credential ${credential_name}`
      );
    } finally {
      // Client cleanup
    }
  }
}

/**
 * Show all saved identities.
 *
 * @returns {void}
 */
function show_identities() {
  const identities = list_identities();
  if (!identities || identities.length === 0) {
    console.log('No saved identities');
    console.log('Create an identity: node scripts/setup-identity.js --name MyAgent');
    return;
  }

  console.log(`Saved identities (${identities.length}):`);
  console.log('-'.repeat(70));
  for (const ident of identities) {
    const jwtStatus = ident.has_jwt ? 'yes' : 'no';
    console.log(`  [${ident.credential_name}]`);
    console.log(`    DID       : ${ident.did}`);
    console.log(`    Name      : ${ident.name || 'N/A'}`);
    console.log(`    user_id   : ${ident.user_id || 'N/A'}`);
    console.log(`    JWT       : ${jwtStatus}`);
    console.log(`    Created at: ${ident.created_at || 'N/A'}`);
    console.log();
  }
}

/**
 * Delete a saved identity.
 *
 * @param {string} credential_name - Credential name to delete
 * @returns {void}
 */
function remove_identity(credential_name) {
  if (delete_identity(credential_name)) {
    console.log(`Deleted credential: ${credential_name}`);
  } else {
    console.log(`Credential '${credential_name}' not found`);
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
    name: null,
    load: null,
    list: false,
    delete: null,
    credential: 'default',
    agent: false,
  };

  // Skip node and script path
  const rawArgs = argv.slice(2);
  let i = 0;

  while (i < rawArgs.length) {
    const arg = rawArgs[i];

    if (arg === '--name' && i + 1 < rawArgs.length) {
      args.name = rawArgs[i + 1];
      i += 2;
    } else if (arg === '--load') {
      if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('--')) {
        args.load = rawArgs[i + 1];
        i += 2;
      } else {
        args.load = 'default';
        i += 1;
      }
    } else if (arg === '--list') {
      args.list = true;
      i += 1;
    } else if (arg === '--delete' && i + 1 < rawArgs.length) {
      args.delete = rawArgs[i + 1];
      i += 2;
    } else if (arg === '--credential' && i + 1 < rawArgs.length) {
      args.credential = rawArgs[i + 1];
      i += 2;
    } else if (arg === '--agent') {
      args.agent = true;
      i += 1;
    } else {
      i += 1;
    }
  }

  // Validate mutually exclusive group
  const actions = [args.name, args.load !== null, args.list, args.delete].filter(Boolean);
  if (actions.length !== 1) {
    console.error('Error: Exactly one action (--name, --load, --list, --delete) is required');
    process.exit(1);
  }

  // Execute action
  if (args.list) {
    show_identities();
  } else if (args.delete) {
    remove_identity(args.delete);
  } else if (args.load !== null) {
    load_saved_identity(args.load).catch((e) => {
      console.error(`Error loading identity: ${e.message}`);
      process.exit(1);
    });
  } else if (args.name) {
    create_new_identity(
      args.name,
      args.name, // display_name
      args.credential,
      args.agent
    ).catch((e) => {
      console.error(`Error creating identity: ${e.message}`);
      process.exit(1);
    });
  }
}

module.exports = {
  create_new_identity,
  load_saved_identity,
  show_identities,
  remove_identity,
  main,
  setup_identity: create_new_identity, // Alias for test compatibility
  
  // Aliases for Python compatibility
  list_identities: show_identities,
  delete_identity: remove_identity,
};
