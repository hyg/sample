#!/usr/bin/env node

/**
 * Register a Handle (human-readable DID alias) interactively.
 * 
 * Compatible with Python's register_handle.py.
 * 
 * Usage:
 *   node scripts/register_handle.js --handle alice --phone +8613800138000
 *   node scripts/register_handle.js --handle bob --phone +86... --otp 123456
 *   node scripts/register_handle.js --handle alice --phone +86... --invite-code ABC123
 */

import { createSDKConfig } from '../src/utils/config.js';
import { createUserServiceClient } from '../src/utils/client.js';
import { sendOtp, registerHandle } from '../src/utils/handle.js';
import { saveIdentity } from '../src/credential_store.js';
import { createInterface } from 'readline';

/**
 * Read input from command line interactively.
 */
function readLine(question) {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

/**
 * Register a Handle interactively.
 */
async function doRegister({
    handle,
    phone,
    otpCode = null,
    inviteCode = null,
    name = null,
    credentialName = 'default'
}) {
    const config = createSDKConfig();
    
    console.log('Service configuration:');
    console.log(`  user-service: ${config.user_service_url}`);
    console.log(`  DID domain  : ${config.did_domain}`);
    
    const client = createUserServiceClient(config);
    
    try {
        // 1. Send OTP if not provided
        if (!otpCode) {
            console.log(`\nSending OTP to ${phone}...`);
            const otpResult = await sendOtp(client, phone);
            console.log('OTP sent. Check your phone.');
            
            otpCode = await readLine('Enter OTP code: ');
            if (!otpCode) {
                console.error('OTP code is required.');
                process.exit(1);
            }
        }
        
        // 2. Register Handle
        console.log(`\nRegistering Handle '${handle}'...`);
        const identity = await registerHandle({
            client,
            config,
            phone,
            otp_code: otpCode,
            handle,
            invite_code: inviteCode,
            name: name || handle,
            is_public: true
        });
        
        console.log(`  Handle    : ${handle}.${config.did_domain}`);
        console.log(`  DID       : ${identity.did}`);
        console.log(`  unique_id : ${identity.uniqueId}`);
        console.log(`  user_id   : ${identity.user_id}`);
        console.log(`  JWT token : ${identity.jwt_token?.substring(0, 50) || 'N/A'}...`);
        
        // 3. Save credential
        const savedPath = saveIdentity({
            did: identity.did,
            uniqueId: identity.uniqueId,
            userId: identity.user_id,
            privateKeyPem: identity.privateKeyPem,
            publicKeyPem: identity.publicKeyPem,
            jwtToken: identity.jwt_token || null,
            displayName: name || handle,
            name: credentialName,
            didDocument: identity.did_document,
            e2eeSigningPrivatePem: identity.e2ee_signing_private_pem,
            e2eeAgreementPrivatePem: identity.e2ee_agreement_private_pem
        });
        
        console.log(`\nCredential saved to: ${savedPath}`);
        console.log(`Credential name: ${credentialName}`);
        
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
    const result = {};
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--handle':
                result.handle = args[++i];
                break;
            case '--phone':
                result.phone = args[++i];
                break;
            case '--otp-code':
                result.otpCode = args[++i];
                break;
            case '--invite-code':
                result.inviteCode = args[++i];
                break;
            case '--name':
                result.name = args[++i];
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
Register a Handle (human-readable DID alias) interactively.

Usage:
  node scripts/register_handle.js [options]

Options:
  --handle <handle>        Handle local-part (e.g., alice)
  --phone <phone>          Phone number in international format
                           (e.g., +8613800138000 for China, +14155552671 for US)
  --otp-code <code>        OTP code (if already obtained)
  --invite-code <code>     Invite code (required for short handles <= 4 chars)
  --name <name>            Display name (defaults to handle)
  --credential <name>      Credential storage name (default: default)
  --help, -h               Show this help message

Examples:
  node scripts/register_handle.js --handle alice --phone +8613800138000
  node scripts/register_handle.js --handle bob --phone +86... --otp 123456
  node scripts/register_handle.js --handle alice --phone +86... --invite-code ABC123
`);
}

// Validate required arguments
const options = parseArgs();

if (!options.handle || !options.phone) {
    console.error('Error: --handle and --phone are required');
    printUsage();
    process.exit(1);
}

await doRegister({
    handle: options.handle,
    phone: options.phone,
    otpCode: options.otpCode,
    inviteCode: options.inviteCode,
    name: options.name,
    credentialName: options.credential || 'default'
});
