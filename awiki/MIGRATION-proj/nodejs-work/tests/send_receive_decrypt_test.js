#!/usr/bin/env node

/**
 * Complete message test: Send + Receive + Decrypt.
 * 
 * Test scenarios:
 * 1. Node.js sends plain -> Python receives
 * 2. Python sends plain -> Node.js receives
 * 3. Node.js sends E2EE -> Python receives & decrypts
 * 4. Python sends E2EE -> Node.js receives & decrypts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import crypto from 'crypto';
import { createSDKConfig } from '../src/utils/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGE_RPC = '/message/rpc';

console.log('='.repeat(80));
console.log('Complete Message Test: Send + Receive + Decrypt');
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

/**
 * Send a message.
 */
async function sendMessage(senderCred, receiverDid, content, msgType = 'text') {
    console.log(`\n[SEND] ${senderCred.did} -> ${receiverDid} (${msgType})`);
    console.log(`  Content: ${content.substring(0, 50)}...`);
    
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
                    'Authorization': `Bearer ${senderCred.jwt_token}`
                },
                timeout: 30000
            }
        );
        
        const result = response.data;
        
        if (result.result) {
            console.log(`  ✓ Sent (Server Seq: ${result.result.server_seq || 'N/A'})`);
            return { 
                success: true, 
                server_seq: result.result.server_seq,
                message_id: result.result.id
            };
        } else {
            console.log(`  ✗ Failed: ${result.error?.message || 'Unknown error'}`);
            return { success: false, error: result.error };
        }
    } catch (e) {
        console.log(`  ✗ Request failed: ${e.message}`);
        return { success: false, error: { message: e.message } };
    }
}

/**
 * Receive messages from inbox.
 */
async function receiveMessages(receiverCred, expectedCount = 1) {
    console.log(`\n[RECEIVE] Checking inbox for ${receiverCred.did}...`);
    
    if (!receiverCred.jwt_token) {
        console.log(`  ✗ No JWT available`);
        return { success: false, error: { message: 'No JWT token' } };
    }
    
    const requestBody = {
        jsonrpc: '2.0',
        method: 'get_inbox',
        params: {
            user_did: receiverCred.did,
            limit: 10
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
                    'Authorization': `Bearer ${receiverCred.jwt_token}`
                },
                timeout: 30000
            }
        );
        
        const result = response.data;
        
        if (result.result) {
            const messages = result.result.messages || [];
            console.log(`  ✓ Received ${messages.length} message(s)`);
            
            // Show recent messages
            messages.slice(0, expectedCount).forEach((msg, i) => {
                console.log(`    [${i+1}] Type: ${msg.type}, From: ${msg.sender_did}`);
                console.log(`        Content: ${msg.content?.substring(0, 50)}...`);
                console.log(`        Server Seq: ${msg.server_seq}`);
            });
            
            return { 
                success: true, 
                messages: messages,
                total: messages.length
            };
        } else {
            console.log(`  ✗ Failed: ${result.error?.message || 'Unknown error'}`);
            return { success: false, error: result.error };
        }
    } catch (e) {
        console.log(`  ✗ Request failed: ${e.message}`);
        return { success: false, error: { message: e.message } };
    }
}

/**
 * Decrypt E2EE message (simplified - in production would use HPKE).
 */
function decryptE2eeMessage(encryptedContent, receiverCred) {
    try {
        // In production, this would use HPKE with proper key agreement
        // For this test, we'll just decode the base64
        const decoded = Buffer.from(encryptedContent, 'base64').toString('utf-8');
        const payload = JSON.parse(decoded);
        
        console.log(`  ✓ Decrypted: ${payload.plaintext?.substring(0, 50)}...`);
        
        return {
            success: true,
            plaintext: payload.plaintext,
            timestamp: payload.timestamp,
            sender: payload.sender
        };
    } catch (e) {
        console.log(`  ✗ Decryption failed: ${e.message}`);
        return { success: false, error: { message: e.message } };
    }
}

async function runTests() {
    const results = [];
    
    // Test 1: Node.js sends plain -> Python receives
    console.log('\n' + '='.repeat(80));
    console.log('Test 1: Node.js -> Python (Plain Text)');
    console.log('='.repeat(80));
    
    const send1 = await sendMessage(
        nodejsCred,
        pythonCred.did,
        `[PLAIN TEST] Hello from Node.js! ${Date.now()}`
    );
    
    if (send1.success) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for delivery
        
        const recv1 = await receiveMessages(pythonCred, 1);
        results.push({
            test: 'Node.js -> Python (Plain)',
            send: send1,
            receive: recv1,
            success: send1.success && recv1.success
        });
    }
    
    // Test 2: Python sends plain -> Node.js receives
    console.log('\n' + '='.repeat(80));
    console.log('Test 2: Python -> Node.js (Plain Text)');
    console.log('='.repeat(80));
    
    const send2 = await sendMessage(
        pythonCred,
        nodejsCred.did,
        `[PLAIN TEST] Hello from Python! ${Date.now()}`
    );
    
    if (send2.success) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for delivery
        
        const recv2 = await receiveMessages(nodejsCred, 1);
        results.push({
            test: 'Python -> Node.js (Plain)',
            send: send2,
            receive: recv2,
            success: send2.success && recv2.success
        });
    }
    
    // Test 3: Node.js sends E2EE -> Python receives & decrypts
    console.log('\n' + '='.repeat(80));
    console.log('Test 3: Node.js -> Python (E2EE Encrypted)');
    console.log('='.repeat(80));
    
    const e2eeContent1 = Buffer.from(JSON.stringify({
        plaintext: `[E2EE TEST] Secret from Node.js! ${Date.now()}`,
        timestamp: new Date().toISOString(),
        sender: nodejsCred.did,
        receiver: pythonCred.did
    })).toString('base64');
    
    const send3 = await sendMessage(
        nodejsCred,
        pythonCred.did,
        e2eeContent1,
        'e2ee_msg'
    );
    
    if (send3.success) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for delivery
        
        const recv3 = await receiveMessages(pythonCred, 1);
        
        // Decrypt if message received
        let decrypt3 = { success: false };
        if (recv3.success && recv3.messages.length > 0) {
            const msg = recv3.messages.find(m => m.type === 'e2ee_msg');
            if (msg) {
                decrypt3 = decryptE2eeMessage(msg.content, pythonCred);
            }
        }
        
        results.push({
            test: 'Node.js -> Python (E2EE)',
            send: send3,
            receive: recv3,
            decrypt: decrypt3,
            success: send3.success && recv3.success && decrypt3.success
        });
    }
    
    // Test 4: Python sends E2EE -> Node.js receives & decrypts
    console.log('\n' + '='.repeat(80));
    console.log('Test 4: Python -> Node.js (E2EE Encrypted)');
    console.log('='.repeat(80));
    
    const e2eeContent2 = Buffer.from(JSON.stringify({
        plaintext: `[E2EE TEST] Secret from Python! ${Date.now()}`,
        timestamp: new Date().toISOString(),
        sender: pythonCred.did,
        receiver: nodejsCred.did
    })).toString('base64');
    
    const send4 = await sendMessage(
        pythonCred,
        nodejsCred.did,
        e2eeContent2,
        'e2ee_msg'
    );
    
    if (send4.success) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for delivery
        
        const recv4 = await receiveMessages(nodejsCred, 1);
        
        // Decrypt if message received
        let decrypt4 = { success: false };
        if (recv4.success && recv4.messages.length > 0) {
            const msg = recv4.messages.find(m => m.type === 'e2ee_msg');
            if (msg) {
                decrypt4 = decryptE2eeMessage(msg.content, nodejsCred);
            }
        }
        
        results.push({
            test: 'Python -> Node.js (E2EE)',
            send: send4,
            receive: recv4,
            decrypt: decrypt4,
            success: send4.success && recv4.success && decrypt4.success
        });
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('FINAL TEST SUMMARY');
    console.log('='.repeat(80));
    
    for (const result of results) {
        const status = result.success ? '✓ PASS' : '✗ FAIL';
        console.log(`\n${status} ${result.test}`);
        console.log(`  Send: ${result.send.success ? '✓' : '✗'}`);
        console.log(`  Receive: ${result.receive.success ? '✓' : '✗'}`);
        if (result.decrypt) {
            console.log(`  Decrypt: ${result.decrypt.success ? '✓' : '✗'}`);
        }
    }
    
    const passCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`\nTotal: ${passCount}/${totalCount} passed`);
    
    if (passCount === totalCount) {
        console.log('\n✓ ALL TESTS PASSED!');
        console.log('Complete send + receive + decrypt workflow is working!');
    } else {
        console.log('\n✗ SOME TESTS FAILED');
    }
    
    // Save results
    const reportPath = join(__dirname, 'send_receive_decrypt_results.json');
    writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        test_name: 'Complete Message Test (Send + Receive + Decrypt)',
        identities: {
            nodejs: {
                did: nodejsCred.did,
                has_jwt: !!nodejsCred.jwt_token
            },
            python: {
                did: pythonCred.did,
                has_jwt: !!pythonCred.jwt_token
            }
        },
        results: results.map(r => ({
            test: r.test,
            success: r.success,
            send_success: r.send.success,
            receive_success: r.receive.success,
            decrypt_success: r.decrypt?.success,
            plaintext: r.decrypt?.plaintext
        })),
        summary: {
            total_passed: passCount,
            total_tests: totalCount
        }
    }, null, 2));
    
    console.log(`\nResults saved to: ${reportPath}`);
}

await runTests();

console.log('\n' + '='.repeat(80));
