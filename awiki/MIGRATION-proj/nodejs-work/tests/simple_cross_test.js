#!/usr/bin/env node

/**
 * Simple cross-platform message test.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { createSDKConfig } from '../src/utils/config.js';
import { loadIdentity } from '../src/credential_store.js';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGE_RPC = '/message/rpc';

console.log('='.repeat(80));
console.log('Simple Cross-Platform Message Test');
console.log('='.repeat(80));

// Load test identities
const pythonCredPath = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message', 'pythonagent.json');
const nodejsCredPath = join(__dirname, '..', '.credentials', 'nodeagentfinal.json');

console.log('\n[Loading Identities]');

let pythonCred, nodejsCred;
try {
    pythonCred = JSON.parse(readFileSync(pythonCredPath, 'utf-8'));
    console.log(`✓ Python identity: ${pythonCred.did}`);
} catch (e) {
    console.log(`✗ Python identity not found`);
}

try {
    nodejsCred = JSON.parse(readFileSync(nodejsCredPath, 'utf-8'));
    console.log(`✓ Node.js identity: ${nodejsCred.did}`);
} catch (e) {
    console.log(`✗ Node.js identity not found`);
}

if (!pythonCred || !nodejsCred) {
    console.log('\nCannot proceed without both identities');
    process.exit(1);
}

const config = createSDKConfig();

async function sendMessage(senderCred, receiverDid, content) {
    console.log(`\nSending message: ${senderCred.did} -> ${receiverDid}`);
    console.log(`  Content: ${content}`);
    
    // Get JWT - use existing or acquire new
    let jwt = senderCred.jwt_token;
    if (!jwt) {
        console.log('  No JWT found, acquiring...');
        // Normalize PEM
        const normalizedPem = senderCred.private_key_pem.replace(/\\n/g, '\n');
        const cryptoLib = await import('crypto');
        const privateKeyObj = cryptoLib.default.createPrivateKey(normalizedPem);
        const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
        const dHex = Buffer.from(privateKeyJwk.d, 'base64url').toString('hex');
        const privateKeyBytes = Buffer.from(dHex, 'hex');
        
        // Use the fixed getJwtViaWba logic
        const { DIDWbaAuthHeader } = await import('../src/utils/auth.js');
        const auth = new DIDWbaAuthHeader(null, null);
        await auth.setCredentials(senderCred.did_document, privateKeyBytes);
        const authHeaders = auth.getAuthHeader(config.user_service_url);
        
        const response = await axios.post(`${config.user_service_url}/user-service/did-auth/rpc`, {
            jsonrpc: '2.0',
            method: 'verify',
            params: {
                authorization: authHeaders['Authorization'],
                domain: config.did_domain
            },
            id: 1
        });
        
        if (response.data.error) {
            throw new Error(response.data.error.message);
        }
        
        jwt = response.data.result.access_token;
        console.log(`  ✓ JWT acquired`);
    } else {
        console.log(`  Using existing JWT`);
    }
    
    const requestBody = {
        jsonrpc: '2.0',
        method: 'send',
        params: {
            sender_did: senderCred.did,
            receiver_did: receiverDid,
            content: content,
            type: 'text',
            client_msg_id: crypto.randomUUID()
        },
        id: 1
    };
    
    try {
        const response = await axios.post(
            `${config.molt_message_url}${MESSAGE_RPC}`,
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwt}`
                },
                timeout: 30000
            }
        );
        
        const result = response.data;
        
        if (result.result) {
            console.log(`  ✓ Message sent successfully`);
            console.log(`    Server Seq: ${result.result.server_seq || 'N/A'}`);
            return { success: true, result: result.result };
        } else {
            console.log(`  ✗ Message send failed`);
            console.log(`    Error: ${result.error?.message || 'Unknown error'}`);
            return { success: false, error: result.error };
        }
    } catch (e) {
        console.log(`  ✗ Request failed: ${e.message}`);
        return { success: false, error: { message: e.message } };
    }
}

async function runTests() {
    // Test 1: Node.js -> Python
    console.log('\n' + '='.repeat(80));
    console.log('Test 1: Node.js -> Python');
    console.log('='.repeat(80));
    
    const test1Result = await sendMessage(
        nodejsCred,
        pythonCred.did,
        `Hello from Node.js! ${new Date().toISOString()}`
    );
    
    // Wait
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Python -> Node.js
    console.log('\n' + '='.repeat(80));
    console.log('Test 2: Python -> Node.js');
    console.log('='.repeat(80));
    
    const test2Result = await sendMessage(
        pythonCred,
        nodejsCred.did,
        `Hello from Python! ${new Date().toISOString()}`
    );
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`${test1Result.success ? '✓' : '✗'} Node.js -> Python`);
    console.log(`${test2Result.success ? '✓' : '✗'} Python -> Node.js`);
    
    const passCount = [test1Result, test2Result].filter(r => r.success).length;
    console.log(`\nTotal: ${passCount}/2 passed`);
}

await runTests();

console.log('\n' + '='.repeat(80));
