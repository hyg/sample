/**
 * Registration + WBA authentication + JWT acquisition.
 * 
 * Implements DID WBA authentication following the ANP specification.
 * 
 * @module utils/auth
 */

import crypto from 'crypto';
import fs from 'fs';
import { sha256 } from '@noble/hashes/sha256';
import secp256k1 from 'secp256k1';
import canonicalize from 'canonicalize';
import axios from 'axios';

/**
 * Token cache for efficient JWT management.
 * Maps serverUrl -> { token, expiresAt }
 */
class TokenCache {
    constructor() {
        this.cache = new Map();
    }
    
    getToken(serverUrl) {
        const entry = this.cache.get(serverUrl);
        if (!entry) return null;
        
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(serverUrl);
            return null;
        }
        
        return entry.token;
    }
    
    setToken(serverUrl, token, expiresIn) {
        const expiresAt = expiresIn ? Date.now() + expiresIn : null;
        this.cache.set(serverUrl, { token, expiresAt });
    }
    
    clearToken(serverUrl) {
        this.cache.delete(serverUrl);
    }
}

/**
 * DIDWbaAuthHeader - manages DID WBA authentication.
 * 
 * Compatible with Python's anp.authentication.DIDWbaAuthHeader.
 */
export class DIDWbaAuthHeader {
    /**
     * @param {string} didDocumentPath - Path to DID document JSON file
     * @param {string} privateKeyPath - Path to private key PEM file
     */
    constructor(didDocumentPath, privateKeyPath) {
        this.didDocumentPath = didDocumentPath;
        this.privateKeyPath = privateKeyPath;
        this.didDocument = null;
        this.privateKeyBytes = null;
        this.tokenCache = new TokenCache();
        
        // Only load credentials if paths are provided
        if (didDocumentPath && privateKeyPath) {
            this._loadCredentials();
        }
    }
    
    /**
     * Load credentials from files.
     * @private
     */
    _loadCredentials() {
        // Load DID document
        const didDocContent = fs.readFileSync(this.didDocumentPath, 'utf-8');
        this.didDocument = JSON.parse(didDocContent);

        // Load private key PEM
        const pemContent = fs.readFileSync(this.privateKeyPath, 'utf-8');
        this.privateKeyBytes = loadPrivateKeyFromPem(pemContent);
    }
    
    /**
     * Set DID document and private key directly (from credential store).
     * @param {Object} didDocument - DID document
     * @param {Buffer|string} privateKeyBytes - Private key bytes (32 bytes) or PEM string
     */
    async setCredentials(didDocument, privateKeyBytes) {
        this.didDocument = didDocument;
        
        // Support PEM string input - convert to raw bytes
        if (typeof privateKeyBytes === 'string') {
            const crypto = await import('crypto');
            const privateKeyObj = crypto.default.createPrivateKey(privateKeyBytes);
            const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
            const dHex = Buffer.from(privateKeyJwk.d, 'base64url').toString('hex');
            this.privateKeyBytes = Buffer.from(dHex, 'hex');
        } else {
            this.privateKeyBytes = privateKeyBytes instanceof Buffer
                ? privateKeyBytes
                : Buffer.from(privateKeyBytes);
        }
    }
    
    /**
     * Get authentication header for server URL.
     *
     * @param {string} serverUrl - Server URL
     * @param {boolean} [forceNew=false] - Force generate new header (ignore cached token)
     * @returns {Object} Headers object
     */
    getAuthHeader(serverUrl, forceNew = false) {
        // Check for cached token
        if (!forceNew) {
            const cachedToken = this.tokenCache.getToken(serverUrl);
            if (cachedToken) {
                return { 'Authorization': `Bearer ${cachedToken}` };
            }
        }

        // Generate new DIDWba header
        const did = this.didDocument.id;
        const nonce = crypto.randomBytes(16).toString('hex');
        // Match Python's timestamp format: truncate milliseconds (don't round)
        const now = new Date();
        now.setMilliseconds(0);
        const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');

        // Extract hostname from URL (e.g., "https://awiki.ai" -> "awiki.ai")
        // This is what Python's ANP library does
        let hostname = serverUrl;
        try {
            const url = new URL(serverUrl);
            hostname = url.hostname;
        } catch (e) {
            // If it's already just a hostname, use as-is
        }

        // Use "aud" field for version >= 1.1 (Python default)
        const authData = {
            nonce,
            timestamp,
            aud: hostname,  // Use hostname only, not full URL
            did
        };

        // Canonicalize using JCS
        const canonicalJson = canonicalize(authData);

        // Calculate SHA-256 hash
        const contentHash = sha256(canonicalJson);
        
        // CRITICAL: Double hash to match Python cryptography behavior
        // Python's cryptography library hashes internally when signing,
        // so we need to hash the already-hashed content once more
        const doubleHash = sha256(contentHash);

        // Sign with secp256k1-node (compatible with Python cryptography)
        const sig = secp256k1.ecdsaSign(doubleHash, this.privateKeyBytes);

        // Convert to R||S format (IEEE P1363) then base64url
        const rsSignature = Buffer.from(sig.signature);
        const signatureB64Url = encodeBase64Url(rsSignature);

        // Get verification method fragment
        const authMethod = this.didDocument.authentication[0];
        const verificationMethodFragment = authMethod.includes('#')
            ? authMethod.split('#')[1]
            : 'key-1';

        // Build Authorization header with version parameter (matching Python v1.1)
        const authHeader = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="${verificationMethodFragment}", signature="${signatureB64Url}"`;

        return { 'Authorization': authHeader };
    }
    
    /**
     * Update token cache from response headers.
     * 
     * @param {string} serverUrl - Server URL
     * @param {Object} responseHeaders - Response headers
     * @returns {string|null} New token if updated
     */
    updateToken(serverUrl, responseHeaders) {
        const authHeader = responseHeaders['Authorization'] || responseHeaders['authorization'] || '';
        
        if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            this.tokenCache.setToken(serverUrl, token, null);
            return token;
        }
        
        return null;
    }
    
    /**
     * Clear cached token for server URL.
     * 
     * @param {string} serverUrl - Server URL
     */
    clearToken(serverUrl) {
        this.tokenCache.clearToken(serverUrl);
    }
}

/**
 * Encode bytes as base64url without padding.
 * @param {Buffer|Uint8Array} data 
 * @returns {string}
 */
function encodeBase64Url(data) {
    if (Buffer.isBuffer(data)) {
        return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    return Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Encode R and S to DER format.
 * 
 * Note: @noble/curves performs low-S normalization by default,
 * which matches Python's cryptography library (OpenSSL) behavior.
 * 
 * @param {bigint} r
 * @param {bigint} s - Already normalized by @noble/curves
 * @returns {Buffer} R||S format signature (IEEE P1363)
 */
function encodeRsSignature(r, s) {
    // Apply low-S normalization (BIP 146)
    const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    let normalizedS = s;
    if (s > CURVE_ORDER / BigInt(2)) {
        normalizedS = CURVE_ORDER - s;
    }
    
    // Fixed 32-byte encoding for each component (secp256k1 = 256 bits = 32 bytes)
    const rBytes = Buffer.from(r.toString(16).padStart(64, '0'), 'hex');
    const sBytes = Buffer.from(normalizedS.toString(16).padStart(64, '0'), 'hex');
    
    return Buffer.concat([rBytes, sBytes]);
}

/**
 * Load private key from PEM format.
 * @param {string} pem - PEM formatted private key
 * @returns {Buffer} Private key bytes (32 bytes)
 */
function loadPrivateKeyFromPem(pem) {
    const privateKeyObj = crypto.createPrivateKey(pem);
    const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
    const dHex = Buffer.from(privateKeyJwk.d, 'base64url').toString('hex');
    return Buffer.from(dHex, 'hex');
}

/**
 * Generate DID WBA Authorization header.
 * 
 * @param {Object} didDocument - DID document
 * @param {string} serviceDomain - Target service domain
 * @param {Buffer} privateKeyBytes - Private key bytes (32 bytes)
 * @returns {string} Authorization header value
 */
export function generateWbaAuthHeader(didDocument, serviceDomain, privateKeyBytes) {
    const auth = new DIDWbaAuthHeader();
    auth.setCredentials(didDocument, privateKeyBytes);
    
    const headers = auth.getAuthHeader(serviceDomain);
    return headers['Authorization'];
}

/**
 * Register a DID identity.
 * 
 * @param {string} userServiceUrl - User service URL
 * @param {Object} didDocument - DID document with proof
 * @param {Object} options - Registration options
 * @returns {Promise<Object>} Registration result
 */
export async function registerDid(userServiceUrl, didDocument, options = {}) {
    const payload = {
        did_document: didDocument,
        ...options
    };
    
    const response = await axios.post(`${userServiceUrl}/user-service/did-auth/rpc`, {
        jsonrpc: '2.0',
        method: 'register',
        params: payload,
        id: 1
    });
    
    if (response.data.error) {
        throw new Error(response.data.error.message);
    }
    
    return response.data.result;
}

/**
 * Obtain JWT token via DID WBA signature.
 *
 * @param {string} userServiceUrl - User service URL
 * @param {Object} didDocument - DID document
 * @param {Buffer|string} privateKeyBytes - Private key bytes or PEM string
 * @param {string} domain - Service domain
 * @returns {Promise<string>} JWT access token
 */
export async function getJwtViaWba(userServiceUrl, didDocument, privateKeyBytes, domain) {
    console.log('[getJwtViaWba] Starting JWT acquisition...');
    console.log('[getJwtViaWba] DID:', didDocument.id);
    console.log('[getJwtViaWba] Domain:', domain);
    
    // Support different input formats: Buffer, hex string, or PEM string
    let privateKeyBytesBuffer;
    if (typeof privateKeyBytes === 'string') {
        // Check if it's a hex string (64 chars = 32 bytes)
        if (privateKeyBytes.length === 64) {
            privateKeyBytesBuffer = Buffer.from(privateKeyBytes, 'hex');
            console.log('[getJwtViaWba] Private key loaded from hex string');
        } else {
            // Try to parse as hex from PEM - extract the raw bytes
            // This is a fallback for old credentials
            try {
                const crypto = await import('crypto');
                const privateKeyObj = crypto.default.createPrivateKey(privateKeyBytes);
                const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
                const dHex = Buffer.from(privateKeyJwk.d, 'base64url').toString('hex');
                privateKeyBytesBuffer = Buffer.from(dHex, 'hex');
                console.log('[getJwtViaWba] Private key loaded from PEM using crypto.createPrivateKey()');
            } catch (e) {
                console.log('[getJwtViaWba] Failed to parse PEM, trying hex parse');
                // Last resort - try hex parse anyway
                privateKeyBytesBuffer = Buffer.from(privateKeyBytes, 'hex');
            }
        }
    } else {
        privateKeyBytesBuffer = privateKeyBytes;
    }

    console.log('[getJwtViaWba] Private key bytes length:', privateKeyBytesBuffer.length);

    const auth = new DIDWbaAuthHeader(null, null);
    await auth.setCredentials(didDocument, privateKeyBytesBuffer);

    const authHeaders = auth.getAuthHeader(userServiceUrl);
    const authHeaderValue = authHeaders['Authorization'];
    
    console.log('[getJwtViaWba] Authorization Header:', authHeaderValue);

    const response = await axios.post(`${userServiceUrl}/user-service/did-auth/rpc`, {
        jsonrpc: '2.0',
        method: 'verify',
        params: {
            authorization: authHeaderValue,
            domain: domain
        },
        id: 1
    });

    console.log('[getJwtViaWba] Response Status:', response.status);
    console.log('[getJwtViaWba] Response Body:', JSON.stringify(response.data, null, 2));

    if (response.data.error) {
        console.error('[getJwtViaWba] JWT verify error:', response.data.error.message);
        throw new Error(response.data.error.message);
    }

    console.log('[getJwtViaWba] SUCCESS - JWT acquired');
    return response.data.result.access_token;
}

/**
 * Create a complete authenticated DID identity.
 * 
 * @param {Object} config - SDK configuration
 * @param {Object} identity - Identity with DID document and keys
 * @param {Object} options - Registration options
 * @returns {Promise<Object>} Identity with user_id and jwt_token
 */
export async function createAuthenticatedIdentity(config, identity, options = {}) {
    // 1. Register DID
    const regResult = await registerDid(config.user_service_url, identity.did_document, {
        name: options.name,
        is_agent: options.isAgent || false,
        ...options.extra
    });

    identity.user_id = regResult.user_id;

    // 2. Check if JWT is included in registration response
    // Some servers return access_token directly in register response
    if (regResult.access_token) {
        identity.jwt_token = regResult.access_token;
        return identity;
    }

    // 3. Obtain JWT via DID WBA signature (fallback)
    try {
        identity.jwt_token = await getJwtViaWba(
            config.user_service_url,
            identity.did_document,
            identity.privateKey,
            config.did_domain
        );
    } catch (error) {
        // If JWT acquisition fails, log warning but continue
        // User can still use the identity for E2EE, just not for authenticated RPC
        console.warn('Warning: JWT acquisition failed. Identity can still be used for E2EE.');
        console.warn(`Error: ${error.message}`);
        // Don't set jwt_token, leave it as null/undefined
    }

    return identity;
}

export default {
    DIDWbaAuthHeader,
    generateWbaAuthHeader,
    registerDid,
    getJwtViaWba,
    createAuthenticatedIdentity,
    loadPrivateKeyFromPem
};
