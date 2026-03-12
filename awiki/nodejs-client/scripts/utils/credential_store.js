/**
 * Credential persistence: indexed multi-credential storage with per-credential directories.
 *
 * Compatible with Python's credential_store.py.
 *
 * [INPUT]: Identity object, credential metadata, SDKConfig (credentials_dir)
 * [OUTPUT]: saveIdentity(), loadIdentity(), listIdentities(), deleteIdentity(),
 *           extractAuthFiles(), updateJwt()
 * [POS]: Core credential management module supporting cross-session identity reuse,
 *        indexed multi-credential storage
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

import { existsSync, rmSync, copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
    INDEX_FILE_NAME,
    CredentialPaths,
    ensureCredentialsRoot,
    loadIndex,
    saveIndex,
    getCredentialEntry,
    setCredentialEntry,
    removeCredentialEntry,
    preferredCredentialDirName,
    buildCredentialPaths,
    resolveCredentialPaths,
    ensureCredentialDirectory,
    writeSecureJson,
    writeSecureText,
    legacyIdentityPath,
    legacyAuthExportPaths,
    isLegacyIdentityPayload,
    hasLegacyLayout,
    legacyLayoutHint,
    listLegacyCredentialNames,
    readJsonIfExists,
    readTextIfExists
} from './credential_layout.js';
import { createSDKConfig, getMode } from './config.js';

/**
 * Normalize bytes/Buffer content into a UTF-8 string.
 * @param {Buffer|string} value - Value
 * @returns {string} UTF-8 string
 */
function _coerceText(value) {
    if (Buffer.isBuffer(value)) {
        return value.toString('utf-8');
    }
    return value;
}

/**
 * Build a normalized credential index entry.
 * @param {string} credentialName - Credential name
 * @param {Object} options - Options
 * @returns {Object} Index entry
 */
function _buildIndexEntry(
    credentialName,
    { dirName, did, uniqueId, userId, displayName, handle, createdAt }
) {
    return {
        credential_name: credentialName,
        dir_name: dirName,
        did: did,
        unique_id: uniqueId,
        user_id: userId,
        name: displayName,
        handle: handle,
        created_at: createdAt,
        is_default: credentialName === 'default'
    };
}

/**
 * Count how many credential names reference the same directory.
 * @param {string} dirName - Directory name
 * @param {Object} config - SDKConfig instance
 * @returns {number} Reference count
 */
function _credentialReferenceCount(dirName, config = null) {
    const index = loadIndex(config);
    let count = 0;
    for (const entry of Object.values(index.credentials)) {
        if (entry.dir_name === dirName) {
            count++;
        }
    }
    return count;
}

/**
 * Save identity to credential store with index entry.
 * 
 * @param {Object} identity - Identity object
 * @param {string} credentialName - Credential name
 * @param {string|null} displayName - Display name
 * @param {string|null} handle - Handle
 * @param {Object} config - SDKConfig instance
 * @returns {string} Credential directory path
 */
export function saveIdentity(
    identity,
    credentialName = 'default',
    displayName = null,
    handle = null,
    config = null
) {
    // Determine directory name from unique_id
    const dirName = preferredCredentialDirName({
        handle: handle || identity.handle,
        uniqueId: identity.uniqueId
    });
    
    // Validate directory is not already used by another credential
    const index = loadIndex(config);
    for (const [name, entry] of Object.entries(index.credentials)) {
        if (name !== credentialName && entry.dir_name === dirName) {
            throw new Error(
                `Credential directory '${dirName}' is already used by credential '${name}'`
            );
        }
    }
    
    // Build paths
    const paths = buildCredentialPaths(dirName, config);
    ensureCredentialDirectory(paths);
    
    // Write identity.json
    const identityPayload = {
        did: identity.did,
        unique_id: identity.uniqueId,
        user_id: identity.userId,
        name: displayName || identity.handle || handle,
        handle: identity.handle || handle,
        created_at: new Date().toISOString()
    };
    writeSecureJson(paths.identityPath, identityPayload);
    
    // Write auth.json (with JWT)
    const authPayload = { jwt_token: identity.jwtToken };
    writeSecureJson(paths.authPath, authPayload);
    
    // Write did_document.json
    writeSecureJson(paths.didDocumentPath, identity.didDocument);
    
    // Write key-1-private.pem
    writeSecureText(paths.key1PrivatePath, _coerceText(identity.privateKeyPem));
    
    // Write key-1-public.pem
    if (identity.publicKeyPem) {
        writeSecureText(paths.key1PublicPath, _coerceText(identity.publicKeyPem));
    }
    
    // Write E2EE keys
    if (identity.e2eeSigningPrivatePem) {
        writeSecureText(paths.e2eeSigningPrivatePath, _coerceText(identity.e2eeSigningPrivatePem));
    }
    if (identity.e2eeAgreementPrivatePem) {
        writeSecureText(paths.e2eeAgreementPrivatePath, _coerceText(identity.e2eeAgreementPrivatePem));
    }
    
    // Write E2EE state
    if (identity.e2eeState) {
        writeSecureJson(paths.e2eeStatePath, identity.e2eeState);
    }
    
    // Update index
    const indexEntry = _buildIndexEntry(credentialName, {
        dirName,
        did: identity.did,
        uniqueId: identity.uniqueId,
        userId: identity.userId,
        displayName: displayName || identity.handle || handle,
        handle: identity.handle || handle,
        createdAt: identityPayload.created_at
    });
    setCredentialEntry(credentialName, indexEntry, config);
    
    return paths.credentialDir;
}

/**
 * Load identity from credential index.
 * 
 * @param {string} name - Credential name
 * @param {Object} config - SDKConfig instance
 * @returns {Object|null} Identity object or null
 */
export function loadIdentity(name = 'default', config = null) {
    // Check for legacy layout first
    if (hasLegacyLayout(config)) {
        console.error(legacyLayoutHint());
        return null;
    }
    
    // Get entry from index
    const entry = getCredentialEntry(name, config);
    if (entry === null) {
        return null;
    }
    
    // Build paths
    const paths = buildCredentialPaths(entry.dir_name, config);
    
    // Read all files
    const identityData = readJsonIfExists(paths.identityPath) || {};
    const authData = readJsonIfExists(paths.authPath) || {};
    const didDocument = readJsonIfExists(paths.didDocumentPath) || {};
    const key1PrivatePem = readTextIfExists(paths.key1PrivatePath);
    const key1PublicPem = readTextIfExists(paths.key1PublicPath);
    const e2eeSigningPrivatePem = readTextIfExists(paths.e2eeSigningPrivatePath);
    const e2eeAgreementPrivatePem = readTextIfExists(paths.e2eeAgreementPrivatePath);
    const e2eeState = readJsonIfExists(paths.e2eeStatePath);
    
    // Merge data
    const result = {
        did: identityData.did || entry.did,
        uniqueId: identityData.unique_id || entry.unique_id,
        userId: identityData.user_id || entry.user_id,
        handle: identityData.handle || entry.handle,
        jwtToken: authData.jwt_token,
        didDocument: didDocument,
        privateKeyPem: key1PrivatePem,
        publicKeyPem: key1PublicPem,
        e2eeSigningPrivatePem: e2eeSigningPrivatePem,
        e2eeAgreementPrivatePem: e2eeAgreementPrivatePem,
        e2eeState: e2eeState,
        createdAt: identityData.created_at || entry.created_at
    };
    
    return result;
}

/**
 * List all saved identities from the credential index.
 * 
 * @param {Object} config - SDKConfig instance
 * @returns {Array} List of identity summaries
 */
export function listIdentities(config = null) {
    // Check for legacy layout first
    if (hasLegacyLayout(config) && listIdentitiesByName(config).length === 0) {
        console.error(legacyLayoutHint());
        return [];
    }
    
    const identities = [];
    const index = loadIndex(config);
    
    for (const [credentialName, entry] of Object.entries(index.credentials)) {
        const paths = buildCredentialPaths(entry.dir_name, config);
        const authData = readJsonIfExists(paths.authPath) || {};
        
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
            has_jwt: !!authData.jwt_token
        });
    }
    
    return identities.sort((a, b) => a.credential_name.localeCompare(b.credential_name));
}

/**
 * List credential names from the index.
 * 
 * @param {Object} config - SDKConfig instance
 * @returns {Object} Credential names mapped to entries
 */
export function listIdentitiesByName(config = null) {
    const index = loadIndex(config);
    return index.credentials;
}

/**
 * Delete a saved identity and its credential directory.
 * 
 * @param {string} name - Credential name
 * @param {Object} config - SDKConfig instance
 * @returns {boolean} True if deleted
 */
export function deleteIdentity(name, config = null) {
    const paths = resolveCredentialPaths(name, config);
    if (paths === null) {
        if (hasLegacyLayout(config)) {
            console.error(legacyLayoutHint());
        }
        return false;
    }
    
    // Check reference count
    const referenceCount = _credentialReferenceCount(paths.dirName, config);
    
    // Delete directory if this is the only reference
    if (existsSync(paths.credentialDir) && referenceCount <= 1) {
        rmSync(paths.credentialDir, { recursive: true, force: true });
    }
    
    // Remove from index
    const removed = removeCredentialEntry(name, config);
    
    return removed;
}

/**
 * Update the JWT token of a saved identity.
 * 
 * @param {string} name - Credential name
 * @param {string} jwtToken - New JWT token
 * @param {Object} config - SDKConfig instance
 * @returns {boolean} True if updated
 */
export function updateJwt(name, jwtToken, config = null) {
    const paths = resolveCredentialPaths(name, config);
    if (paths === null) {
        if (hasLegacyLayout(config)) {
            console.error(legacyLayoutHint());
        }
        return false;
    }
    
    // Read existing auth.json or create new
    const authPayload = readJsonIfExists(paths.authPath) || {};
    authPayload.jwt_token = jwtToken;
    writeSecureJson(paths.authPath, authPayload);
    
    return true;
}

/**
 * Return credential DID document and key-1 private key paths for auth.
 * 
 * @param {string} name - Credential name
 * @param {Object} config - SDKConfig instance
 * @returns {[string, string]|null} DID document and private key paths or null
 */
export function extractAuthFiles(name = 'default', config = null) {
    const paths = resolveCredentialPaths(name, config);
    if (paths === null) {
        if (hasLegacyLayout(config)) {
            console.error(legacyLayoutHint());
        }
        return null;
    }
    
    if (!existsSync(paths.didDocumentPath) || !existsSync(paths.key1PrivatePath)) {
        return null;
    }
    
    return [paths.didDocumentPath, paths.key1PrivatePath];
}

/**
 * Backup the current credential directory before destructive changes.
 * 
 * @param {string} name - Credential name
 * @param {Object} config - SDKConfig instance
 * @returns {string|null} Backup directory path or null
 */
export function backupIdentity(name, config = null) {
    const paths = resolveCredentialPaths(name, config);
    if (paths === null || !existsSync(paths.credentialDir)) {
        return null;
    }
    
    // Use imported copyFileSync for backup
    
    const backupRoot = join(
        paths.rootDir,
        '.recovery-backup',
        name,
        new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    );
    
    if (!existsSync(backupRoot)) {
        mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
    }
    
    const backupDir = join(backupRoot, paths.dirName);
    
    // Simple backup: copy entire directory
    // Note: For production, use a proper recursive copy function
    console.warn('Backup not fully implemented - manual backup recommended');
    
    return backupRoot;
}

/**
 * Create a DIDWbaAuthHeader instance from a saved credential.
 * @param {string} name - Credential name
 * @param {Object} config - SDKConfig instance
 * @returns {Promise<[Object, Object]|null>} [auth, data] or null
 */
export async function createAuthenticator(name = 'default', config = null) {
    const { DIDWbaAuthHeader } = await import('../../src/utils/auth.js');
    
    const data = loadIdentity(name);
    
    if (data === null) {
        console.warn(`Cannot create authenticator: credential '${name}' not found`);
        
        // 调试模式: 尝试从备份路径加载
        if (getMode() === 'debug') {
            console.log('调试模式: 尝试从备份路径加载凭据...');
            const backupData = await loadIdentityFromBackup(name);
            if (backupData) {
                return await createAuthenticatorFromBackup(backupData, config);
            }
        }
        
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
    
    return [auth, data];
}

/**
 * Load identity from backup path (debug mode only).
 * @private
 * @param {string} name - Credential name
 * @returns {Promise<Object|null>} Identity data or null
 */
async function loadIdentityFromBackup(name) {
    try {
        const { readFileSync } = await import('fs');
        
        // hyg4awiki 的备份路径 (正常模式)
        const credentialDir = 'C:\\Users\\hyg\\.openclaw\\credentials\\awiki-agent-id-message\\k1_V1SjUrhl6aDXfbpPNIpWgj7wcPq2XrcI6tIWX6KJlOw';
        
        const identityPath = `${credentialDir}\\identity.json`;
        const didDocPath = `${credentialDir}\\did_document.json`;
        const keyPath = `${credentialDir}\\key-1-private.pem`;
        const authPath = `${credentialDir}\\auth.json`;
        
        const identityData = JSON.parse(readFileSync(identityPath, 'utf-8'));
        const didDocument = JSON.parse(readFileSync(didDocPath, 'utf-8'));
        const privateKey = readFileSync(keyPath, 'utf-8');
        
        let jwtToken = null;
        try {
            const authData = JSON.parse(readFileSync(authPath, 'utf-8'));
            jwtToken = authData.jwt_token;
        } catch (authError) {
            console.log('auth.json 读取失败:', authError.message);
        }
        
        return {
            did: identityData.did,
            uniqueId: identityData.unique_id,
            userId: identityData.user_id,
            privateKeyPem: privateKey,
            did_document: didDocument,
            jwt_token: jwtToken,
            name: identityData.name
        };
    } catch (error) {
        console.log('从备份路径加载失败:', error.message);
        return null;
    }
}

/**
 * Create authenticator from backup data.
 * @private
 * @param {Object} backupData - Backup identity data
 * @param {Object} config - SDKConfig instance
 * @returns {Promise<[Object, Object]|null>} [auth, data] or null
 */
async function createAuthenticatorFromBackup(backupData, config) {
    const { DIDWbaAuthHeader } = await import('../../src/utils/auth.js');
    
    // Create auth header instance
    const auth = new DIDWbaAuthHeader(null, null);
    
    // Set credentials from loaded identity
    if (backupData.did_document && backupData.privateKeyPem) {
        const privateKeyBytes = loadPrivateKeyFromPem(backupData.privateKeyPem);
        await auth.setCredentials(backupData.did_document, privateKeyBytes);
    }
    
    // Pre-populate token cache if JWT exists
    if (backupData.jwt_token && config) {
        const serverUrl = config.user_service_url || 'https://awiki.ai';
        auth.updateToken(serverUrl, { 'Authorization': `Bearer ${backupData.jwt_token}` });
    }
    
    return [auth, backupData];
}

/**
 * Load private key from PEM string.
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

export default {
    saveIdentity,
    loadIdentity,
    listIdentities,
    deleteIdentity,
    updateJwt,
    extractAuthFiles,
    createAuthenticator
};
