/**
 * Credential persistence: save/load private keys, DID, JWT to local files.
 *
 * Compatible with Python's scripts/credential_store.py.
 *
 * @module utils/credential_store
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { createSDKConfig } from './config.js';

/**
 * Get credential file path.
 * @param {string} credentialName - Credential name
 * @returns {string} Credential file path
 */
export function getCredentialPath(credentialName = 'default') {
    const config = createSDKConfig();
    const credDir = config.credentials_dir;

    if (!existsSync(credDir)) {
        mkdirSync(credDir, { recursive: true, mode: 0o700 });
    }

    return join(credDir, `${credentialName}.json`);
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
        user_id: identity.userId,
        jwt_token: identity.jwtToken,
        e2ee_signing_private_pem: identity.e2ee_signing_private_pem,
        e2ee_signing_public_pem: identity.e2ee_signing_public_pem,
        e2ee_agreement_private_pem: identity.e2ee_agreement_private_pem,
        e2ee_agreement_public_pem: identity.e2ee_agreement_public_pem
    };

    writeFileSync(credPath, JSON.stringify(cred, null, 2), 'utf-8');
}

/**
 * Load identity from credential store.
 * @param {string} credentialName - Credential name
 * @returns {Object|null} Identity object or null
 */
export function loadIdentity(credentialName = 'default') {
    const credPath = getCredentialPath(credentialName);

    if (!existsSync(credPath)) {
        return null;
    }

    try {
        const data = readFileSync(credPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Failed to load credential: ${error.message}`);
        return null;
    }
}

/**
 * Update JWT token in credential file.
 * @param {string} credentialName - Credential name
 * @param {string} jwtToken - New JWT token
 */
export function updateJwt(credentialName, jwtToken) {
    const cred = loadIdentity(credentialName);
    if (cred) {
        cred.jwt_token = jwtToken;
        saveIdentity({
            did: cred.did,
            did_document: cred.did_document,
            privateKeyPem: cred.private_key_pem,
            publicKeyPem: cred.public_key_pem,
            userId: cred.user_id,
            jwtToken: cred.jwt_token,
            e2ee_signing_private_pem: cred.e2ee_signing_private_pem,
            e2ee_signing_public_pem: cred.e2ee_signing_public_pem,
            e2ee_agreement_private_pem: cred.e2ee_agreement_private_pem,
            e2ee_agreement_public_pem: cred.e2ee_agreement_public_pem
        }, credentialName);
    }
}

/**
 * List all credentials.
 * @returns {string[]} List of credential names
 */
export function listIdentities() {
    const config = createSDKConfig();
    const credDir = config.credentials_dir;

    if (!existsSync(credDir)) {
        return [];
    }

    const files = readdirSync(credDir);
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
    if (existsSync(credPath)) {
        unlinkSync(credPath);
    }
}

export default {
    saveIdentity,
    loadIdentity,
    updateJwt,
    listIdentities,
    deleteIdentity,
    getCredentialPath
};
