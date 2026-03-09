/**
 * DID identity creation (secp256k1 key pair + DID document + proof).
 * 
 * Creates key-bound DID identity where the public key fingerprint 
 * automatically becomes the last segment of the DID path (k1_{fingerprint}).
 * 
 * @module utils/identity
 */

import crypto from 'crypto';
import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import { generateW3cProof } from '../w3c_proof.js';
import { base58btc } from 'multiformats/bases/base58';

/**
 * Create proper PKCS#8 PEM format for secp256k1 private key
 */
function createSecp256k1PrivateKeyPem(privateKeyBytes) {
    // PKCS#8 structure for EC private key with secp256k1
    // SEQUENCE { INTEGER 0, SEQUENCE { OID 1.3.132.0.10 }, OCTET STRING { privateKey } }
    const version = Buffer.from([0x02, 0x01, 0x00]); // INTEGER 0

    // secp256k1 OID: 1.3.132.0.10
    const algorithmIdentifier = Buffer.from([
        0x30, 0x09, // SEQUENCE length 9
        0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x01, 0x01, // OID 1.3.132.0.10 (secp256k1)
    ]);

    // Private key octet string
    const privateKeyOctet = Buffer.concat([
        Buffer.from([0x04, 0x20]), // OCTET STRING length 32
        Buffer.from(privateKeyBytes)
    ]);

    const pkcs8 = Buffer.concat([version, algorithmIdentifier, privateKeyOctet]);

    // Wrap in SEQUENCE
    const length = pkcs8.length;
    const lengthByte = length < 128 ? Buffer.from([length]) : Buffer.from([0x81, length]);
    const final = Buffer.concat([Buffer.from([0x30]), lengthByte, pkcs8]);

    const base64 = final.toString('base64').match(/.{1,64}/g).join('\n');
    return `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`;
}

/**
 * Create proper SPKI PEM format for secp256k1 public key
 */
function createSecp256k1PublicKeyPem(publicKeyBytes) {
    // SPKI structure for EC public key with secp256k1
    // SEQUENCE { SEQUENCE { OID ecPublicKey, OID secp256k1 }, BIT STRING { publicKey } }
    
    // Algorithm identifier: ecPublicKey (1.2.840.10045.2.1) + secp256k1 (1.3.132.0.10)
    const algorithmIdentifier = Buffer.from([
        0x30, 0x0a, // SEQUENCE length 10
        0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // ecPublicKey
        0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x0a, // secp256k1
    ]);
    
    // Public key as BIT STRING (prepended with 0x00 for unused bits)
    const publicKeyBitString = Buffer.concat([
        Buffer.from([0x03, 0x42, 0x00]), // BIT STRING length 66, unused bits 0
        Buffer.from(publicKeyBytes)
    ]);
    
    const spki = Buffer.concat([algorithmIdentifier, publicKeyBitString]);
    
    // Wrap in SEQUENCE
    const length = spki.length;
    const lengthByte = length < 128 ? Buffer.from([length]) : Buffer.from([0x81, length]);
    const final = Buffer.concat([Buffer.from([0x30]), lengthByte, spki]);
    
    const base64 = final.toString('base64').match(/.{1,64}/g).join('\n');
    return `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
}

/**
 * DID Identity data structure.
 * @typedef {Object} DIDIdentity
 * @property {string} did - DID identifier
 * @property {Object} did_document - DID document with proof
 * @property {Buffer} privateKey - secp256k1 private key bytes (32 bytes)
 * @property {Buffer} publicKey - secp256k1 public key bytes (65 bytes uncompressed)
 * @property {string} privateKeyPem - PEM-encoded private key
 * @property {string} publicKeyPem - PEM-encoded public key
 * @property {string} uniqueId - Unique ID extracted from DID (k1_{fingerprint})
 * @property {string|null} userId - User ID after registration
 * @property {string|null} jwtToken - JWT token after WBA authentication
 * @property {string|null} e2ee_signing_private_pem - key-2 secp256r1 signing private key PEM
 * @property {string|null} e2ee_signing_public_pem - key-2 secp256r1 signing public key PEM
 * @property {string|null} e2ee_agreement_private_pem - key-3 X25519 agreement private key PEM
 * @property {string|null} e2ee_agreement_public_pem - key-3 X25519 agreement public key PEM
 */

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
 * Convert secp256k1 public key to JWK format.
 * @param {Buffer} publicKeyBytes - Uncompressed public key bytes (65 bytes, starting with 0x04)
 * @returns {Object} JWK object
 */
export function publicKeyToJwk(publicKeyBytes) {
    if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
        throw new Error('Invalid public key format: expected 65 bytes uncompressed');
    }

    const x = publicKeyBytes.slice(1, 33);
    const y = publicKeyBytes.slice(33, 65);

    // Calculate kid using JWK Thumbprint (RFC 7638) - same as fingerprint calculation
    const xB64 = encodeBase64Url(x);
    const yB64 = encodeBase64Url(y);
    const canonicalInput = `{"crv":"secp256k1","kty":"EC","x":"${xB64}","y":"${yB64}"}`;
    const kid = encodeBase64Url(sha256(Buffer.from(canonicalInput, 'ascii')));

    return {
        kty: 'EC',
        crv: 'secp256k1',
        x: xB64,
        y: yB64,
        kid: kid
    };
}

/**
 * Convert private key bytes to PEM format (PKCS#8).
 * @param {Buffer} privateKeyBytes - Private key bytes (32 bytes)
 * @returns {string} PEM formatted private key
 */
export function privateKeyToPem(privateKeyBytes) {
    // Use Node.js crypto to create proper PKCS#8 format
    const crypto = require('crypto');
    
    // Create private key object from raw bytes
    // First, create an EC key using the raw bytes
    const privateKeyJwk = {
        kty: 'EC',
        crv: 'secp256k1',
        d: Buffer.from(privateKeyBytes).toString('base64url')
    };
    
    const privateKey = crypto.createPrivateKey({
        key: crypto.createPublicKey({
            key: privateKeyJwk,
            format: 'jwk'
        }).export({ type: 'pkcs8', format: 'pem' }),
        format: 'pem'
    });
    
    return privateKey.export({ type: 'pkcs8', format: 'pem' });
}

/**
 * Convert public key bytes to PEM format (SPKI).
 * @param {Buffer} publicKeyBytes - Public key bytes (65 bytes uncompressed)
 * @returns {string} PEM formatted public key
 */
export function publicKeyToPem(publicKeyBytes) {
    // SPKI format
    // SEQUENCE {
    //   SEQUENCE {
    //     OID 1.2.840.10045.2.1 (ecPublicKey)
    //     OID 1.3.132.0.10 (secp256k1)
    //   }
    //   BIT STRING { public key }
    // }
    const spkiHeader = Buffer.from([
        0x30, 0x59, // SEQUENCE, length 89
        0x30, 0x13, // SEQUENCE, length 19
        0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID ecPublicKey
        0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID secp256k1
        0x03, 0x42, 0x00 // BIT STRING, length 66
    ]);

    const spkiData = Buffer.concat([spkiHeader, Buffer.from(publicKeyBytes)]);
    const base64 = spkiData.toString('base64').match(/.{1,64}/g).join('\n');

    return `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
}

/**
 * Generate E2EE key pairs (secp256r1 for signing, X25519 for key agreement).
 * Also updates the DID document with key-2 and key-3 verification methods.
 * @param {DIDIdentity} identity - DID identity to add E2EE keys to
 * @returns {DIDIdentity} Identity with E2EE keys
 */
export function generateE2eeKeys(identity) {
    // Generate secp256r1 (P-256) signing key
    const signingKeyPair = crypto.generateKeyPairSync('ec', {
        namedCurve: 'P-256'
    });

    identity.e2ee_signing_private_pem = signingKeyPair.privateKey.export({
        format: 'pem',
        type: 'pkcs8'
    });

    identity.e2ee_signing_public_pem = signingKeyPair.publicKey.export({
        format: 'pem',
        type: 'spki'
    });

    // Generate X25519 (Curve25519) agreement key
    const agreementKeyPair = crypto.generateKeyPairSync('x25519');

    identity.e2ee_agreement_private_pem = agreementKeyPair.privateKey.export({
        format: 'pem',
        type: 'pkcs8'
    });

    identity.e2ee_agreement_public_pem = agreementKeyPair.publicKey.export({
        format: 'pem',
        type: 'spki'
    });

    // Add key-2 (secp256r1) to DID document
    const jwkP256 = {
        kty: 'EC',
        crv: 'P-256',
        x: identity.e2ee_signing_public_pem,
        y: '' // Will be extracted below
    };
    
    // Extract x and y from the PEM
    const pubKeyObj = crypto.createPublicKey(identity.e2ee_signing_public_pem);
    const jwk = pubKeyObj.export({ format: 'jwk' });
    
    identity.did_document.verificationMethod.push({
        id: `${identity.did}#key-2`,
        type: 'EcdsaSecp256r1VerificationKey2019',
        controller: identity.did,
        publicKeyJwk: {
            kty: 'EC',
            crv: 'P-256',
            x: jwk.x,
            y: jwk.y
        }
    });

    // Add key-3 (X25519) to DID document
    // For X25519, we use publicKeyMultibase format
    // Extract the raw 32-byte public key from the key object
    const rawX25519PubKey = agreementKeyPair.publicKey.export({ format: 'jwk' }).x;
    const rawX25519PubKeyBytes = Buffer.from(rawX25519PubKey, 'base64url');

    // Convert to base58btc (the encode result already includes 'z' prefix)
    const multibase = base58btc.encode(rawX25519PubKeyBytes);
    
    identity.did_document.verificationMethod.push({
        id: `${identity.did}#key-3`,
        type: 'X25519KeyAgreementKey2019',
        controller: identity.did,
        publicKeyMultibase: multibase
    });

    // Add keyAgreement field
    identity.did_document.keyAgreement = [
        `${identity.did}#key-3`
    ];

    // Add x25519-2019 context if not present
    const x25519Context = 'https://w3id.org/security/suites/x25519-2019/v1';
    if (!identity.did_document['@context'].includes(x25519Context)) {
        identity.did_document['@context'].push(x25519Context);
    }

    // REGENERATE proof to cover the new E2EE keys
    // The original proof was generated before adding key-2 and key-3
    // We need to sign the complete document including E2EE keys
    const originalProof = identity.did_document.proof;
    const proofOptions = {
        verificationMethod: originalProof.verificationMethod,
        proofPurpose: originalProof.proofPurpose,
        domain: originalProof.domain,
        // Keep the same challenge if present
        ...(originalProof.challenge && { challenge: originalProof.challenge })
    };
    
    // Remove old proof before regenerating
    delete identity.did_document.proof;
    
    // Generate new proof covering the complete document with E2EE keys
    const signedDocument = generateW3cProof(identity.did_document, identity.privateKey, proofOptions);
    identity.did_document = signedDocument;

    return identity;
}

/**
 * Create a key-bound DID identity (secp256k1 key pair + DID document + proof).
 *
 * @param {Object} options
 * @param {string} options.hostname - Domain name for the DID (e.g., "awiki.ai")
 * @param {string[]} [options.pathPrefix=['user']] - DID path prefix (e.g., ["user"])
 * @param {string} [options.proofPurpose='authentication'] - Proof purpose
 * @param {string} [options.domain] - Service domain bound to the proof
 * @param {string} [options.challenge] - Proof nonce (only added if explicitly provided)
 * @param {Object[]} [options.services] - Custom service entries
 * @returns {DIDIdentity} DID identity
 */
export function createIdentity({
    hostname,
    pathPrefix = ['user'],
    proofPurpose = 'authentication',
    domain,
    challenge,  // Only added if explicitly provided (matching Python behavior)
    services = []
} = {}) {
    if (!hostname) {
        throw new Error('Hostname cannot be empty');
    }

    // Generate secp256k1 key pair using noble-curves
    const privateKeyBytes = secp256k1.utils.randomPrivateKey();
    const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, false);

    // Create proper PEM format using Node.js crypto
    // Build proper PKCS#8 format manually for secp256k1
    const privateKeyPem = createSecp256k1PrivateKeyPem(privateKeyBytes);
    const publicKeyPem = createSecp256k1PublicKeyPem(publicKeyBytes);

    // Calculate fingerprint using JWK Thumbprint (RFC 7638)
    // This matches Python's compute_jwk_fingerprint
    const xCoord = publicKeyBytes.slice(1, 33);
    const yCoord = publicKeyBytes.slice(33, 65);
    const xB64 = encodeBase64Url(xCoord);
    const yB64 = encodeBase64Url(yCoord);
    // Canonical JSON with fixed field order (alphabetical, matching RFC 7638)
    const canonicalInput = `{"crv":"secp256k1","kty":"EC","x":"${xB64}","y":"${yB64}"}`;
    const fingerprint = encodeBase64Url(sha256(Buffer.from(canonicalInput, 'ascii')));

    // Build DID
    const uniqueId = `k1_${fingerprint}`;
    const didPath = [...pathPrefix, uniqueId].join(':');
    const did = `did:wba:${hostname}:${didPath}`;

    // Build JWK
    const jwk = publicKeyToJwk(publicKeyBytes);

    // Build verification method
    const verificationMethod = {
        id: `${did}#key-1`,
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: did,
        publicKeyJwk: jwk
    };

    // Build DID document
    const didDocument = {
        '@context': [
            'https://www.w3.org/ns/did/v1',
            'https://w3id.org/security/suites/jws-2020/v1',
            'https://w3id.org/security/suites/secp256k1-2019/v1'
        ],
        id: did,
        verificationMethod: [verificationMethod],
        authentication: [verificationMethod.id]
    };

    // Add services if provided
    if (services && services.length > 0) {
        didDocument.service = services.map(s => {
            const service = { ...s };
            if (s.id && s.id.startsWith('#')) {
                service.id = `${did}${s.id}`;
            }
            return service;
        });
    }

    // Generate proof
    const proofOptions = {
        verificationMethod: `${did}#key-1`,
        proofPurpose: proofPurpose,
        domain: domain || hostname,
        // Auto-generate challenge if not provided (matching Python behavior)
        challenge: challenge || crypto.randomBytes(16).toString('hex')
    };

    const signedDocument = generateW3cProof(didDocument, privateKeyBytes, proofOptions);

    // Create identity object (PEM already generated above)
    const identity = {
        did,
        did_document: signedDocument,
        privateKey: privateKeyBytes,
        publicKey: publicKeyBytes,
        privateKeyPem,
        publicKeyPem,
        uniqueId,
        userId: null,
        jwtToken: null,
        e2ee_signing_private_pem: null,
        e2ee_signing_public_pem: null,
        e2ee_agreement_private_pem: null,
        e2ee_agreement_public_pem: null
    };

    return identity;
}

/**
 * Load private key from PEM format.
 * @param {string} pem - PEM formatted private key
 * @returns {Buffer} Private key bytes (32 bytes)
 */
export function loadPrivateKeyFromPem(pem) {
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

export default {
    createIdentity,
    generateE2eeKeys,
    publicKeyToJwk,
    privateKeyToPem,
    publicKeyToPem,
    loadPrivateKeyFromPem,
    encodeBase64Url
};
