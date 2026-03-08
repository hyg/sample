#!/usr/bin/env node

/**
 * Test JWT acquisition with detailed debugging.
 */

import { loadIdentity } from '../src/credential_store.js';
import { createSDKConfig } from '../src/utils/config.js';
import axios from 'axios';
import { DIDWbaAuthHeader } from '../src/utils/auth.js';
import crypto from 'crypto';

console.log('='.repeat(80));
console.log('JWT Acquisition Debug Test');
console.log('='.repeat(80));

// Load identity
const cred = loadIdentity('nodeagentfinal');
if (!cred) {
    console.log('Credential not found');
    process.exit(1);
}

console.log(`\n[1] Identity Info`);
console.log(`Local DID: ${cred.did}`);

const config = createSDKConfig();
const userServiceUrl = config.user_service_url;

console.log(`Service URL: ${userServiceUrl}`);
console.log(`DID Domain: ${config.did_domain}`);

// Create auth header with fresh nonce and current timestamp
const auth = new DIDWbaAuthHeader(null, null);

// Parse private key from PEM to get raw bytes
const pemLines = cred.private_key_pem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
const der = Buffer.from(pemLines.join(''), 'base64');

// PKCS#8 format: find the private key octet string (04 20)
let privOffset = -1;
for (let i = 0; i < der.length - 2; i++) {
    if (der[i] === 0x04 && der[i + 1] === 0x20) {
        privOffset = i + 2;
        break;
    }
}

const rawPrivateKey = der.slice(privOffset, privOffset + 32);
console.log(`\n[2] Private Key`);
console.log(`Private key (hex): ${rawPrivateKey.toString('hex')}`);

auth.setCredentials(cred.did_document, rawPrivateKey);

// Get auth header with force_new=true to get fresh nonce
console.log(`\n[3] Generating Auth Header...`);
const headers = auth.getAuthHeader(userServiceUrl, true);
const authHeaderValue = headers['Authorization'];

console.log(`Authorization Header:`);
console.log(authHeaderValue);

// Parse the header to show components
const headerParts = authHeaderValue.match(/(\w+)="([^"]+)"/g);
console.log(`\n[4] Header Components:`);
headerParts.forEach(part => {
    const [key, value] = part.split('="');
    console.log(`  ${key}: ${value.replace('"', '')}`);
});

// Check timestamp
const timestampMatch = authHeaderValue.match(/timestamp="([^"]+)"/);
if (timestampMatch) {
    const timestamp = new Date(timestampMatch[1]);
    const now = new Date();
    const drift = (now - timestamp) / 1000;
    console.log(`\n[5] Timestamp Check:`);
    console.log(`  Client timestamp: ${timestamp.toISOString()}`);
    console.log(`  Current time: ${now.toISOString()}`);
    console.log(`  Time drift: ${drift.toFixed(2)} seconds (must be < 300 seconds)`);
}

// Send verify request
console.log(`\n[6] Sending verify request to ${userServiceUrl}/user-service/did-auth/rpc...`);

async function testJwtAcquisition() {
    try {
        const requestBody = {
            jsonrpc: '2.0',
            method: 'verify',
            params: {
                authorization: authHeaderValue,
                domain: config.did_domain
            },
            id: 1
        };

        console.log(`\nRequest Body:`);
        console.log(JSON.stringify(requestBody, null, 2));

        const response = await axios.post(`${userServiceUrl}/user-service/did-auth/rpc`, requestBody, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });

        console.log(`\n[7] Response:`);
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.error) {
            console.log(`\n❌ JWT acquisition FAILED`);
            console.log(`Error Code: ${response.data.error.code}`);
            console.log(`Error Message: ${response.data.error.message}`);
            if (response.data.error.data) {
                console.log(`Error Data: ${response.data.error.data}`);
            }
            
            // Analyze error
            console.log(`\n[8] Error Analysis:`);
            if (response.data.error.message.includes('Signature verification failed')) {
                console.log(`  - Signature verification failed`);
                console.log(`  Possible causes:`);
                console.log(`    1. Invalid signature format`);
                console.log(`    2. Public key mismatch (DID document issue)`);
                console.log(`    3. JCS canonicalization difference`);
                console.log(`    4. Domain not in allowed_domains whitelist`);
            }
        } else {
            console.log(`\n✓ JWT acquisition SUCCESS`);
            console.log(`JWT Token: ${response.data.result.access_token.substring(0, 50)}...`);
        }
    } catch (error) {
        console.error(`\n❌ Request failed:`);
        console.error(error.message);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        if (error.request) {
            console.error(`Request: ${JSON.stringify(error.request, null, 2)}`);
        }
    }
}

await testJwtAcquisition();

console.log(`\n` + '='.repeat(80));
