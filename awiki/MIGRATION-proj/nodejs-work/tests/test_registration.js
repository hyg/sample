#!/usr/bin/env node

/**
 * Test full DID registration with Node.js generated proof.
 */

import crypto from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { generateW3cProof } from '../src/w3c_proof.js';
import axios from 'axios';

console.log("=== Testing Full DID Registration with Node.js Proof ===\n");

// Generate key pair
const keyPair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    publicKeyEncoding: { format: 'pem', type: 'spki' }
});

// Extract keys
const privateKey = crypto.createPrivateKey(keyPair.privateKey);
const jwk = privateKey.export({ format: 'jwk' });
const privBytes = Buffer.from(jwk.d, 'base64url');
const pubX = Buffer.from(jwk.x, 'base64url');
const pubY = Buffer.from(jwk.y, 'base64url');

// Calculate kid
const pubBytes = Buffer.concat([Buffer.from([0x04]), pubX, pubY]);
const compressed = secp256k1.Point.fromHex(pubBytes).toRawBytes(true);
const kid = Buffer.from(sha256(compressed)).toString('base64url').replace(/=/g, '');

const did = `did:wba:awiki.ai:user:k1_${kid}`;
console.log("DID:", did);
console.log("kid:", kid);

// Build DID document
const jwk_obj = {
    kty: 'EC',
    crv: 'secp256k1',
    x: jwk.x,
    y: jwk.y,
    kid: kid
};

const didDocument = {
    '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/jws-2020/v1',
        'https://w3id.org/security/suites/secp256k1-2019/v1'
    ],
    id: did,
    verificationMethod: [{
        id: `${did}#key-1`,
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: did,
        publicKeyJwk: jwk_obj
    }],
    authentication: [`${did}#key-1`]
};

// Generate proof
const challenge = crypto.randomBytes(16).toString('hex');
const signedDoc = generateW3cProof(didDocument, privBytes, {
    verificationMethod: `${did}#key-1`,
    proofPurpose: 'authentication',
    domain: 'awiki.ai',
    challenge: challenge
});

console.log("\nProof value:", signedDoc.proof.proofValue);

// Register
(async () => {
    try {
        console.log("\nRegistering with awiki.ai...\n");
        
        const response = await axios.post('https://awiki.ai/user-service/did-auth/rpc', {
            jsonrpc: '2.0',
            method: 'register',
            params: {
                did_document: signedDoc,
                name: 'NodeJSTest2',
                is_agent: true
            },
            id: 1
        });
        
        if (response.data.error) {
            console.log("Registration failed:");
            console.log("  Error:", response.data.error.message);
            if (response.data.error.data) {
                console.log("  Data:", JSON.stringify(response.data.error.data, null, 2));
            }
        } else {
            console.log("\nSUCCESS! Registration completed!");
            console.log("  DID:", response.data.result.did);
            console.log("  User ID:", response.data.result.user_id);
            
            // Save credentials
            const fs = await import('fs');
            const path = await import('path');
            
            const credDir = path.join(process.cwd(), '.credentials');
            if (!fs.existsSync(credDir)) {
                fs.mkdirSync(credDir, { recursive: true, mode: 0o700 });
            }
            
            const credential = {
                did: response.data.result.did,
                unique_id: response.data.result.did.split(':').pop(),
                user_id: response.data.result.user_id,
                private_key_pem: keyPair.privateKey,
                public_key_pem: keyPair.publicKey,
                jwt_token: null,
                name: 'NodeJSTest2',
                did_document: signedDoc,
                created_at: new Date().toISOString()
            };
            
            const credPath = path.join(credDir, 'nodetest2.json');
            fs.writeFileSync(credPath, JSON.stringify(credential, null, 2), { mode: 0o600 });
            console.log("\nCredentials saved to:", credPath);
        }
    } catch (error) {
        console.log("Request failed:");
        console.log("  Error:", error.message);
        if (error.response) {
            console.log("  Status:", error.response.status);
            console.log("  Data:", error.response?.data);
        }
    }
})();
