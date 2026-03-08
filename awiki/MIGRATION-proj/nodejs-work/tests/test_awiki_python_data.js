#!/usr/bin/env node

/**
 * Test awiki.ai JWT verification using Python's exact signature data.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('Test awiki.ai JWT Verification (Using Python Signature Data)');
console.log('='.repeat(80));

// Load Python output
const pythonOutput = JSON.parse(readFileSync(join(__dirname, 'python_output', 'python_step_by_step.json'), 'utf-8'));

console.log('\n[1] Python Data');
console.log('-'.repeat(80));
console.log(`DID: ${pythonOutput.did}`);
console.log(`Nonce: ${pythonOutput.nonce}`);
console.log(`Timestamp: ${pythonOutput.timestamp}`);
console.log(`Signature: ${pythonOutput.signature_b64url}`);

// Build Authorization header using Python's exact data
const authHeader = pythonOutput.auth_header;

console.log('\n[2] Authorization Header');
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

console.log('\n[3] Request Body');
console.log('-'.repeat(80));
console.log(JSON.stringify(requestBody, null, 2));

// Send request to awiki.ai
console.log('\n[4] Sending request to awiki.ai...');

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

        console.log('\n[5] Response');
        console.log('-'.repeat(80));
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.result) {
            console.log('\n✓ JWT verification SUCCESS');
            console.log(`JWT Token: ${response.data.result.access_token?.substring(0, 50)}...`);
        } else {
            console.log('\n✗ JWT verification FAILED');
            console.log(`Error: ${response.data.error?.message}`);
            console.log(`Error Data: ${response.data.error?.data}`);
        }

        // Save result
        const result = {
            test: 'Python Signature Data',
            request: requestBody,
            response: response.data,
            success: !!response.data.result,
            timestamp: new Date().toISOString()
        };

        const outputPath = join(__dirname, 'python_output', 'test_awiki_python_result.json');
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
