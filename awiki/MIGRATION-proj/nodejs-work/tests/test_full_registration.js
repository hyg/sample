#!/usr/bin/env node

/**
 * Test full DID registration flow with Node.js generated proof.
 */

import crypto from 'crypto';
import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import canonicalize from 'canonicalize';
import axios from 'axios';

function encodeBase64Url(data) {
    if (Buffer.isBuffer(data)) {
        return data.toString('base64url').replace(/=/g, '');
    }
    return Buffer.from(data).toString('base64url').replace(/=/g, '');
}

async function testFullFlow() {
    console.log("Testing full DID registration flow with Node.js generated proof\n");
    
    // Step 1: Generate key pair
    const keyPair = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1',
        privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
        publicKeyEncoding: { format: 'pem', type: 'spki' }
    });
    
    // Use crypto module to properly extract key bytes
    const privateKey = crypto.createPrivateKey(keyPair.privateKey);
    const privateKeyBytes = privateKey.export({ format: 'der', type: 'pkcs8' }).slice(-32);
    
    console.log("[Step 1] Key pair generated");
    
    // Step 2: Build DID document
    const publicKeyBytes = Buffer.from(keyPair.publicKey.split('\n').filter(l => !l.startsWith('-----') && l.trim()).join(''), 'base64').slice(-65);
    const compressed = secp256k1.Point.fromHex(publicKeyBytes).toRawBytes(true);
    const kid = encodeBase64Url(sha256(compressed));
    
    const did = `did:wba:awiki.ai:user:k1_${kid}`;
    
    const jwk = {
        kty: 'EC',
        crv: 'secp256k1',
        x: encodeBase64Url(publicKeyBytes.slice(1, 33)),
        y: encodeBase64Url(publicKeyBytes.slice(33, 65)),
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
            publicKeyJwk: jwk
        }],
        authentication: [`${did}#key-1`]
    };
    
    console.log("[Step 2] DID document built");
    console.log("  DID:", did);
    
    // Step 3: Create proof
    const challenge = crypto.randomBytes(16).toString('hex');
    const created = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const domain = 'awiki.ai';
    
    const proof = {
        type: 'EcdsaSecp256k1Signature2019',
        verificationMethod: `${did}#key-1`,
        created: created,
        proofPurpose: 'authentication',
        domain: domain,
        challenge: challenge,
        proofValue: ''
    };
    
    console.log("[Step 3] Proof structure created");
    console.log("  Timestamp:", created);
    
    // Step 4: Create document to sign
    const docToSign = JSON.parse(JSON.stringify(didDocument));
    docToSign.proof = JSON.parse(JSON.stringify(proof));
    
    console.log("[Step 4] Document to sign prepared");
    
    // Step 5: JCS Canonicalize
    const canonicalJson = canonicalize(docToSign);
    
    console.log("[Step 5] JCS Canonicalize");
    console.log("  Length:", canonicalJson.length, "bytes");
    
    // Step 6: Calculate SHA-256 hash
    const contentHash = sha256(canonicalJson);
    
    console.log("[Step 6] SHA-256 hash");
    console.log("  Hash:", Buffer.from(contentHash).toString('hex'));
    
    // Step 7: Sign
    const signature = secp256k1.sign(contentHash, privateKeyBytes);
    const r = signature.r;
    let s = signature.s;
    
    // Low-S normalization
    const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    if (s > CURVE_ORDER / BigInt(2)) {
        s = CURVE_ORDER - s;
    }
    
    const rBytes = Buffer.from(r.toString(16).padStart(64, '0'), 'hex');
    const sBytes = Buffer.from(s.toString(16).padStart(64, '0'), 'hex');
    const signatureRs = Buffer.concat([rBytes, sBytes]);
    const proofValue = encodeBase64Url(signatureRs);
    
    console.log("[Step 7] Signature generated");
    console.log("  Signature:", proofValue);
    
    // Step 8: Update proof
    proof.proofValue = proofValue;
    didDocument.proof = proof;
    
    console.log("[Step 8] Proof added to DID document");
    
    // Step 9: Register
    console.log("\n[Step 9] Registering with awiki.ai...\n");
    
    const userServiceUrl = process.env.E2E_USER_SERVICE_URL || 'https://awiki.ai';
    
    try {
        const response = await axios.post(`${userServiceUrl}/user-service/did-auth/rpc`, {
            jsonrpc: '2.0',
            method: 'register',
            params: {
                did_document: didDocument,
                name: 'NodeTestAgent',
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
            return false;
        } else {
            console.log("SUCCESS! Registration completed!");
            console.log("  DID:", response.data.result.did);
            console.log("  User ID:", response.data.result.user_id);
            
            // Save credentials for later use
            console.log("\nSaving credentials...");
            
            const fs = await import('fs');
            const path = await import('path');
            
            const credDir = path.join(__dirname, '..', '.credentials');
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
                name: 'NodeTestAgent',
                did_document: didDocument,
                created_at: new Date().toISOString()
            };
            
            const credPath = path.join(credDir, 'nodetest.json');
            fs.writeFileSync(credPath, JSON.stringify(credential, null, 2), { mode: 0o600 });
            console.log("  Credentials saved to:", credPath);
            
            return true;
        }
    } catch (error) {
        console.log("Request failed:");
        console.log("  Error:", error.message);
        if (error.response) {
            console.log("  Status:", error.response.status);
            console.log("  Data:", error.response.data);
        }
        return false;
    }
}

testFullFlow().then(success => {
    if (success) {
        console.log("\n" + "=".repeat(60));
        console.log("Node.js DID registration test PASSED!");
        console.log("=".repeat(60));
    } else {
        console.log("\n" + "=".repeat(60));
        console.log("Node.js DID registration test FAILED!");
        console.log("=".repeat(60));
        process.exit(1);
    }
}).catch(console.error);
