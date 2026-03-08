#!/usr/bin/env node

/**
 * Test JWT verification with multiple registered DIDs.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';
import axios from 'axios';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('Test: Multiple Registered DIDs JWT Verification');
console.log('='.repeat(80));

// List of registered DIDs to test
const testIdentities = [
    {
        name: 'pythonagent',
        credPath: join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message', 'pythonagent.json'),
        note: 'Python registered'
    },
    {
        name: 'testfresh',
        credPath: join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message', 'testfresh.json'),
        note: 'Python registered (fresh)'
    },
    {
        name: 'nodeagentfinal',
        credPath: join(__dirname, '..', '.credentials', 'nodeagentfinal.json'),
        note: 'Node.js registered'
    }
];

async function testIdentity(identity) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Testing: ${identity.name}]`);
    console.log(`Note: ${identity.note}`);
    console.log('-'.repeat(80));
    
    // Load credential
    if (!existsSync(identity.credPath)) {
        console.log(`Credential file not found: ${identity.credPath}`);
        return { name: identity.name, success: false, error: 'File not found' };
    }
    
    const cred = JSON.parse(readFileSync(identity.credPath, 'utf-8'));
    const did = cred.did;
    const privateKeyPem = cred.private_key_pem;
    
    console.log(`DID: ${did}`);
    
    // Parse private key
    let privateKeyBytes;
    try {
        const privateKeyObj = crypto.createPrivateKey(privateKeyPem);
        const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
        const dHex = Buffer.from(privateKeyJwk.d, 'base64url').toString('hex');
        privateKeyBytes = Buffer.from(dHex, 'hex');
    } catch (error) {
        console.log(`Failed to parse private key: ${error.message}`);
        return { name: identity.name, success: false, error: error.message };
    }
    
    // Generate auth data
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    
    const dataToSign = {
        nonce: nonce,
        timestamp: timestamp,
        aud: 'awiki.ai',
        did: did
    };
    
    // JCS canonicalize
    const canonicalJson = canonicalize(dataToSign);
    
    // SHA-256 hash
    const contentHash = sha256(Buffer.from(canonicalJson, 'utf-8'));
    
    // Sign
    const signature = secp256k1.sign(contentHash, privateKeyBytes);
    
    // Convert to DER format
    const rBytes = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
    const sBytes = Buffer.from(signature.s.toString(16).padStart(64, '0'), 'hex');
    
    let rDer = rBytes;
    let sDer = sBytes;
    if (rBytes[0] & 0x80) rDer = Buffer.concat([Buffer.alloc(1), rBytes]);
    if (sBytes[0] & 0x80) sDer = Buffer.concat([Buffer.alloc(1), sBytes]);
    
    const totalLen = 2 + rDer.length + 2 + sDer.length;
    const derSignature = Buffer.concat([
        Buffer.from([0x30, totalLen]),
        Buffer.from([0x02, rDer.length]),
        rDer,
        Buffer.from([0x02, sDer.length]),
        sDer
    ]);
    
    const signatureB64Url = derSignature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    // Build auth header
    const authHeader = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureB64Url}"`;
    
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Signature: ${signatureB64Url.substring(0, 50)}...`);
    
    // Send verify request
    const requestBody = {
        jsonrpc: '2.0',
        method: 'verify',
        params: {
            authorization: authHeader,
            domain: 'awiki.ai'
        },
        id: 1
    };
    
    try {
        const response = await axios.post(
            'https://awiki.ai/user-service/did-auth/rpc',
            requestBody,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );
        
        const result = response.data;
        
        if (result.result) {
            console.log(`Result: SUCCESS`);
            console.log(`JWT Token: ${result.result.access_token?.substring(0, 50)}...`);
            console.log(`User ID: ${result.result.user_id || 'N/A'}`);
            return { name: identity.name, success: true, did, userId: result.result.user_id };
        } else {
            const error = result.error || {};
            console.log(`Result: FAILED`);
            console.log(`Error: ${error.message || 'Unknown error'}`);
            return { name: identity.name, success: false, error: error.message };
        }
    } catch (error) {
        console.log(`Request failed: ${error.message}`);
        if (error.response) {
            console.log(`Status: ${error.response.status}`);
            console.log(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        return { name: identity.name, success: false, error: error.message };
    }
}

async function main() {
    const results = [];
    
    for (const identity of testIdentities) {
        const result = await testIdentity(identity);
        results.push(result);
        
        // Wait between tests
        if (testIdentities.indexOf(identity) < testIdentities.length - 1) {
            console.log(`\nWaiting 2 seconds before next test...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('SUMMARY');
    console.log('='.repeat(80));
    
    for (const result of results) {
        const status = result.success ? 'SUCCESS' : 'FAILED';
        const details = result.success ? `User ID: ${result.userId}` : `Error: ${result.error}`;
        console.log(`${result.name}: ${status} (${details})`);
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`\nTotal: ${successCount}/${results.length} successful`);
    
    if (successCount === 0) {
        console.log(`\nWARNING: All tests failed`);
        console.log(`This suggests a systemic issue, not specific to any DID.`);
    } else if (successCount > 0 && successCount < results.length) {
        console.log(`\nSome tests succeeded - Issue may be DID-specific`);
    } else {
        console.log(`\nAll tests succeeded!`);
    }
    
    // Save results
    const summary = {
        test: 'Multiple Registered DIDs JWT Verification',
        timestamp: new Date().toISOString(),
        results,
        success_count: successCount,
        total: results.length
    };
    
    const outputPath = join(__dirname, 'REGISTERED_DIDS_TEST_RESULT.json');
    writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    console.log(`\nResults saved to: ${outputPath}`);
}

await main();

console.log('\n' + '='.repeat(80));
