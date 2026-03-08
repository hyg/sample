import { createIdentity } from '../src/utils/identity.js';
import { createSDKConfig } from '../src/utils/config.js';

const config = createSDKConfig();
let identity = createIdentity({
    hostname: config.did_domain,
    pathPrefix: ['user'],
    proofPurpose: 'authentication',
    domain: config.did_domain
});

console.log('DID:', identity.did);
console.log('Proof challenge:', identity.did_document.proof.challenge);
console.log('Challenge length:', identity.did_document.proof.challenge?.length, 'chars');
