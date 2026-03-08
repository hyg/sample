#!/usr/bin/env node

/**
 * Test real registration with awiki.ai using Node.js generated proof.
 */

import { createIdentity, generateE2eeKeys } from '../src/utils/identity.js';
import { createSDKConfig } from '../src/utils/config.js';
import axios from 'axios';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('Real awiki.ai Registration Test - Node.js Generated Proof');
console.log('='.repeat(80));

const config = createSDKConfig();

console.log('\n[Step 1] Create DID Identity with Node.js');
console.log('-'.repeat(40));

let identity = createIdentity({
    hostname: config.did_domain,
    pathPrefix: ['user'],
    proofPurpose: 'authentication',
    domain: config.did_domain
});

identity = generateE2eeKeys(identity);

console.log(`DID: ${identity.did}`);
console.log(`unique_id: ${identity.uniqueId}`);

// Save DID document for debugging
writeFileSync(join(__dirname, 'debug_nodejs_did.json'), JSON.stringify(identity.did_document, null, 2));
console.log('\nDID document saved to debug_nodejs_did.json');

console.log('\n[Step 2] Register with awiki.ai');
console.log('-'.repeat(40));

try {
    const response = await axios.post(`${config.user_service_url}/user-service/did-auth/rpc`, {
        jsonrpc: '2.0',
        method: 'register',
        params: {
            did_document: identity.did_document,
            name: 'NodeJSTest',
            is_agent: true
        },
        id: 1
    }, {
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.error) {
        console.log(`\nRegistration FAILED: ${response.data.error.message}`);
        if (response.data.error.data) {
            console.log(`Details: ${response.data.error.data}`);
        }
        process.exit(1);
    }
    
    console.log(`\nRegistration SUCCESS!`);
    console.log(`DID: ${response.data.result.did}`);
    console.log(`User ID: ${response.data.result.user_id}`);
    
    console.log('\n[Step 3] Get JWT Token');
    console.log('-'.repeat(40));
    
    // Now get JWT token
    const jwtResponse = await axios.post(`${config.user_service_url}/user-service/did-auth/rpc`, {
        jsonrpc: '2.0',
        method: 'verify',
        params: {
            authorization: generateAuthHeader(identity.did_document, config.did_domain, identity.privateKey),
            domain: config.did_domain
        },
        id: 1
    }, {
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });
    
    console.log('JWT Response:', JSON.stringify(jwtResponse.data, null, 2));
    
    if (jwtResponse.data.error) {
        console.log(`\nJWT verification FAILED: ${jwtResponse.data.error.message}`);
        process.exit(1);
    }
    
    console.log(`\nJWT verification SUCCESS!`);
    console.log(`JWT token: ${jwtResponse.data.result.access_token.substring(0, 50)}...`);
    
    console.log('\n' + '='.repeat(80));
    console.log('COMPLETE SUCCESS!');
    console.log('Node.js implementation can register with awiki.ai!');
    console.log('='.repeat(80));
    
} catch (error) {
    console.error('\nError:', error.message);
    if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
        console.error('Stack:', error.stack);
    }
    process.exit(1);
}

/**
 * Generate DIDWba auth header.
 */
function generateAuthHeader(didDocument, domain, privateKeyBytes) {
    const { secp256k1 } = await import('@noble/curves/secp256k1');
    const { sha256 } = await import('@noble/hashes/sha256');
    const canonicalize = (await import('canonicalize')).default;
    
    const did = didDocument.id;
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    
    const authData = {
        nonce,
        timestamp,
        service: `${domain}`,
        did
    };
    
    const canonicalJson = canonicalize(authData);
    const contentHash = sha256(canonicalJson);
    const signature = secp256k1.sign(contentHash, privateKeyBytes);
    
    // Convert to DER format
    const r = signature.r.toBigInt();
    let s = signature.s.toBigInt();
    const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    if (s > CURVE_ORDER / BigInt(2)) {
        s = CURVE_ORDER - s;
    }
    
    const rBytes = Buffer.from(r.toString(16).padStart(64, '0'), 'hex');
    const sBytes = Buffer.from(s.toString(16).padStart(64, '0'), 'hex');
    
    // DER encode
    let rDer = rBytes;
    let sDer = sBytes;
    if (rBytes[0] & 0x80) rDer = Buffer.concat([Buffer.alloc(1), rBytes]);
    if (sBytes[0] & 0x80) sDer = Buffer.concat([Buffer.alloc(1), sBytes]);
    
    const totalLen = 2 + rDer.length + 2 + sDer.length;
    const derSig = Buffer.concat([
        Buffer.from([0x30, totalLen]),
        Buffer.from([0x02, rDer.length]),
        rDer,
        Buffer.from([0x02, sDer.length]),
        sDer
    ]);
    
    const signatureB64Url = derSig.toString('base64url').replace(/=/g, '');
    
    return `DIDWba did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureB64Url}"`;
}

import crypto from 'crypto';
