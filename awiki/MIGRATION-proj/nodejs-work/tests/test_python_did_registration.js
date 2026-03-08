#!/usr/bin/env node

/**
 * Test registration using Python-generated DID document.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

async function testRegistration() {
    console.log("Testing registration with Python-generated DID document...\n");
    
    // Load Python's final DID document
    const results = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));
    const didDocument = results.final_did_document;
    const privateKeyPem = results.step1_keypair.private_key_pem;
    
    console.log("DID:", didDocument.id);
    console.log("Proof value:", didDocument.proof.proofValue);
    
    // Try to register
    const userServiceUrl = process.env.E2E_USER_SERVICE_URL || 'https://awiki.ai';
    
    try {
        const response = await axios.post(`${userServiceUrl}/user-service/did-auth/rpc`, {
            jsonrpc: '2.0',
            method: 'register',
            params: {
                did_document: didDocument,
                name: 'TestNodeAgent',
                is_agent: true
            },
            id: 1
        });
        
        if (response.data.error) {
            console.log("\nRegistration failed:");
            console.log("  Error:", response.data.error.message);
            if (response.data.error.data) {
                console.log("  Data:", JSON.stringify(response.data.error.data));
            }
        } else {
            console.log("\nRegistration succeeded!");
            console.log("  DID:", response.data.result.did);
            console.log("  User ID:", response.data.result.user_id);
            
            // Now try to get JWT
            console.log("\nTrying to get JWT...");
            
            // For JWT, we need to sign with the private key
            // This is more complex, so let's just verify registration worked
        }
    } catch (error) {
        console.log("\nRequest failed:");
        console.log("  Error:", error.message);
        if (error.response) {
            console.log("  Status:", error.response.status);
            console.log("  Data:", error.response.data);
        }
    }
}

testRegistration().catch(console.error);
