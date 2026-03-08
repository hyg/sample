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
 * @param {string} credentialName - Credential name
 * @returns {string} Credential file path
 */
function getCredentialPath(credentialName) {
    const credDir = ensureCredentialsDir();
    return path.join(credDir, `${credentialName}.json`);
}

/**
 * Save identity to credential store.
 * @param {Object} identity - Identity object
 * @param {string} credentialName - Credential name
 */
export function saveIdentity(identity, credentialName = 'default') {
    const credPath = getCredentialPath(credentialName);
    
    const cred = {
        did: identity.did,
        did_document: identity.did_document,
        private_key_pem: identity.privateKeyPem,
        public_key_pem: identity.publicKeyPem,
        user_id: identity.user_id,
        jwt_token: identity.jwtToken,
        e2ee_signing_private_pem: identity.e2ee_signing_private_pem,
        e2ee_signing_public_pem: identity.e2ee_signing_public_pem,
        e2ee_agreement_private_pem: identity.e2ee_agreement_private_pem,
        e2ee_agreement_public_pem: identity.e2ee_agreement_public_pem
    };
    
    fs.writeFileSync(credPath, JSON.stringify(cred, null, 2), 'utf-8');
    console.log(`Credential saved to: ${credPath}`);
}

/**
 * Load identity from credential store.
 * @param {string} credentialName - Credential name
 * @returns {Object|null} Identity object or null
 */
export function loadIdentity(credentialName = 'default') {
    const credPath = getCredentialPath(credentialName);
    
    if (!fs.existsSync(credPath)) {
        return null;
    }
    
    try {
        const data = fs.readFileSync(credPath, 'utf-8');
        const cred = JSON.parse(data);
        return cred;
    } catch (error) {
        console.error(`Failed to load credential: ${error.message}`);
        return null;
    }
}

/**
 * List all credentials.
 * @returns {string[]} List of credential names
 */
export function listIdentities() {
    const credDir = ensureCredentialsDir();
    const files = fs.readdirSync(credDir);
    return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
}

/**
 * Delete a credential.
 * @param {string} credentialName - Credential name
 */
export function deleteIdentity(credentialName = 'default') {
    const credPath = getCredentialPath(credentialName);
    if (fs.existsSync(credPath)) {
        fs.unlinkSync(credPath);
        console.log(`Credential '${credentialName}' deleted`);
    } else {
        console.error(`Credential '${credentialName}' not found`);
    }
}

/**
 * Update JWT token in credential.
 * @param {string} jwtToken - New JWT token
 * @param {string} credentialName - Credential name
 */
export function updateJwt(jwtToken, credentialName = 'default') {
    const cred = loadIdentity(credentialName);
    if (cred) {
        cred.jwt_token = jwtToken;
        saveIdentity(cred, credentialName);
    }
}

export default {
    saveIdentity,
    loadIdentity,
    listIdentities,
    deleteIdentity,
    updateJwt
};
