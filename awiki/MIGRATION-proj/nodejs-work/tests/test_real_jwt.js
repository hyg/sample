#!/usr/bin/env node

/**
 * Test real JWT acquisition from awiki.ai.
 */

import { loadIdentity } from '../src/credential_store.js';
import { createSDKConfig } from '../src/utils/config.js';
import axios from 'axios';
import { DIDWbaAuthHeader } from '../src/utils/auth.js';

console.log('='.repeat(80));
console.log('Real JWT Acquisition Test');
console.log('='.repeat(80));

// Load identity
const cred = loadIdentity('nodeagentjwt2');
if (!cred) {
    console.log('Credential not found');
    process.exit(1);
}

console.log(`\nLocal DID: ${cred.did}`);

const config = createSDKConfig();
const userServiceUrl = config.user_service_url;

console.log(`Service URL: ${userServiceUrl}`);

// Create auth header
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

auth.setCredentials(cred.did_document, rawPrivateKey);

// Get auth header
const headers = auth.getAuthHeader(userServiceUrl, true);
const authHeaderValue = headers['Authorization'];

console.log(`\nAuthorization Header:`);
console.log(authHeaderValue.substring(0, 200) + '...');

// Send verify request
console.log('\nSending verify request...');

async function testJwtAcquisition() {
    try {
        const response = await axios.post(`${userServiceUrl}/user-service/did-auth/rpc`, {
            jsonrpc: '2.0',
            method: 'verify',
            params: {
                authorization: authHeaderValue,
                domain: config.did_domain
            },
            id: 1
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });

        console.log('\nResponse:');
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.error) {
            console.log('\n❌ JWT acquisition FAILED');
            console.log(`Error: ${response.data.error.message}`);
            if (response.data.error.data) {
                console.log(`Details: ${response.data.error.data}`);
            }
        } else {
            console.log('\n✓ JWT acquisition SUCCESS');
            console.log(`JWT Token: ${response.data.result.access_token.substring(0, 50)}...`);
        }
    } catch (error) {
        console.error('\n❌ Request failed:');
        console.error(error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

await testJwtAcquisition();

console.log('\n' + '='.repeat(80));
