/**
 * Capture exact input/output of getJwtViaWba() for comparison with Python.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { DIDWbaAuthHeader } from '../src/utils/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('Node.js getJwtViaWba() - Input/Output Capture');
console.log('='.repeat(80));

// Load credential
const credPath = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message', 'bearertest.json');
const cred = JSON.parse(readFileSync(credPath, 'utf-8'));

const did = cred.did;
const didDocument = cred.did_document;
const privateKeyPem = cred.private_key_pem;

console.log(`\n[Input Parameters]`);
console.log(`userServiceUrl: https://awiki.ai`);
console.log(`did: ${did}`);
console.log(`didDocument: (see DID Document section below)`);
console.log(`privateKeyBytes: PEM string (will be parsed by crypto.createPrivateKey)`);
console.log(`domain: awiki.ai`);

console.log(`\n[DID Document]`);
console.log(`ID: ${didDocument.id}`);
console.log(`Verification Methods: ${didDocument.verificationMethod?.length || 0}`);
didDocument.verificationMethod?.forEach(vm => {
    console.log(`  - ${vm.id} (${vm.type})`);
});

console.log(`\n[Private Key]`);
console.log(`Type: secp256k1`);
console.log(`Format: PKCS#8 PEM`);
console.log(`PEM Header: ${privateKeyPem.split('\n')[0]}`);

// Generate auth header - pass PEM string directly
console.log(`\n[Auth Header Generation]`);

const auth = new DIDWbaAuthHeader(null, null);
// Pass PEM string directly - the function will parse it correctly
await auth.setCredentials(didDocument, privateKeyPem);

const authHeaders = auth.getAuthHeader('https://awiki.ai');
const authHeaderValue = authHeaders['Authorization'];

console.log(`Generated Authorization Header:`);
console.log(`  ${authHeaderValue}`);

// Parse auth header to show components
const parts = {};
const matches = authHeaderValue.matchAll(/(\w+)="([^"]+)"/g);
for (const match of matches) {
    parts[match[1]] = match[2];
}

console.log(`\nHeader Components:`);
console.log(`  v: ${parts.v || 'N/A'}`);
console.log(`  did: ${parts.did?.substring(0, 50) || 'N/A'}...`);
console.log(`  nonce: ${parts.nonce || 'N/A'}`);
console.log(`  timestamp: ${parts.timestamp || 'N/A'}`);
console.log(`  verification_method: ${parts.verification_method || 'N/A'}`);
console.log(`  signature: ${parts.signature?.substring(0, 50) || 'N/A'}...`);

// Send verify request
console.log(`\n${'='.repeat(80)}`);
console.log(`HTTP Request (verify)`);
console.log(`${'='.repeat(80)}`);

async function verify() {
    const requestBody = {
        jsonrpc: '2.0',
        method: 'verify',
        params: {
            authorization: authHeaderValue,
            domain: 'awiki.ai'
        },
        id: 1
    };
    
    console.log(`\nRequest:`);
    console.log(`  URL: https://awiki.ai/user-service/did-auth/rpc`);
    console.log(`  Method: POST`);
    console.log(`  Headers:`);
    console.log(`    Content-Type: application/json`);
    console.log(`  Body:`);
    console.log(`    ${JSON.stringify(requestBody, null, 6)}`);
    
    try {
        const response = await axios.post(
            'https://awiki.ai/user-service/did-auth/rpc',
            requestBody,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );
        
        console.log(`\nResponse:`);
        console.log(`  Status: ${response.status}`);
        console.log(`  Headers:`);
        Object.entries(response.headers).forEach(([k, v]) => {
            if (['content-type', 'content-length', 'server', 'date'].includes(k.toLowerCase())) {
                console.log(`    ${k}: ${v}`);
            }
        });
        
        const result = response.data;
        console.log(`  Body:`);
        console.log(`    ${JSON.stringify(result, null, 6)}`);
        
        // Parse JWT if successful
        if (result.result && result.result.access_token) {
            const jwt = result.result.access_token;
            console.log(`\n[JWT Token]`);
            console.log(`  Token: ${jwt.substring(0, 80)}...`);
            
            // Parse JWT
            const parts = jwt.split('.');
            if (parts.length === 3) {
                const headerPadded = parts[0] + '='.repeat(-parts[0].length % 4);
                const payloadPadded = parts[1] + '='.repeat(-parts[1].length % 4);
                
                const header = JSON.parse(Buffer.from(headerPadded, 'base64').toString('utf-8'));
                const payload = JSON.parse(Buffer.from(payloadPadded, 'base64').toString('utf-8'));
                
                console.log(`\n  JWT Header:`);
                Object.entries(header).forEach(([k, v]) => {
                    console.log(`    ${k}: ${v}`);
                });
                
                console.log(`\n  JWT Payload:`);
                Object.entries(payload).forEach(([k, v]) => {
                    if (['iat', 'exp'].includes(k) && typeof v === 'number') {
                        const dt = new Date(v * 1000).toISOString();
                        console.log(`    ${k}: ${v} (${dt})`);
                    } else {
                        console.log(`    ${k}: ${v}`);
                    }
                });
            }
        }
        
        // Save complete log
        const logData = {
            timestamp: new Date().toISOString(),
            function: 'getJwtViaWba',
            input: {
                userServiceUrl: 'https://awiki.ai',
                did: did,
                didDocument: didDocument,
                privateKey: {
                    type: 'secp256k1',
                    format: 'PKCS#8 PEM'
                },
                domain: 'awiki.ai'
            },
            auth_header_generation: {
                version: '1.1',
                domain_field: 'aud',
                generated_header: authHeaderValue,
                parsed_components: parts
            },
            http_request: {
                url: 'https://awiki.ai/user-service/did-auth/rpc',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: requestBody
            },
            http_response: {
                status_code: response.status,
                headers: response.headers,
                body: result
            },
            output: {
                success: !!(result.result && result.result.access_token),
                access_token: result.result?.access_token || null,
                error: result.error || null
            }
        };
        
        const { writeFileSync } = await import('fs');
        const logPath = join(__dirname, 'nodejs_get_jwt_log.json');
        writeFileSync(logPath, JSON.stringify(logData, null, 2), 'utf-8');
        
        console.log(`\n[LOG SAVED]`);
        console.log(`Complete log saved to: ${logPath}`);
        
        return result;
        
    } catch (error) {
        console.log(`\n[ERROR]`);
        console.log(`Request failed: ${error.message}`);
        if (error.response) {
            console.log(`Status: ${error.response.status}`);
            console.log(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        
        // Save error log
        const logData = {
            timestamp: new Date().toISOString(),
            function: 'getJwtViaWba',
            input: {
                userServiceUrl: 'https://awiki.ai',
                did: did,
                didDocument: didDocument,
                domain: 'awiki.ai'
            },
            error: {
                message: error.message,
                response: error.response?.data || null
            }
        };
        
        const { writeFileSync } = await import('fs');
        const logPath = join(__dirname, 'nodejs_get_jwt_error.json');
        writeFileSync(logPath, JSON.stringify(logData, null, 2), 'utf-8');
        
        console.log(`\n[LOG SAVED]`);
        console.log(`Error log saved to: ${logPath}`);
        
        return { error: { message: error.message } };
    }
}

const result = await verify();

console.log(`\n${'='.repeat(80)}`);
console.log(`[Output]`);
console.log(`${'='.repeat(80)}`);

if (result.result && result.result.access_token) {
    console.log(`Return Value: ${result.result.access_token.substring(0, 80)}...`);
    console.log(`Status: SUCCESS`);
} else {
    console.log(`Return Value: None (exception raised)`);
    console.log(`Error: ${result.error?.message || 'Unknown error'}`);
    console.log(`Status: FAILED`);
}

console.log(`${'='.repeat(80)}`);
