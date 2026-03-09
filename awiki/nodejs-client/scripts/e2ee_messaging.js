#!/usr/bin/env node

/**
 * E2EE encrypted messaging.
 * 
 * Compatible with Python's e2ee_messaging.py.
 * 
 * Usage:
 *   node scripts/e2ee_messaging.js --handshake did:wba:...    # Initiate session
 *   node scripts/e2ee_messaging.js --send did:wba:... --content "secret"  # Send encrypted
 *   node scripts/e2ee_messaging.js --process --peer did:wba:...  # Process inbox
 */

import { loadIdentity, saveIdentity } from '../src/credential_store.js';
import { createSDKConfig } from '../src/utils/config.js';
import { createMoltMessageClient } from '../src/utils/client.js';
import { authenticatedRpcCall } from '../src/utils/rpc.js';
import { resolveToDid } from '../src/utils/resolve.js';
import { E2eeClient, SUPPORTED_E2EE_VERSION } from '../src/e2ee.js';
import { saveE2eeState, loadE2eeState } from '../src/e2ee_store.js';
import { beginSendAttempt, recordLocalFailure, recordRemoteFailure, markSendSuccess } from '../src/e2ee_outbox.js';
import crypto from 'crypto';

const MESSAGE_RPC = '/message/rpc';

// E2EE message types
const E2EE_MSG_TYPES = new Set(['e2ee_init', 'e2ee_ack', 'e2ee_msg', 'e2ee_rekey', 'e2ee_error']);

/**
 * Load or create E2EE client.
 */
function loadOrCreateE2eeClient(cred, credentialName) {
    const state = loadE2eeState(credentialName);
    
    if (state && state.local_did === cred.did) {
        const client = E2eeClient.fromState(state);
        // Override with credential keys if available
        if (cred.e2ee_signing_private_pem && cred.e2ee_agreement_private_pem) {
            return new E2eeClient(cred.did, cred.e2ee_signing_private_pem, cred.e2ee_agreement_private_pem);
        }
        return client;
    }
    
    return new E2eeClient(
        cred.did,
        cred.e2ee_signing_private_pem,
        cred.e2ee_agreement_private_pem
    );
}

/**
 * Save E2EE client state.
 */
function saveE2eeClient(client, credentialName) {
    const state = client.exportState();
    saveE2eeState(state, credentialName);
}

/**
 * Send message helper.
 */
async function sendMessage(client, senderDid, receiverDid, msgType, content, jwt) {
    return await authenticatedRpcCall(
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
        { auth: null, credentialName: null }
    );
}

/**
 * Initiate E2EE handshake.
 */
async function initiateHandshake(peerDid, credentialName = 'default') {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const resolvedDid = await resolveToDid(peerDid, config);
    const e2eeClient = loadOrCreateE2eeClient(cred, credentialName);
    const moltClient = createMoltMessageClient(config);
    
    try {
        // Initiate handshake
        const { msg_type, content } = await e2eeClient.initiateHandshake(resolvedDid);
        
        // Send e2ee_init message
        await sendMessage(
            moltClient,
            cred.did,
            resolvedDid,
            msg_type,
            content,
            cred.jwt_token
        );
        
        // Save E2EE state
        saveE2eeClient(e2eeClient, credentialName);
        
        console.log('E2EE session initiated:');
        console.log(`  session_id: ${content.session_id}`);
        console.log(`  peer_did: ${resolvedDid}`);
        console.log('Session is ACTIVE; you can send encrypted messages now');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        moltClient.close();
    }
}

/**
 * Send encrypted message.
 */
async function sendEncrypted(peerDid, plaintext, credentialName = 'default') {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const resolvedDid = await resolveToDid(peerDid, config);
    const e2eeClient = loadOrCreateE2eeClient(cred, credentialName);
    const moltClient = createMoltMessageClient(config);
    
    try {
        // Begin send attempt
        const outboxId = beginSendAttempt(resolvedDid, plaintext, 'text');
        
        // Encrypt message
        const { msg_type, content } = await e2eeClient.encryptMessage(resolvedDid, plaintext, 'text');
        
        // Send encrypted message
        const result = await sendMessage(
            moltClient,
            cred.did,
            resolvedDid,
            msg_type,
            content,
            cred.jwt_token
        );
        
        // Mark success
        markSendSuccess(outboxId, result.server_seq);
        
        // Save E2EE state
        saveE2eeClient(e2eeClient, credentialName);
        
        console.log('Encrypted message sent:');
        console.log(`  peer: ${resolvedDid}`);
        console.log(`  seq: ${content.seq}`);
    } catch (error) {
        console.error('Error:', error.message);
        recordLocalFailure(outboxId, error.message);
        process.exit(1);
    } finally {
        moltClient.close();
    }
}

/**
 * Process E2EE messages from inbox.
 */
async function processInbox(peerDid, credentialName = 'default') {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const resolvedDid = await resolveToDid(peerDid, config);
    const e2eeClient = loadOrCreateE2eeClient(cred, credentialName);
    const moltClient = createMoltMessageClient(config);
    
    try {
        // Get inbox
        const inbox = await authenticatedRpcCall(
            moltClient,
            MESSAGE_RPC,
            'getInbox',
            { user_did: cred.did, limit: 50 },
            1,
            { auth: null, credentialName: null }
        );
        
        // Filter E2EE messages from peer
        const e2eeMessages = (inbox.messages || [])
            .filter(msg => E2EE_MSG_TYPES.has(msg.type) && msg.sender_did === resolvedDid)
            .sort((a, b) => {
                // Sort by type priority, then server_seq
                const typeOrder = { 'e2ee_init': 0, 'e2ee_ack': 1, 'e2ee_rekey': 2, 'e2ee_msg': 3, 'e2ee_error': 4 };
                const typeDiff = (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
                if (typeDiff !== 0) return typeDiff;
                return (a.server_seq || 0) - (b.server_seq || 0);
            });
        
        if (e2eeMessages.length === 0) {
            console.log('No E2EE messages from peer');
            return;
        }
        
        console.log(`Processing ${e2eeMessages.length} E2EE message(s) from ${resolvedDid}...`);
        
        for (const msg of e2eeMessages) {
            console.log(`\nProcessing ${msg.type} (seq: ${msg.server_seq || 'N/A'})...`);
            
            try {
                if (msg.type === 'e2ee_init') {
                    // Process handshake
                    const { msg_type: ackType, content: ackContent } = await e2eeClient.processHandshake(msg.content);
                    console.log(`  Session established: ${ackContent.session_id}`);
                    
                    // Send e2ee_ack
                    await sendMessage(
                        moltClient,
                        cred.did,
                        resolvedDid,
                        ackType,
                        ackContent,
                        cred.jwt_token
                    );
                    
                } else if (msg.type === 'e2ee_msg') {
                    // Decrypt message
                    const { plaintext, original_type } = await e2eeClient.decryptMessage(msg.content);
                    console.log(`  Decrypted [${original_type}]: ${plaintext}`);
                    
                } else if (msg.type === 'e2ee_ack') {
                    console.log(`  Session acknowledged: ${msg.content.session_id}`);
                    
                } else if (msg.type === 'e2ee_error') {
                    console.log(`  E2EE error: ${msg.content.error_code}`);
                    
                } else if (msg.type === 'e2ee_rekey') {
                    console.log(`  Rekey requested`);
                }
            } catch (error) {
                console.error(`  Failed to process: ${error.message}`);
            }
        }
        
        // Save E2EE state
        saveE2eeClient(e2eeClient, credentialName);
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        moltClient.close();
    }
}

/**
 * Parse command line arguments.
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {
        credential: 'default'
    };
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--handshake':
                result.handshake = args[++i];
                break;
            case '--send':
                result.send = args[++i];
                break;
            case '--content':
                result.content = args[++i];
                break;
            case '--process':
                result.process = true;
                break;
            case '--peer':
                result.peer = args[++i];
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
E2EE encrypted messaging.

Usage:
  node scripts/e2ee_messaging.js [options]

Options:
  --handshake <did>      Initiate E2EE session with peer
  --send <did>           Send encrypted message to peer
  --content <text>       Message content (required for --send)
  --process              Process E2EE messages from inbox
  --peer <did>           Peer DID (required for --process)
  --credential <name>    Credential name (default: default)
  --help, -h             Show this help message

Examples:
  node scripts/e2ee_messaging.js --handshake did:wba:awiki.ai:user:abc123
  node scripts/e2ee_messaging.js --send did:wba:awiki.ai:user:abc123 --content "secret"
  node scripts/e2ee_messaging.js --process --peer did:wba:awiki.ai:user:abc123
`);
}

// Main
const options = parseArgs();

if (options.handshake) {
    await initiateHandshake(options.handshake, options.credential);
} else if (options.send) {
    if (!options.content) {
        console.error('Error: --content is required for --send');
        process.exit(1);
    }
    await sendEncrypted(options.send, options.content, options.credential);
} else if (options.process) {
    if (!options.peer) {
        console.error('Error: --peer is required for --process');
        process.exit(1);
    }
    await processInbox(options.peer, options.credential);
} else {
    console.error('Error: Please specify an action (--handshake, --send, or --process)');
    printUsage();
    process.exit(1);
}
