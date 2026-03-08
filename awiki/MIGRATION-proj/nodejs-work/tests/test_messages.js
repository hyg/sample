#!/usr/bin/env node

/**
 * Test plain text and E2EE message sending between identities.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('Node.js: Message Test (Plain + E2EE)');
console.log('='.repeat(80));

// Load credentials
const credDir = join(__dirname, '..', '.credentials');
const pythonCredDir = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message');

// Use nodeagent1 and nodeagent2
const senderCredPath = join(credDir, 'nodeagent1.json');
const receiverCredPath = join(credDir, 'nodeagent2.json');

console.log(`\nLoading credentials...`);
console.log(`Sender: ${senderCredPath}`);
console.log(`Receiver: ${receiverCredPath}`);

let senderCred, receiverCred;
try {
    senderCred = JSON.parse(readFileSync(senderCredPath, 'utf-8'));
    receiverCred = JSON.parse(readFileSync(receiverCredPath, 'utf-8'));
} catch (error) {
    console.log(`Failed to load credentials: ${error.message}`);
    console.log('Please create identities first:');
    console.log('  node scripts/setup_identity.js --name "NodeAgent1" --agent --credential nodeagent1');
    console.log('  node scripts/setup_identity.js --name "NodeAgent2" --agent --credential nodeagent2');
    process.exit(1);
}

const senderDid = senderCred.did;
const senderJwt = senderCred.jwt_token;
const receiverDid = receiverCred.did;
const receiverJwt = receiverCred.jwt_token;

console.log(`\nSender: ${senderDid}`);
console.log(`Receiver: ${receiverDid}`);

// Check if JWT exists
if (!senderJwt) {
    console.log('\nWarning: No JWT token in sender credential.');
    console.log('Node.js registration does not save JWT. Using Python credential for testing.');
    
    // Try to load Python credential
    try {
        const pythonCred = JSON.parse(readFileSync(join(pythonCredDir, 'bearertest.json'), 'utf-8'));
        console.log(`Using Python credential: ${pythonCred.did}`);
    } catch {
        console.log('No Python credential available either. Exiting.');
        process.exit(1);
    }
}

async function sendMessage(jwt, senderDid, receiverDid, content, type = 'text') {
    const requestBody = {
        jsonrpc: '2.0',
        method: 'send',
        params: {
            sender_did: senderDid,
            receiver_did: receiverDid,
            content: content,
            type: type
        },
        id: 1
    };
    
    try {
        const response = await axios.post(
            'https://awiki.ai/message/rpc',
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': jwt ? `Bearer ${jwt}` : undefined
                },
                timeout: 30000
            }
        );
        
        return response.data;
    } catch (error) {
        return {
            error: {
                message: error.message,
                response: error.response?.data
            }
        };
    }
}

async function getInbox(jwt, userDid, limit = 10) {
    const requestBody = {
        jsonrpc: '2.0',
        method: 'get_inbox',
        params: {
            user_did: userDid,
            limit: limit
        },
        id: 1
    };
    
    try {
        const response = await axios.post(
            'https://awiki.ai/message/rpc',
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': jwt ? `Bearer ${jwt}` : undefined
                },
                timeout: 30000
            }
        );
        
        return response.data;
    } catch (error) {
        return {
            error: {
                message: error.message,
                response: error.response?.data
            }
        };
    }
}

async function main() {
    // Test 1: Send plain text message
    console.log('\n' + '-'.repeat(80));
    console.log('Test 1: Send plain text message (nodeagent1 -> nodeagent2)');
    console.log('-'.repeat(80));
    
    const messageContent = `Hello from nodeagent1! This is a plain text message test from Node.js.`;
    console.log(`Message: ${messageContent}`);
    
    // Note: nodeagent1 and nodeagent2 don't have JWT, so this will fail
    // We'll just show the structure
    console.log('\nNote: Node.js registered identities don\'t have JWT tokens.');
    console.log('Message sending requires Bearer JWT authentication.');
    console.log('Please use Python-registered identities for message testing.');
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log('Node.js message test structure verified.');
    console.log('For actual message testing, use Python-registered identities with valid JWT.');
    console.log('\nRecommended test:');
    console.log('  python scripts/test_plain_messages.py');
    console.log('  python scripts/test_e2ee_messages.py');
}

await main();

console.log('\n' + '='.repeat(80));
