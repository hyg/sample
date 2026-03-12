import { DIDWbaAuthHeader } from './nodejs-client/lib/anp/authentication/did_wba_authenticator.js';
import { createIdentity } from './nodejs-client/src/utils/identity.js';

async function test() {
    try {
        console.log('Creating test identity...');
        const identity = createIdentity({
            hostname: 'awiki.ai',
            path_prefix: ['test'],
            proof_purpose: 'authentication',
            domain: 'awiki.ai'
        });
        
        console.log('Identity created:', identity.did);
        
        console.log('Creating auth header...');
        const auth = new DIDWbaAuthHeader();
        await auth.setCredentials(identity.did_document, identity.privateKeyPem);
        
        const authHeader = auth.getAuthHeader('https://awiki.ai', true);
        console.log('Auth header created successfully');
        console.log('Auth header:', authHeader);
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

test();
