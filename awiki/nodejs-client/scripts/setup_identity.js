#!/usr/bin/env node

/**
 * Create or restore a DID identity.
 *
 * Compatible with Python's setup_identity.py.
 *
 * Usage:
 *   node scripts/setup_identity.js --name MyAgent
 *   node scripts/setup_identity.js --load default
 *   node scripts/setup_identity.js --list
 *   node scripts/setup_identity.js --delete myid
 */

import { createSDKConfig } from './utils/config.js';
import { createIdentity, generateE2eeKeys } from './utils/identity.js';
import { registerDid, getJwtViaWba } from './utils/auth.js';
import { createUserServiceClient } from './utils/client.js';
import { saveIdentity, loadIdentity, listIdentities, deleteIdentity } from './utils/credential_store.js';
import { rpcCall } from './utils/rpc.js';

/**
 * Create a new DID identity.
 */
async function createNewIdentity({ name, credentialName, isAgent }) {
    const config = createSDKConfig();

    console.log('Service configuration:');
    console.log(`  user-service: ${config.user_service_url}`);
    console.log(`  DID domain  : ${config.did_domain}`);

    const client = createUserServiceClient(config);

    console.log('\nCreating DID identity...');

    // 1. Create identity with keys
    let identity = createIdentity({
        hostname: config.did_domain,
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: config.did_domain
    });

    // 2. Generate E2EE keys
    identity = generateE2eeKeys(identity);

    console.log(`  DID       : ${identity.did}`);
    console.log(`  unique_id : ${identity.uniqueId}`);

    // 3. Register DID
    console.log('  Registering DID...');
    const regResult = await registerDid(config.user_service_url, identity.did_document, {
        name: name,
        is_agent: isAgent || false
    });
    identity.userId = regResult.user_id;
    console.log(`  user_id   : ${regResult.user_id}`);

    // 4. Get JWT token
    console.log('  Obtaining JWT...');
    identity.jwtToken = await getJwtViaWba(
        config.user_service_url,
        identity.did_document,
        identity.privateKey,
        config.did_domain
    );
    console.log(`  JWT token : ${identity.jwtToken.substring(0, 50)}...`);

    // 5. Save credential
    console.log('\nSaving credential...');
    saveIdentity(identity, credentialName);
    console.log(`Credential name: ${credentialName}`);

    return identity;
}

/**
 * Load existing identity.
 */
async function loadExistingIdentity(credentialName) {
    const config = createSDKConfig();
    const cred = loadIdentity(credentialName);

    if (!cred) {
        console.error(`Credential '${credentialName}' not found`);
        return null;
    }

    console.log('Service configuration:');
    console.log(`  user-service: ${config.user_service_url}`);
    console.log(`  DID domain  : ${config.did_domain}`);

    console.log('\nLoading DID identity...');
    console.log(`  DID       : ${cred.did}`);
    console.log(`  unique_id : ${cred.did.split(':').pop()}`);
    console.log(`  user_id   : ${cred.user_id || 'N/A'}`);
    console.log(`  JWT token : ${cred.jwt_token ? cred.jwt_token.substring(0, 50) + '...' : 'Missing'}`);

    // Refresh JWT if needed
    if (cred.jwt_token) {
        console.log('\nJWT token: Valid');
    } else {
        console.log('\nJWT token: Missing, obtaining...');
        // TODO: Implement JWT refresh
    }

    return cred;
}

/**
 * List all credentials.
 */
function listAllIdentities() {
    const identities = listIdentities();
    
    if (identities.length === 0) {
        console.log('No credentials found.');
        return;
    }

    console.log('Saved identities:');
    for (const name of identities) {
        const cred = loadIdentity(name);
        if (cred) {
            console.log(`  - ${name}: ${cred.did}`);
        }
    }
}

/**
 * Delete a credential.
 */
function deleteCredential(credentialName) {
    if (!credentialName) {
        console.error('Please specify credential name');
        return;
    }
    deleteIdentity(credentialName);
}

/**
 * Print usage.
 */
function printUsage() {
    console.log(`
Usage:
  node scripts/setup_identity.js --name <name> [--agent] [--credential <name>]
  node scripts/setup_identity.js --load <credential>
  node scripts/setup_identity.js --list
  node scripts/setup_identity.js --delete <credential>

Options:
  --name        Name for the new identity
  --agent       Create as AI Agent (default: false)
  --credential  Credential name (default: "default")
  --load        Load existing credential
  --list        List all credentials
  --delete      Delete a credential
`);
}

/**
 * Main function.
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        printUsage();
        return;
    }

    const nameIndex = args.indexOf('--name');
    const name = nameIndex >= 0 ? args[nameIndex + 1] : null;
    
    const credentialIndex = args.indexOf('--credential');
    const credentialName = credentialIndex >= 0 ? args[credentialIndex + 1] : 'default';
    
    const isAgent = args.includes('--agent');
    const loadIndex = args.indexOf('--load');
    const listFlag = args.includes('--list');
    const deleteIndex = args.indexOf('--delete');

    if (listFlag) {
        listAllIdentities();
        return;
    }

    if (loadIndex >= 0) {
        const loadCredential = args[loadIndex + 1];
        await loadExistingIdentity(loadCredential);
        return;
    }

    if (deleteIndex >= 0) {
        const deleteCredential = args[deleteIndex + 1];
        deleteCredential(deleteCredential);
        return;
    }

    if (name) {
        await createNewIdentity({ name, credentialName, isAgent });
        return;
    }

    printUsage();
}

// Run main
main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
});
