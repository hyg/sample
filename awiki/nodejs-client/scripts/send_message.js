#!/usr/bin/env node

/**
 * Send a message to a specified DID.
 * 
 * Compatible with Python's send_message.py.
 * 
 * Usage:
 *   node scripts/send_message.js --to "did:wba:awiki.ai:user:abc123" --content "Hello!"
 *   node scripts/send_message.js --to "did:wba:awiki.ai:user:abc123" --content "hello" --type text
 */

import { createSDKConfig } from './utils/config.js';
import { createMoltMessageClient } from './utils/client.js';
import { loadIdentity } from './utils/credential_store.js';
import { getJwtViaWba } from './utils/auth.js';
import { resolveToDid } from './utils/resolve.js';
import crypto from 'crypto';

const MESSAGE_RPC = '/message/rpc';

/**
 * Send a message to a specified DID or handle.
 */
async function sendMessage({
    receiver,
    content,
    msgType = 'text',
    credentialName = 'default'
}) {
    const config = createSDKConfig();
    
    // Load credential
    const cred = loadIdentity(credentialName);
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const senderDid = cred.did;
    
    // Resolve receiver to DID
    const receiverDid = await resolveToDid(receiver, config);

    // Get JWT
    let jwt = cred.jwt_token;
    if (!jwt) {
        console.error('No JWT found. Please run setup_identity first.');
        process.exit(1);
    }

    const client = createMoltMessageClient(config);
    const authHeader = `Bearer ${jwt}`;
    
    try {
        const result = await client.post(
            MESSAGE_RPC,
            {
                jsonrpc: '2.0',
                method: 'send',
                params: {
                    sender_did: senderDid,
                    receiver_did: receiverDid,
                    content: content,
                    type: msgType,
                    client_msg_id: crypto.randomUUID()
                },
                id: 1
            },
            { headers: { 'Authorization': authHeader } }
        );
        
        console.log('Message sent successfully:');
        console.log(JSON.stringify(result.data.result, null, 2));
    } catch (e) {
        console.error('Error:', e.response?.data || e.message);
        process.exit(1);
    }
}

/**
 * Parse command line arguments.
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--to' && args[i + 1]) {
            result.to = args[++i];
        } else if (arg === '--content' && args[i + 1]) {
            result.content = args[++i];
        } else if (arg === '--type' && args[i + 1]) {
            result.type = args[++i];
        } else if (arg === '--credential' && args[i + 1]) {
            result.credential = args[++i];
        } else if (arg === '--help' || arg === '-h') {
            result.help = true;
        }
    }
    
    return result;
}

/**
 * Print usage help.
 */
function printHelp() {
    console.log(`
Send a message to a specified DID.

Usage:
  node scripts/send_message.js [options]

Options:
  --to <did>              Receiver DID or handle (required)
  --content <text>        Message content (required)
  --type <type>          Message type (default: text)
  --credential <name>    Credential name (default: default)
  --help, -h             Show this help message

Examples:
  node scripts/send_message.js --to "did:wba:awiki.ai:user:bob" --content "Hello!"
  node scripts/send_message.js --to "alice.awiki.ai" --content "Hello Alice!"
`);
}

/**
 * Main entry point.
 */
async function main() {
    const args = parseArgs();
    
    if (args.help || (!args.to && !args.content)) {
        printHelp();
        return;
    }
    
    if (!args.to) {
        console.error('Error: --to is required');
        printHelp();
        process.exit(1);
    }
    
    if (!args.content) {
        console.error('Error: --content is required');
        printHelp();
        process.exit(1);
    }
    
    await sendMessage({
        receiver: args.to,
        content: args.content,
        msgType: args.type || 'text',
        credentialName: args.credential || 'default'
    });
}

main().catch(err => {
    console.error('Error:', err.message);
    if (err.response) {
        console.error('Response:', err.response.data);
    }
    process.exit(1);
});
