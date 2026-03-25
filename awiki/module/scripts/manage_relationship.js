/**
 * Follow/unfollow/view relationship status/lists.
 *
 * Node.js implementation based on Python version:
 * python/scripts/manage_relationship.py
 *
 * [INPUT]: SDK (RPC calls), credential_store (load identity credentials),
 *          local_store, logging_config
 * [OUTPUT]: Relationship operation results with local contact sedimentation updates
 * [POS]: Social relationship management script
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

const { SDKConfig } = require('./utils/config');
const { create_user_service_client } = require('./utils/client');
const { authenticated_rpc_call } = require('./utils/rpc');
const { resolve_to_did } = require('./utils/resolve');
const { configureLogging } = require('./utils/logging');
const { create_authenticator } = require('./credential-store');
const local_store = require('./local-store');

const RPC_ENDPOINT = '/user-service/did/relationships/rpc';

/**
 * Follow a specific DID.
 *
 * Python 原型:
 * async def follow(target_did: str, credential_name: str = "default") -> None:
 *
 * @param {string} target_did - Target DID to follow
 * @param {string} [credential_name="default"] - Credential name
 * @returns {Promise<void>}
 */
async function follow(target_did, credential_name = 'default') {
  console.error(`Following target=${target_did} credential=${credential_name}`);
  
  const config = SDKConfig.load();
  const auth_result = create_authenticator(credential_name, config);
  
  if (auth_result === null) {
    console.log(`Credential '${credential_name}' unavailable; please create an identity first`);
    process.exit(1);
  }

  const [auth, data] = auth_result;
  
  const client = create_user_service_client(config);
  try {
    const result = await authenticated_rpc_call(
      client,
      RPC_ENDPOINT,
      'follow',
      { target_did: target_did },
      1,
      { auth: auth, credentialName: credential_name }
    );
    
    try {
      const conn = local_store.get_connection();
      local_store.ensure_schema(conn);
      local_store.upsert_contact(
        conn,
        {
          owner_did: data.did,
          did: target_did,
          relationship: 'following',
          followed: true
        }
      );
      local_store.append_relationship_event(
        conn,
        {
          owner_did: data.did,
          target_did: target_did,
          event_type: 'followed',
          status: 'applied',
          credential_name: credential_name
        }
      );
      conn.close();
    } catch (e) {
      console.error(`Failed to persist follow relationship locally: ${e.message}`);
    }
    
    console.error('Follow succeeded:');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    // Close client if needed
  }
}

/**
 * Unfollow a specific DID.
 *
 * Python 原型:
 * async def unfollow(target_did: str, credential_name: str = "default") -> None:
 *
 * @param {string} target_did - Target DID to unfollow
 * @param {string} [credential_name="default"] - Credential name
 * @returns {Promise<void>}
 */
async function unfollow(target_did, credential_name = 'default') {
  console.error(`Unfollowing target=${target_did} credential=${credential_name}`);
  
  const config = SDKConfig.load();
  const auth_result = create_authenticator(credential_name, config);
  
  if (auth_result === null) {
    console.log(`Credential '${credential_name}' unavailable; please create an identity first`);
    process.exit(1);
  }

  const [auth, data] = auth_result;
  
  const client = create_user_service_client(config);
  try {
    const result = await authenticated_rpc_call(
      client,
      RPC_ENDPOINT,
      'unfollow',
      { target_did: target_did },
      1,
      { auth: auth, credentialName: credential_name }
    );
    
    try {
      const conn = local_store.get_connection();
      local_store.ensure_schema(conn);
      local_store.upsert_contact(
        conn,
        {
          owner_did: data.did,
          did: target_did,
          relationship: 'none',
          followed: false
        }
      );
      local_store.append_relationship_event(
        conn,
        {
          owner_did: data.did,
          target_did: target_did,
          event_type: 'unfollowed',
          status: 'applied',
          credential_name: credential_name
        }
      );
      conn.close();
    } catch (e) {
      console.error(`Failed to persist unfollow relationship locally: ${e.message}`);
    }
    
    console.error('Unfollow succeeded:');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    // Close client if needed
  }
}

/**
 * View relationship status with a specific DID.
 *
 * Python 原型:
 * async def get_status(target_did: str, credential_name: str = "default") -> None:
 *
 * @param {string} target_did - Target DID to check status
 * @param {string} [credential_name="default"] - Credential name
 * @returns {Promise<void>}
 */
async function get_status(target_did, credential_name = 'default') {
  console.error(`Fetching relationship status target=${target_did} credential=${credential_name}`);
  
  const config = SDKConfig.load();
  const auth_result = create_authenticator(credential_name, config);
  
  if (auth_result === null) {
    console.log(`Credential '${credential_name}' unavailable; please create an identity first`);
    process.exit(1);
  }

  const [auth, _] = auth_result;
  
  const client = create_user_service_client(config);
  try {
    const result = await authenticated_rpc_call(
      client,
      RPC_ENDPOINT,
      'get_status',
      { target_did: target_did },
      1,
      { auth: auth, credentialName: credential_name }
    );
    
    console.error('Relationship status:');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    // Close client if needed
  }
}

/**
 * View following list.
 *
 * Python 原型:
 * async def get_following(credential_name: str = "default", limit: int = 50, offset: int = 0) -> None:
 *
 * @param {string} [credential_name="default"] - Credential name
 * @param {number} [limit=50] - List result count
 * @param {number} [offset=0] - List offset
 * @returns {Promise<void>}
 */
async function get_following(credential_name = 'default', limit = 50, offset = 0) {
  console.error(`Fetching following list credential=${credential_name} limit=${limit} offset=${offset}`);
  
  const config = SDKConfig.load();
  const auth_result = create_authenticator(credential_name, config);
  
  if (auth_result === null) {
    console.log(`Credential '${credential_name}' unavailable; please create an identity first`);
    process.exit(1);
  }

  const [auth, _] = auth_result;
  
  const client = create_user_service_client(config);
  try {
    const result = await authenticated_rpc_call(
      client,
      RPC_ENDPOINT,
      'get_following',
      { limit: limit, offset: offset },
      1,
      { auth: auth, credentialName: credential_name }
    );
    
    console.error('Following list:');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    // Close client if needed
  }
}

/**
 * View followers list.
 *
 * Python 原型:
 * async def get_followers(credential_name: str = "default", limit: int = 50, offset: int = 0) -> None:
 *
 * @param {string} [credential_name="default"] - Credential name
 * @param {number} [limit=50] - List result count
 * @param {number} [offset=0] - List offset
 * @returns {Promise<void>}
 */
async function get_followers(credential_name = 'default', limit = 50, offset = 0) {
  console.error(`Fetching followers list credential=${credential_name} limit=${limit} offset=${offset}`);
  
  const config = SDKConfig.load();
  const auth_result = create_authenticator(credential_name, config);
  
  if (auth_result === null) {
    console.log(`Credential '${credential_name}' unavailable; please create an identity first`);
    process.exit(1);
  }

  const [auth, _] = auth_result;
  
  const client = create_user_service_client(config);
  try {
    const result = await authenticated_rpc_call(
      client,
      RPC_ENDPOINT,
      'get_followers',
      { limit: limit, offset: offset },
      1,
      { auth: auth, credentialName: credential_name }
    );
    
    console.error('Followers list:');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    // Close client if needed
  }
}

/**
 * CLI entry point.
 *
 * Python 原型:
 * def main() -> None:
 */
function main() {
  configureLogging({ console_level: null, mirror_stdio: true });

  const args = process.argv.slice(2);
  let follow = null;
  let unfollow = null;
  let status = null;
  let following = false;
  let followers = false;
  let credential = 'default';
  let limit = 50;
  let offset = 0;

  // 解析命令行参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--follow' && args[i + 1]) {
      follow = args[++i];
    } else if (arg === '--unfollow' && args[i + 1]) {
      unfollow = args[++i];
    } else if (arg === '--status' && args[i + 1]) {
      status = args[++i];
    } else if (arg === '--following') {
      following = true;
    } else if (arg === '--followers') {
      followers = true;
    } else if (arg === '--credential' && args[i + 1]) {
      credential = args[++i];
    } else if (arg === '--limit' && args[i + 1]) {
      limit = parseInt(args[++i], 10);
    } else if (arg === '--offset' && args[i + 1]) {
      offset = parseInt(args[++i], 10);
    }
  }

  console.error(`manage_relationship CLI started credential=${credential}`);

  if (follow) {
    resolve_to_did(follow).then(target_did => {
      follow(target_did, credential);
    });
  } else if (unfollow) {
    resolve_to_did(unfollow).then(target_did => {
      unfollow(target_did, credential);
    });
  } else if (status) {
    resolve_to_did(status).then(target_did => {
      get_status(target_did, credential);
    });
  } else if (following) {
    get_following(credential, limit, offset);
  } else if (followers) {
    get_followers(credential, limit, offset);
  }
}

module.exports = {
  follow,
  unfollow,
  get_status,
  get_following,
  get_followers,
  main
};
