/**
 * DID WBA authentication functions.
 *
 * Compatible with Python's anp.authentication.did_wba module.
 *
 * @module authentication/did_wba
 */

import crypto from 'crypto';
import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import canonicalize from 'canonicalize';

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
 * Load private key from PEM format.
 * @param {string} pem - PEM formatted private key
 * @returns {Buffer} Private key bytes (32 bytes)
 */
function loadPrivateKeyFromPem(pem) {
    const pemLines = pem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
    const der = Buffer.from(pemLines.join(''), 'base64');

    // PKCS#8 format: find the private key octet string (04 20)
    let privOffset = -1;
    for (let i = 0; i < der.length - 2; i++) {
        if (der[i] === 0x04 && der[i+1] === 0x20) {
            privOffset = i + 2;
            break;
        }
    }

    return der.slice(privOffset, privOffset + 32);
}

/**
 * Generate DID WBA authorization header.
 *
 * @param {Object} didDocument - DID document with id field
 * @param {string} serviceDomain - Service domain (e.g., "awiki.ai")
 * @param {Function} signCallback - Signing callback: (content: Buffer, methodFragment: string) => Buffer
 * @returns {string} Authorization header value
 */
export function generateAuthHeader(didDocument, serviceDomain, signCallback) {
    // 1. Build auth data
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const did = didDocument.id;

    const authData = {
        nonce,
        timestamp,
        aud: serviceDomain,
        did
    };

    // 2. JCS canonicalize
    const canonicalJson = canonicalize(authData);

    // 3. SHA-256 hash
    const contentHash = sha256(canonicalJson);

    // 4. ECDSA secp256k1 sign (DER format)
    const signature = signCallback(Buffer.from(contentHash), 'key-1');

    // 5. Base64URL encode
    const signatureB64Url = encodeBase64Url(signature);

    // 6. Build auth header
    const authHeader = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureB64Url}"`;

    return authHeader;
}

/**
 * Extract authentication header parts.
 *
 * @param {string} authHeader - Authorization header value
 * @returns {Object} Parsed parts: { version, did, nonce, timestamp, verificationMethod, signature }
 */
export function extractAuthHeaderParts(authHeader) {
    const parts = {};
    const regex = /(\w+)="([^"]*)"/g;
    let match;

    while ((match = regex.exec(authHeader)) !== null) {
        parts[match[1]] = match[2];
    }

    // Extract version (without quotes)
    const versionMatch = authHeader.match(/DIDWba v="([^"]*)"/);
    if (versionMatch) {
        parts.version = versionMatch[1];
    }

    return parts;
}

/**
 * Verify DID WBA authentication header signature.
 *
 * @param {string} authHeader - Authorization header value
 * @param {Object} didDocument - DID document with public key
 * @returns {boolean} True if signature is valid
 */
export function verifyAuthHeaderSignature(authHeader, didDocument) {
    const parts = extractAuthHeaderParts(authHeader);

    // Rebuild auth data (excluding signature)
    const authData = {
        nonce: parts.nonce,
        timestamp: parts.timestamp,
        aud: parts.aud,
        did: parts.did
    };

    // Canonicalize and hash
    const canonicalJson = canonicalize(authData);
    const contentHash = sha256(canonicalJson);

    // Decode signature from base64url
    const signatureBytes = Buffer.from(parts.signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

    // Extract public key from DID document
    const verificationMethod = didDocument.verificationMethod.find(vm => vm.id.endsWith('#key-1'));
    if (!verificationMethod || !verificationMethod.publicKeyJwk) {
        return false;
    }

    const jwk = verificationMethod.publicKeyJwk;
    const x = Buffer.from(jwk.x, 'base64url');
    const y = Buffer.from(jwk.y, 'base64url');

    // Reconstruct public key and verify
    try {
        const { secp256k1 } = require('@noble/curves/secp256k1');
        const publicKeyBytes = Buffer.concat([Buffer.from([0x04]), x, y]);
        return secp256k1.verify(signatureBytes, contentHash, publicKeyBytes);
    } catch (error) {
        return false;
    }
}

export {
    encodeBase64Url,
    encodeDerSignature,
    loadPrivateKeyFromPem
};

export default {
    generateAuthHeader,
    extractAuthHeaderParts,
    verifyAuthHeaderSignature,
    encodeBase64Url,
    encodeDerSignature,
    loadPrivateKeyFromPem
};
