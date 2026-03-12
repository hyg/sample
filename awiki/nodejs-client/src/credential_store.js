/**
 * Credential persistence: save/load private keys, DID, JWT to local files.
 *
 * Compatible with Python's credential_store.py.
 * Uses the same file structure and naming conventions.
 *
 * @module credential_store
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createSDKConfig } from './utils/config.js';

// File name constants (matching Python version)
const FILE_NAMES = {
    INDEX: 'index.json',
    IDENTITY: 'identity.json',
    AUTH: 'auth.json',
    DID_DOCUMENT: 'did_document.json',
    KEY1_PRIVATE: 'key-1-private.pem',
    KEY1_PUBLIC: 'key-1-public.pem',
    E2EE_SIGNING_PRIVATE: 'e2ee-signing-private.pem',
    E2EE_AGREEMENT_PRIVATE: 'e2ee-agreement-private.pem',
    E2EE_STATE: 'e2ee-state.json'
};

// Index schema version (matching Python version)
const INDEX_SCHEMA_VERSION = 3;

/**
 * Check if running in development/debug mode.
 * In debug mode, uses local .credentials directory.
 * In production mode, uses system credential directory (same as Python).
 * @returns {boolean} True if in debug mode
 */
export function isDebugMode() {
    return process.env.NODE_AWIKI_DEBUG === 'true' || process.env.NODE_ENV === 'development';
}

/**
 * Get credentials directory.
 * @returns {string} Credentials directory path
 */
export function getCredentialsDir() {
    if (isDebugMode()) {
        // Debug mode: use local .credentials directory
        const debugDir = path.join(process.cwd(), '.credentials');
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true, mode: 0o700 });
        }
        return debugDir;
    } else {
        // Production mode: use system credential directory (same as Python)
        const config = createSDKConfig();
        return config.credentials_dir;
    }
}

/**
 * Ensure credentials directory exists with proper permissions.
 * @returns {string} Credentials directory path
 */
export function ensureCredentialsDir() {
    const credDir = getCredentialsDir();
    if (!fs.existsSync(credDir)) {
        fs.mkdirSync(credDir, { recursive: true, mode: 0o700 });
    }
    return credDir;
}

/**
 * Write text file with secure permissions (0o600).
 * @param {string} filePath - File path
 * @param {string} content - Text content
 */
export function writeSecureText(filePath, content) {
    fs.writeFileSync(filePath, content, {
        encoding: 'utf-8',
        mode: 0o600
    });
}

/**
 * Write JSON file with secure permissions (0o600).
 * @param {string} filePath - File path
 * @param {Object} payload - JSON payload
 */
export function writeSecureJson(filePath, payload) {
    writeSecureText(filePath, JSON.stringify(payload, null, 2));
}

/**
 * Load the credential index.
 * @returns {Object} Credential index
 */
export function loadIndex() {
    const indexPath = path.join(ensureCredentialsDir(), FILE_NAMES.INDEX);
    
    if (!fs.existsSync(indexPath)) {
        return {
            schema_version: INDEX_SCHEMA_VERSION,
            default_credential_name: null,
            credentials: {}
        };
    }
    
    try {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        
        // Validate schema version
        if (data.schema_version !== INDEX_SCHEMA_VERSION) {
            console.warn(`Unsupported credential index schema: ${data.schema_version}, expected ${INDEX_SCHEMA_VERSION}`);
        }
        
        return data;
    } catch (e) {
        console.warn('Failed to load credential index, returning empty index:', e.message);
        return {
            schema_version: INDEX_SCHEMA_VERSION,
            default_credential_name: null,
            credentials: {}
        };
    }
}

/**
 * Save the credential index.
 * @param {Object} index - Credential index
 * @returns {string} Index file path
 */
export function saveIndex(index) {
    const indexPath = path.join(ensureCredentialsDir(), FILE_NAMES.INDEX);
    
    const payload = {
        schema_version: INDEX_SCHEMA_VERSION,
        default_credential_name: index.default_credential_name || null,
        credentials: index.credentials || {}
    };
    
    writeSecureJson(indexPath, payload);
    return indexPath;
}

/**
 * Get index entry for a credential name.
 * @param {string} credentialName - Credential name
 * @returns {Object|null} Index entry or null
 */
export function getIndexEntry(credentialName) {
    const index = loadIndex();
    return index.credentials[credentialName] || null;
}

/**
 * Set index entry for a credential name.
 * @param {string} credentialName - Credential name
 * @param {Object} entry - Index entry
 * @returns {string} Index file path
 */
export function setIndexEntry(credentialName, entry) {
    const index = loadIndex();
    
    index.credentials[credentialName] = {
        ...entry,
        credential_name: credentialName,
        is_default: credentialName === index.default_credential_name
    };
    
    return saveIndex(index);
}

/**
 * Remove index entry for a credential name.
 * @param {string} credentialName - Credential name
 * @returns {boolean} True if removed
 */
export function removeIndexEntry(credentialName) {
    const index = loadIndex();
    
    if (!index.credentials[credentialName]) {
        return false;
    }
    
    delete index.credentials[credentialName];
    
    if (index.default_credential_name === credentialName) {
        index.default_credential_name = null;
    }
    
    saveIndex(index);
    return true;
}

/**
 * Get credential directory path for a directory name.
 * @param {string} dirName - Directory name (unique_id)
 * @returns {string} Credential directory path
 */
export function getCredentialDir(dirName) {
    return path.join(ensureCredentialsDir(), dirName);
}

/**
 * Build credential paths for a directory name.
 * @param {string} dirName - Directory name (unique_id)
 * @returns {Object} Credential paths
 */
export function buildCredentialPaths(dirName) {
    const credDir = getCredentialDir(dirName);
    
    return {
        rootDir: ensureCredentialsDir(),
        dirName: dirName,
        credentialDir: credDir,
        identityPath: path.join(credDir, FILE_NAMES.IDENTITY),
        authPath: path.join(credDir, FILE_NAMES.AUTH),
        didDocumentPath: path.join(credDir, FILE_NAMES.DID_DOCUMENT),
        key1PrivatePath: path.join(credDir, FILE_NAMES.KEY1_PRIVATE),
        key1PublicPath: path.join(credDir, FILE_NAMES.KEY1_PUBLIC),
        e2eeSigningPrivatePath: path.join(credDir, FILE_NAMES.E2EE_SIGNING_PRIVATE),
        e2eeAgreementPrivatePath: path.join(credDir, FILE_NAMES.E2EE_AGREEMENT_PRIVATE),
        e2eeStatePath: path.join(credDir, FILE_NAMES.E2EE_STATE)
    };
}

/**
 * Resolve credential paths from index.
 * @param {string} credentialName - Credential name
 * @returns {Object|null} Credential paths or null
 */
export function resolveCredentialPaths(credentialName) {
    const entry = getIndexEntry(credentialName);
    
    if (!entry) {
        return null;
    }
    
    return buildCredentialPaths(entry.dir_name);
}

/**
 * Save a DID identity to local files.
 *
 * @param {Object} options - Identity data
 * @param {string} options.did - DID identifier
 * @param {string} options.uniqueId - Unique ID (k1_...)
 * @param {string|null} options.userId - User ID after registration
 * @param {string} options.privateKeyPem - Private key PEM
 * @param {string} options.publicKeyPem - Public key PEM
 * @param {string|null} options.jwtToken - JWT token
 * @param {string|null} options.displayName - Display name
 * @param {string|null} options.handle - Handle (e.g., hyg4awiki.awiki.ai)
 * @param {string} options.name - Credential name (default: 'default')
 * @param {Object|null} options.didDocument - DID document
 * @param {string|null} options.e2eeSigningPrivatePem - E2EE signing private key
 * @param {string|null} options.e2eeAgreementPrivatePem - E2EE agreement private key
 * @returns {string} Identity file path
 */
export function saveIdentity(options) {
    const {
        did,
        uniqueId,
        userId,
        privateKeyPem,
        publicKeyPem,
        jwtToken,
        displayName,
        handle,
        name = 'default',
        didDocument,
        e2eeSigningPrivatePem,
        e2eeAgreementPrivatePem
    } = options;
    
    if (!did || !uniqueId) {
        throw new Error('saveIdentity requires did and uniqueId');
    }
    
    // Directory name = unique_id (matching Python)
    const dirName = uniqueId;
    const paths = buildCredentialPaths(dirName);
    
    // Create credential directory with secure permissions
    if (!fs.existsSync(paths.credentialDir)) {
        fs.mkdirSync(paths.credentialDir, { recursive: true, mode: 0o700 });
    }
    
    // Save identity.json
    writeSecureJson(paths.identityPath, {
        did: did,
        unique_id: uniqueId,
        user_id: userId || null,
        name: displayName || null,
        handle: handle || null,
        created_at: new Date().toISOString()
    });
    
    // Save auth.json (if JWT exists)
    if (jwtToken) {
        writeSecureJson(paths.authPath, {
            jwt_token: jwtToken
        });
    }
    
    // Save did_document.json (if exists)
    if (didDocument) {
        writeSecureJson(paths.didDocumentPath, didDocument);
    }
    
    // Save private key
    writeSecureText(paths.key1PrivatePath, privateKeyPem);
    
    // Save public key
    writeSecureText(paths.key1PublicPath, publicKeyPem);
    
    // Save E2EE keys (if exist)
    if (e2eeSigningPrivatePem) {
        writeSecureText(paths.e2eeSigningPrivatePath, e2eeSigningPrivatePem);
    }
    
    if (e2eeAgreementPrivatePem) {
        writeSecureText(paths.e2eeAgreementPrivatePath, e2eeAgreementPrivatePem);
    }
    
    // Update index.json
    setIndexEntry(name, {
        dir_name: dirName,
        did: did,
        unique_id: uniqueId,
        user_id: userId || null,
        name: displayName || null,
        handle: handle || null,
        created_at: new Date().toISOString(),
        is_default: name === 'default'
    });
    
    console.log(`Credential saved to: ${paths.identityPath}`);
    console.log(`Credential name: ${name}`);
    
    return paths.identityPath;
}

/**
 * Load a DID identity from local files.
 *
 * @param {string} name - Credential name (default: 'default')
 * @returns {Object|null} Identity data or null
 */
export function loadIdentity(name = 'default') {
    const entry = getIndexEntry(name);
    
    if (!entry) {
        // Try legacy format (direct file in credentials dir)
        const legacyPath = path.join(ensureCredentialsDir(), `${name}.json`);
        if (fs.existsSync(legacyPath)) {
            console.warn(`Loading legacy credential format: ${legacyPath}`);
            return JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
        }
        
        return null;
    }
    
    const paths = buildCredentialPaths(entry.dir_name);
    
    // Load identity.json
    if (!fs.existsSync(paths.identityPath)) {
        console.warn(`Identity file not found: ${paths.identityPath}`);
        return null;
    }
    
    const identity = JSON.parse(fs.readFileSync(paths.identityPath, 'utf-8'));
    
    // Load auth.json (JWT)
    if (fs.existsSync(paths.authPath)) {
        const auth = JSON.parse(fs.readFileSync(paths.authPath, 'utf-8'));
        identity.jwt_token = auth.jwt_token;
    }
    
    // Load DID document
    if (fs.existsSync(paths.didDocumentPath)) {
        identity.did_document = JSON.parse(fs.readFileSync(paths.didDocumentPath, 'utf-8'));
    }
    
    // Load private key (for JWT refresh)
    if (fs.existsSync(paths.key1PrivatePath)) {
        identity.private_key_pem = fs.readFileSync(paths.key1PrivatePath, 'utf-8');
    }
    
    // Load public key
    if (fs.existsSync(paths.key1PublicPath)) {
        identity.public_key_pem = fs.readFileSync(paths.key1PublicPath, 'utf-8');
    }
    
    // Load E2EE keys
    if (fs.existsSync(paths.e2eeSigningPrivatePath)) {
        identity.e2ee_signing_private_pem = fs.readFileSync(paths.e2eeSigningPrivatePath, 'utf-8');
    }
    
    if (fs.existsSync(paths.e2eeAgreementPrivatePath)) {
        identity.e2ee_agreement_private_pem = fs.readFileSync(paths.e2eeAgreementPrivatePath, 'utf-8');
    }
    
    return identity;
}

/**
 * List all saved identities.
 *
 * @returns {Array} List of identity summaries
 */
export function listIdentities() {
    const index = loadIndex();
    const identities = [];
    
    for (const [name, entry] of Object.entries(index.credentials)) {
        const paths = buildCredentialPaths(entry.dir_name);
        
        const summary = {
            credential_name: name,
            did: entry.did,
            name: entry.name,
            handle: entry.handle,
            created_at: entry.created_at,
            is_default: entry.is_default,
            has_jwt: false
        };
        
        // Check if JWT exists
        if (fs.existsSync(paths.authPath)) {
            summary.has_jwt = true;
        }
        
        identities.push(summary);
    }
    
    return identities;
}

/**
 * Delete a saved identity.
 *
 * @param {string} name - Credential name
 * @returns {boolean} True if deleted
 */
export function deleteIdentity(name) {
    const entry = getIndexEntry(name);
    
    if (!entry) {
        return false;
    }
    
    const paths = buildCredentialPaths(entry.dir_name);
    
    // Remove credential directory
    if (fs.existsSync(paths.credentialDir)) {
        fs.rmSync(paths.credentialDir, { recursive: true, force: true });
    }
    
    // Remove from index
    removeIndexEntry(name);
    
    console.log(`Credential deleted: ${name}`);
    
    return true;
}

/**
 * Update JWT token for a credential.
 *
 * @param {string} name - Credential name
 * @param {string} jwtToken - New JWT token
 * @returns {boolean} True if updated
 */
export function updateJwt(name, jwtToken) {
    const entry = getIndexEntry(name);
    
    if (!entry) {
        return false;
    }
    
    const paths = buildCredentialPaths(entry.dir_name);
    
    // Save auth.json
    writeSecureJson(paths.authPath, {
        jwt_token: jwtToken
    });
    
    console.log(`JWT updated for credential: ${name}`);
    
    return true;
}

/**
 * Create a DIDWbaAuthHeader instance from a saved credential.
 *
 * @param {string} name - Credential name (default: 'default')
 * @param {Object|null} config - SDK config
 * @returns {Object|null} { auth, data } or null
 */
export async function createAuthenticator(name = 'default', config = null) {
    const { DIDWbaAuthHeader } = await import('./utils/auth.js');
    
    const data = loadIdentity(name);
    
    if (data === null) {
        console.warn(`Cannot create authenticator: credential '${name}' not found`);
        return null;
    }
    
    // Create auth header instance
    const auth = new DIDWbaAuthHeader(null, null);
    
    // Set credentials from loaded identity
    if (data.did_document && data.private_key_pem) {
        const privateKeyBytes = loadPrivateKeyFromPem(data.private_key_pem);
        await auth.setCredentials(data.did_document, privateKeyBytes);
    } else {
        // Fallback to file-based approach
        const paths = resolveCredentialPaths(name);
        if (paths === null) {
            return null;
        }
        
        auth.didDocumentPath = paths.didDocumentPath;
        auth.privateKeyPath = paths.key1PrivatePath;
        auth._loadCredentials();
    }
    
    // Pre-populate token cache if JWT exists
    if (data.jwt_token && config) {
        const serverUrl = config.user_service_url || 'https://awiki.ai';
        auth.updateToken(serverUrl, { 'Authorization': `Bearer ${data.jwt_token}` });
    }
    
    return { auth, data };
}

/**
 * Load private key from PEM string.
 *
 * @param {string} pemContent - PEM content
 * @returns {Buffer} Private key bytes
 */
function loadPrivateKeyFromPem(pemContent) {
    // Extract base64 content from PEM
    const lines = pemContent.split('\n').filter(line => {
        return !line.startsWith('-----') && line.trim() !== '';
    });
    const base64Content = lines.join('');
    
    return Buffer.from(base64Content, 'base64');
}

/**
 * Extract authentication credentials from identity.
 * @param {Object} identity - Identity object
 * @returns {Object} Authentication credentials
 */
export function extractAuthCredentials(identity) {
    return {
        did: identity.did,
        jwt_token: identity.jwt_token,
        privateKeyPem: identity.privateKeyPem
    };
}

export default {
    saveIdentity,
    loadIdentity,
    listIdentities,
    deleteIdentity,
    updateJwt,
    createAuthenticator,
    extractAuthCredentials,
    loadIndex,
    saveIndex,
    getIndexEntry,
    setIndexEntry,
    removeIndexEntry,
    getCredentialsDir,
    ensureCredentialsDir,
    isDebugMode
};
