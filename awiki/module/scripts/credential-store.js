/**
 * Credential persistence: indexed multi-credential storage with per-credential directories.
 *
 * Node.js implementation based on Python version:
 * python/scripts/credential_store.py
 *
 * [INPUT]: DIDIdentity object, DIDWbaAuthHeader (ANP SDK), SDKConfig (credentials_dir),
 *          credential_layout helpers
 * [OUTPUT]: save_identity(), load_identity(), list_identities(), delete_identity(),
 *           extract_auth_files(), create_authenticator()
 * [POS]: Core credential management module supporting cross-session identity reuse,
 *        indexed multi-credential storage, and DIDWbaAuthHeader factory
 */

const fs = require('fs');
const path = require('path');
const { SDKConfig } = require('./utils/config');
const credentialLayout = require('./credential-layout');

const {
  getIndexEntry,
  hasLegacyLayout,
  legacyLayoutHint,
  listLegacyCredentialNames,
  preferredCredentialDirName,
  removeIndexEntry,
  resolveCredentialPaths,
  setIndexEntry,
  writeSecureJson,
  writeSecureText,
  ensureCredentialDirectory,
  buildCredentialPaths,
  loadIndex
} = credentialLayout;

/**
 * Normalize bytes/str content into a UTF-8 string
 * @param {Buffer|string} value - Value to coerce
 * @returns {string} UTF-8 string
 */
function _coerceText(value) {
  if (Buffer.isBuffer(value)) {
    return value.toString('utf-8');
  }
  return String(value);
}

/**
 * Read JSON content when the path exists
 * @param {string} filePath - File path
 * @returns {Object|null} JSON object or null
 */
function _readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Read text content when the path exists
 * @param {string} filePath - File path
 * @returns {string|null} Text content or null
 */
function _readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Build a normalized credential index entry
 * @param {string} credentialName - Credential name
 * @param {Object} options - Options
 * @param {string} options.dir_name - Directory name
 * @param {string} options.did - DID
 * @param {string} options.unique_id - Unique ID
 * @param {string|null} options.user_id - User ID
 * @param {string|null} options.display_name - Display name
 * @param {string|null} options.handle - Handle
 * @param {string} options.created_at - Created at timestamp
 * @returns {Object} Index entry
 */
function _buildIndexEntry(
  credentialName,
  { dir_name, did, unique_id, user_id, display_name, handle, created_at }
) {
  return {
    credential_name: credentialName,
    dir_name: dir_name,
    did: did,
    unique_id: unique_id,
    user_id: user_id,
    name: display_name,
    handle: handle,
    created_at: created_at,
    is_default: credentialName === 'default'
  };
}

/**
 * Ensure the target directory name is not already owned by another credential
 * @param {string} credentialName - Credential name
 * @param {Object} options - Options
 * @param {string} options.dir_name - Directory name
 * @param {string} options.did - DID
 */
function _validateTargetDirectory(credentialName, { dir_name, did }) {
  const indexCredentials = {};
  const allCredentials = listIdentitiesByName();
  
  for (const [name, entry] of Object.entries(allCredentials)) {
    if (name !== credentialName) {
      indexCredentials[name] = entry;
    }
  }
  
  for (const [existingName, entry] of Object.entries(indexCredentials)) {
    if (entry.dir_name === dir_name) {
      if (entry.did === did) {
        continue;
      }
      throw new Error(
        `Credential directory '${dir_name}' is already used by ` +
        `credential '${existingName}' (${entry.did})`
      );
    }
  }

  const paths = buildCredentialPaths(dir_name);
  if (fs.existsSync(paths.credential_dir) && fs.readdirSync(paths.credential_dir).length > 0) {
    for (const entry of Object.values(indexCredentials)) {
      if (entry.dir_name === dir_name && entry.did === did) {
        return;
      }
    }
    throw new Error(
      `Credential directory '${dir_name}' already exists but is not indexed; ` +
      `refusing to overwrite for DID ${did}`
    );
  }
}

/**
 * Count how many credential names reference the same directory
 * @param {string} dirName - Directory name
 * @returns {number} Reference count
 */
function _credentialReferenceCount(dirName) {
  const allCredentials = listIdentitiesByName();
  let count = 0;
  for (const entry of Object.values(allCredentials)) {
    if (entry.dir_name === dirName) {
      count++;
    }
  }
  return count;
}

/**
 * Return the raw credential index mapping
 * @returns {Object} Credentials indexed by name
 */
function listIdentitiesByName() {
  return loadIndex().credentials;
}

/**
 * Delete a credential directory when it is no longer referenced by the index
 * @param {string} dirName - Directory name
 * @returns {boolean} True if pruned
 */
function pruneUnreferencedCredentialDir(dirName) {
  if (_credentialReferenceCount(dirName) > 0) {
    return false;
  }
  const paths = buildCredentialPaths(dirName);
  if (!fs.existsSync(paths.credential_dir)) {
    return false;
  }
  fs.rmSync(paths.credential_dir, { recursive: true, force: true });
  return true;
}

/**
 * Save a DID identity into the indexed multi-credential layout
 *
 * @param {Object} options - Identity options
 * @param {string} options.did - DID
 * @param {string} options.unique_id - Unique ID
 * @param {string|null} [options.user_id] - User ID
 * @param {Buffer|string} options.private_key_pem - Private key PEM
 * @param {Buffer|string} options.public_key_pem - Public key PEM
 * @param {string|null} [options.jwt_token] - JWT token
 * @param {string|null} [options.display_name] - Display name
 * @param {string|null} [options.handle] - Handle
 * @param {string} [options.name] - Credential name (default: "default")
 * @param {Object|null} [options.did_document] - DID document
 * @param {Buffer|string|null} [options.e2ee_signing_private_pem] - E2EE signing private key
 * @param {Buffer|string|null} [options.e2ee_agreement_private_pem] - E2EE agreement private key
 * @param {boolean} [options.replace_existing] - Replace existing credential
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {string} Path to identity.json
 */
function saveIdentity(
  {
    did,
    unique_id,
    user_id = null,
    private_key_pem,
    public_key_pem,
    jwt_token = null,
    display_name = null,
    handle = null,
    name = 'default',
    did_document = null,
    e2ee_signing_private_pem = null,
    e2ee_agreement_private_pem = null,
    replace_existing = false
  },
  config
) {
  const dirName = preferredCredentialDirName({ handle, unique_id });
  const existingEntry = getIndexEntry(name, config);
  
  if (existingEntry !== null) {
    if (existingEntry.did !== did) {
      if (!replace_existing) {
        throw new Error(
          `Credential '${name}' already exists for DID ${existingEntry.did}; ` +
          `refusing to overwrite with DID ${did}`
        );
      }
      _validateTargetDirectory(name, { dir_name: dirName, did });
    } else {
      dirName = existingEntry.dir_name;
    }
  } else {
    _validateTargetDirectory(name, { dir_name: dirName, did });
  }

  const paths = buildCredentialPaths(dirName, config);
  ensureCredentialDirectory(paths);

  const existingIdentity = _readJsonIfExists(paths.identity_path) || {};
  const createdAt = existingIdentity.created_at || new Date().toISOString();

  const identityPayload = {
    did: did,
    unique_id: unique_id,
    created_at: createdAt
  };
  
  if (user_id !== null) {
    identityPayload.user_id = user_id;
  }
  if (display_name !== null) {
    identityPayload.name = display_name;
  }
  if (handle !== null) {
    identityPayload.handle = handle;
  }

  writeSecureJson(paths.identity_path, identityPayload);
  writeSecureJson(paths.auth_path, { jwt_token: jwt_token });
  if (did_document !== null) {
    writeSecureJson(paths.did_document_path, did_document);
  }

  writeSecureText(paths.key1_private_path, _coerceText(private_key_pem));
  writeSecureText(paths.key1_public_path, _coerceText(public_key_pem));
  if (e2ee_signing_private_pem !== null) {
    writeSecureText(paths.e2ee_signing_private_path, _coerceText(e2ee_signing_private_pem));
  }
  if (e2ee_agreement_private_pem !== null) {
    writeSecureText(paths.e2ee_agreement_private_path, _coerceText(e2ee_agreement_private_pem));
  }

  const indexEntry = _buildIndexEntry(
    name,
    {
      dir_name: dirName,
      did: did,
      unique_id: unique_id,
      user_id: user_id,
      display_name: display_name,
      handle: handle,
      created_at: createdAt
    }
  );
  setIndexEntry(name, indexEntry, config);
  
  return paths.identity_path;
}

/**
 * Load a DID identity from the indexed multi-credential layout
 *
 * @param {string} [name] - Credential name (default: "default")
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {Object|null} Identity data or null
 */
function loadIdentity(name = 'default', config) {
  const paths = resolveCredentialPaths(name, config);
  if (paths === null) {
    if (hasLegacyLayout(config)) {
      console.error(legacyLayoutHint());
    }
    return null;
  }

  const identityPayload = _readJsonIfExists(paths.identity_path);
  if (identityPayload === null || !identityPayload.did) {
    return null;
  }

  const authPayload = _readJsonIfExists(paths.auth_path) || {};
  const data = {
    did: identityPayload.did,
    unique_id: identityPayload.unique_id || '',
    user_id: identityPayload.user_id || null,
    created_at: identityPayload.created_at || null
  };
  
  if ('name' in identityPayload) {
    data.name = identityPayload.name;
  }
  if ('handle' in identityPayload) {
    data.handle = identityPayload.handle;
  }

  const jwtToken = authPayload.jwt_token;
  if (jwtToken !== undefined && jwtToken !== null) {
    data.jwt_token = jwtToken;
  }

  const didDocument = _readJsonIfExists(paths.did_document_path);
  if (didDocument !== null) {
    data.did_document = didDocument;
  }

  const privateKeyPem = _readTextIfExists(paths.key1_private_path);
  if (privateKeyPem !== null) {
    data.private_key_pem = privateKeyPem;
  }

  const publicKeyPem = _readTextIfExists(paths.key1_public_path);
  if (publicKeyPem !== null) {
    data.public_key_pem = publicKeyPem;
  }

  const e2eeSigningPrivatePem = _readTextIfExists(paths.e2ee_signing_private_path);
  if (e2eeSigningPrivatePem !== null) {
    data.e2ee_signing_private_pem = e2eeSigningPrivatePem;
  }

  const e2eeAgreementPrivatePem = _readTextIfExists(paths.e2ee_agreement_private_path);
  if (e2eeAgreementPrivatePem !== null) {
    data.e2ee_agreement_private_pem = e2eeAgreementPrivatePem;
  }

  return data;
}

/**
 * List all saved identities from the credential index
 *
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {Array} List of identity summaries
 */
function listIdentities(config) {
  if (hasLegacyLayout(config) && Object.keys(listIdentitiesByName()).length === 0) {
    console.error(legacyLayoutHint());
    return [];
  }

  const identities = [];
  const allCredentials = listIdentitiesByName();
  
  const sortedNames = Object.keys(allCredentials).sort();
  for (const credentialName of sortedNames) {
    const entry = allCredentials[credentialName];
    const paths = resolveCredentialPaths(credentialName, config);
    
    identities.push({
      credential_name: credentialName,
      did: entry.did || '',
      unique_id: entry.unique_id || '',
      name: entry.name || '',
      handle: entry.handle || '',
      user_id: entry.user_id || '',
      created_at: entry.created_at || '',
      is_default: !!entry.is_default,
      dir_name: entry.dir_name || '',
      has_jwt: paths !== null ? !!((_readJsonIfExists(paths.auth_path) || {}).jwt_token) : false
    });
  }

  return identities;
}

/**
 * Delete a saved identity and its credential directory
 *
 * @param {string} name - Credential name
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {boolean} True if deleted
 */
function deleteIdentity(name, config) {
  const paths = resolveCredentialPaths(name, config);
  if (paths === null) {
    if (hasLegacyLayout(config)) {
      console.error(legacyLayoutHint());
    }
    return false;
  }

  const referenceCount = _credentialReferenceCount(paths.dir_name);
  if (fs.existsSync(paths.credential_dir) && referenceCount <= 1) {
    fs.rmSync(paths.credential_dir, { recursive: true, force: true });
  }
  
  const removed = removeIndexEntry(name, config);
  return removed;
}

/**
 * Backup the current credential directory before destructive changes
 *
 * @param {string} name - Credential name
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {string|null} Backup directory path or null
 */
function backupIdentity(name, config) {
  const paths = resolveCredentialPaths(name, config);
  if (paths === null || !fs.existsSync(paths.credential_dir)) {
    return null;
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '').slice(0, 15) + 'Z';
  const backupRoot = path.join(
    paths.root_dir,
    '.recovery-backup',
    name,
    timestamp
  );
  
  fs.mkdirSync(backupRoot, { recursive: true });
  const backupDir = path.join(backupRoot, paths.dir_name);
  fs.cpSync(paths.credential_dir, backupDir, { recursive: true });

  const indexEntry = getIndexEntry(name, config) || {};
  writeSecureJson(path.join(backupRoot, 'index_entry.json'), indexEntry);
  
  return backupRoot;
}

/**
 * Update the JWT token of a saved identity
 *
 * @param {string} name - Credential name
 * @param {string} jwtToken - JWT token
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {boolean} True if updated
 */
function updateJwt(name, jwtToken, config) {
  const paths = resolveCredentialPaths(name, config);
  if (paths === null) {
    if (hasLegacyLayout(config)) {
      console.error(legacyLayoutHint());
    }
    return false;
  }

  const authPayload = _readJsonIfExists(paths.auth_path) || {};
  authPayload.jwt_token = jwtToken;
  writeSecureJson(paths.auth_path, authPayload);
  
  return true;
}

/**
 * Return credential DID document and key-1 private key paths for auth
 *
 * @param {string} [name] - Credential name (default: "default")
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {[string, string]|null} Tuple of paths or null
 */
function extractAuthFiles(name = 'default', config) {
  const paths = resolveCredentialPaths(name, config);
  if (paths === null) {
    if (hasLegacyLayout(config)) {
      console.error(legacyLayoutHint());
    }
    return null;
  }

  if (!fs.existsSync(paths.did_document_path) || !fs.existsSync(paths.key1_private_path)) {
    return null;
  }

  return [paths.did_document_path, paths.key1_private_path];
}

/**
 * Create a DIDWbaAuthHeader instance from a saved credential
 *
 * @param {string} [name] - Credential name (default: "default")
 * @param {SDKConfig} [config] - SDK configuration
 * @returns {[Object, Object]|null} Tuple of authenticator and identity data, or null
 */
function createAuthenticator(name = 'default', config) {
  // Note: DIDWbaAuthHeader is not yet implemented in Node.js
  // This function is a placeholder for future implementation
  const data = loadIdentity(name, config);
  if (data === null) {
    return null;
  }

  const authFiles = extractAuthFiles(name, config);
  if (authFiles === null) {
    return null;
  }

  const [didDocPath, keyPath] = authFiles;
  
  // Placeholder for DIDWbaAuthHeader
  // In Python: auth = DIDWbaAuthHeader(str(did_doc_path), str(key_path))
  const auth = {
    did_document_path: didDocPath,
    key_path: keyPath,
    update_token: function(url, headers) {
      // Placeholder for token update
    }
  };

  if (data.jwt_token && config !== undefined) {
    const serverUrl = config.user_service_url;
    auth.update_token(serverUrl, { Authorization: `Bearer ${data.jwt_token}` });
    if (config.molt_message_url) {
      auth.update_token(
        config.molt_message_url,
        { Authorization: `Bearer ${data.jwt_token}` }
      );
    }
  }

  return [auth, data];
}

module.exports = {
  // Main functions (camelCase)
  saveIdentity,
  loadIdentity,
  listIdentities,
  deleteIdentity,
  backupIdentity,
  updateJwt,
  extractAuthFiles,
  createAuthenticator,
  pruneUnreferencedCredentialDir,
  
  // Main functions (snake_case aliases for Python compatibility)
  save_identity: saveIdentity,
  load_identity: loadIdentity,
  list_identities: listIdentities,
  delete_identity: deleteIdentity,
  backup_identity: backupIdentity,
  update_jwt: updateJwt,
  extract_auth_files: extractAuthFiles,
  create_authenticator: createAuthenticator,
  prune_unreferenced_credential_dir: pruneUnreferencedCredentialDir,
  
  // Internal helpers (exported for testing)
  listIdentitiesByName,
  list_identities_by_name: listIdentitiesByName,
  _coerceText,
  _readJsonIfExists,
  _readTextIfExists,
  _buildIndexEntry,
  _validateTargetDirectory,
  _credentialReferenceCount,
  
  // Re-export credential_layout for compatibility with test file
  getCredentialDir: (config, credentialName) => {
    const resolved = config || SDKConfig.load();
    return path.join(resolved.credentials_dir, credentialName);
  }
};
