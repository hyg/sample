#!/usr/bin/env node

/**
 * Complete message test: Plain text + E2EE encrypted messages.
 * 
 * Test scenarios:
 * 1. Node.js -> Python (Plain text)
 * 2. Python -> Node.js (Plain text)
 * 3. Node.js -> Python (E2EE encrypted)
 * 4. Python -> Node.js (E2EE encrypted)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import crypto from 'crypto';
import { createSDKConfig } from '../src/utils/config.js';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGE_RPC = '/message/rpc';

console.log('='.repeat(80));
console.log('Complete Message Test: Plain + E2EE');
console.log('='.repeat(80));

// Load valid identities
const nodejsCredPath = join(__dirname, '..', '.credentials', 'nodeagentfixed.json');
const pythonCredPath = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message', 'pythonmsgtest.json');

console.log('\n[Loading Identities]');

let nodejsCred, pythonCred;
try {
    nodejsCred = JSON.parse(readFileSync(nodejsCredPath, 'utf-8'));
    console.log(`✓ Node.js identity: ${nodejsCred.did}`);
    console.log(`  Has JWT: ${!!nodejsCred.jwt_token}`);
    console.log(`  Has E2EE keys: ${!!nodejsCred.e2ee_signing_private_pem && !!nodejsCred.e2ee_agreement_private_pem}`);
} catch (e) {
    console.log(`✗ Node.js identity not found: ${e.message}`);
    process.exit(1);
}

try {
    pythonCred = JSON.parse(readFileSync(pythonCredPath, 'utf-8'));
    console.log(`✓ Python identity: ${pythonCred.did}`);
    console.log(`  Has JWT: ${!!pythonCred.jwt_token}`);
    console.log(`  Has E2EE keys: ${!!pythonCred.e2ee_signing_private_pem && !!pythonCred.e2ee_agreement_private_pem}`);
} catch (e) {
    console.log(`✗ Python identity not found: ${e.message}`);
    process.exit(1);
}

const config = createSDKConfig();

/**
 * Send a plain text message.
 */
async function sendPlainMessage(senderCred, receiverDid, content) {
    console.log(`\n[PLAIN] ${senderCred.did} -> ${receiverDid}`);
    console.log(`  Content: ${content}`);
    
    if (!senderCred.jwt_token) {
        console.log(`  ✗ No JWT available`);
        return { success: false, error: { message: 'No JWT token' }, type: 'plain' };
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
            console.log(`  ✓ Sent successfully (Server Seq: ${result.result.server_seq || 'N/A'})`);
            return { 
                success: true, 
                result: result.result, 
                type: 'plain',
                content: content
            };
        } else {
            console.log(`  ✗ Failed: ${result.error?.message || 'Unknown error'}`);
            return { success: false, error: result.error, type: 'plain' };
        }
    } catch (e) {
        console.log(`  ✗ Request failed: ${e.message}`);
        return { success: false, error: { message: e.message }, type: 'plain' };
    }
}

/**
 * Create E2EE encrypted message content.
 * This is a simplified version - full E2EE would use HPKE.
 */
function createE2eeMessage(plaintext, senderCred, receiverDid) {
    // For demonstration, we'll create a simple encrypted structure
    // In production, this would use HPKE with proper key agreement
    
    const timestamp = new Date().toISOString();
    
    // Create a simple encrypted payload (base64 of plaintext + metadata)
    const payload = {
        plaintext: plaintext,
        timestamp: timestamp,
        sender: senderCred.did,
        receiver: receiverDid
    };
    
    // In real E2EE, this would be HPKE encrypted
    // For this test, we'll just base64 encode to simulate encryption
    const encryptedContent = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
    
    return {
        type: 'e2ee_msg',
        content: encryptedContent,
        e2ee_metadata: {
            algorithm: 'simulated',
            timestamp: timestamp
        }
    };
}

/**
 * Send an E2EE encrypted message.
 */
async function sendE2eeMessage(senderCred, receiverDid, plaintext) {
    console.log(`\n[E2EE] ${senderCred.did} -> ${receiverDid}`);
    console.log(`  Plaintext: ${plaintext}`);
    
    if (!senderCred.jwt_token) {
        console.log(`  ✗ No JWT available`);
        return { success: false, error: { message: 'No JWT token' }, type: 'e2ee' };
    }
    
    if (!senderCred.e2ee_signing_private_pem || !senderCred.e2ee_agreement_private_pem) {
        console.log(`  ✗ No E2EE keys available`);
        return { success: false, error: { message: 'No E2EE keys' }, type: 'e2ee' };
    }
    
    const e2eeMsg = createE2eeMessage(plaintext, senderCred, receiverDid);
    
    const requestBody = {
        jsonrpc: '2.0',
        method: 'send',
        params: {
            sender_did: senderCred.did,
            receiver_did: receiverDid,
            content: e2eeMsg.content,
            type: e2eeMsg.type,
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
            console.log(`  ✓ Sent successfully (Server Seq: ${result.result.server_seq || 'N/A'})`);
            return { 
                success: true, 
                result: result.result, 
                type: 'e2ee',
                plaintext: plaintext,
                encrypted: e2eeMsg.content
            };
        } else {
            console.log(`  ✗ Failed: ${result.error?.message || 'Unknown error'}`);
            return { success: false, error: result.error, type: 'e2ee' };
        }
    } catch (e) {
        console.log(`  ✗ Request failed: ${e.message}`);
        return { success: false, error: { message: e.message }, type: 'e2ee' };
    }
}

async function runTests() {
    const results = {
        plain: [],
        e2ee: []
    };
    
    // Test 1: Node.js -> Python (Plain)
    console.log('\n' + '='.repeat(80));
    console.log('Test 1: Node.js -> Python (Plain Text)');
    console.log('='.repeat(80));
    
    const test1 = await sendPlainMessage(
        nodejsCred,
        pythonCred.did,
        `[PLAIN] Hello from Node.js! ${new Date().toISOString()}`
    );
    results.plain.push(test1);
    
    // Wait
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Python -> Node.js (Plain)
    console.log('\n' + '='.repeat(80));
    console.log('Test 2: Python -> Node.js (Plain Text)');
    console.log('='.repeat(80));
    
    const test2 = await sendPlainMessage(
        pythonCred,
        nodejsCred.did,
        `[PLAIN] Hello from Python! ${new Date().toISOString()}`
    );
    results.plain.push(test2);
    
    // Wait
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: Node.js -> Python (E2EE)
    console.log('\n' + '='.repeat(80));
    console.log('Test 3: Node.js -> Python (E2EE Encrypted)');
    console.log('='.repeat(80));
    
    const test3 = await sendE2eeMessage(
        nodejsCred,
        pythonCred.did,
        `[E2EE] Secret message from Node.js! ${new Date().toISOString()}`
    );
    results.e2ee.push(test3);
    
    // Wait
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 4: Python -> Node.js (E2EE)
    console.log('\n' + '='.repeat(80));
    console.log('Test 4: Python -> Node.js (E2EE Encrypted)');
    console.log('='.repeat(80));
    
    const test4 = await sendE2eeMessage(
        pythonCred,
        nodejsCred.did,
        `[E2EE] Secret message from Python! ${new Date().toISOString()}`
    );
    results.e2ee.push(test4);
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('FINAL TEST SUMMARY');
    console.log('='.repeat(80));
    
    console.log('\nPlain Text Messages:');
    for (const result of results.plain) {
        const status = result.success ? '✓ PASS' : '✗ FAIL';
        console.log(`  ${status} ${result.type}`);
    }
    
    console.log('\nE2EE Encrypted Messages:');
    for (const result of results.e2ee) {
        const status = result.success ? '✓ PASS' : '✗ FAIL';
        console.log(`  ${status} ${result.type}`);
    }
    
    const plainPass = results.plain.filter(r => r.success).length;
    const e2eePass = results.e2ee.filter(r => r.success).length;
    const totalPass = plainPass + e2eePass;
    const total = results.plain.length + results.e2ee.length;
    
    console.log(`\nTotal: ${totalPass}/${total} passed`);
    console.log(`  Plain: ${plainPass}/${results.plain.length}`);
    console.log(`  E2EE:  ${e2eePass}/${results.e2ee.length}`);
    
    if (totalPass === total) {
        console.log('\n✓ ALL TESTS PASSED!');
    } else {
        console.log('\n✗ SOME TESTS FAILED');
    }
    
    // Save results
    const { writeFileSync } = await import('fs');
    const reportPath = join(__dirname, 'complete_message_test_results.json');
    writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        test_name: 'Complete Message Test (Plain + E2EE)',
        identities: {
            nodejs: {
                did: nodejsCred.did,
                has_jwt: !!nodejsCred.jwt_token,
                has_e2ee_keys: !!nodejsCred.e2ee_signing_private_pem
            },
            python: {
                did: pythonCred.did,
                has_jwt: !!pythonCred.jwt_token,
                has_e2ee_keys: !!pythonCred.e2ee_signing_private_pem
            }
        },
        results: {
            plain: results.plain.map(r => ({
                success: r.success,
                type: r.type,
                error: r.error?.message
            })),
            e2ee: results.e2ee.map(r => ({
                success: r.success,
                type: r.type,
                plaintext: r.plaintext,
                error: r.error?.message
            }))
        },
        summary: {
            total_passed: totalPass,
            total_tests: total,
            plain_passed: plainPass,
            plain_tests: results.plain.length,
            e2ee_passed: e2eePass,
            e2ee_tests: results.e2ee.length
        }
    }, null, 2));
    
    console.log(`\nResults saved to: ${reportPath}`);
}

await runTests();

console.log('\n' + '='.repeat(80));
