#!/usr/bin/env node

/**
 * Follow/unfollow/view relationship status/lists.
 * 
 * Compatible with Python's manage_relationship.py.
 * 
 * Usage:
 *   node scripts/manage_relationship.js --follow did:wba:...
 *   node scripts/manage_relationship.js --unfollow did:wba:...
 *   node scripts/manage_relationship.js --status did:wba:...
 *   node scripts/manage_relationship.js --following
 *   node scripts/manage_relationship.js --followers
 */

import { loadIdentity } from './utils/credential_store.js';
import { createSDKConfig } from './utils/config.js';
import { createUserServiceClient } from './utils/client.js';
import { authenticatedRpcCall } from './utils/rpc.js';
import { resolveToDid } from './utils/resolve.js';

const RPC_ENDPOINT = '/user-service/did/relationships/rpc';

/**
 * Follow a specific DID.
 */
async function follow(targetDid, credentialName = 'default') {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const resolvedDid = await resolveToDid(targetDid, config);
    const client = createUserServiceClient(config);
    
    try {
        const result = await authenticatedRpcCall(
            client,
            RPC_ENDPOINT,
            'follow',
            { target_did: resolvedDid },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Follow succeeded:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    } finally {
        client.close();
    }
}

/**
 * Unfollow a specific DID.
 */
async function unfollow(targetDid, credentialName = 'default') {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const resolvedDid = await resolveToDid(targetDid, config);
    const client = createUserServiceClient(config);
    
    try {
        const result = await authenticatedRpcCall(
            client,
            RPC_ENDPOINT,
            'unfollow',
            { target_did: resolvedDid },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Unfollow succeeded:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    } finally {
        client.close();
    }
}

/**
 * View relationship status with a specific DID.
 */
async function getStatus(targetDid, credentialName = 'default') {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const resolvedDid = await resolveToDid(targetDid, config);
    const client = createUserServiceClient(config);
    
    try {
        const result = await authenticatedRpcCall(
            client,
            RPC_ENDPOINT,
            'get_relationship',
            { target_did: resolvedDid },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Relationship status:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    } finally {
        client.close();
    }
}

/**
 * View following list.
 */
async function getFollowing(credentialName = 'default', limit = 50, offset = 0) {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const client = createUserServiceClient(config);
    
    try {
        const result = await authenticatedRpcCall(
            client,
            RPC_ENDPOINT,
            'get_following',
            { limit, offset },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Following list:');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.list && result.list.length > 0) {
            console.log(`\nTotal: ${result.total || result.list.length}`);
        }
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    } finally {
        client.close();
    }
}

/**
 * View followers list.
 */
async function getFollowers(credentialName = 'default', limit = 50, offset = 0) {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    const client = createUserServiceClient(config);
    
    try {
        const result = await authenticatedRpcCall(
            client,
            RPC_ENDPOINT,
            'get_followers',
            { limit, offset },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Followers list:');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.list && result.list.length > 0) {
            console.log(`\nTotal: ${result.total || result.list.length}`);
        }
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
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
        credential: 'default',
        limit: 50,
        offset: 0
    };
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--follow':
                result.follow = args[++i];
                break;
            case '--unfollow':
                result.unfollow = args[++i];
                break;
            case '--status':
                result.status = args[++i];
                break;
            case '--following':
                result.following = true;
                break;
            case '--followers':
                result.followers = true;
                break;
            case '--limit':
                result.limit = parseInt(args[++i], 10);
                break;
            case '--offset':
                result.offset = parseInt(args[++i], 10);
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
Follow/unfollow/view relationship status/lists.

Usage:
  node scripts/manage_relationship.js [options]

Options:
  --follow <did>           Follow a specific DID or handle
  --unfollow <did>         Unfollow a specific DID or handle
  --status <did>           View relationship status with a specific DID or handle
  --following              View following list
  --followers              View followers list
  --limit <n>              List result count (default: 50)
  --offset <n>             List offset (default: 0)
  --credential <name>      Credential name (default: default)
  --help, -h               Show this help message

Examples:
  node scripts/manage_relationship.js --follow did:wba:awiki.ai:user:abc123
  node scripts/manage_relationship.js --unfollow alice
  node scripts/manage_relationship.js --status did:wba:...
  node scripts/manage_relationship.js --following --limit 100
  node scripts/manage_relationship.js --followers
`);
}

// Main
const options = parseArgs();

if (options.follow) {
    await follow(options.follow, options.credential);
} else if (options.unfollow) {
    await unfollow(options.unfollow, options.credential);
} else if (options.status) {
    await getStatus(options.status, options.credential);
} else if (options.following) {
    await getFollowing(options.credential, options.limit, options.offset);
} else if (options.followers) {
    await getFollowers(options.credential, options.limit, options.offset);
} else {
    console.error('Error: Please specify an action (--follow, --unfollow, --status, --following, or --followers)');
    printUsage();
    process.exit(1);
}
