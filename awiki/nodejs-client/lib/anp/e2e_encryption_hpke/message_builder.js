/**
 * EcdsaSecp256r1Signature2019 proof generation and verification.
 * 
 * Matching Python implementation in anp_src/anp_package/e2e_encryption_hpke/proof.py
 * 
 * Different from W3C proof:
 * - W3C uses hash(options) || hash(document) for signing
 * - This protocol signs the complete JSON (excluding proof_value) directly
 */

import crypto from 'crypto';
import canonicalize from 'canonicalize';
import { p256 } from '@noble/curves/p256';

const PROOF_TYPE = 'EcdsaSecp256r1Signature2019';

/**
 * Encode bytes as base64url without padding.
 * @param {Buffer} data
 * @returns {string}
 */
function b64urlEncode(data) {
    return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode base64url string.
 * @param {string} str
 * @returns {Buffer}
 */
function b64urlDecode(str) {
    const padding = '='.repeat((4 - str.length % 4) % 4);
    return Buffer.from(str + padding, 'base64');
}

/**
 * Strip proof_value from content.
 * @param {Object} content
 * @returns {Object}
 */
function stripProofValue(content) {
    const result = JSON.parse(JSON.stringify(content));
    if (result.proof && result.proof.proof_value) {
        delete result.proof.proof_value;
    }
    return result;
}

/**
 * ECDSA secp256r1 signature, return R||S (64 bytes).
 * @param {Buffer} privateKeyBytes - 32 bytes
 * @param {Buffer} data
 * @returns {Buffer} 64 bytes signature
 */
function signSecp256r1(privateKeyBytes, data) {
    // Hash the data first (matching Python's ECDSA(SHA256()))
    const dataHash = crypto.createHash('sha256').update(data).digest();
    
    // Sign
    const signature = p256.sign(dataHash, privateKeyBytes);
    
    // Convert to R||S format (32 bytes each)
    const rBytes = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
    const sBytes = Buffer.from(signature.s.toString(16).padStart(64, '0'), 'hex');
    
    return Buffer.concat([rBytes, sBytes]);
}

/**
 * Verify ECDSA secp256r1 signature.
 * @param {Buffer} publicKeyBytes - 32 bytes
 * @param {Buffer} data
 * @param {Buffer} signature - 64 bytes R||S
 * @returns {boolean}
 */
function verifySecp256r1(publicKeyBytes, data, signature) {
    try {
        // Hash the data first
        const dataHash = crypto.createHash('sha256').update(data).digest();
        
        // Extract R and S
        const r = BigInt('0x' + signature.slice(0, 32).toString('hex'));
        const s = BigInt('0x' + signature.slice(32).toString('hex'));
        
        // Verify
        return p256.verify({ r, s }, dataHash, publicKeyBytes);
    } catch (e) {
        return false;
    }
}

/**
 * Generate proof signature for content.
 * 
 * Flow: content (with proof but without proof_value) → JCS canonicalize
 * → UTF-8 → ECDSA(SHA-256) → Base64URL
 * 
 * @param {Object} content - Content dict without proof field
 * @param {Buffer} privateKeyPem - secp256r1 private key PEM
 * @param {string} verificationMethod - DID document verification method ID
 * @returns {Object} Content with proof field
 */
export function generateW3cProof(content, privateKeyPem, verificationMethod) {
    const result = JSON.parse(JSON.stringify(content));
    
    // Generate timestamp
    const created = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    
    // Build proof object (without proof_value)
    result.proof = {
        type: PROOF_TYPE,
        created: created,
        verification_method: verificationMethod
    };
    
    // JCS canonicalize → UTF-8 → sign
    const canonicalJson = canonicalize(result);
    const canonicalBytes = Buffer.from(canonicalJson, 'utf-8');
    
    // Parse PEM to get raw private key bytes
    const pemLines = privateKeyPem.toString('utf-8').split('\n').filter(l => !l.startsWith('-----') && l.trim());
    const der = Buffer.from(pemLines.join(''), 'base64');
    
    // PKCS#8 format: find the private key octet string
    let privOffset = -1;
    for (let i = 0; i < der.length - 2; i++) {
        if (der[i] === 0x04 && der[i + 1] === 0x20) {
            privOffset = i + 2;
            break;
        }
    }
    
    if (privOffset === -1) {
        throw new Error('Failed to parse private key PEM');
    }
    
    const privateKeyBytes = der.slice(privOffset, privOffset + 32);
    
    // Sign
    const signature = signSecp256r1(privateKeyBytes, canonicalBytes);
    result.proof.proof_value = b64urlEncode(signature);
    
    return result;
}

/**
 * Verify proof signature.
 * 
 * @param {Object} content - Content with proof field
 * @param {Buffer} publicKeyPem - secp256r1 public key PEM
 * @param {number} maxTimeDrift - Max allowed time drift (seconds)
 * @returns {boolean} True if valid
 */
export function verifyW3cProof(content, publicKeyPem, maxTimeDrift = 300) {
    const proof = content.proof;
    if (!proof) {
        return false;
    }
    
    const proofValue = proof.proof_value;
    if (!proofValue) {
        return false;
    }
    
    const proofType = proof.type;
    if (proofType !== PROOF_TYPE) {
        return false;
    }
    
    // Check timestamp
    if (proof.created && maxTimeDrift > 0) {
        const createdTime = new Date(proof.created);
        const now = new Date();
        const drift = Math.abs((now - createdTime).getTime() / 1000);
        if (drift > maxTimeDrift) {
            return false;
        }
    }
    
    // Strip proof_value and canonicalize
    const contentWithoutProofValue = stripProofValue(content);
    const canonicalJson = canonicalize(contentWithoutProofValue);
    const canonicalBytes = Buffer.from(canonicalJson, 'utf-8');
    
    // Decode signature
    const signature = b64urlDecode(proofValue);
    
    // Parse PEM to get raw public key bytes
    const pemLines = publicKeyPem.toString('utf-8').split('\n').filter(l => !l.startsWith('-----') && l.trim());
    const der = Buffer.from(pemLines.join(''), 'base64');
    
    // PKCS#8 format for public key is different, extract from SPKI
    // For secp256r1, the public key is at the end
    let pubOffset = -1;
    for (let i = der.length - 65; i > 0; i--) {
        if (der[i] === 0x04 && der[i + 1] === 0x41) {
            pubOffset = i + 2;
            break;
        }
    }
    
    if (pubOffset === -1) {
        return false;
    }
    
    const publicKeyBytes = der.slice(pubOffset, pubOffset + 65);
    
    // Verify
    return verifySecp256r1(publicKeyBytes, canonicalBytes, signature);
}
