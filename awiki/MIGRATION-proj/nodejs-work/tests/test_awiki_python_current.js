#!/usr/bin/env node

/**
 * Test awiki.ai JWT verification using Python's signature format with current timestamp.
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
console.log('Test awiki.ai JWT Verification (Python Format + Current Timestamp)');
console.log('='.repeat(80));

// Load Python output to get private key and DID
const pythonOutput = JSON.parse(readFileSync(join(__dirname, 'python_output', 'python_step_by_step.json'), 'utf-8'));

console.log('\n[1] Load Python Data');
console.log('-'.repeat(80));
console.log(`DID: ${pythonOutput.did}`);
console.log(`Private Key: ${pythonOutput.private_key_hex.substring(0, 32)}...`);

// Use current timestamp
const nonce = crypto.randomBytes(16).toString('hex');
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

console.log('\n[2] Generate New Timestamp');
console.log('-'.repeat(80));
console.log(`Nonce: ${nonce}`);
console.log(`Timestamp: ${timestamp}`);

// Build data to sign
const dataToSign = {
    nonce: nonce,
    timestamp: timestamp,
    aud: 'awiki.ai',
    did: pythonOutput.did
};

// JCS canonicalize
const canonicalJson = canonicalize(dataToSign);

// SHA-256 hash
const contentHash = sha256(Buffer.from(canonicalJson, 'utf-8'));

// Sign with private key
const privateKeyBytes = Buffer.from(pythonOutput.private_key_hex, 'hex');
const signature = secp256k1.sign(contentHash, privateKeyBytes);

// Convert to R||S format
const rBytes = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
const sBytes = Buffer.from(signature.s.toString(16).padStart(64, '0'), 'hex');
const rsSignature = Buffer.concat([rBytes, sBytes]);

// Base64URL encode
const signatureB64Url = rsSignature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

console.log('\n[3] Generated Signature');
console.log('-'.repeat(80));
console.log(`Signature: ${signatureB64Url}`);

// Build Authorization header
const authHeader = `DIDWba v="1.1", did="${pythonOutput.did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureB64Url}"`;

console.log('\n[4] Authorization Header');
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

console.log('\n[5] Request Body');
console.log('-'.repeat(80));
console.log(JSON.stringify(requestBody, null, 2));

// Send request to awiki.ai
console.log('\n[6] Sending request to awiki.ai...');

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

        console.log('\n[7] Response');
        console.log('-'.repeat(80));
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.result) {
            console.log('\n✓ JWT verification SUCCESS');
            console.log(`JWT Token: ${response.data.result.access_token?.substring(0, 50)}...`);
        } else {
            console.log('\n✗ JWT verification FAILED');
            console.log(`Error: ${response.data.error?.message}`);
        }

        // Save result
        const result = {
            test: 'Python Format + Current Timestamp',
            request: requestBody,
            auth_header: authHeader,
            response: response.data,
            success: !!response.data.result,
            timestamp: new Date().toISOString()
        };

        const outputPath = join(__dirname, 'python_output', 'test_awiki_python_current.json');
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
