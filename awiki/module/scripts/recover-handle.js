/**
 * Recover a Handle by rebinding it to a new DID.
 *
 * Node.js implementation based on Python version:
 * python/scripts/recover_handle.py
 *
 * [INPUT]: SDK (handle OTP + recovery RPC), credential_store, local_store, e2ee_store
 * [OUTPUT]: Handle recovery result with safe credential target selection, optional
 *           credential replacement, and conditional local cache migration
 * [POS]: Pure non-interactive recovery CLI for users who lost the old DID private key
 *        but still control the original Handle phone number
 */

const fs = require('fs');
const path = require('path');
const { SDKConfig } = require('./utils/config');
const { create_user_service_client } = require('./utils/client');
const { recover_handle } = require('./utils/handle');
const { loadIdentity, saveIdentity, backupIdentity, pruneUnreferencedCredentialDir } = require('./credential-store');
const localStore = require('./local-store');
const { deleteE2eeState } = require('./e2ee_store');
const { configureLogging } = require('./utils/logging');

/**
 * Return a non-destructive credential name for a recovered Handle.
 *
 * @param {string} handle - Handle local-part
 * @returns {string} Recovery credential name
 */
function _allocate_recovery_credential_name(handle) {
  const candidateNames = [handle, `${handle}_recovered`];
  for (const candidate of candidateNames) {
    if (loadIdentity(candidate) === null) {
      return candidate;
    }
  }

  let suffix = 2;
  while (true) {
    const candidate = `${handle}_recovered_${suffix}`;
    if (loadIdentity(candidate) === null) {
      return candidate;
    }
    suffix += 1;
  }
}

/**
 * Resolve the credential target for recovery without implicit overwrites.
 *
 * @param {Object} options - Options
 * @param {string} options.handle - Handle local-part
 * @param {string|null} options.requested_credential_name - Requested credential name
 * @param {boolean} options.replace_existing - Replace existing credential
 * @returns {[string, Object|null]} Tuple of [credential_name, old_credential]
 * @throws {Error} If credential exists and replace_existing is false
 */
function _resolve_recovery_target({ handle, requested_credential_name, replace_existing }) {
  if (requested_credential_name === null || requested_credential_name === undefined) {
    return [_allocate_recovery_credential_name(handle), null];
  }

  const existingCredential = loadIdentity(requested_credential_name);
  if (existingCredential !== null && !replace_existing) {
    throw new Error(
      `Credential '${requested_credential_name}' already exists for DID ` +
      `${existingCredential.did}; use a different --credential value ` +
      'or pass --replace-existing to overwrite it intentionally.'
    );
  }
  return [requested_credential_name, existingCredential];
}

/**
 * Rebind local messages/contacts and clear stale E2EE artifacts.
 *
 * @param {Object} options - Options
 * @param {string} options.credential_name - Credential name
 * @param {string} options.old_did - Old DID
 * @param {string} options.new_did - New DID
 * @returns {Object} Migration result
 */
function _migrate_local_cache({ credential_name, old_did, new_did }) {
  const conn = localStore.get_connection();
  localStore.ensure_schema(conn);
  try {
    const rebound = localStore.rebind_owner_did(
      conn,
      { old_owner_did: old_did, new_owner_did: new_did }
    );
    const cleared = localStore.clear_owner_e2ee_data(
      conn,
      { owner_did: old_did, credential_name: credential_name }
    );
  } finally {
    conn.close();
  }

  const deletedState = deleteE2eeState(credential_name);
  return {
    messages_rebound: rebound.messages,
    contacts_rebound: rebound.contacts,
    e2ee_outbox_cleared: cleared.e2ee_outbox,
    e2ee_state_deleted: deletedState,
  };
}

/**
 * Recover a Handle with phone OTP verification.
 *
 * @param {Object} options - Options
 * @param {string} options.handle - Handle local-part
 * @param {string} options.phone - Phone number
 * @param {string|null} options.otp_code - OTP code
 * @param {string|null} options.requested_credential_name - Requested credential name
 * @param {boolean} options.replace_existing - Replace existing credential
 * @returns {Promise<void>}
 * @throws {Error} If OTP code is not provided or recovery fails
 */
async function do_recover({ handle, phone, otp_code, requested_credential_name, replace_existing }) {
  const [credentialName, oldCredential] = _resolve_recovery_target({
    handle,
    requested_credential_name,
    replace_existing,
  });
  const shouldReplaceExisting = oldCredential !== null && replace_existing;

  console.error(
    `Recovering handle handle=${handle} requested_credential=${requested_credential_name} ` +
    `target_credential=${credentialName} replace_existing=${shouldReplaceExisting} ` +
    `otp_provided=${otp_code !== null}`
  );

  const config = SDKConfig.load();
  const oldDid = oldCredential && oldCredential.did ? String(oldCredential.did) : null;
  const oldUniqueId = oldCredential && oldCredential.unique_id ? String(oldCredential.unique_id) : null;

  if (otp_code === null || otp_code === undefined) {
    throw new Error('OTP code is required for handle recovery.');
  }

  const client = create_user_service_client(config);
  let identity;
  let recoverResult;
  try {
    [identity, recoverResult] = await recover_handle(
      client,
      config,
      phone,
      otp_code,
      handle,
    );
  } finally {
    // Client cleanup if needed (undici-based client doesn't require explicit close)
  }

  const backupPath = shouldReplaceExisting ? backupIdentity(credentialName) : null;
  if (backupPath !== null) {
    console.log(`Existing credential backed up to: ${backupPath}`);
  }

  saveIdentity(
    {
      did: identity.did,
      unique_id: identity.unique_id,
      user_id: identity.user_id,
      private_key_pem: identity.private_key_pem,
      public_key_pem: identity.public_key_pem,
      jwt_token: identity.jwt_token,
      display_name: oldCredential && oldCredential.name ? oldCredential.name : handle,
      handle: handle,
      name: credentialName,
      did_document: identity.did_document,
      e2ee_signing_private_pem: identity.e2ee_signing_private_pem,
      e2ee_agreement_private_pem: identity.e2ee_agreement_private_pem,
      replace_existing: shouldReplaceExisting,
    },
    config,
  );

  let cacheMigration = null;
  if (shouldReplaceExisting && oldDid && oldDid !== identity.did) {
    cacheMigration = _migrate_local_cache({
      credential_name: credentialName,
      old_did: oldDid,
      new_did: identity.did,
    });
  }
  if (shouldReplaceExisting && oldUniqueId && oldUniqueId !== identity.unique_id) {
    pruneUnreferencedCredentialDir(oldUniqueId);
  }

  console.error('Handle recovered successfully:');
  console.log(
    JSON.stringify(
      {
        did: identity.did,
        user_id: identity.user_id,
        handle: recoverResult.handle || handle,
        full_handle: recoverResult.full_handle,
        requested_credential_name: requested_credential_name,
        credential_name: credentialName,
        replaced_existing_credential: shouldReplaceExisting,
        message: recoverResult.message || 'OK',
        local_backup_path: backupPath ? String(backupPath) : null,
        local_cache_migration: cacheMigration,
      },
      null,
      2,
    )
  );
}

/**
 * CLI entry point.
 * @returns {void}
 */
function main() {
  configureLogging({
    level: 'INFO',
    consoleLevel: 'INFO',
    force: false,
    config: null,
    prefix: 'awiki-agent',
    mirrorStdio: true,
  });

  const args = process.argv.slice(2);
  const argParser = {
    handle: null,
    phone: null,
    otp_code: null,
    credential: null,
    replace_existing: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--handle') {
      argParser.handle = args[++i];
    } else if (arg === '--phone') {
      argParser.phone = args[++i];
    } else if (arg === '--otp-code') {
      argParser.otp_code = args[++i];
    } else if (arg === '--credential') {
      argParser.credential = args[++i];
    } else if (arg === '--replace-existing') {
      argParser.replace_existing = true;
    }
  }

  // Validate required arguments
  if (!argParser.handle) {
    console.error('Error: --handle is required');
    process.exit(2);
  }
  if (!argParser.phone) {
    console.error('Error: --phone is required');
    process.exit(2);
  }

  // Run the recovery
  do_recover({
    handle: argParser.handle,
    phone: argParser.phone,
    otp_code: argParser.otp_code,
    requested_credential_name: argParser.credential,
    replace_existing: argParser.replace_existing,
  }).catch((exc) => {
    console.error(`recover_handle CLI failed: ${exc.message}`);
    process.exit(1);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  do_recover,
  main,
  _allocate_recovery_credential_name,
  _resolve_recovery_target,
  _migrate_local_cache,
  // Python-compatible aliases
  doRecover: do_recover,
  recover_handle: do_recover,  // Python 兼容的导出名称
  main: main,
  allocate_recovery_credential_name: _allocate_recovery_credential_name,
  resolve_recovery_target: _resolve_recovery_target,
  migrate_local_cache: _migrate_local_cache,
};
