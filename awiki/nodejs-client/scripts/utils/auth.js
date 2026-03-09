/**
 * Registration + WBA authentication + JWT acquisition.
 * 
 * @module auth
 */

import crypto from 'crypto';
import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import canonicalize from 'canonicalize';
import axios from 'axios';

/**
 * Encode ECDSA signature (r, s) as DER format.
 * DER format: SEQUENCE { INTEGER r, INTEGER s }
 * @param {bigint} r - r component of signature
 * @param {bigint} s - s component of signature
 * @returns {Buffer} DER-encoded signature
 */
function encodeDerSignature(r, s) {
    // Convert BigInt to unsigned BigEndian bytes
    function intToBytes(n) {
        let hex = n.toString(16);
        if (hex.length % 2 === 1) hex = '0' + hex;
        const bytes = Buffer.from(hex, 'hex');
        // If high bit is set, prepend 0x00 for unsigned integer
        if (bytes[0] & 0x80) {
            return Buffer.concat([Buffer.from([0x00]), bytes]);
        }
        return bytes;
    }
    
    const rBytes = intToBytes(r);
    const sBytes = intToBytes(s);
    
    // DER INTEGER for r: 02 LEN RBYTES
    const rDer = Buffer.concat([Buffer.from([0x02, rBytes.length]), rBytes]);
    // DER INTEGER for s: 02 LEN SBYTES
    const sDer = Buffer.concat([Buffer.from([0x02, sBytes.length]), sBytes]);
    
    // DER SEQUENCE: 30 LEN (rDer + sDer)
    const seqLen = rDer.length + sDer.length;
    const seqDer = Buffer.concat([Buffer.from([0x30, seqLen]), rDer, sDer]);
    
    return seqDer;
}

/**
 * Token cache for efficient JWT management.
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
 */
export class DIDWbaAuthHeader {
    constructor() {
        this.didDocument = null;
        this.privateKeyBytes = null;
        this.tokenCache = new TokenCache();
    }
    
    /**
     * Set DID document and private key directly.
     * @param {Object} didDocument - DID document
     * @param {Buffer} privateKeyBytes - Private key bytes (32 bytes)
     */
    setCredentials(didDocument, privateKeyBytes) {
        this.didDocument = didDocument;
        this.privateKeyBytes = privateKeyBytes instanceof Buffer 
            ? privateKeyBytes 
            : Buffer.from(privateKeyBytes);
    }
    
    /**
     * Get authentication header for server URL.
     * 
     * @param {string} serverUrl - Server URL
     * @param {boolean} [forceNew=false] - Force generate new header
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
        const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        
        const authData = {
            nonce,
            timestamp,
            aud: serverUrl,  // Use "aud" field (version 1.1+)
            did
        };
        
        // Canonicalize using JCS
        const canonicalJson = canonicalize(authData);
        
        // Calculate SHA-256 hash
        const contentHash = sha256(canonicalJson);
        
        // Sign with secp256k1 (noble-curves hashes internally)
        const signature = secp256k1.sign(contentHash, this.privateKeyBytes);
        
        // Encode as R||S format (IEEE P1363) with low-S normalization, then base64url
        const r = signature.r.toBigInt();
        let s = signature.s.toBigInt();
        
        const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
        const normalizedS = s > CURVE_ORDER / BigInt(2) ? CURVE_ORDER - s : s;
        
        // Fixed 32-byte encoding for each component (secp256k1 = 256 bits = 32 bytes)
        const rBytes = Buffer.from(r.toString(16).padStart(64, '0'), 'hex');
        const sBytes = Buffer.from(normalizedS.toString(16).padStart(64, '0'), 'hex');
        
        const signatureRs = Buffer.concat([rBytes, sBytes]);
        const signatureB64Url = signatureRs.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        
        // Get verification method fragment
        const authMethod = this.didDocument.authentication[0];
        const verificationMethodFragment = authMethod.includes('#') 
            ? authMethod.split('#')[1] 
            : 'key-1';
        
        // Build Authorization header (include version 1.1)
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
 * @param {Buffer} privateKeyBytes - Private key bytes
 * @param {string} domain - Service domain
 * @returns {Promise<string>} JWT access token
 */
export async function getJwtViaWba(userServiceUrl, didDocument, privateKeyBytes, domain) {
    const auth = new DIDWbaAuthHeader();
    auth.setCredentials(didDocument, privateKeyBytes);
    
    const authHeader = auth.getAuthHeader(userServiceUrl);
    
    const response = await axios.post(`${userServiceUrl}/user-service/did-auth/rpc`, {
        jsonrpc: '2.0',
        method: 'verify',
        params: {
            authorization: authHeader,
            domain: domain
        },
        id: 1
    });
    
    if (response.data.error) {
        throw new Error(response.data.error.message);
    }
    
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
    
    // 2. Obtain JWT
    identity.jwt_token = await getJwtViaWba(
        config.user_service_url,
        identity.did_document,
        identity.privateKey,
        config.did_domain
    );
    
    return identity;
}

export default {
    DIDWbaAuthHeader,
    registerDid,
    getJwtViaWba,
    createAuthenticatedIdentity
};
