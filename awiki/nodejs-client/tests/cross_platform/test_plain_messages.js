#!/usr/bin/env node

/**
 * Cross-platform plain text message test.
 * 
 * Tests:
 * 1. Python -> Node.js plain message
 * 2. Node.js -> Python plain message
 * 
 * Usage:
 *   node tests/cross_platform/test_plain_messages.js --from python1 --to node1
 *   node tests/cross_platform/test_plain_messages.js --from node1 --to python1
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { createSDKConfig } from '../../src/utils/config.js';
import { loadIdentity } from '../../src/credential_store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_CRED_DIR = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message');
const NODEJS_CRED_DIR = join(__dirname, '..', '.credentials');
const ALT_NODEJS_CRED_DIR = join(__dirname, '..', '..', '..', 'nodejs-awiki', '.credentials');

const TEST_RESULTS = {
    passed: 0,
    failed: 0,
    details: []
};

/**
 * Load credential from appropriate directory.
 */
function loadCredential(name) {
    // Try Node.js directory first
    try {
        const nodePath = join(NODEJS_CRED_DIR, `${name}.json`);
        return JSON.parse(readFileSync(nodePath, 'utf-8'));
    } catch (e) {
        // Try alternative Node.js directory
        try {
            const altNodePath = join(ALT_NODEJS_CRED_DIR, `${name}.json`);
            return JSON.parse(readFileSync(altNodePath, 'utf-8'));
        } catch (e2) {
            // Try Python directory
            try {
                const pythonPath = join(PYTHON_CRED_DIR, `${name}.json`);
                return JSON.parse(readFileSync(pythonPath, 'utf-8'));
            } catch (e3) {
                throw new Error(`Credential '${name}' not found in either directory`);
            }
        }
    }
}

/**
 * Send message using JWT.
 */
async function sendMessage(senderCred, receiverDid, content) {
    const config = createSDKConfig();
    
    const requestBody = {
        jsonrpc: '2.0',
        method: 'send',
        params: {
            sender_did: senderCred.did,
            receiver_did: receiverDid,
            content: content,
            type: 'text',
            client_msg_id: `test_${Date.now()}`
        },
        id: 1
    };
    
    try {
        const response = await axios.post(
            `${config.molt_message_url}/message/rpc`,
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
            return {
                success: true,
                server_seq: result.result.server_seq,
                message_id: result.result.id
            };
        } else {
            return {
                success: false,
                error: result.error?.message || 'Unknown error'
            };
        }
    } catch (e) {
        return {
            success: false,
            error: e.message
        };
    }
}

/**
 * Check inbox for messages.
 */
async function checkInbox(receiverCred, expectedSender) {
    const config = createSDKConfig();
    
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
            `${config.molt_message_url}/message/rpc`,
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
        
        if (result.result && result.result.messages) {
            // Find message from expected sender
            const expectedMsg = result.result.messages.find(
                msg => msg.sender_did === expectedSender
            );
            
            return {
                success: true,
                message: expectedMsg,
                total_messages: result.result.messages.length
            };
        } else {
            return {
                success: false,
                error: result.error?.message || 'No messages'
            };
        }
    } catch (e) {
        return {
            success: false,
            error: e.message
        };
    }
}

/**
 * Run cross-platform plain message test.
 */
async function runTest(fromName, toName) {
    console.log('='.repeat(60));
    console.log(`Cross-Platform Plain Message Test: ${fromName} -> ${toName}`);
    console.log('='.repeat(60));
    
    // Load credentials
    console.log('\n[1/4] Loading credentials...');
    let senderCred, receiverCred;
    
    try {
        senderCred = loadCredential(fromName);
        console.log(`  ✓ Sender (${fromName}): ${senderCred.did}`);
    } catch (e) {
        console.log(`  ✗ Failed to load sender credential: ${e.message}`);
        TEST_RESULTS.failed++;
        TEST_RESULTS.details.push({
            test: `Load sender credential (${fromName})`,
            success: false,
            error: e.message
        });
        return;
    }
    
    try {
        receiverCred = loadCredential(toName);
        console.log(`  ✓ Receiver (${toName}): ${receiverCred.did}`);
    } catch (e) {
        console.log(`  ✗ Failed to load receiver credential: ${e.message}`);
        TEST_RESULTS.failed++;
        TEST_RESULTS.details.push({
            test: `Load receiver credential (${toName})`,
            success: false,
            error: e.message
        });
        return;
    }
    
    // Send message
    console.log('\n[2/4] Sending message...');
    const testMessage = `[CROSS-PLATFORM TEST] ${fromName} -> ${toName} @ ${new Date().toISOString()}`;
    
    const sendResult = await sendMessage(senderCred, receiverCred.did, testMessage);
    
    if (sendResult.success) {
        console.log(`  ✓ Message sent (Server Seq: ${sendResult.server_seq})`);
        TEST_RESULTS.passed++;
        TEST_RESULTS.details.push({
            test: 'Send message',
            success: true,
            server_seq: sendResult.server_seq
        });
    } else {
        console.log(`  ✗ Failed to send: ${sendResult.error}`);
        TEST_RESULTS.failed++;
        TEST_RESULTS.details.push({
            test: 'Send message',
            success: false,
            error: sendResult.error
        });
        return;
    }
    
    // Wait for message delivery
    console.log('\n[3/4] Waiting for message delivery...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check inbox
    console.log('\n[4/4] Checking receiver inbox...');
    const inboxResult = await checkInbox(receiverCred, senderCred.did);
    
    if (inboxResult.success && inboxResult.message) {
        const msg = inboxResult.message;
        
        // Verify message content
        if (msg.content.includes('[CROSS-PLATFORM TEST]')) {
            console.log(`  ✓ Message received and verified`);
            console.log(`    From: ${msg.sender_did}`);
            console.log(`    Content: ${msg.content.substring(0, 50)}...`);
            console.log(`    Server Seq: ${msg.server_seq}`);
            
            TEST_RESULTS.passed++;
            TEST_RESULTS.details.push({
                test: 'Receive and verify message',
                success: true,
                server_seq: msg.server_seq,
                content_match: true
            });
        } else {
            console.log(`  ✗ Message content mismatch`);
            TEST_RESULTS.failed++;
            TEST_RESULTS.details.push({
                test: 'Receive and verify message',
                success: false,
                error: 'Content mismatch'
            });
        }
    } else {
        console.log(`  ✗ Failed to receive message: ${inboxResult.error}`);
        TEST_RESULTS.failed++;
        TEST_RESULTS.details.push({
            test: 'Receive and verify message',
            success: false,
            error: inboxResult.error
        });
    }
}

/**
 * Parse command line arguments.
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {
        from: null,
        to: null
    };
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--from':
                result.from = args[++i];
                break;
            case '--to':
                result.to = args[++i];
                break;
            case '--help':
            case '-h':
                console.log(`
Cross-Platform Plain Message Test

Usage:
  node tests/cross_platform/test_plain_messages.js --from <name> --to <name>

Examples:
  node tests/cross_platform/test_plain_messages.js --from python1 --to node1
  node tests/cross_platform/test_plain_messages.js --from node1 --to python1
`);
                process.exit(0);
                break;
        }
    }
    
    return result;
}

// Main
const options = parseArgs();

if (!options.from || !options.to) {
    console.error('Error: --from and --to are required');
    console.error('Use --help for usage information');
    process.exit(1);
}

await runTest(options.from, options.to);

// Print summary
console.log('\n' + '='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));
console.log(`Passed: ${TEST_RESULTS.passed}`);
console.log(`Failed: ${TEST_RESULTS.failed}`);
console.log('='.repeat(60));

if (TEST_RESULTS.failed === 0) {
    console.log('\n✓ TEST PASSED');
    process.exit(0);
} else {
    console.log('\n✗ TEST FAILED');
    process.exit(1);
}
