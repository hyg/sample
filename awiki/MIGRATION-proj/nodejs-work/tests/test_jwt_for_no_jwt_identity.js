#!/usr/bin/env node

/**
 * Test JWT acquisition for identities without JWT.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { createSDKConfig } from '../src/utils/config.js';
import { loadIdentity } from '../src/credential_store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('JWT Acquisition Test');
console.log('='.repeat(80));

// Load Node.js identity without JWT
const nodejsCredPath = join(__dirname, '..', '.credentials', 'nodeagentfinal.json');

console.log('\n[Loading Identity]');

let nodejsCred;
try {
    nodejsCred = JSON.parse(readFileSync(nodejsCredPath, 'utf-8'));
    console.log(`✓ Node.js identity: ${nodejsCred.did}`);
    console.log(`  Has JWT: ${!!nodejsCred.jwt_token}`);
    console.log(`  Has PEM: ${!!nodejsCred.private_key_pem}`);
} catch (e) {
    console.log(`✗ Identity not found: ${e.message}`);
    process.exit(1);
}

const config = createSDKConfig();

async function testJwtAcquisition() {
    console.log('\n[Test] Acquiring JWT via getJwtViaWba()...');
    
    // PEM from JSON has literal \n, need to replace with actual newlines
    const rawPem = nodejsCred.private_key_pem;
    console.log(`  Raw PEM length: ${rawPem.length} chars`);
    console.log(`  Raw PEM preview: ${rawPem.substring(0, 50)}...`);
    
    // Replace JSON-escaped newlines with actual newlines
    const normalizedPem = rawPem.replace(/\\n/g, '\n');
    console.log(`  Normalized PEM length: ${normalizedPem.length} chars`);
    console.log(`  Normalized PEM preview: ${normalizedPem.substring(0, 50)}...`);
    
    try {
        // Import crypto
        const cryptoLib = await import('crypto');
        
        // Parse PEM
        console.log('\n  Parsing PEM...');
        const privateKeyObj = cryptoLib.default.createPrivateKey(normalizedPem);
        console.log(`  ✓ Private key parsed`);
        
        // Extract JWK
        const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
        console.log(`  ✓ JWK exported`);
        console.log(`    kty: ${privateKeyJwk.kty}`);
        console.log(`    crv: ${privateKeyJwk.crv}`);
        console.log(`    d (length): ${privateKeyJwk.d?.length || 0} chars`);
        
        // Convert to bytes
        const dHex = Buffer.from(privateKeyJwk.d, 'base64url').toString('hex');
        const privateKeyBytes = Buffer.from(dHex, 'hex');
        console.log(`  ✓ Private key bytes: ${privateKeyBytes.length} bytes`);
        
        // Import auth functions
        const { DIDWbaAuthHeader } = await import('../src/utils/auth.js');
        
        // Create auth header
        console.log('\n  Generating auth header...');
        const auth = new DIDWbaAuthHeader(null, null);
        await auth.setCredentials(nodejsCred.did_document, privateKeyBytes);
        const authHeaders = auth.getAuthHeader(config.user_service_url);
        const authHeaderValue = authHeaders['Authorization'];
        
        console.log(`  ✓ Auth header generated`);
        console.log(`    ${authHeaderValue.substring(0, 100)}...`);
        
        // Send verify request
        console.log('\n  Sending verify request...');
        const response = await axios.post(
            `${config.user_service_url}/user-service/did-auth/rpc`,
            {
                jsonrpc: '2.0',
                method: 'verify',
                params: {
                    authorization: authHeaderValue,
                    domain: config.did_domain
                },
                id: 1
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );
        
        console.log(`  ✓ Response received: ${response.status}`);
        console.log(`  Body: ${JSON.stringify(response.data, null, 2)}`);
        
        if (response.data.result && response.data.result.access_token) {
            console.log('\n✓ SUCCESS - JWT acquired!');
            console.log(`  JWT: ${response.data.result.access_token.substring(0, 80)}...`);
            
            // Save JWT to credential file
            const { writeFileSync } = await import('fs');
            nodejsCred.jwt_token = response.data.result.access_token;
            writeFileSync(nodejsCredPath, JSON.stringify(nodejsCred, null, 2), 'utf-8');
            console.log(`  ✓ JWT saved to credential file`);
            
            return { success: true, jwt: response.data.result.access_token };
        } else {
            console.log('\n✗ FAILED - No JWT in response');
            return { success: false, error: response.data.error };
        }
        
    } catch (e) {
        console.log(`\n✗ ERROR: ${e.message}`);
        if (e.response) {
            console.log(`  Status: ${e.response.status}`);
            console.log(`  Body: ${JSON.stringify(e.response.data)}`);
        }
        console.log(`  Stack: ${e.stack}`);
        return { success: false, error: { message: e.message } };
    }
}

const result = await testJwtAcquisition();

console.log('\n' + '='.repeat(80));
console.log(`Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
console.log('='.repeat(80));
