import { createIdentity, generateE2eeKeys } from '../src/utils/identity.js';
import { createSDKConfig } from '../src/utils/config.js';
import { writeFileSync } from 'fs';

const config = createSDKConfig();
let identity = createIdentity({
    hostname: config.did_domain,
    pathPrefix: ['user'],
    proofPurpose: 'authentication',
    domain: config.did_domain
});
identity = generateE2eeKeys(identity);

console.log('DID:', identity.did);
console.log('Proof:', JSON.stringify(identity.did_document.proof, null, 2));

writeFileSync('debug_did.json', JSON.stringify(identity.did_document, null, 2));
console.log('\nDID document saved to debug_did.json');
