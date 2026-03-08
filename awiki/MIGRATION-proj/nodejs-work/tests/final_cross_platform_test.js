#!/usr/bin/env node

/**
 * Final cross-platform message test with valid identities.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { createSDKConfig } from '../src/utils/config.js';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGE_RPC = '/message/rpc';

console.log('='.repeat(80));
console.log('Final Cross-Platform Message Test');
console.log('='.repeat(80));

// Load valid identities
const nodejsCredPath = join(__dirname, '..', '.credentials', 'nodeagentfixed.json');
const pythonCredPath = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message', 'pythonmsgtest.json');

console.log('\n[Loading Valid Identities]');

let nodejsCred, pythonCred;
try {
    nodejsCred = JSON.parse(readFileSync(nodejsCredPath, 'utf-8'));
    console.log(`✓ Node.js identity: ${nodejsCred.did}`);
    console.log(`  PEM length: ${nodejsCred.private_key_pem?.length || 0} chars (should be ~240)`);
    console.log(`  Has JWT: ${!!nodejsCred.jwt_token}`);
} catch (e) {
    console.log(`✗ Node.js identity not found: ${e.message}`);
    process.exit(1);
}

try {
    pythonCred = JSON.parse(readFileSync(pythonCredPath, 'utf-8'));
    console.log(`✓ Python identity: ${pythonCred.did}`);
    console.log(`  Has JWT: ${!!pythonCred.jwt_token}`);
} catch (e) {
    console.log(`✗ Python identity not found: ${e.message}`);
    process.exit(1);
}

const config = createSDKConfig();

async function sendMessage(senderCred, receiverDid, content) {
    console.log(`\nSending message: ${senderCred.did} -> ${receiverDid}`);
    console.log(`  Content: ${content}`);
    
    if (!senderCred.jwt_token) {
        console.log(`  ✗ No JWT available`);
        return { success: false, error: { message: 'No JWT token' } };
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
                    'Authorization': `Bearer ${senderCred.jwt_token}`
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
        if (e.response) {
            console.log(`    Status: ${e.response.status}`);
            console.log(`    Body: ${JSON.stringify(e.response.data)}`);
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
        `[CROSS-PLATFORM TEST] Node.js to Python - ${new Date().toISOString()}`
    );
    results.push({ test: 'Node.js -> Python', ...test1Result });
    
    // Wait
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Python -> Node.js
    console.log('\n' + '='.repeat(80));
    console.log('Test 2: Python -> Node.js');
    console.log('='.repeat(80));
    
    const test2Result = await sendMessage(
        pythonCred,
        nodejsCred.did,
        `[CROSS-PLATFORM TEST] Python to Node.js - ${new Date().toISOString()}`
    );
    results.push({ test: 'Python -> Node.js', ...test2Result });
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('FINAL TEST SUMMARY');
    console.log('='.repeat(80));
    
    for (const result of results) {
        const status = result.success ? '✓ PASS' : '✗ FAIL';
        console.log(`${status} ${result.test}`);
        if (!result.success) {
            console.log(`  Error: ${result.error?.message || 'Unknown error'}`);
        }
    }
    
    const passCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`\nTotal: ${passCount}/${totalCount} passed`);
    
    if (passCount === totalCount) {
        console.log('\n✓ ALL TESTS PASSED!');
        console.log('Cross-platform messaging between Python and Node.js is working!');
    } else {
        console.log('\n✗ SOME TESTS FAILED');
    }
    
    // Save results
    const { writeFileSync } = await import('fs');
    const reportPath = join(__dirname, 'final_cross_platform_results.json');
    writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        test_name: 'Final Cross-Platform Message Test',
        identities: {
            nodejs: {
                did: nodejsCred.did,
                pem_length: nodejsCred.private_key_pem?.length || 0,
                has_jwt: !!nodejsCred.jwt_token
            },
            python: {
                did: pythonCred.did,
                has_jwt: !!pythonCred.jwt_token
            }
        },
        results
    }, null, 2));
    
    console.log(`\nResults saved to: ${reportPath}`);
}

await runTests();

console.log('\n' + '='.repeat(80));
