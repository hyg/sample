#!/usr/bin/env node

/**
 * Test Node.js JWT acquisition flow.
 * This script registers a new identity and obtains JWT token.
 */

import { createSDKConfig } from '../src/utils/config.js';
import { createIdentity, generateE2eeKeys } from '../src/utils/identity.js';
import { createAuthenticatedIdentity } from '../src/utils/auth.js';
import { saveIdentity } from '../src/credential_store.js';
import { createMoltMessageClient } from '../src/utils/client.js';
import { authenticatedRpcCall } from '../src/utils/rpc.js';

console.log('='.repeat(80));
console.log('Node.js: JWT Acquisition Test');
console.log('='.repeat(80));

const config = createSDKConfig();

console.log('\n[Step 1] Create Identity');
console.log('-'.repeat(80));

// Create identity with keys
let identity = createIdentity({
    hostname: config.did_domain,
    pathPrefix: ['user'],
    proofPurpose: 'authentication',
    domain: config.did_domain
});

// Generate E2EE keys
identity = generateE2eeKeys(identity);

console.log(`DID: ${identity.did}`);
console.log(`unique_id: ${identity.uniqueId}`);
console.log(`Has E2EE signing key: ${!!identity.e2ee_signing_private_pem}`);
console.log(`Has E2EE agreement key: ${!!identity.e2ee_agreement_private_pem}`);

console.log('\n[Step 2] Register and Obtain JWT');
console.log('-'.repeat(80));

try {
    // Register and get JWT
    const result = await createAuthenticatedIdentity(config, identity, {
        name: 'NodeJSTest',
        isAgent: true
    });
    
    console.log(`user_id: ${result.user_id}`);
    console.log(`JWT token: ${result.jwt_token ? result.jwt_token.substring(0, 50) + '...' : 'NOT OBTAINED'}`);
    
    if (result.jwt_token) {
        console.log('\n[PASS] JWT acquisition SUCCESS');
        
        // Save credential with JWT
        console.log('\n[Step 3] Save Credential');
        console.log('-'.repeat(80));
        
        const savedPath = saveIdentity({
            did: result.did,
            uniqueId: result.uniqueId,
            userId: result.user_id,
            privateKeyPem: result.privateKeyPem,
            publicKeyPem: result.publicKeyPem,
            jwtToken: result.jwt_token,
            displayName: 'NodeJSTest',
            name: 'nodejs_jwt_test',
            didDocument: result.did_document,
            e2eeSigningPrivatePem: result.e2ee_signing_private_pem,
            e2eeAgreementPrivatePem: result.e2ee_agreement_private_pem
        });
        
        console.log(`Credential saved to: ${savedPath}`);
        
        // Test JWT by calling get_me
        console.log('\n[Step 4] Test JWT with get_me');
        console.log('-'.repeat(80));
        
        const client = createMoltMessageClient(config);
        
        const me = await authenticatedRpcCall(
            client,
            '/user-service/did-auth/rpc',
            'get_me',
            {},
            1,
            { 
                auth: null,  // Will use JWT from credential
                credentialName: 'nodejs_jwt_test'
            }
        );
        
        console.log(`get_me result: ${JSON.stringify(me, null, 2)}`);
        console.log('\n[PASS] JWT verification SUCCESS');
        
    } else {
        console.log('\n[FAIL] JWT token not obtained');
        console.log('This indicates getJwtViaWba failed.');
    }
    
} catch (error) {
    console.log(`\n[FAIL] Registration/JWT acquisition failed`);
    console.log(`Error: ${error.message}`);
    if (error.response) {
        console.log(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    console.log('\nStack trace:');
    console.log(error.stack);
}

console.log('\n' + '='.repeat(80));
console.log('Test completed');
console.log('='.repeat(80));
