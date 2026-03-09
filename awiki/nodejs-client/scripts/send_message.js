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

import { createSDKConfig } from '../src/utils/config.js';
import { createMoltMessageClient } from '../src/utils/client.js';
import { loadIdentity, createAuthenticator } from '../src/credential_store.js';
import { authenticatedRpcCall } from '../src/utils/rpc.js';
import { resolveToDid } from '../src/utils/resolve.js';
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

    // Create authenticator (will handle JWT refresh on 401 automatically)
    const authResult = await createAuthenticator(credentialName, config);
    if (!authResult) {
        console.error(`Cannot create authenticator for '${credentialName}'`);
        process.exit(1);
    }

    const { auth } = authResult;
    const client = createMoltMessageClient(config);

    try {
        const result = await authenticatedRpcCall(
            client,
            MESSAGE_RPC,
            'send',
            {
                sender_did: senderDid,
                receiver_did: receiverDid,
                content: content,
                type: msgType,
                client_msg_id: crypto.randomUUID()
            },
            1,
            { auth, credentialName }
        );

        console.log('Message sent successfully:');
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
        if (e.message.includes('JWT refresh failed')) {
            console.error('\nJWT refresh failed. Please check:');
            console.error('1. Private key is correct');
            console.error('2. DID document is valid');
            console.error('3. Network connection to awiki.ai');
        }
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
  --to <did|handle>       Receiver DID or handle (required)
  --content <text>        Message content (required)
  --type <type>           Message type: text, event (default: text)
  --credential <name>     Credential name (default: default)
  -h, --help              Show this help message

Examples:
  node scripts/send_message.js --to "did:wba:awiki.ai:user:abc123" --content "Hello!"
  node scripts/send_message.js --to "alice.awiki.ai" --content "Hi Alice" --credential myagent
`);
}

/**
 * Main entry point.
 */
function main() {
    const args = parseArgs();

    if (args.help) {
        printHelp();
        process.exit(0);
    }

    if (!args.to || !args.content) {
        console.error('Error: --to and --content are required');
        printHelp();
        process.exit(1);
    }

    sendMessage({
        receiver: args.to,
        content: args.content,
        msgType: args.type || 'text',
        credentialName: args.credential || 'default'
    });
}

main();
