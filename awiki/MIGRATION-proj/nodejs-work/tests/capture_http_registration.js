/**
 * Capture the EXACT HTTP request and response when registering with awiki.ai.
 */

import { createIdentity, generateE2eeKeys } from '../src/utils/identity.js';
import { createSDKConfig } from '../src/utils/config.js';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

async function captureRegistration() {
    console.log('='.repeat(80));
    console.log('Node.js Registration - HTTP Request/Response Capture');
    console.log('='.repeat(80));

    const config = createSDKConfig();
    
    // Create identity
    console.log('\n[1] Creating identity...');
    let identity = createIdentity({
        hostname: config.did_domain,
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: config.did_domain
    });
    
    // Generate E2EE keys (same as setup_identity.js)
    identity = generateE2eeKeys(identity);
    
    console.log(`DID: ${identity.did}`);
    
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
    
    // Send HTTP request
    console.log('\n[2] Sending registration request to awiki.ai...');
    
    try {
        const response = await axios.post(
            `${config.user_service_url}/user-service/did-auth/rpc`,
            requestPayload,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );
        
        // Capture request and response
        const captureData = {
            request: {
                url: `${config.user_service_url}/user-service/did-auth/rpc`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: requestPayload
            },
            response: {
                status_code: response.status,
                headers: response.headers,
                body: response.data
            },
            identity: {
                did: identity.did,
                proof: identity.did_document.proof
            }
        };
        
        console.log('\n[3] Response received:');
        console.log(`Status: ${response.status}`);
        console.log(`Response body: ${JSON.stringify(response.data, null, 2)}`);
        
        // Save to file
        writeFileSync(
            join(OUTPUT_DIR, 'nodejs_http_capture.json'),
            JSON.stringify(captureData, null, 2)
        );
        
        console.log(`\n[4] Full capture saved to: ${join(OUTPUT_DIR, 'nodejs_http_capture.json')}`);
        
    } catch (error) {
        console.log('\n[3] Error received:');
        console.log(`Status: ${error.response?.status}`);
        console.log(`Response: ${JSON.stringify(error.response?.data, null, 2)}`);
        
        // Capture error response
        const captureData = {
            request: {
                url: `${config.user_service_url}/user-service/did-auth/rpc`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: requestPayload
            },
            response: {
                status_code: error.response?.status,
                headers: error.response?.headers,
                body: error.response?.data,
                error: error.message
            },
            identity: {
                did: identity.did,
                proof: identity.did_document.proof
            }
        };
        
        writeFileSync(
            join(OUTPUT_DIR, 'nodejs_http_capture.json'),
            JSON.stringify(captureData, null, 2)
        );
        
        console.log(`\n[4] Full capture saved to: ${join(OUTPUT_DIR, 'nodejs_http_capture.json')}`);
    }
}

captureRegistration();
