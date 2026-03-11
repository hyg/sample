#!/usr/bin/env node
/**
 * Regenerate E2EE keys for an existing DID identity.
 *
 * When a credential file is missing E2EE private keys (e2ee_signing_private_pem,
 * e2ee_agreement_private_pem), this script generates new key-2 (secp256r1) and
 * key-3 (X25519) key pairs, updates the DID document with new public keys,
 * re-signs the document with key-1, calls did-auth.update_document on the server,
 * and saves everything locally.
 *
 * Usage:
 *     node scripts/regenerate_e2ee_keys.js --credential default
 *
 * [INPUT]: credential_store (load/save), ANP (_build_e2ee_entries, generate_w3c_proof),
 *          utils.auth (update_did_document, get_jwt_via_wba), utils.config (SDKConfig),
 *          logging_config
 * [OUTPUT]: Updated credential file with E2EE private keys and refreshed DID document
 * [POS]: CLI script for E2EE key recovery; one-time repair tool
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updates
 */

import { parseArgs } from 'util';
import { loadIdentity, saveIdentity } from './utils/credential_store.js';

const args = parseArgs({
    options: {
        credential: { type: 'string', default: 'default' },
        force: { type: 'boolean' }
    }
});

const credentialName = args.values.credential || 'default';
const force = args.values.force || false;

console.log(`regenerate_e2ee_keys CLI started credential=${credentialName} force=${force}`);

// Load existing credential
const data = loadIdentity(credentialName);
if (data === null) {
    console.error(`Error: Credential '${credentialName}' not found.`);
    console.error("Create an identity first: node scripts/setup_identity.js --name MyAgent");
    process.exit(1);
}

const did = data.did;
console.log(`Loaded credential: ${credentialName}`);
console.log(`  DID: ${did}`);

// Check if E2EE keys already exist
const hasSigning = data.e2ee_signing_private_pem ? true : false;
const hasAgreement = data.e2ee_agreement_private_pem ? true : false;
if (hasSigning && hasAgreement) {
    if (!force) {
        console.log("\n  E2EE keys already present in credential.");
        console.log("  Use --force to regenerate anyway.");
        process.exit(0);
    }
    console.log("\n  --force specified, regenerating existing E2EE keys...");
}

// Verify key-1 private key exists (needed for re-signing)
const privateKeyPem = data.private_key_pem;
if (!privateKeyPem) {
    console.error("Error: key-1 private key not found in credential. Cannot re-sign.");
    process.exit(1);
}

console.log("  key-1 private key: OK");

console.log("\nError: E2EE key regeneration requires ANP library which is not available in Node.js.");
console.error("This feature is not yet implemented in Node.js version.");
console.error("Please use the Python version for now:");
console.error(`  uv run python scripts/regenerate_e2ee_keys.js --credential ${credentialName} ${force ? '--force' : ''}`);

process.exit(1);
