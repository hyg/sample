/**
 * Credential persistence: save/load private keys, DID, JWT to local files.
 * 
 * Compatible with Python's credential_store.py.
 * 
 * @module credential_store
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createSDKConfig } from './config.js';
import { loadPrivateKeyFromPem } from './identity.js';

/**
 * Get credentials directory.
 * @returns {string} Credentials directory path
 */
function getCredentialsDir() {
    const config = createSDKConfig();
    return config.credentials_dir;
}

/**
 * Ensure credentials directory exists with proper permissions.
 * @returns {string} Credentials directory path
 */
function ensureCredentialsDir() {
    const credDir = getCredentialsDir();
    if (!fs.existsSync(credDir)) {
        fs.mkdirSync(credDir, { recursive: true, mode: 0o700 });
    }
    return credDir;
}

/**
 * Get credential file path.
 * @param {string} name - Credential name
 * @returns {string} File path
 */
function credentialPath(name) {
    return path.join(ensureCredentialsDir(), `${name}.json`);
}

/**
 * Save a DID identity to a local file.
 * 
 * @param {Object} options - Identity data
 * @param {string} options.did - DID identifier
 * @param {string} options.uniqueId - Unique ID extracted from DID
 * @param {string|null} options.userId - User ID after registration
 * @param {string} options.privateKeyPem - Private key PEM
 * @param {string} options.publicKeyPem - Public key PEM
 * @param {string|null} [options.jwtToken] - JWT token
 * @param {string|null} [options.displayName] - Display name
 * @param {string} [options.name='default'] - Credential name
 * @param {Object|null} [options.didDocument] - DID document
 * @param {string|null} [options.e2eeSigningPrivatePem] - key-2 secp256r1 signing private key PEM
 * @param {string|null} [options.e2eeAgreementPrivatePem] - key-3 X25519 agreement private key PEM
 * @returns {string} Credential file path
 */
export function saveIdentity({
    did,
    uniqueId,
    userId,
    privateKeyPem,
    privateKeyHex,
    publicKeyPem,
    jwtToken = null,
    displayName = null,
    name = 'default',
    didDocument = null,
    e2eeSigningPrivatePem = null,
    e2eeAgreementPrivatePem = null
}) {
    const credentialData = {
        did,
        unique_id: uniqueId,
        user_id: userId,
        private_key_pem: privateKeyPem,
        private_key_hex: privateKeyHex,
        public_key_pem: publicKeyPem,
        jwt_token: jwtToken,
        name: displayName,
        did_document: didDocument,
        created_at: new Date().toISOString()
    };
    
    if (e2eeSigningPrivatePem !== null) {
        credentialData.e2ee_signing_private_pem = e2eeSigningPrivatePem;
    }
    if (e2eeAgreementPrivatePem !== null) {
        credentialData.e2ee_agreement_private_pem = e2eeAgreementPrivatePem;
    }
    
    const filePath = credentialPath(name);
    fs.writeFileSync(filePath, JSON.stringify(credentialData, null, 2), {
        mode: 0o600
    });
    
    return filePath;
}

/**
 * Load a DID identity from a local file.
 * 
 * @param {string} name - Credential name (default: 'default')
 * @returns {Object|null} Credential data dict, or null if not found
 */
export function loadIdentity(name = 'default') {
    const filePath = credentialPath(name);
    
    if (!fs.existsSync(filePath)) {
        return null;
    }
    
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * List all saved identities.
 * 
 * @returns {Object[]} List of identities
 */
export function listIdentities() {
    const identities = [];
    const credDir = ensureCredentialsDir();
    
    const files = fs.readdirSync(credDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(credDir, file), 'utf-8'));
            identities.push({
                credential_name: path.basename(file, '.json'),
                did: data.did || '',
                unique_id: data.unique_id || '',
                name: data.name || '',
                user_id: data.user_id || '',
                created_at: data.created_at || '',
                has_jwt: !!data.jwt_token
            });
        } catch (e) {
            continue;
        }
    }
    
    return identities;
}

/**
 * Delete a saved identity.
 * 
 * @param {string} name - Credential name
 * @returns {boolean} Whether deletion was successful
 */
export function deleteIdentity(name) {
    const filePath = credentialPath(name);
    
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
    }
    
    return false;
}

/**
 * Update the JWT token of a saved identity.
 * 
 * @param {string} name - Credential name
 * @param {string} jwtToken - New JWT token
 * @returns {boolean} Whether update was successful
 */
export function updateJwt(name, jwtToken) {
    const data = loadIdentity(name);
    if (data === null) {
        return false;
    }
    
    data.jwt_token = jwtToken;
    
    const filePath = credentialPath(name);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), {
        mode: 0o600
    });
    
    return true;
}

/**
 * Extract DID document and private key files from credential for DIDWbaAuthHeader.
 *
 * @param {string} name - Credential name
 * @returns {{didDocPath: string, keyPath: string}|null} Paths tuple, or null if unavailable
 */
export function extractAuthFiles(name = 'default') {
    const data = loadIdentity(name);
    if (data === null || !data.did_document) {
        return null;
    }

    const credDir = ensureCredentialsDir();

    // Write DID document JSON
    const didDocPath = path.join(credDir, `${name}_did_document.json`);
    fs.writeFileSync(didDocPath, JSON.stringify(data.did_document, null, 2));

    // Write private key PEM - try to use hex key to generate proper PEM
    const keyPath = path.join(credDir, `${name}_private_key.pem`);
    
    let pemContent;
    if (data.private_key_hex) {
        // Regenerate PEM from hex key
        const rawKey = Buffer.from(data.private_key_hex, 'hex');
        const privateKeyJwk = {
            kty: 'EC',
            crv: 'secp256k1',
            d: rawKey.toString('base64url')
        };
        
        try {
            const privateKey = crypto.createPrivateKey({
                key: privateKeyJwk,
                format: 'jwk'
            });
            pemContent = privateKey.export({ type: 'pkcs8', format: 'pem' });
        } catch (e) {
            // Fallback to stored PEM
            pemContent = typeof data.private_key_pem === 'string' 
                ? data.private_key_pem 
                : Buffer.from(data.private_key_pem).toString('utf-8');
        }
    } else if (data.private_key_pem) {
        pemContent = typeof data.private_key_pem === 'string' 
            ? data.private_key_pem 
            : Buffer.from(data.private_key_pem).toString('utf-8');
    } else {
        return null;
    }
    
    fs.writeFileSync(keyPath, pemContent, { mode: 0o600 });

    return { didDocPath, keyPath };
}

/**
 * Create a DIDWbaAuthHeader instance.
 *
 * @param {string} name - Credential name
 * @param {Object} config - SDKConfig instance
 * @returns {{auth: import('./auth.js').DIDWbaAuthHeader, data: Object}|null}
 */
export async function createAuthenticator(name = 'default', config = null) {
    const { DIDWbaAuthHeader } = await import('./auth.js');

    const data = loadIdentity(name);
    if (data === null) {
        return null;
    }

    // Use setCredentials with hex key directly (avoiding PEM issues with secp256k1)
    const auth = new DIDWbaAuthHeader(null, null);
    
    if (data.did_document && data.private_key_hex) {
        const privateKeyBytes = Buffer.from(data.private_key_hex, 'hex');
        await auth.setCredentials(data.did_document, privateKeyBytes);
    } else {
        // Fallback: try to load from files
        const authFiles = extractAuthFiles(name);
        if (authFiles === null) {
            return null;
        }
        
        // Read DID document and private key from files
        const didDoc = JSON.parse(fs.readFileSync(authFiles.didDocPath, 'utf-8'));
        const pemContent = fs.readFileSync(authFiles.keyPath, 'utf-8');
        
        // Load private key from PEM
        const privateKeyBytes = loadPrivateKeyFromPem(pemContent);
        await auth.setCredentials(didDoc, privateKeyBytes);
    }

    // Pre-populate token cache if JWT exists
    if (data.jwt_token && config) {
        const serverUrl = config.user_service_url;
        auth.updateToken(serverUrl, { 'Authorization': `Bearer ${data.jwt_token}` });

        if (config.molt_message_url) {
            auth.updateToken(config.molt_message_url, { 'Authorization': `Bearer ${data.jwt_token}` });
        }
    }

    return { auth, data };
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
