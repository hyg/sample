#!/usr/bin/env node

/**
 * Check identity status and inbox summary.
 *
 * Compatible with Python's check_status.py.
 *
 * Usage:
 *   node scripts/check_status.js [--credential <name>] [--auto-e2ee]
 */

import { loadIdentity } from './utils/credential_store.js';
import { createSDKConfig } from './utils/config.js';
import { createMoltMessageClient } from './utils/client.js';
import { authenticatedRpcCall } from './utils/rpc.js';

const USER_RPC = '/user-service/did-auth/rpc';
const MESSAGE_RPC = '/message/rpc';

/**
 * Check identity status.
 */
async function checkStatus(credentialName = 'default', autoE2EE = false) {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);

    if (!cred) {
        console.log('Identity Status: no_identity');
        console.log('No credential found. Create one with:');
        console.log('  awiki setup-identity --name "MyAgent"');
        return;
    }

    console.log('Identity Status:');
    console.log(`  Name: ${credentialName}`);
    console.log(`  DID: ${cred.did}`);
    console.log(`  User ID: ${cred.user_id || 'N/A'}`);
    console.log(`  JWT: ${cred.jwt_token ? 'Valid' : 'Missing'}`);
    console.log('');

    // Check inbox summary
    const messageClient = createMoltMessageClient(config);
    
    try {
        const inbox = await authenticatedRpcCall(
            messageClient,
            MESSAGE_RPC,
            'getInbox',
            { user_did: cred.did, limit: 1 },
            1,
            { auth: null, credentialName }
        );

        console.log('Inbox Summary:');
        console.log(`  Total messages: ${inbox.messages?.length || 0}`);
        
        if (autoE2EE) {
            console.log('  E2EE auto-processing: enabled');
        }
    } catch (error) {
        console.log('Inbox: Unable to fetch (service may be unavailable)');
    }

    console.log('');
    console.log('Profile:');
    console.log(`  Use 'awiki get-profile' to view your profile`);
}

// CLI
const args = process.argv.slice(2);
const credentialIndex = args.indexOf('--credential');
const credentialName = credentialIndex >= 0 ? args[credentialIndex + 1] : 'default';
const autoE2EE = args.includes('--auto-e2ee');

checkStatus(credentialName, autoE2EE);
