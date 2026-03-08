#!/usr/bin/env node

/**
 * Test awiki.ai JWT verification using freshly registered TestFresh identity.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';
import axios from 'axios';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('Test awiki.ai JWT Verification (Using Fresh TestFresh Identity)');
console.log('='.repeat(80));

// Load TestFresh credential (freshly registered with Python)
const credPath = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message', 'testfresh.json');

console.log('\n[1] Load Credential');
console.log('-'.repeat(80));
console.log(`Credential path: ${credPath}`);

let credData;
try {
    credData = JSON.parse(readFileSync(credPath, 'utf-8'));
} catch (error) {
    console.error(`Failed to load credential: ${error.message}`);
    process.exit(1);
}

const did = credData.did;
const privateKeyPem = credData.private_key_pem;

console.log(`DID: ${did}`);
console.log(`Private Key: ${privateKeyPem.substring(0, 50)}...`);

// Parse PEM using crypto.createPrivateKey
let privateKeyBytes;
try {
    const privateKeyObj = crypto.createPrivateKey(privateKeyPem);
    const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
    const dHex = Buffer.from(privateKeyJwk.d, 'base64url').toString('hex');
    privateKeyBytes = Buffer.from(dHex, 'hex');
} catch (error) {
    console.error(`Failed to parse private key: ${error.message}`);
    process.exit(1);
}
console.log(`Private Key (hex): ${privateKeyBytes.toString('hex').substring(0, 32)}...`);

// Generate new nonce and timestamp
const nonce = crypto.randomBytes(16).toString('hex');
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

console.log('\n[2] Generate Auth Data');
console.log('-'.repeat(80));
console.log(`Nonce: ${nonce}`);
console.log(`Timestamp: ${timestamp}`);

// Build data to sign
const dataToSign = {
    nonce: nonce,
    timestamp: timestamp,
    aud: 'awiki.ai',
    did: did
};

// JCS canonicalize
const canonicalJson = canonicalize(dataToSign);
console.log(`\nCanonical JSON: ${canonicalJson}`);

// SHA-256 hash
const contentHash = sha256(Buffer.from(canonicalJson, 'utf-8'));
console.log(`Content Hash: ${contentHash.toString('hex')}`);

// Sign with private key
const signature = secp256k1.sign(contentHash, privateKeyBytes);
console.log(`\nSignature R: ${signature.r.toString(16).substring(0, 32)}...`);
console.log(`Signature S: ${signature.s.toString(16).substring(0, 32)}...`);

// Convert to R||S format
const rBytes = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
const sBytes = Buffer.from(signature.s.toString(16).padStart(64, '0'), 'hex');
const rsSignature = Buffer.concat([rBytes, sBytes]);

// Base64URL encode
const signatureB64Url = rsSignature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
console.log(`\nSignature (Base64URL): ${signatureB64Url}`);

// Build Authorization header
const authHeader = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureB64Url}"`;

console.log('\n[3] Authorization Header');
console.log('-'.repeat(80));
console.log(authHeader);

// Build JWT verification request
const requestBody = {
    jsonrpc: '2.0',
    method: 'verify',
    params: {
        authorization: authHeader,
        domain: 'awiki.ai'
    },
    id: 1
};

console.log('\n[4] Request Body');
console.log('-'.repeat(80));
console.log(JSON.stringify(requestBody, null, 2));

// Send request to awiki.ai
console.log('\n[5] Sending request to awiki.ai...');

async function testJwtVerification() {
    try {
        const response = await axios.post(
            'https://awiki.ai/user-service/did-auth/rpc',
            requestBody,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        console.log('\n[6] Response');
        console.log('-'.repeat(80));
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.result) {
            console.log('\n✓ JWT verification SUCCESS');
            console.log(`JWT Token: ${response.data.result.access_token?.substring(0, 80)}...`);
            console.log(`User ID: ${response.data.result.user_id || 'N/A'}`);
        } else {
            console.log('\n✗ JWT verification FAILED');
            console.log(`Error: ${response.data.error?.message}`);
            console.log(`Error Data: ${response.data.error?.data}`);
        }

        // Save result
        const result = {
            test: 'Fresh TestFresh Identity (Python registered, Node.js verified)',
            did: did,
            nonce: nonce,
            timestamp: timestamp,
            request: requestBody,
            auth_header: authHeader,
            response: response.data,
            success: !!response.data.result,
            test_timestamp: new Date().toISOString()
        };

        const outputPath = join(__dirname, 'python_output', 'test_awiki_testfresh_result.json');
        writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`\nResult saved to: ${outputPath}`);

    } catch (error) {
        console.error('\n✗ Request failed');
        console.error(error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

await testJwtVerification();

console.log('\n' + '='.repeat(80));
