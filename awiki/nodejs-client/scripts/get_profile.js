#!/usr/bin/env node

/**
 * View DID Profile (own or public).
 * 
 * Compatible with Python's get_profile.py.
 * 
 * Usage:
 *   node scripts/get_profile.js                      # View own profile
 *   node scripts/get_profile.js --did did:wba:...    # View public profile by DID
 *   node scripts/get_profile.js --handle alice       # View public profile by handle
 *   node scripts/get_profile.js --resolve did:wba:... # Resolve DID document
 */

import { loadIdentity } from '../src/credential_store.js';
import { createSDKConfig } from '../src/utils/config.js';
import { createUserServiceClient } from '../src/utils/client.js';
import { authenticatedRpcCall } from '../src/utils/rpc.js';
import { resolveToDid } from '../src/utils/resolve.js';

const PROFILE_RPC = '/user-service/did/profile/rpc';

/**
 * View own Profile.
 */
async function getMyProfile(credentialName = 'default') {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const client = createUserServiceClient(config);
    
    try {
        const me = await authenticatedRpcCall(
            client,
            PROFILE_RPC,
            'get_me',
            {},
            1,
            { auth: null, credentialName }
        );
        
        console.log(JSON.stringify(me, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        client.close();
    }
}

/**
 * View public Profile of a specific DID or handle.
 */
async function getPublicProfile({ did = null, handle = null }) {
    const config = createSDKConfig();
    const client = createUserServiceClient(config);
    
    const params = {};
    if (did) {
        params.did = did;
    } else if (handle) {
        params.handle = handle;
    } else {
        console.error('Error: must provide --did or --handle');
        process.exit(1);
    }
    
    try {
        const profile = await authenticatedRpcCall(
            client,
            PROFILE_RPC,
            'getProfile',
            params,
            1,
            { auth: null }
        );
        
        console.log(JSON.stringify(profile, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        client.close();
    }
}

/**
 * Resolve a DID document.
 */
async function resolveDid(did) {
    const config = createSDKConfig();
    const client = createUserServiceClient(config);
    
    try {
        const resolved = await authenticatedRpcCall(
            client,
            PROFILE_RPC,
            'resolve',
            { did },
            1,
            { auth: null }
        );
        
        console.log(JSON.stringify(resolved, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        client.close();
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
            case '--did':
                result.did = args[++i];
                break;
            case '--handle':
                result.handle = args[++i];
                break;
            case '--resolve':
                result.resolve = args[++i];
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
View DID Profile (own or public).

Usage:
  node scripts/get_profile.js [options]

Options:
  --did <did>              View public Profile of a specific DID
  --handle <handle>        View public Profile of a specific handle
  --resolve <did>          Resolve a DID document
  --credential <name>      Credential name (default: default)
  --help, -h               Show this help message

Examples:
  node scripts/get_profile.js
  node scripts/get_profile.js --did did:wba:awiki.ai:user:abc123
  node scripts/get_profile.js --handle alice
  node scripts/get_profile.js --resolve did:wba:awiki.ai:user:abc123
`);
}

// Main
const options = parseArgs();

if (options.resolve) {
    await resolveDid(options.resolve);
} else if (options.did || options.handle) {
    await getPublicProfile({ did: options.did, handle: options.handle });
} else {
    await getMyProfile(options.credential);
}
