/**
 * Credential storage layout helpers for multi-credential support.
 *
 * Node.js implementation based on Python version:
 * python/scripts/credential_layout.py
 *
 * [INPUT]: SDKConfig (credentials_dir), credential metadata, credential names
 * [OUTPUT]: CredentialPaths, index/legacy path helpers, validated legacy-layout
 *           detection helpers
 * [POS]: Shared storage layout module used by credential_store, e2ee_store, and
 *        credential migration logic to manage indexed per-credential directories
 */

const fs = require('fs');
const path = require('path');
const { SDKConfig } = require('./utils/config');

// Constants
const INDEX_SCHEMA_VERSION = 3;
const INDEX_FILE_NAME = 'index.json';
const LEGACY_BACKUP_DIR_NAME = '.legacy-backup';
const IDENTITY_FILE_NAME = 'identity.json';
const AUTH_FILE_NAME = 'auth.json';
const DID_DOCUMENT_FILE_NAME = 'did_document.json';
const KEY1_PRIVATE_FILE_NAME = 'key-1-private.pem';
const KEY1_PUBLIC_FILE_NAME = 'key-1-public.pem';
const E2EE_SIGNING_PRIVATE_FILE_NAME = 'e2ee-signing-private.pem';
const E2EE_AGREEMENT_PRIVATE_FILE_NAME = 'e2ee-agreement-private.pem';
const E2EE_STATE_FILE_NAME = 'e2ee-state.json';

const SAFE_PATH_COMPONENT = /[^A-Za-z0-9._-]+/g;
const LEGACY_E2EE_PREFIX = 'e2ee_';

const LEGACY_LAYOUT_HINT = (
  "Legacy credential layout detected. Run " +
  "'node scripts/check_status.js' once to migrate credentials."
);

/**
 * CredentialPaths - Resolved paths for a single credential directory
 *
 * @typedef {Object} CredentialPaths
 * @property {string} root_dir - Root directory
 * @property {string} dir_name - Directory name
 * @property {string} credential_dir - Credential directory path
 * @property {string} identity_path - identity.json path
 * @property {string} auth_path - auth.json path
 * @property {string} did_document_path - did_document.json path
 * @property {string} key1_private_path - key-1-private.pem path
 * @property {string} key1_public_path - key-1-public.pem path
 * @property {string} e2ee_signing_private_path - e2ee-signing-private.pem path
 * @property {string} e2ee_agreement_private_path - e2ee-agreement-private.pem path
 * @property {string} e2ee_state_path - e2ee-state.json path
 */

/**
 * Get the credentials root directory
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {string} Root directory path
 */
function _getCredentialsRoot(config) {
  const resolvedConfig = config || SDKConfig.load();
  return resolvedConfig.credentials_dir;
}

/**
 * Create the credential storage root directory with secure permissions
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {string} Root directory path
 */
function ensureCredentialsRoot(config) {
  const rootDir = _getCredentialsRoot(config);
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true, mode: 0o700 });
  }
  fs.chmodSync(rootDir, 0o700);
  return rootDir;
}

/**
 * Return the credential index file path
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {string} Index file path
 */
function indexPath(config) {
  return path.join(ensureCredentialsRoot(config), INDEX_FILE_NAME);
}

/**
 * Return the legacy backup directory path
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {string} Legacy backup directory path
 */
function legacyBackupRoot(config) {
  return path.join(ensureCredentialsRoot(config), LEGACY_BACKUP_DIR_NAME);
}

/**
 * Return an empty credential index payload
 * @returns {Object} Empty index payload
 */
function _defaultIndex() {
  return {
    schema_version: INDEX_SCHEMA_VERSION,
    default_credential_name: null,
    credentials: {}
  };
}

/**
 * Normalize older index payloads into the current schema shape
 * @param {Object} data - Index data to normalize
 * @returns {Object} Normalized index data
 */
function _normalizeIndexPayload(data) {
  const credentials = data.credentials;
  if (typeof credentials !== 'object' || credentials === null) {
    throw new Error("Credential index 'credentials' must be an object");
  }

  let defaultCredentialName = data.default_credential_name;
  if (defaultCredentialName === null && 'default' in credentials) {
    defaultCredentialName = 'default';
  }

  const normalizedCredentials = {};
  for (const [credentialName, entry] of Object.entries(credentials)) {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Credential index entry must be an object: ${credentialName}`);
    }
    const normalizedEntry = { ...entry };
    normalizedEntry.credential_name = credentialName;
    normalizedEntry.is_default = credentialName === defaultCredentialName;
    normalizedCredentials[credentialName] = normalizedEntry;
  }

  return {
    schema_version: INDEX_SCHEMA_VERSION,
    default_credential_name: defaultCredentialName,
    credentials: normalizedCredentials
  };
}

/**
 * Load the credential index, or return an empty default index
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {Object} Index data
 */
function loadIndex(config) {
  const pathToFile = indexPath(config);
  if (!fs.existsSync(pathToFile)) {
    return _defaultIndex();
  }

  const data = JSON.parse(fs.readFileSync(pathToFile, 'utf-8'));
  const schemaVersion = data.schema_version;
  if (schemaVersion !== 2 && schemaVersion !== 3) {
    throw new Error(`Unsupported credential index schema: ${schemaVersion}`);
  }
  return _normalizeIndexPayload(data);
}

/**
 * Persist the credential index with secure permissions
 * @param {Object} index - Index data to save
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {string} Path to saved index file
 */
function saveIndex(index, config) {
  const payload = _normalizeIndexPayload({ ...index });
  const pathToFile = indexPath(config);
  fs.writeFileSync(
    pathToFile,
    JSON.stringify(payload, null, 2),
    { encoding: 'utf-8', mode: 0o600 }
  );
  return pathToFile;
}

/**
 * Return the index entry for a credential name
 * @param {string} credentialName - Credential name
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {Object|null} Index entry or null
 */
function getIndexEntry(credentialName, config) {
  const index = loadIndex(config);
  let entry = index.credentials[credentialName];
  
  if (entry === undefined && credentialName === 'default') {
    const fallbackName = index.default_credential_name;
    if (fallbackName && fallbackName !== 'default') {
      entry = index.credentials[fallbackName];
    }
  }
  return entry || null;
}

/**
 * Upsert a credential index entry
 * @param {string} credentialName - Credential name
 * @param {Object} entry - Entry data
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {string} Path to saved index file
 */
function setIndexEntry(credentialName, entry, config) {
  const index = loadIndex(config);
  index.credentials[credentialName] = entry;
  
  if (entry.is_default) {
    index.default_credential_name = credentialName;
  } else if (index.default_credential_name === credentialName) {
    index.default_credential_name = null;
  }
  
  return saveIndex(index, config);
}

/**
 * Remove a credential index entry if it exists
 * @param {string} credentialName - Credential name
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {boolean} True if removed
 */
function removeIndexEntry(credentialName, config) {
  const index = loadIndex(config);
  if (!(credentialName in index.credentials)) {
    return false;
  }
  delete index.credentials[credentialName];
  if (index.default_credential_name === credentialName) {
    index.default_credential_name = null;
  }
  saveIndex(index, config);
  return true;
}

/**
 * Convert a preferred directory label into a safe filesystem name
 * @param {string} rawValue - Raw value to sanitize
 * @returns {string} Sanitized name
 */
function sanitizeCredentialDirName(rawValue) {
  const sanitized = rawValue.replace(SAFE_PATH_COMPONENT, '_').replace(/^[_.-]+|[_.-]+$/g, '');
  if (!sanitized) {
    throw new Error(`Unable to derive a safe credential directory name from: ${rawValue}`);
  }
  return sanitized;
}

/**
 * Select the preferred credential directory name
 * @param {Object} options - Options
 * @param {string|null} [options.handle] - Handle
 * @param {string} options.unique_id - Unique ID
 * @returns {string} Credential directory name
 */
function preferredCredentialDirName({ handle, unique_id }) {
  if (!unique_id) {
    throw new Error("Credential directory name requires unique_id");
  }
  return sanitizeCredentialDirName(unique_id);
}

/**
 * Build all storage paths for a credential directory name
 * @param {string} dirName - Directory name
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {CredentialPaths} Credential paths object
 */
function buildCredentialPaths(dirName, config) {
  const rootDir = ensureCredentialsRoot(config);
  const credentialDir = path.join(rootDir, dirName);
  
  return {
    root_dir: rootDir,
    dir_name: dirName,
    credential_dir: credentialDir,
    identity_path: path.join(credentialDir, IDENTITY_FILE_NAME),
    auth_path: path.join(credentialDir, AUTH_FILE_NAME),
    did_document_path: path.join(credentialDir, DID_DOCUMENT_FILE_NAME),
    key1_private_path: path.join(credentialDir, KEY1_PRIVATE_FILE_NAME),
    key1_public_path: path.join(credentialDir, KEY1_PUBLIC_FILE_NAME),
    e2ee_signing_private_path: path.join(credentialDir, E2EE_SIGNING_PRIVATE_FILE_NAME),
    e2ee_agreement_private_path: path.join(credentialDir, E2EE_AGREEMENT_PRIVATE_FILE_NAME),
    e2ee_state_path: path.join(credentialDir, E2EE_STATE_FILE_NAME)
  };
}

/**
 * Resolve credential paths from the top-level index
 * @param {string} credentialName - Credential name
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {CredentialPaths|null} Credential paths or null
 */
function resolveCredentialPaths(credentialName, config) {
  const entry = getIndexEntry(credentialName, config);
  if (entry === null) {
    return null;
  }
  return buildCredentialPaths(entry.dir_name, config);
}

/**
 * Create a credential directory with secure permissions
 * @param {CredentialPaths} paths - Credential paths
 * @returns {string} Credential directory path
 */
function ensureCredentialDirectory(paths) {
  const credentialDir = paths.credential_dir;
  if (!fs.existsSync(credentialDir)) {
    fs.mkdirSync(credentialDir, { recursive: true, mode: 0o700 });
  }
  fs.chmodSync(credentialDir, 0o700);
  return credentialDir;
}

/**
 * Write a text file with 600 permissions
 * @param {string} filePath - File path
 * @param {string} content - Content to write
 */
function writeSecureText(filePath, content) {
  fs.writeFileSync(filePath, content, { encoding: 'utf-8', mode: 0o600 });
}

/**
 * Write JSON with 600 permissions
 * @param {string} filePath - File path
 * @param {Object} payload - JSON payload
 */
function writeSecureJson(filePath, payload) {
  writeSecureText(filePath, JSON.stringify(payload, null, 2));
}

/**
 * Write a binary file with 600 permissions
 * @param {string} filePath - File path
 * @param {Buffer} content - Content to write
 */
function writeSecureBytes(filePath, content) {
  fs.writeFileSync(filePath, content, { mode: 0o600 });
}

/**
 * Return the legacy credential JSON path
 * @param {string} credentialName - Credential name
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {string} Legacy identity path
 */
function legacyIdentityPath(credentialName, config) {
  return path.join(ensureCredentialsRoot(config), `${credentialName}.json`);
}

/**
 * Return the legacy E2EE state JSON path
 * @param {string} credentialName - Credential name
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {string} Legacy E2EE state path
 */
function legacyE2eeStatePath(credentialName, config) {
  return path.join(ensureCredentialsRoot(config), `${LEGACY_E2EE_PREFIX}${credentialName}.json`);
}

/**
 * Return the legacy extracted DID document/private key paths
 * @param {string} credentialName - Credential name
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {[string, string]} Tuple of DID document path and private key path
 */
function legacyAuthExportPaths(credentialName, config) {
  const rootDir = ensureCredentialsRoot(config);
  return [
    path.join(rootDir, `${credentialName}_did_document.json`),
    path.join(rootDir, `${credentialName}_private_key.pem`)
  ];
}

/**
 * Return whether a JSON payload matches the legacy credential shape
 * @param {any} payload - Payload to check
 * @returns {boolean} True if legacy identity payload
 */
function _isLegacyIdentityPayload(payload) {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const did = payload.did;
  const privateKeyPem = payload.private_key_pem;
  return typeof did === 'string' && did && typeof privateKeyPem === 'string' && privateKeyPem;
}

/**
 * Scan the root credential directory for legacy flat-file artifacts
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {Object} Scan result
 */
function scanLegacyLayout(config) {
  const rootDir = ensureCredentialsRoot(config);
  const validCredentials = {};
  const invalidJsonFiles = [];
  const e2eeCandidates = {};

  // Get all JSON files in root directory
  let files = [];
  if (fs.existsSync(rootDir)) {
    files = fs.readdirSync(rootDir)
      .filter(f => f.endsWith('.json'))
      .sort();
  }

  for (const fileName of files) {
    if (fileName === INDEX_FILE_NAME) {
      continue;
    }
    if (fileName.endsWith('_did_document.json')) {
      continue;
    }
    if (fileName.startsWith(LEGACY_E2EE_PREFIX)) {
      const credentialName = fileName.slice(LEGACY_E2EE_PREFIX.length, -'.json'.length);
      e2eeCandidates[credentialName] = path.join(rootDir, fileName);
      continue;
    }

    const filePath = path.join(rootDir, fileName);
    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (exc) {
      invalidJsonFiles.push({
        file: fileName,
        reason: `invalid_json: ${exc.message}`
      });
      continue;
    }

    if (!_isLegacyIdentityPayload(payload)) {
      invalidJsonFiles.push({
        file: fileName,
        reason: 'not_a_legacy_credential_payload'
      });
      continue;
    }

    const credentialName = fileName.slice(0, -'.json'.length);
    validCredentials[credentialName] = {
      credential_name: credentialName,
      path: filePath,
      did: payload.did,
      unique_id: payload.unique_id || payload.did.split(':').pop(),
      handle: payload.handle || null
    };
  }

  const orphanE2eeFiles = [];
  for (const [credentialName, filePath] of Object.entries(e2eeCandidates).sort()) {
    if (!(credentialName in validCredentials)) {
      orphanE2eeFiles.push({
        credential_name: credentialName,
        file: path.basename(filePath)
      });
    }
  }

  const uniqueDids = sortedUnique([
    ...new Set(Object.values(validCredentials).map(e => e.did).filter(d => d))
  ]);

  return {
    legacy_credentials: Object.keys(validCredentials).sort(),
    valid_credentials: validCredentials,
    invalid_json_files: invalidJsonFiles,
    orphan_e2ee_files: orphanE2eeFiles,
    unique_dids: uniqueDids,
    unique_did_count: uniqueDids.length
  };
}

/**
 * Sort and deduplicate an array
 * @param {Array} arr - Array to process
 * @returns {Array} Sorted unique array
 */
function sortedUnique(arr) {
  return [...new Set(arr)].sort();
}

/**
 * List validated legacy credential names still using the flat-file layout
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {string[]} List of legacy credential names
 */
function listLegacyCredentialNames(config) {
  return scanLegacyLayout(config).legacy_credentials;
}

/**
 * Return whether any legacy flat-file artifacts remain
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {boolean} True if legacy layout exists
 */
function hasLegacyLayout(config) {
  const scanResult = scanLegacyLayout(config);
  return !!(
    scanResult.legacy_credentials.length ||
    scanResult.invalid_json_files.length ||
    scanResult.orphan_e2ee_files.length
  );
}

/**
 * Return the standard legacy-layout migration hint
 * @returns {string} Legacy layout hint
 */
function legacyLayoutHint() {
  return LEGACY_LAYOUT_HINT;
}

module.exports = {
  // Constants
  INDEX_SCHEMA_VERSION,
  INDEX_FILE_NAME,
  LEGACY_BACKUP_DIR_NAME,
  IDENTITY_FILE_NAME,
  AUTH_FILE_NAME,
  DID_DOCUMENT_FILE_NAME,
  KEY1_PRIVATE_FILE_NAME,
  KEY1_PUBLIC_FILE_NAME,
  E2EE_SIGNING_PRIVATE_FILE_NAME,
  E2EE_AGREEMENT_PRIVATE_FILE_NAME,
  E2EE_STATE_FILE_NAME,
  LEGACY_E2EE_PREFIX,
  LEGACY_LAYOUT_HINT,
  
  // Functions
  ensureCredentialsRoot,
  indexPath,
  legacyBackupRoot,
  loadIndex,
  saveIndex,
  getIndexEntry,
  setIndexEntry,
  removeIndexEntry,
  sanitizeCredentialDirName,
  preferredCredentialDirName,
  buildCredentialPaths,
  resolveCredentialPaths,
  ensureCredentialDirectory,
  writeSecureText,
  writeSecureJson,
  writeSecureBytes,
  legacyIdentityPath,
  legacyE2eeStatePath,
  legacyAuthExportPaths,
  scanLegacyLayout,
  listLegacyCredentialNames,
  hasLegacyLayout,
  legacyLayoutHint
};
