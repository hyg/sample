/**
 * Legacy credential migration into the indexed per-credential directory layout.
 *
 * Node.js implementation based on Python version:
 * python/scripts/credential_migration.py
 *
 * [INPUT]: Legacy flat credential JSON files, legacy E2EE state files,
 *          credential_layout validated scan helpers, credential_store, e2ee_store
 * [OUTPUT]: detect_legacy_layout(), migrate_legacy_credentials(),
 *          ensure_credential_storage_ready()
 * [POS]: Shared migration module used by check_status.js and the standalone
 *       migrate_credentials.js CLI
 */

const fs = require('fs');
const path = require('path');
const { save_identity } = require('./credential-store');
const { save_e2ee_state } = require('./e2ee_store');
const credentialLayout = require('./credential-layout');

const {
  getIndexEntry: get_index_entry,
  hasLegacyLayout: has_legacy_layout,
  legacyAuthExportPaths: legacy_auth_export_paths,
  legacyBackupRoot: legacy_backup_root,
  legacyE2eeStatePath: legacy_e2ee_state_path,
  legacyIdentityPath: legacy_identity_path,
  resolveCredentialPaths: resolve_credential_paths,
  scanLegacyLayout: scan_legacy_layout
} = credentialLayout;

/**
 * Inspect whether legacy credential files still exist
 * @returns {Object} Detection result
 */
function detect_legacy_layout() {
  const scanResult = scan_legacy_layout();
  const legacyCredentials = scanResult.legacy_credentials;
  
  let status;
  if (legacyCredentials.length > 0) {
    status = 'legacy';
  } else if (scanResult.invalid_json_files.length > 0 || scanResult.orphan_e2ee_files.length > 0) {
    status = 'legacy_issues';
  } else {
    status = 'new';
  }
  
  return {
    status: status,
    legacy_credentials: legacyCredentials,
    unique_dids: scanResult.unique_dids,
    unique_did_count: scanResult.unique_did_count,
    invalid_json_files: scanResult.invalid_json_files,
    orphan_e2ee_files: scanResult.orphan_e2ee_files
  };
}

/**
 * Move legacy files into a timestamped backup directory
 * @param {string} credentialName - Credential name
 * @param {string} runId - Run ID (timestamp)
 * @returns {string} Backup directory path
 * @private
 */
function _backupLegacyFiles(credentialName, runId) {
  const backupDir = path.join(legacy_backup_root(), runId, credentialName);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const pathsToArchive = [
    legacy_identity_path(credentialName),
    legacy_e2ee_state_path(credentialName),
    ...legacy_auth_export_paths(credentialName)
  ];

  for (const filePath of pathsToArchive) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const destPath = path.join(backupDir, path.basename(filePath));
    fs.renameSync(filePath, destPath);
  }

  return backupDir;
}

/**
 * Migrate one legacy credential into the new layout
 * @param {string} credentialName - Credential name
 * @param {string} runId - Run ID (timestamp)
 * @returns {Object} Migration result
 * @private
 */
function _migrateSingleCredential(credentialName, runId) {
  const legacyPath = legacy_identity_path(credentialName);
  if (!fs.existsSync(legacyPath)) {
    throw new Error(`Legacy credential file not found for '${credentialName}'`);
  }

  const legacyData = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
  const did = legacyData.did;
  const uniqueId = legacyData.unique_id || did.split(':').pop();

  save_identity({
    did: did,
    unique_id: uniqueId,
    user_id: legacyData.user_id,
    private_key_pem: legacyData.private_key_pem,
    public_key_pem: legacyData.public_key_pem || '',
    jwt_token: legacyData.jwt_token,
    display_name: legacyData.name,
    handle: legacyData.handle,
    name: credentialName,
    did_document: legacyData.did_document,
    e2ee_signing_private_pem: legacyData.e2ee_signing_private_pem,
    e2ee_agreement_private_pem: legacyData.e2ee_agreement_private_pem
  });

  const legacyE2eePath = legacy_e2ee_state_path(credentialName);
  if (fs.existsSync(legacyE2eePath)) {
    save_e2ee_state(JSON.parse(fs.readFileSync(legacyE2eePath, 'utf-8')), credentialName);
  }

  const backupDir = _backupLegacyFiles(credentialName, runId);
  const resolvedPaths = resolve_credential_paths(credentialName);
  
  return {
    credential_name: credentialName,
    did: did,
    dir_name: resolvedPaths ? resolvedPaths.dir_name : null,
    backup_dir: backupDir
  };
}

/**
 * Migrate legacy flat-file credentials into the new indexed layout
 * @param {string|null} credentialName - Credential name (optional)
 * @returns {Object} Migration result
 */
function migrate_legacy_credentials(credentialName = null) {
  const scanResult = scan_legacy_layout();
  let legacyCredentials = scanResult.legacy_credentials;
  
  if (credentialName !== null) {
    legacyCredentials = legacyCredentials.filter(name => name === credentialName);
  }

  if (legacyCredentials.length === 0) {
    return {
      status: 'not_needed',
      legacy_credentials: legacyCredentials,
      unique_dids: scanResult.unique_dids,
      unique_did_count: scanResult.unique_did_count,
      migrated: [],
      skipped: [],
      conflicts: [],
      errors: [],
      invalid_json_files: scanResult.invalid_json_files,
      orphan_e2ee_files: scanResult.orphan_e2ee_files
    };
  }

  const runId = new Date().toISOString().slice(0, -5).replace(/[:.]/g, '-').replace('T', 'T') + 'Z';
  const migrated = [];
  const skipped = [];
  const conflicts = [];
  const errors = [];

  for (const legacyName of legacyCredentials) {
    try {
      const existingEntry = get_index_entry(legacyName);
      const legacyPath = legacy_identity_path(legacyName);
      
      if (existingEntry !== null && !fs.existsSync(legacyPath)) {
        skipped.push({
          credential_name: legacyName,
          reason: 'already_migrated'
        });
        continue;
      }

      migrated.push(_migrateSingleCredential(legacyName, runId));
    } catch (exc) {
      if (exc.message.includes('conflict') || exc.message.includes('Conflict')) {
        conflicts.push({
          credential_name: legacyName,
          reason: exc.message
        });
      } else {
        errors.push({
          credential_name: legacyName,
          reason: exc.message
        });
      }
    }
  }

  let status;
  if (conflicts.length > 0 || errors.length > 0) {
    status = migrated.length > 0 ? 'partial' : 'error';
  } else {
    status = 'migrated';
  }

  return {
    status: status,
    legacy_credentials: legacyCredentials,
    unique_dids: scanResult.unique_dids,
    unique_did_count: scanResult.unique_did_count,
    migrated: migrated,
    skipped: skipped,
    conflicts: conflicts,
    errors: errors,
    invalid_json_files: scanResult.invalid_json_files,
    orphan_e2ee_files: scanResult.orphan_e2ee_files
  };
}

/**
 * Ensure the credential storage layout is ready for runtime use
 * @param {string|null} credentialName - Credential name (optional)
 * @returns {Object} Credential storage status
 */
function ensure_credential_storage_ready(credentialName = null) {
  const detection = detect_legacy_layout();
  
  if (detection.status === 'new') {
    return {
      status: 'ready',
      layout: 'new',
      credential_ready: true,
      migration: null
    };
  }

  const migration = migrate_legacy_credentials(credentialName);
  const targetInLegacy = credentialName !== null && detection.legacy_credentials.includes(credentialName);
  const credentialReady = !targetInLegacy || get_index_entry(credentialName) !== null;
  
  return {
    status: migration.status,
    layout: !has_legacy_layout() ? 'new' : 'legacy_remaining',
    credential_ready: credentialReady,
    migration: migration
  };
}

module.exports = {
  detect_legacy_layout,
  migrate_legacy_credentials,
  ensure_credential_storage_ready
};
