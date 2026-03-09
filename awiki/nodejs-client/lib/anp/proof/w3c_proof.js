/**
 * W3C Data Integrity Proof generation and verification.
 * 
 * Implements proof generation and verification following the W3C Data Integrity
 * specification (https://www.w3.org/TR/vc-data-integrity/), adapted for ANP
 * use cases with JCS canonicalization (RFC 8785).
 * 
 * Flow:
 *   1. Canonicalize the document (excluding any existing proof) using JCS
 *   2. Canonicalize the proof options (type, created, verificationMethod, proofPurpose)
 *   3. Hash both with SHA-256
 *   4. Concatenate hashes: hash(proof_options) || hash(document)
 *   5. Sign the concatenated bytes with the private key
 *   6. Encode signature as base64url → proofValue
 *   7. Attach proof object to document
 * 
 * Supported Proof Types:
 *   - EcdsaSecp256k1Signature2019: ECDSA with secp256k1 curve + SHA-256
 *   - Ed25519Signature2020: Ed25519 (RFC 8032)
 * 
 * @module w3c_proof
 */

import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import jcsCanonicalize from 'canonicalize';

// Proof type constants
const PROOF_TYPE_SECP256K1 = 'EcdsaSecp256k1Signature2019';
const PROOF_TYPE_ED25519 = 'Ed25519Signature2020';

/**
 * Encode bytes as base64url without padding.
 * @param {Buffer|Uint8Array} data 
 * @returns {string}
 */
export function b64urlEncode(data) {
    if (Buffer.isBuffer(data)) {
        return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    return Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode base64url string (with or without padding).
 * @param {string} str 
 * @returns {Buffer}
 */
export function b64urlDecode(str) {
    const padding = '='.repeat((4 - str.length % 4) % 4);
    return Buffer.from(str + padding, 'base64');
}

/**
 * Canonicalize a JSON object using JCS (RFC 8785).
 * @param {Object} obj - JSON-serializable dictionary
 * @returns {Buffer} Canonical byte representation
 */
export function canonicalize(obj) {
    const result = jcsCanonicalize(obj);
    return Buffer.from(result, 'utf-8');
}

/**
 * Compute SHA-256 hash of bytes.
 * @param {Buffer|Uint8Array|string} data 
 * @returns {Buffer} 32 bytes hash
 */
export function hashBytes(data) {
    if (typeof data === 'string') {
        data = Buffer.from(data, 'utf-8');
    } else if (Buffer.isBuffer(data)) {
        // Already a buffer
    } else {
        data = Buffer.from(data);
    }
    return Buffer.from(sha256(data));
}

/**
 * Sign data with secp256k1 ECDSA, return R||S raw signature.
 * 
 * Note: Python's cryptography library hashes the input with SHA256 before signing.
 * Our toBeSigned is already a hash (options_hash || doc_hash = 64 bytes),
 * so we need to hash it again to match Python's behavior.
 * 
 * @param {Buffer} privateKeyBytes - 32 bytes private key
 * @param {Buffer} data - Data to sign (64 bytes toBeSigned in our case)
 * @returns {Buffer} 64 bytes signature (R||S) with low-S normalization
 */
export function signSecp256k1(privateKeyBytes, data) {
    // Python hashes the toBeSigned (64 bytes) with SHA256 before signing
    // noble-curves also hashes internally, so we need to double-hash
    const dataHash = sha256(data);
    const signature = secp256k1.sign(dataHash, privateKeyBytes);

    // Fixed 32-byte encoding for each component
    const rBytes = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
    
    // Apply low-S normalization (BIP 146)
    const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    const sBigInt = BigInt(signature.s);
    const normalizedS = sBigInt > CURVE_ORDER / BigInt(2) ? CURVE_ORDER - sBigInt : sBigInt;
    const sBytes = Buffer.from(normalizedS.toString(16).padStart(64, '0'), 'hex');

    return Buffer.concat([rBytes, sBytes]);
}

/**
 * Verify secp256k1 ECDSA signature (R||S format).
 * 
 * Note: Python's cryptography library hashes the input with SHA256 before verification.
 * Our toBeSigned is already a hash (options_hash || doc_hash = 64 bytes),
 * so we need to hash it again to match Python's behavior.
 * 
 * @param {Buffer} publicKeyBytes - 65 bytes uncompressed public key
 * @param {Buffer} data - Data that was signed (64 bytes toBeSigned in our case)
 * @param {Buffer} signature - 64 bytes signature (R||S)
 * @returns {boolean} True if valid
 */
export function verifySecp256k1(publicKeyBytes, data, signature) {
    try {
        // Python hashes the toBeSigned (64 bytes) with SHA256 before verification
        // noble-curves also hashes internally, so we need to double-hash
        const dataHash = sha256(data);
        return secp256k1.verify(signature, dataHash, publicKeyBytes);
    } catch (e) {
        return false;
    }
}

/**
 * Compute the data to be signed.
 * 
 * Following W3C Data Integrity:
 *   toBeSigned = hash(canonicalize(proof_options)) || hash(canonicalize(document))
 * 
 * @param {Object} document - The document to sign (without proof field)
 * @param {Object} proofOptions - Proof options (type, created, verificationMethod, proofPurpose)
 * @returns {Buffer} Concatenated hash bytes (64 bytes)
 */
export function computeSigningInput(document, proofOptions) {
    const docHash = hashBytes(canonicalize(document));
    const optionsHash = hashBytes(canonicalize(proofOptions));
    
    // Concatenate: options_hash + doc_hash (32 + 32 = 64 bytes)
    return Buffer.concat([optionsHash, docHash]);
}

/**
 * Generate a W3C Data Integrity Proof for a JSON document.
 * 
 * @param {Object} document - JSON document to sign
 * @param {Buffer} privateKeyBytes - 32 bytes secp256k1 private key
 * @param {Object} options - Proof options
 * @param {string} options.verificationMethod - Full DID URL of the verification method
 * @param {string} [options.proofPurpose='authentication'] - The purpose of the proof
 * @param {string} [options.proofType] - Explicit proof type (auto-detected if not provided)
 * @param {string} [options.created] - ISO 8601 timestamp (default: current UTC time)
 * @param {string} [options.domain] - Optional domain restriction for the proof
 * @param {string} [options.challenge] - Optional challenge string for the proof
 * @returns {Object} New object containing the original document fields plus a "proof" field
 */
export function generateW3cProof(document, privateKeyBytes, options = {}) {
    const {
        verificationMethod,
        proofPurpose = 'authentication',
        proofType = PROOF_TYPE_SECP256K1,
        created,
        domain,
        challenge
    } = options;
    
    // Prepare timestamp
    const createdTime = created || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    
    // Build proof options (used for hashing, without proofValue)
    const proofOptions = {
        type: proofType,
        created: createdTime,
        verificationMethod: verificationMethod,
        proofPurpose: proofPurpose
    };
    
    if (domain !== undefined) {
        proofOptions.domain = domain;
    }
    
    if (challenge !== undefined) {
        proofOptions.challenge = challenge;
    }
    
    // Remove existing proof from document for signing
    const docWithoutProof = {};
    for (const key of Object.keys(document)) {
        if (key !== 'proof') {
            docWithoutProof[key] = document[key];
        }
    }
    
    // Compute signing input
    const toBeSigned = computeSigningInput(docWithoutProof, proofOptions);
    
    // Sign
    const signature = signSecp256k1(privateKeyBytes, toBeSigned);
    
    // Encode signature as base64url
    const proofValue = b64urlEncode(signature);
    
    // Build complete proof object
    const proof = { ...proofOptions, proofValue: proofValue };
    
    // Return new document with proof attached
    return { ...document, proof: proof };
}

/**
 * Verify a W3C Data Integrity Proof on a JSON document.
 * 
 * @param {Object} document - Document containing a "proof" field
 * @param {Buffer} publicKeyBytes - 65 bytes uncompressed public key
 * @param {Object} [options] - Verification options
 * @param {string} [options.expectedPurpose] - If provided, verify that proofPurpose matches
 * @param {string} [options.expectedDomain] - If provided, verify that domain matches
 * @param {string} [options.expectedChallenge] - If provided, verify that challenge matches
 * @returns {boolean} True if the proof is valid, false otherwise
 */
export function verifyW3cProof(document, publicKeyBytes, options = {}) {
    const { expectedPurpose, expectedDomain, expectedChallenge } = options;
    
    const proof = document.proof;
    if (!proof) {
        return false;
    }
    
    // Extract proof fields
    const proofOptions = {
        type: proof.type,
        created: proof.created,
        verificationMethod: proof.verificationMethod,
        proofPurpose: proof.proofPurpose
    };
    
    if (proof.domain !== undefined) {
        proofOptions.domain = proof.domain;
    }
    
    if (proof.challenge !== undefined) {
        proofOptions.challenge = proof.challenge;
    }
    
    // Verify expected values
    if (expectedPurpose && proof.proofPurpose !== expectedPurpose) {
        return false;
    }
    
    if (expectedDomain && proof.domain !== expectedDomain) {
        return false;
    }
    
    if (expectedChallenge && proof.challenge !== expectedChallenge) {
        return false;
    }
    
    // Remove proof from document for verification
    const docWithoutProof = {};
    for (const key of Object.keys(document)) {
        if (key !== 'proof') {
            docWithoutProof[key] = document[key];
        }
    }
    
    // Compute signing input
    const toBeSigned = computeSigningInput(docWithoutProof, proofOptions);
    
    // Decode signature
    const signature = b64urlDecode(proof.proofValue);
    
    // Verify signature
    return verifySecp256k1(publicKeyBytes, toBeSigned, signature);
}

export default {
    PROOF_TYPE_SECP256K1,
    PROOF_TYPE_ED25519,
    b64urlEncode,
    b64urlDecode,
    canonicalize,
    hashBytes,
    signSecp256k1,
    verifySecp256k1,
    computeSigningInput,
    generateW3cProof,
    verifyW3cProof
};
