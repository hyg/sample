#!/usr/bin/env node

/**
 * Capture the exact registration request sent to awiki.ai by Node.js.
 */

import { createIdentity, generateE2eeKeys } from '../src/utils/identity.js';
import { createSDKConfig } from '../src/utils/config.js';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

console.log('='.repeat(80));
console.log('Node.js Registration Request Capture');
console.log('='.repeat(80));

const config = createSDKConfig();

// Create DID document (same as setup_identity.js)
// Note: Not passing challenge parameter, so it will be auto-generated
let identity = createIdentity({
    hostname: config.did_domain,
    pathPrefix: ['user'],
    proofPurpose: 'authentication',
    domain: config.did_domain
    // challenge is NOT passed - will be auto-generated as random hex
});

identity = generateE2eeKeys(identity);

// Build registration request
const requestPayload = {
    "jsonrpc": "2.0",
    "method": "register",
    "params": {
        "did_document": identity.did_document,
        "name": "NodeJSCaptureTest",
        "is_agent": true
    },
    "id": 1
};

// Save the exact request
writeFileSync(
    join(OUTPUT_DIR, 'nodejs_registration_request.json'),
    JSON.stringify(requestPayload, null, 2)
);

console.log('\n[Registration Request Payload]');
console.log(JSON.stringify(requestPayload, null, 2));

// Extract key info for comparison
const summary = {
    "did": identity.did_document.id,
    "context": identity.did_document['@context'],
    "verification_methods": identity.did_document.verificationMethod.map(vm => ({
        "id": vm.id,
        "type": vm.type,
        "crv": vm.publicKeyJwk?.crv || vm.publicKeyMultibase?.substring(0, 20) || 'N/A'
    })),
    "authentication": identity.did_document.authentication,
    "keyAgreement": identity.did_document.keyAgreement || [],
    "proof": {
        "type": identity.did_document.proof.type,
        "created": identity.did_document.proof.created,
        "verificationMethod": identity.did_document.proof.verificationMethod,
        "proofPurpose": identity.did_document.proof.proofPurpose,
        "domain": identity.did_document.proof.domain || undefined,
        "challenge": identity.did_document.proof.challenge || "NOT PRESENT (auto-generated random)",
        "proofValue": identity.did_document.proof.proofValue
    }
};

writeFileSync(
    join(OUTPUT_DIR, 'nodejs_registration_summary.json'),
    JSON.stringify(summary, null, 2)
);

console.log('\n[Summary]');
console.log(JSON.stringify(summary, null, 2));

console.log(`\nFull request saved to: ${join(OUTPUT_DIR, 'nodejs_registration_request.json')}`);
console.log(`Summary saved to: ${join(OUTPUT_DIR, 'nodejs_registration_summary.json')}`);
console.log('='.repeat(80));
