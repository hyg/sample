#!/usr/bin/env node

/**
 * Check inbox, view chat history, mark messages as read.
 * 
 * Compatible with Python's check_inbox.py.
 * 
 * Usage:
 *   node scripts/check_inbox.js                    # View inbox
 *   node scripts/check_inbox.js --limit 5          # Limit result count
 *   node scripts/check_inbox.js --history did:...  # View chat history
 *   node scripts/check_inbox.js --mark-read id1,id2 # Mark messages as read
 */

import { loadIdentity } from './utils/credential_store.js';
import { createSDKConfig } from './utils/utils/config.js';
import { createMoltMessageClient } from './utils/utils/client.js';
import { authenticatedRpcCall } from './utils/utils/rpc.js';
import { resolveToDid } from './utils/utils/resolve.js';

const MESSAGE_RPC = '/message/rpc';

/**
 * View inbox.
 */
async function checkInbox(credentialName = 'default', limit = 20) {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const client = createMoltMessageClient(config);
    
    try {
        const inbox = await authenticatedRpcCall(
            client,
            MESSAGE_RPC,
            'getInbox',
            { user_did: cred.did, limit },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Inbox:');
        console.log(JSON.stringify(inbox, null, 2));
        
        if (inbox.messages && inbox.messages.length > 0) {
            console.log(`\nTotal: ${inbox.messages.length} message(s)`);
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

/**
 * View chat history with a specific DID.
 */
async function getHistory(peerDid, credentialName = 'default', limit = 50) {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    // Resolve peerDid if it's a handle
    const resolvedDid = await resolveToDid(peerDid, config);
    
    const client = createMoltMessageClient(config);
    
    try {
        const history = await authenticatedRpcCall(
            client,
            MESSAGE_RPC,
            'getHistory',
            { user_did: cred.did, peer_did: resolvedDid, limit },
            1,
            { auth: null, credentialName }
        );
        
        console.log(`Chat history with ${resolvedDid}:`);
        console.log(JSON.stringify(history, null, 2));
        
        if (history.messages && history.messages.length > 0) {
            console.log(`\nTotal: ${history.messages.length} message(s)`);
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

/**
 * Mark messages as read.
 */
async function markRead(messageIds, credentialName = 'default') {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const client = createMoltMessageClient(config);
    
    try {
        const result = await authenticatedRpcCall(
            client,
            MESSAGE_RPC,
            'markRead',
            { user_did: cred.did, message_ids: messageIds },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Messages marked as read:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

/**
 * Parse command line arguments.
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {
        limit: 20,
        credential: 'default'
    };
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--limit':
                result.limit = parseInt(args[++i], 10);
                break;
            case '--history':
                result.history = args[++i];
                break;
            case '--mark-read':
                result.markRead = args[++i].split(',');
                break;
            case '--credential':
                result.credential = args[++i];
                break;
            case '--help':
            case '-h':
                printUsage();
                process.exit(0);
                break;
        }
    }
    
    return result;
}

function printUsage() {
    console.log(`
Check inbox, view chat history, mark messages as read.

Usage:
  node scripts/check_inbox.js [options]

Options:
  --limit <n>              Limit result count (default: 20)
  --history <did>          View chat history with a specific DID or handle
  --mark-read <ids>        Mark specified message IDs as read (comma-separated)
  --credential <name>      Credential name (default: default)
  --help, -h               Show this help message

Examples:
  node scripts/check_inbox.js
  node scripts/check_inbox.js --limit 5
  node scripts/check_inbox.js --history did:wba:awiki.ai:user:abc123
  node scripts/check_inbox.js --mark-read msg_id_1,msg_id_2
`);
}

// Main
const options = parseArgs();

if (options.markRead) {
    await markRead(options.markRead, options.credential);
} else if (options.history) {
    await getHistory(options.history, options.credential, options.limit);
} else {
    await checkInbox(options.credential, options.limit);
}
