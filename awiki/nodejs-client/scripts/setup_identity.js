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

import { createSDKConfig } from '../src/utils/config.js';
import { createIdentity, generateE2eeKeys } from '../src/utils/identity.js';
import { createAuthenticatedIdentity } from '../src/utils/auth.js';
import { createUserServiceClient } from '../src/utils/client.js';
import {
    saveIdentity,
    loadIdentity,
    listIdentities,
    deleteIdentity,
    updateJwt,
    createAuthenticator
} from '../src/credential_store.js';
import { rpcCall, authenticatedRpcCall } from '../src/utils/rpc.js';
import axios from 'axios';

/**
 * Create a new DID identity and save it.
 */
async function createNewIdentity({ name, displayName, credentialName, isAgent }) {
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
    
    // Generate E2EE keys
    identity = generateE2eeKeys(identity);

    console.log(`  DID       : ${identity.did}`);
    console.log(`  unique_id : ${identity.uniqueId}`);

    // 2. Register and get JWT
    let registrationSucceeded = false;
    try {
        await createAuthenticatedIdentity(config, identity, {
            name: displayName || name,
            isAgent
        });

        console.log(`  user_id   : ${identity.user_id}`);
        console.log(`  JWT token : ${identity.jwt_token.substring(0, 50)}...`);
        registrationSucceeded = true;
    } catch (error) {
        console.error('\nNote: Registration succeeded but JWT verification failed.');
        console.error('Identity can still be used for E2EE messaging.');
        console.error('JWT is only needed for authenticated RPC calls.');
        console.error(`Error: ${error.message}`);
    }

    // 3. Save credential (always save, regardless of JWT status)
    console.log('\nSaving credential...');
    console.log('  privateKeyPem:', identity.privateKeyPem ? identity.privateKeyPem.substring(0, 50) + '...' : 'undefined');
    console.log('  didDocument:', identity.did_document ? 'present' : 'undefined');

    const savedPath = saveIdentity({
        did: identity.did,
        uniqueId: identity.uniqueId,
        userId: identity.user_id || null,
        privateKeyPem: identity.privateKeyPem,
        privateKeyHex: Buffer.from(identity.privateKey).toString('hex'),
        publicKeyPem: identity.publicKeyPem,
        jwtToken: identity.jwt_token || null,
        displayName: displayName || name,
        name: credentialName,
        didDocument: identity.did_document,
        e2eeSigningPrivatePem: identity.e2ee_signing_private_pem,
        e2eeAgreementPrivatePem: identity.e2ee_agreement_private_pem
    });

    console.log(`\nCredential saved to: ${savedPath}`);
    console.log(`Credential name: ${credentialName}`);

    if (!registrationSucceeded) {
        console.log('\nNote: Identity saved but JWT verification failed.');
        console.log('You may need to update the JWT token later for authenticated RPC calls.');
    }
}

/**
 * Load a saved identity and verify it.
 */
async function loadSavedIdentity(credentialName = 'default') {
    const data = loadIdentity(credentialName);
    
    if (data === null) {
        console.log(`Credential '${credentialName}' not found`);
        console.log('Create an identity first: node scripts/setup_identity.js --name MyAgent');
        process.exit(1);
    }
    
    console.log(`Loaded credential: ${credentialName}`);
    console.log(`  DID       : ${data.did}`);
    console.log(`  unique_id : ${data.unique_id}`);
    console.log(`  user_id   : ${data.user_id || 'N/A'}`);
    console.log(`  Created at: ${data.created_at || 'N/A'}`);
    
    if (!data.jwt_token) {
        console.log('\n  No JWT token saved');
        return;
    }
    
    const config = createSDKConfig();

    // Try using DIDWbaAuthHeader for automatic authentication
    const authResult = await createAuthenticator(credentialName, config);

    if (authResult !== null) {
        const { auth } = authResult;
        const client = createUserServiceClient(config);
        
        try {
            const me = await authenticatedRpcCall(
                client,
                '/user-service/did-auth/rpc',
                'get_me',
                {},
                1,
                { auth, credentialName }
            );
            
            console.log(`\n  JWT verification succeeded! Current identity:`);
            console.log(`    DID: ${me.did || 'N/A'}`);
            console.log(`    Name: ${me.name || 'N/A'}`);
        } catch (e) {
            console.log(`\n  JWT verification/refresh failed: ${e.message}`);
            console.log('  You may need to recreate the identity');
        }
    } else {
        // Legacy credential without did_document; fall back to direct verification
        console.log('\n  Legacy credential without did_document');
        const client = axios.create({
            baseURL: config.user_service_url,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.jwt_token}`
            }
        });
        
        try {
            const me = await rpcCall(client, '/user-service/did-auth/rpc', 'get_me');
            console.log(`\n  JWT verification succeeded! Current identity:`);
            console.log(`    DID: ${me.did || 'N/A'}`);
            console.log(`    Name: ${me.name || 'N/A'}`);
        } catch (e) {
            console.log(`\n  JWT expired. Please recreate the identity:`);
            console.log(`    node scripts/setup_identity.js --name "${data.name || 'MyAgent'}" --credential ${credentialName}`);
        }
    }
}

/**
 * Show all saved identities.
 */
function showIdentities() {
    const identities = listIdentities();
    
    if (identities.length === 0) {
        console.log('No saved identities');
        console.log('Create an identity: node scripts/setup_identity.js --name MyAgent');
        return;
    }
    
    console.log(`Saved identities (${identities.length}):`);
    console.log('-'.repeat(70));
    
    for (const ident of identities) {
        const jwtStatus = ident.has_jwt ? 'yes' : 'no';
        console.log(`  [${ident.credential_name}]`);
        console.log(`    DID       : ${ident.did}`);
        console.log(`    Name      : ${ident.name || 'N/A'}`);
        console.log(`    user_id   : ${ident.user_id || 'N/A'}`);
        console.log(`    JWT       : ${jwtStatus}`);
        console.log(`    Created at: ${ident.created_at || 'N/A'}`);
        console.log();
    }
}

/**
 * Delete a saved identity.
 */
function removeIdentity(credentialName) {
    if (deleteIdentity(credentialName)) {
        console.log(`Deleted credential: ${credentialName}`);
    } else {
        console.log(`Credential '${credentialName}' not found`);
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
        
        if (arg === '--name' && args[i + 1]) {
            result.name = args[++i];
        } else if (arg === '--load') {
            result.load = args[i + 1] || 'default';
            i++;
        } else if (arg === '--list') {
            result.list = true;
        } else if (arg === '--delete' && args[i + 1]) {
            result.delete = args[++i];
        } else if (arg === '--credential' && args[i + 1]) {
            result.credential = args[++i];
        } else if (arg === '--agent') {
            result.agent = true;
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
Create or restore a DID identity.

Usage:
  node scripts/setup_identity.js [options]

Options:
  --name <name>           Create a new identity with display name
  --load [name]           Load a saved identity (default: default)
  --list                  List all saved identities
  --delete <name>         Delete a saved identity
  --credential <name>     Credential storage name (default: default)
  --agent                 Mark as AI Agent identity
  --help, -h              Show this help message

Examples:
  node scripts/setup_identity.js --name MyAgent
  node scripts/setup_identity.js --name Alice --credential alice
  node scripts/setup_identity.js --load default
  node scripts/setup_identity.js --list
`);
}

/**
 * Main entry point.
 */
async function main() {
    const args = parseArgs();
    
    if (args.help || (!args.name && args.load === undefined && !args.list && !args.delete)) {
        printHelp();
        return;
    }
    
    const credentialName = args.credential || 'default';
    
    if (args.list) {
        showIdentities();
    } else if (args.delete) {
        removeIdentity(args.delete);
    } else if (args.load !== undefined) {
        await loadSavedIdentity(args.load || 'default');
    } else if (args.name) {
        await createNewIdentity({
            name: args.name,
            displayName: args.name,
            credentialName,
            isAgent: args.agent || false
        });
    }
}

main().catch(err => {
    console.error('Error:', err.message);
    if (err.response) {
        console.error('Response:', err.response.data);
    }
    process.exit(1);
});
