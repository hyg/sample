/**
 * Compare Node.js vs Python DID document structure.
 */

import { createIdentity, generateE2eeKeys } from '../src/utils/identity.js';
import { createSDKConfig } from '../src/utils/config.js';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = createSDKConfig();

console.log('='.repeat(80));
console.log('Node.js vs Python DID Document Comparison');
console.log('='.repeat(80));

// Create Node.js identity
let identity = createIdentity({
    hostname: config.did_domain,
    pathPrefix: ['user'],
    proofPurpose: 'authentication',
    domain: config.did_domain
});
identity = generateE2eeKeys(identity);

console.log('\n[Node.js DID Document]');
console.log(JSON.stringify(identity.did_document, null, 2));

// Save for comparison
writeFileSync(join(__dirname, 'nodejs_did.json'), JSON.stringify(identity.did_document, null, 2));

console.log('\nSaved to nodejs_did.json');
console.log('\nNow compare with Python generated DID document manually.');
console.log('='.repeat(80));
