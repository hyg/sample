/**
 * DIDWbaAuthHeader - Simplified DID authentication client providing HTTP authentication headers.
 *
 * Compatible with Python's anp.authentication.DIDWbaAuthHeader.
 *
 * @module authentication/did_wba_authenticator
 */

import { readFileSync } from 'fs';
import { parse as parseUrl } from 'url';
import { secp256k1 } from '@noble/curves/secp256k1';
import { generateAuthHeader, encodeDerSignature, loadPrivateKeyFromPem } from './did_wba.js';

/**
 * DIDWbaAuthHeader class for managing DID authentication headers and JWT tokens.
 */
export class DIDWbaAuthHeader {
    /**
     * Initialize the DID authentication client.
     *
     * @param {string} didDocumentPath - Path to the DID document
     * @param {string} privateKeyPath - Path to the private key PEM file
     */
    constructor(didDocumentPath, privateKeyPath) {
        this.didDocumentPath = didDocumentPath;
        this.privateKeyPath = privateKeyPath;

        // State variables
        this.didDocument = null;
        this.authHeaders = {};  // Store DID authentication headers by domain
        this.tokens = {};       // Store JWT tokens by domain
    }

    /**
     * Extract domain from URL.
     * @private
     * @param {string} serverUrl - Server URL
     * @returns {string} Domain name
     */
    _getDomain(serverUrl) {
        const parsed = parseUrl(serverUrl);
        return parsed.hostname || parsed.path.split('/')[0];
    }

    /**
     * Load DID document from file.
     * @private
     * @returns {Object} DID document
     */
    _loadDidDocument() {
        try {
            if (this.didDocument) {
                return this.didDocument;
            }

            const didDocument = JSON.parse(readFileSync(this.didDocumentPath, 'utf-8'));
            this.didDocument = didDocument;
            return didDocument;
        } catch (error) {
            console.error(`Error loading DID document: ${error.message}`);
            throw error;
        }
    }

    /**
     * Load private key from PEM file.
     * @private
     * @returns {string} Private key PEM
     */
    _loadPrivateKey() {
        try {
            const privateKeyData = readFileSync(this.privateKeyPath, 'utf-8');
            return privateKeyData;
        } catch (error) {
            console.error(`Error loading private key: ${error.message}`);
            throw error;
        }
    }

    /**
     * Sign callback function for generateAuthHeader.
     * @private
     * @param {Buffer} content - Content to sign
     * @param {string} methodFragment - Verification method fragment
     * @returns {Buffer} DER-encoded signature
     */
    _signCallback(content, methodFragment) {
        const privateKeyPem = this._loadPrivateKey();
        const privateKeyBytes = loadPrivateKeyFromPem(privateKeyPem);

        // Sign with secp256k1 (DER format)
        const signature = secp256k1.sign(content, privateKeyBytes);
        const derSignature = encodeDerSignature(signature.r, signature.s);

        return Buffer.from(derSignature);
    }

    /**
     * Generate DID authentication header.
     * @private
     * @param {string} domain - Service domain
     * @returns {string} Authorization header value
     */
    _generateAuthHeader(domain) {
        try {
            const didDocument = this._loadDidDocument();

            const authHeader = generateAuthHeader(
                didDocument,
                domain,
                this._signCallback.bind(this)
            );

            return authHeader;
        } catch (error) {
            console.error(`Error generating authentication header: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get authentication header.
     *
     * @param {string} serverUrl - Server URL
     * @param {boolean} [forceNew=false] - Whether to force generate new auth header
     * @returns {Object} HTTP header dictionary
     */
    getAuthHeader(serverUrl, forceNew = false) {
        const domain = this._getDomain(serverUrl);

        // If token exists and not forcing new auth, return token
        if (domain in this.tokens && !forceNew) {
            const token = this.tokens[domain];
            return { "Authorization": `Bearer ${token}` };
        }

        // Otherwise, generate or use existing DID auth header
        if (!(domain in this.authHeaders) || forceNew) {
            this.authHeaders[domain] = this._generateAuthHeader(domain);
        }

        return { "Authorization": this.authHeaders[domain] };
    }

    /**
     * Update token from response headers.
     *
     * @param {string} serverUrl - Server URL
     * @param {Object} headers - Response headers
     * @returns {string|null} Updated token, or null if no valid token
     */
    updateToken(serverUrl, headers) {
        const domain = this._getDomain(serverUrl);
        const authHeader = headers.Authorization || headers.authorization || 
                          (headers.get && (headers.get("Authorization") || headers.get("authorization")));

        if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
            const token = authHeader.substring(7);
            this.tokens[domain] = token;
            return token;
        }

        return null;
    }

    /**
     * Clear token for the specified domain.
     *
     * @param {string} serverUrl - Server URL
     */
    clearToken(serverUrl) {
        const domain = this._getDomain(serverUrl);
        delete this.tokens[domain];
    }

    /**
     * Clear all tokens for all domains.
     */
    clearAllTokens() {
        this.tokens = {};
    }
}

export default {
    DIDWbaAuthHeader
};
