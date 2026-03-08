#!/usr/bin/env node

/**
 * Cross-platform message test: Python and Node.js identities sending messages to each other.
 * 
 * Test scenarios:
 * 1. Node.js -> Python (Node.js sends to Python identity)
 * 2. Python -> Node.js (Python sends to Node.js identity)
 * 3. Node.js -> Node.js (Node.js sends to another Node.js identity)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { createSDKConfig } from '../src/utils/config.js';
import { loadIdentity } from '../src/credential_store.js';
import { getJwtViaWba } from '../src/utils/auth.js';
import { resolveToDid } from '../src/utils/resolve.js';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGE_RPC = '/message/rpc';

console.log('='.repeat(80));
console.log('Cross-Platform Message Test');
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
    console.log(`✗ Python identity not found: ${e.message}`);
}

try {
    nodejsCred = JSON.parse(readFileSync(nodejsCredPath, 'utf-8'));
    console.log(`✓ Node.js identity: ${nodejsCred.did}`);
} catch (e) {
    console.log(`✗ Node.js identity not found: ${e.message}`);
}

if (!pythonCred || !nodejsCred) {
    console.log('\nCannot proceed without both identities');
    process.exit(1);
}

const config = createSDKConfig();

async function getJwt(cred) {
    // Try to use existing JWT first
    if (cred.jwt_token) {
        // Check if JWT is still valid (simple check, could be enhanced)
        console.log(`  Using existing JWT`);
        return cred.jwt_token;
    }
    
    // Acquire new JWT
    console.log(`  Acquiring new JWT via getJwtViaWba()...`);
    
    // Normalize PEM string (replace \n with actual newlines)
    const normalizedPem = cred.private_key_pem.replace(/\\n/g, '\n');
    
    const jwt = await getJwtViaWba(
        config.user_service_url,
        cred.did_document,
        normalizedPem,  // Pass normalized PEM string
        config.did_domain
    );
    console.log(`  ✓ JWT acquired: ${jwt.substring(0, 50)}...`);
    return jwt;
}

async function sendMessage(senderCred, receiverDid, content, msgType = 'text') {
    console.log(`\nSending message: ${senderCred.did} -> ${receiverDid}`);
    console.log(`  Content: ${content}`);
    console.log(`  Type: ${msgType}`);
    
    const jwt = await getJwt(senderCred);
    
    const requestBody = {
        jsonrpc: '2.0',
        method: 'send',
        params: {
            sender_did: senderCred.did,
            receiver_did: receiverDid,
            content: content,
            type: msgType,
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
            console.log(`    Message ID: ${result.result.id || 'N/A'}`);
            console.log(`    Server Seq: ${result.result.server_seq || 'N/A'}`);
            return { success: true, result: result.result };
        } else {
            console.log(`  ✗ Message send failed`);
            console.log(`    Error: ${result.error?.message || 'Unknown error'}`);
            return { success: false, error: result.error };
        }
    } catch (e) {
        console.log(`  ✗ Request failed: ${e.message}`);
        if (e.response) {
            console.log(`    Status: ${e.response.status}`);
            console.log(`    Response: ${JSON.stringify(e.response.data)}`);
        }
        return { success: false, error: { message: e.message } };
    }
}

async function runTests() {
    const results = [];
    
    // Test 1: Node.js -> Python
    console.log('\n' + '='.repeat(80));
    console.log('Test 1: Node.js -> Python');
    console.log('='.repeat(80));
    
    const test1Result = await sendMessage(
        nodejsCred,
        pythonCred.did,
        `Hello from Node.js! Test timestamp: ${new Date().toISOString()}`,
        'text'
    );
    results.push({ test: 'Node.js -> Python', ...test1Result });
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Python -> Node.js
    console.log('\n' + '='.repeat(80));
    console.log('Test 2: Python -> Node.js');
    console.log('='.repeat(80));
    
    const test2Result = await sendMessage(
        pythonCred,
        nodejsCred.did,
        `Hello from Python! Test timestamp: ${new Date().toISOString()}`,
        'text'
    );
    results.push({ test: 'Python -> Node.js', ...test2Result });
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: Node.js -> Node.js (if we have another Node.js identity)
    const nodejsCred2Path = join(__dirname, '..', '.credentials', 'nodeagent1.json');
    try {
        const nodejsCred2 = JSON.parse(readFileSync(nodejsCred2Path, 'utf-8'));
        
        console.log('\n' + '='.repeat(80));
        console.log('Test 3: Node.js -> Node.js');
        console.log('='.repeat(80));
        
        const test3Result = await sendMessage(
            nodejsCred,
            nodejsCred2.did,
            `Hello from Node.js (self-test)! Test timestamp: ${new Date().toISOString()}`,
            'text'
        );
        results.push({ test: 'Node.js -> Node.js', ...test3Result });
    } catch (e) {
        console.log('\nSkipping Node.js -> Node.js test (no second Node.js identity)');
        results.push({ test: 'Node.js -> Node.js', skipped: true });
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    
    for (const result of results) {
        const status = result.skipped ? 'SKIPPED' : (result.success ? '✓ PASS' : '✗ FAIL');
        console.log(`${status} ${result.test}`);
        if (!result.success && !result.skipped) {
            console.log(`  Error: ${result.error?.message || 'Unknown error'}`);
        }
    }
    
    const passCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success && !r.skipped).length;
    const skipCount = results.filter(r => r.skipped).length;
    
    console.log(`\nTotal: ${passCount} passed, ${failCount} failed, ${skipCount} skipped`);
    
    // Save results
    const { writeFileSync } = await import('fs');
    const reportPath = join(__dirname, 'cross_platform_test_results.json');
    writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        identities: {
            python: pythonCred.did,
            nodejs: nodejsCred.did
        },
        results
    }, null, 2));
    
    console.log(`\nResults saved to: ${reportPath}`);
}

await runTests();

console.log('\n' + '='.repeat(80));
