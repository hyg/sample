/**
 * Credential storage layout helpers for multi-credential support.
 *
 * Compatible with Python's credential_layout.py.
 *
 * [INPUT]: SDKConfig (credentials_dir), credential metadata, credential names
 * [OUTPUT]: CredentialPaths, index/legacy path helpers, validated legacy-layout
 *           detection helpers
 * [POS]: Shared storage layout module used by credential_store, e2ee_store, and
 *        credential migration logic to manage indexed per-credential directories
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, chmodSync } from 'fs';
import { join } from 'path';
import { createSDKConfig } from './config.js';

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
 * Resolved paths for a single credential directory.
 */
export class CredentialPaths {
    constructor(
        rootDir,
        dirName,
        credentialDir,
        identityPath,
        authPath,
        didDocumentPath,
        key1PrivatePath,
        key1PublicPath,
        e2eeSigningPrivatePath,
        e2eeAgreementPrivatePath,
        e2eeStatePath
    ) {
        this.rootDir = rootDir;
        this.dirName = dirName;
        this.credentialDir = credentialDir;
        this.identityPath = identityPath;
        this.authPath = authPath;
        this.didDocumentPath = didDocumentPath;
        this.key1PrivatePath = key1PrivatePath;
        this.key1PublicPath = key1PublicPath;
        this.e2eeSigningPrivatePath = e2eeSigningPrivatePath;
        this.e2eeAgreementPrivatePath = e2eeAgreementPrivatePath;
        this.e2eeStatePath = e2eeStatePath;
    }
}

/**
 * Return the credential storage root directory.
 * @param {Object} config - SDKConfig instance
 * @returns {string} Credential storage root directory
 */
function _getCredentialsRoot(config = null) {
    const resolvedConfig = config || createSDKConfig();
    return resolvedConfig.credentials_dir;
}

/**
 * Create the credential storage root directory with secure permissions.
 * @param {Object} config - SDKConfig instance
 * @returns {string} Credential storage root directory
 */
export function ensureCredentialsRoot(config = null) {
    const rootDir = _getCredentialsRoot(config);
    if (!existsSync(rootDir)) {
        mkdirSync(rootDir, { recursive: true, mode: 0o700 });
    }
    return rootDir;
}

/**
 * Return the credential index file path.
 * @param {Object} config - SDKConfig instance
 * @returns {string} Index file path
 */
export function indexPath(config = null) {
    return join(ensureCredentialsRoot(config), INDEX_FILE_NAME);
}

/**
 * Return the legacy backup directory path.
 * @param {Object} config - SDKConfig instance
 * @returns {string} Legacy backup root path
 */
export function legacyBackupRoot(config = null) {
    return join(ensureCredentialsRoot(config), LEGACY_BACKUP_DIR_NAME);
}

/**
 * Return an empty credential index payload.
 * @returns {Object} Empty index
 */
function _defaultIndex() {
    return {
        schema_version: INDEX_SCHEMA_VERSION,
        default_credential_name: null,
        credentials: {}
    };
}

/**
 * Normalize older index payloads into the current schema shape.
 * @param {Object} data - Index data
 * @returns {Object} Normalized index
 */
function _normalizeIndexPayload(data) {
    const credentials = data.credentials || {};
    if (typeof credentials !== 'object') {
        throw new Error("Credential index 'credentials' must be a dict");
    }

    let defaultCredentialName = data.default_credential_name || null;
    if (defaultCredentialName === null && 'default' in credentials) {
        defaultCredentialName = 'default';
    }

    const normalizedCredentials = {};
    for (const [credentialName, entry] of Object.entries(credentials)) {
        if (typeof entry !== 'object') {
            throw new Error(`Credential index entry must be a dict: ${credentialName}`);
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
 * Load the credential index, or return an empty default index.
 * @param {Object} config - SDKConfig instance
 * @returns {Object} Credential index
 */
export function loadIndex(config = null) {
    const path = indexPath(config);
    if (!existsSync(path)) {
        return _defaultIndex();
    }

    const data = JSON.parse(readFileSync(path, 'utf-8'));
    const schemaVersion = data.schema_version;
    if (schemaVersion !== 2 && schemaVersion !== 3) {
        throw new Error(`Unsupported credential index schema: ${schemaVersion}`);
    }
    return _normalizeIndexPayload(data);
}

/**
 * Persist the credential index with secure permissions.
 * @param {Object} index - Index data
 * @param {Object} config - SDKConfig instance
 * @returns {string} Index file path
 */
export function saveIndex(index, config = null) {
    const payload = _normalizeIndexPayload({ ...index });
    const path = indexPath(config);
    writeFileSync(path, JSON.stringify(payload, null, 2), { encoding: 'utf-8', mode: 0o600 });
    return path;
}

/**
 * Return the index entry for a credential name.
 * @param {string} credentialName - Credential name
 * @param {Object} config - SDKConfig instance
 * @returns {Object|null} Index entry or null
 */
export function getCredentialEntry(credentialName, config = null) {
    const index = loadIndex(config);
    return index.credentials[credentialName] || null;
}

/**
 * Upsert a credential index entry.
 * @param {string} credentialName - Credential name
 * @param {Object} entry - Index entry
 * @param {Object} config - SDKConfig instance
 * @returns {string} Index file path
 */
export function setCredentialEntry(credentialName, entry, config = null) {
    const index = loadIndex(config);
    index.credentials[credentialName] = { ...entry };
    
    if (entry.is_default) {
        index.default_credential_name = credentialName;
    } else if (index.default_credential_name === credentialName) {
        index.default_credential_name = null;
    }
    
    return saveIndex(index, config);
}

/**
 * Remove a credential index entry if it exists.
 * @param {string} credentialName - Credential name
 * @param {Object} config - SDKConfig instance
 * @returns {boolean} True if removed
 */
export function removeCredentialEntry(credentialName, config = null) {
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
 * Convert a preferred directory label into a safe filesystem name.
 * @param {string} rawValue - Raw value
 * @returns {string} Sanitized name
 */
export function sanitizeCredentialDirName(rawValue) {
    const sanitized = rawValue.replace(SAFE_PATH_COMPONENT, '_').trim('._-');
    if (!sanitized) {
        throw new Error(`Unable to derive a safe credential directory name from: ${rawValue}`);
    }
    return sanitized;
}

/**
 * Select the preferred credential directory name.
 * 
 * The credential directory name is always derived from the DID unique_id so
 * it remains stable even if the Handle changes or is removed later.
 * 
 * @param {Object} options - Options
 * @param {string|null} options.handle - Handle
 * @param {string} options.uniqueId - Unique ID
 * @returns {string} Directory name
 */
export function preferredCredentialDirName({ handle, uniqueId }) {
    if (!uniqueId) {
        throw new Error("Credential directory name requires unique_id");
    }
    return sanitizeCredentialDirName(uniqueId);
}

/**
 * Build all storage paths for a credential directory name.
 * @param {string} dirName - Directory name
 * @param {Object} config - SDKConfig instance
 * @returns {CredentialPaths} Credential paths
 */
export function buildCredentialPaths(dirName, config = null) {
    const rootDir = ensureCredentialsRoot(config);
    const credentialDir = join(rootDir, dirName);
    
    return new CredentialPaths(
        rootDir,
        dirName,
        credentialDir,
        join(credentialDir, IDENTITY_FILE_NAME),
        join(credentialDir, AUTH_FILE_NAME),
        join(credentialDir, DID_DOCUMENT_FILE_NAME),
        join(credentialDir, KEY1_PRIVATE_FILE_NAME),
        join(credentialDir, KEY1_PUBLIC_FILE_NAME),
        join(credentialDir, E2EE_SIGNING_PRIVATE_FILE_NAME),
        join(credentialDir, E2EE_AGREEMENT_PRIVATE_FILE_NAME),
        join(credentialDir, E2EE_STATE_FILE_NAME)
    );
}

/**
 * Resolve credential paths from the top-level index.
 * @param {string} credentialName - Credential name
 * @param {Object} config - SDKConfig instance
 * @returns {CredentialPaths|null} Credential paths or null
 */
export function resolveCredentialPaths(credentialName, config = null) {
    const entry = getCredentialEntry(credentialName, config);
    if (entry === null) {
        return null;
    }
    return buildCredentialPaths(entry.dir_name, config);
}

/**
 * Create a credential directory with secure permissions.
 * @param {CredentialPaths} paths - Credential paths
 * @returns {string} Credential directory path
 */
export function ensureCredentialDirectory(paths) {
    if (!existsSync(paths.credentialDir)) {
        mkdirSync(paths.credentialDir, { recursive: true, mode: 0o700 });
    }
    return paths.credentialDir;
}

/**
 * Write a text file with 0o600 permissions.
 * @param {string} path - File path
 * @param {string} content - Content
 */
export function writeSecureText(path, content) {
    writeFileSync(path, content, { encoding: 'utf-8', mode: 0o600 });
}

/**
 * Write JSON with 0o600 permissions.
 * @param {string} path - File path
 * @param {Object} payload - JSON payload
 */
export function writeSecureJson(path, payload) {
    writeSecureText(path, JSON.stringify(payload, null, 2));
}

/**
 * Write a binary file with 0o600 permissions.
 * @param {string} path - File path
 * @param {Buffer} content - Content
 */
export function writeSecureBytes(path, content) {
    writeFileSync(path, content, { mode: 0o600 });
}

/**
 * Return the legacy credential JSON path.
 * @param {string} credentialName - Credential name
 * @param {Object} config - SDKConfig instance
 * @returns {string} Legacy identity path
 */
export function legacyIdentityPath(credentialName, config = null) {
    return join(ensureCredentialsRoot(config), `${credentialName}.json`);
}

/**
 * Return the legacy E2EE state JSON path.
 * @param {string} credentialName - Credential name
 * @param {Object} config - SDKConfig instance
 * @returns {string} Legacy E2EE state path
 */
export function legacyE2eeStatePath(credentialName, config = null) {
    return join(ensureCredentialsRoot(config), `${LEGACY_E2EE_PREFIX}${credentialName}.json`);
}

/**
 * Return the legacy extracted DID document/private key paths.
 * @param {string} credentialName - Credential name
 * @param {Object} config - SDKConfig instance
 * @returns {[string, string]} DID document and private key paths
 */
export function legacyAuthExportPaths(credentialName, config = null) {
    const rootDir = ensureCredentialsRoot(config);
    return [
        join(rootDir, `${credentialName}_did_document.json`),
        join(rootDir, `${credentialName}_private_key.pem`)
    ];
}

/**
 * Return whether a JSON payload matches the legacy credential shape.
 * @param {any} payload - Payload
 * @returns {boolean} True if legacy format
 */
export function isLegacyIdentityPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return false;
    }
    return 'did' in payload && 'private_key_pem' in payload;
}

/**
 * Scan the root credential directory for legacy flat-file artifacts.
 * 
 * A file counts as a migratable legacy credential only when its JSON payload
 * matches the expected credential shape (at minimum: ``did`` and
 * ``private_key_pem``). Standalone ``e2ee_<name>.json`` files are reported as
 * orphan E2EE files unless a valid ``<name>.json`` credential exists.
 * 
 * @param {Object} config - SDKConfig instance
 * @returns {Object} Scan results
 */
export function scanLegacyLayout(config = null) {
    const rootDir = ensureCredentialsRoot(config);
    const validCredentials = {};
    const invalidJsonFiles = [];
    const e2eeCandidates = {};

    const files = readdirSync(rootDir);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort();

    for (const file of jsonFiles) {
        const filePath = path.join(rootDir, file);
        if (file === INDEX_FILE_NAME) {
            continue;
        }
        if (file.endsWith('_did_document.json')) {
            continue;
        }
        if (file.startsWith(LEGACY_E2EE_PREFIX)) {
            const credentialName = file.slice(LEGACY_E2EE_PREFIX.length, -5); // Remove prefix and .json
            e2eeCandidates[credentialName] = filePath;
            continue;
        }

        try {
            const content = readFileSync(filePath, 'utf-8');
            const payload = JSON.parse(content);
            if (!isLegacyIdentityPayload(payload)) {
                invalidJsonFiles.push({
                    file: file,
                    reason: "not_a_legacy_credential_payload"
                });
                continue;
            }
            const credentialName = file.replace(/\.json$/, '');
            validCredentials[credentialName] = {
                credential_name: credentialName,
                path: filePath,
                did: payload.did,
                unique_id: payload.unique_id || payload.did.split(':').pop(),
                handle: payload.handle
            };
        } catch (exc) {
            invalidJsonFiles.push({
                file: file,
                reason: `invalid_json: ${exc.message}`
            });
        }
    }

    const orphanE2eeFiles = [];
    for (const [credentialName, filePath] of Object.entries(e2eeCandidates)) {
        if (!(credentialName in validCredentials)) {
            orphanE2eeFiles.push({
                credential_name: credentialName,
                file: path.basename(filePath)
            });
        }
    }

    const uniqueDids = [...new Set(
        Object.values(validCredentials)
            .filter(entry => entry.did)
            .map(entry => entry.did)
    )].sort();

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
 * Check if legacy flat JSON files exist.
 * @param {Object} config - SDKConfig instance
 * @returns {boolean} True if legacy layout detected
 */
export function hasLegacyLayout(config = null) {
    const scanResult = scanLegacyLayout(config);
    return scanResult.legacy_credentials.length > 0 ||
           scanResult.invalid_json_files.length > 0 ||
           scanResult.orphan_e2ee_files.length > 0;
}

/**
 * Return the legacy layout hint message.
 * @returns {string} Hint message
 */
export function legacyLayoutHint() {
    return LEGACY_LAYOUT_HINT;
}

/**
 * List validated legacy credential names still using the flat-file layout.
 * @param {Object} config - SDKConfig instance
 * @returns {string[]} List of legacy credential names
 */
export function listLegacyCredentialNames(config = null) {
    return scanLegacyLayout(config).legacy_credentials;
}

/**
 * Read JSON content when the path exists.
 * @param {string} path - File path
 * @returns {Object|null} JSON content or null
 */
export function readJsonIfExists(path) {
    if (!existsSync(path)) {
        return null;
    }
    return JSON.parse(readFileSync(path, 'utf-8'));
}

/**
 * Read text content when the path exists.
 * @param {string} path - File path
 * @returns {string|null} Text content or null
 */
export function readTextIfExists(path) {
    if (!existsSync(path)) {
        return null;
    }
    return readFileSync(path, 'utf-8');
}

export {
    INDEX_FILE_NAME
};

export default {
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
    CredentialPaths,
    ensureCredentialsRoot,
    indexPath,
    legacyBackupRoot,
    loadIndex,
    saveIndex,
    getCredentialEntry,
    setCredentialEntry,
    removeCredentialEntry,
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
    isLegacyIdentityPayload,
    scanLegacyLayout,
    hasLegacyLayout,
    legacyLayoutHint,
    listLegacyCredentialNames,
    readJsonIfExists,
    readTextIfExists
};
