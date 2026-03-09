#!/usr/bin/env node

/**
 * Update DID Profile.
 * 
 * Compatible with Python's update_profile.py.
 * 
 * Usage:
 *   node scripts/update_profile.js --name "New Name"
 *   node scripts/update_profile.js --bio "My bio"
 *   node scripts/update_profile.js --avatar https://...
 *   node scripts/update_profile.js --name "Name" --bio "Bio"
 */

import { loadIdentity } from '../src/credential_store.js';
import { createSDKConfig } from '../src/utils/config.js';
import { createUserServiceClient } from '../src/utils/client.js';
import { authenticatedRpcCall } from '../src/utils/rpc.js';

const PROFILE_RPC = '/user-service/did/profile/rpc';

/**
 * Update profile.
 */
async function updateProfile(updates, credentialName = 'default') {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);
    
    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        process.exit(1);
    }
    
    // Build profile object from updates
    const profile = {};
    if (updates.name !== undefined) {
        profile.name = updates.name;
    }
    if (updates.bio !== undefined) {
        profile.bio = updates.bio;
    }
    if (updates.avatar !== undefined) {
        profile.avatar = updates.avatar;
    }
    if (updates.is_public !== undefined) {
        profile.is_public = updates.is_public;
    }
    
    if (Object.keys(profile).length === 0) {
        console.error('Error: No fields to update');
        console.error('Specify --name, --bio, --avatar, or --is-public');
        process.exit(1);
    }
    
    const client = createUserServiceClient(config);
    
    try {
        const result = await authenticatedRpcCall(
            client,
            PROFILE_RPC,
            'updateProfile',
            { profile },
            1,
            { auth: null, credentialName }
        );
        
        console.log('Profile updated:');
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
 * Parse command line arguments.
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {
        credential: 'default'
    };
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--name':
                result.name = args[++i];
                break;
            case '--bio':
                result.bio = args[++i];
                break;
            case '--avatar':
                result.avatar = args[++i];
                break;
            case '--is-public':
                result.is_public = args[++i] === 'true';
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
Update DID Profile.

Usage:
  node scripts/update_profile.js [options]

Options:
  --name <name>            Display name
  --bio <bio>              Bio text
  --avatar <url>           Avatar URL
  --is-public <true|false> Whether profile is publicly visible
  --credential <name>      Credential name (default: default)
  --help, -h               Show this help message

Examples:
  node scripts/update_profile.js --name "New Name"
  node scripts/update_profile.js --bio "My bio"
  node scripts/update_profile.js --avatar https://example.com/avatar.jpg
  node scripts/update_profile.js --name "Name" --bio "Bio"
`);
}

// Main
const options = parseArgs();

const updates = {};
if (options.name !== undefined) updates.name = options.name;
if (options.bio !== undefined) updates.bio = options.bio;
if (options.avatar !== undefined) updates.avatar = options.avatar;
if (options.is_public !== undefined) updates.is_public = options.is_public;

await updateProfile(updates, options.credential);
