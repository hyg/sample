import { DIDWbaAuthHeader } from './nodejs-client/lib/anp/authentication/did_wba_authenticator.js';
import { loadIdentity } from './nodejs-client/scripts/utils/credential_store.js';

async function test() {
    try {
        console.log('Loading identity...');
        const identity = loadIdentity('hyg4awiki');
        
        if (!identity) {
            console.error('Identity not found');
            return;
        }
        
        console.log('Creating auth header...');
        const auth = new DIDWbaAuthHeader();
        await auth.setCredentials(identity.did_document, identity.privateKeyPem);
        
        const authHeader = auth.getAuthHeader('https://awiki.ai', true);
        console.log('Auth header created:', authHeader);
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

test();
