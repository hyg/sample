#!/usr/bin/env node
/**
 * Recover a Handle by rebinding it to a new DID.
 *
 * Usage:
 *     node scripts/recover_handle.js --handle alice --phone +8613800138000
 *     node scripts/recover_handle.js --handle alice --phone +8613800138000 --credential alice
 *     node scripts/recover_handle.js --handle alice --phone +8613800138000 --credential default --replace-existing
 *
 * [INPUT]: SDK (handle OTP + recovery RPC), credential_store, local_store, e2ee_store
 * [OUTPUT]: Handle recovery result with safe credential target selection, optional
 *           credential replacement, and conditional local cache migration
 * [POS]: Recovery CLI for users who lost the old DID private key but still control
 *        the original Handle phone number
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updating
 */

import { parseArgs } from 'util';
import readline from 'readline';
import { createSDKConfig } from './utils/config.js';
import { createUserServiceClient } from '../src/utils/client.js';
import { recoverHandle, sendOtp } from '../src/utils/handle.js';
import { loadIdentity, saveIdentity, backupIdentity } from './utils/credential_store.js';
import { deleteE2eeState } from './utils/e2ee_store.js';
import { rebind_owner_did, clear_owner_e2ee_data } from './utils/local_store.js';

const args = parseArgs({
    options: {
        handle: { type: 'string' },
        phone: { type: 'string' },
        'otp-code': { type: 'string' },
        credential: { type: 'string' },
        'replace-existing': { type: 'boolean' }
    },
    allowPositionals: false
});

if (!args.values.handle || !args.values.phone) {
    console.error('Usage: node scripts/recover_handle.js --handle <handle> --phone <phone> [--otp-code <code>] [--credential <name>] [--replace-existing]');
    process.exit(1);
}

const handle = args.values.handle;
const phone = args.values.phone;
const otpCode = args.values['otp-code'];
const requestedCredentialName = args.values.credential;
const replaceExisting = args.values['replace-existing'];

// Allocate recovery credential name
function allocateRecoveryCredentialName(handle) {
    const candidateNames = [handle, `${handle}_recovered`];
    for (const candidate of candidateNames) {
        if (loadIdentity(candidate) === null) {
            return candidate;
        }
    }
    
    let suffix = 2;
    while (true) {
        const candidate = `${handle}_recovered_${suffix}`;
        if (loadIdentity(candidate) === null) {
            return candidate;
        }
        suffix++;
    }
}

// Resolve recovery target
function resolveRecoveryTarget(handle, requestedCredentialName, replaceExisting) {
    if (!requestedCredentialName) {
        return [allocateRecoveryCredentialName(handle), null];
    }
    
    const existingCredential = loadIdentity(requestedCredentialName);
    if (existingCredential && !replaceExisting) {
        throw new Error(
            `Credential '${requestedCredentialName}' already exists for DID ` +
            `${existingCredential.did}; use a different --credential value ` +
            "or pass --replace-existing to overwrite it intentionally."
        );
    }
    return [requestedCredentialName, existingCredential];
}

// Migrate local cache
function migrateLocalCache(credentialName, oldDid, newDid) {
    const rebound = rebind_owner_did(oldDid, newDid);
    const cleared = clear_owner_e2ee_data(oldDid, credentialName);
    const deletedState = deleteE2eeState(credentialName);
    
    return {
        messages_rebound: rebound.messages,
        contacts_rebound: rebound.contacts,
        e2ee_outbox_cleared: cleared.e2ee_outbox,
        e2ee_state_deleted: deletedState
    };
}

async function doRecover(handle, phone, otpCode, requestedCredentialName, replaceExisting) {
    let credentialName, oldCredential;
    try {
        [credentialName, oldCredential] = resolveRecoveryTarget(handle, requestedCredentialName, replaceExisting);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
    
    const shouldReplaceExisting = oldCredential !== null && replaceExisting;
    
    console.log(`Recovering handle handle=${handle} requested_credential=${requestedCredentialName || 'none'} target_credential=${credentialName} replace_existing=${shouldReplaceExisting} otp_provided=${otpCode ? 'yes' : 'no'}`);
    
    const config = createSDKConfig();
    const oldDid = oldCredential?.did || null;
    const oldUniqueId = oldCredential?.uniqueId || null;
    
    const client = await createUserServiceClient(config);
    
    let otpCodeInput = otpCode;
    if (!otpCodeInput) {
        console.log(`Sending OTP to ${phone}...`);
        try {
            await sendOtp(client, phone);
            console.log('OTP sent. Check your phone.');
        } catch (error) {
            console.error(`Failed to send OTP: ${error.message}`);
            process.exit(1);
        }
        
        // Use readline to prompt for OTP
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        otpCodeInput = await new Promise((resolve) => {
            rl.question('Enter OTP code: ', (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        });
        
        if (!otpCodeInput) {
            console.error('OTP code is required.');
            process.exit(1);
        }
    }
    
    const [identity, recoverResult] = await recoverHandle(client, config, phone, otpCodeInput, handle);
    
    let backupPath = null;
    if (shouldReplaceExisting) {
        backupPath = backupIdentity(credentialName);
        if (backupPath) {
            console.log(`Existing credential backed up to: ${backupPath}`);
        }
    }
    
    saveIdentity({
        did: identity.did,
        uniqueId: identity.uniqueId,
        userId: identity.user_id,
        privateKeyPem: identity.privateKeyPem,
        publicKeyPem: identity.publicKeyPem,
        jwtToken: identity.jwt_token,
        displayName: oldCredential?.name || handle,
        handle: handle,
        name: credentialName,
        didDocument: identity.did_document,
        e2eeSigningPrivatePem: identity.e2eeSigningPrivatePem,
        e2eeAgreementPrivatePem: identity.e2eeAgreementPrivatePem,
        replaceExisting: shouldReplaceExisting
    });
    
    let cacheMigration = null;
    if (shouldReplaceExisting && oldDid && oldDid !== identity.did) {
        cacheMigration = migrateLocalCache(credentialName, oldDid, identity.did);
    }
    
    if (shouldReplaceExisting && oldUniqueId && oldUniqueId !== identity.uniqueId) {
        // pruneUnreferencedCredentialDir is not yet implemented in Node.js
        console.log(`Would prune unreferenced credential directory for old unique ID: ${oldUniqueId}`);
    }
    
    console.log('Handle recovered successfully:');
    console.log(JSON.stringify({
        did: identity.did,
        user_id: identity.user_id,
        handle: recoverResult.handle || handle,
        full_handle: recoverResult.full_handle,
        requested_credential_name: requestedCredentialName,
        credential_name: credentialName,
        replaced_existing_credential: shouldReplaceExisting,
        message: recoverResult.message || 'OK',
        local_backup_path: backupPath,
        local_cache_migration: cacheMigration
    }, null, 2));
}

doRecover(handle, phone, otpCode, requestedCredentialName, replaceExisting)
    .then(() => {
        console.log('Recovery completed successfully.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error during handle recovery:', error.message);
        process.exit(1);
    });
