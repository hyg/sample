#!/usr/bin/env node

/**
 * Use Python-registered JWT for Node.js operations.
 * This script loads JWT from Python credential and tests it with Node.js.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('Node.js: Use Python JWT for Authentication');
console.log('='.repeat(80));

// Load Python credential
const pythonCredPath = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message', 'bearertest.json');

console.log(`\nLoading Python credential: ${pythonCredPath}`);

let pythonCred;
try {
    pythonCred = JSON.parse(readFileSync(pythonCredPath, 'utf-8'));
} catch (error) {
    console.log(`Failed to load Python credential: ${error.message}`);
    process.exit(1);
}

const did = pythonCred.did;
const jwt = pythonCred.jwt_token;

console.log(`DID: ${did}`);
console.log(`JWT: ${jwt ? jwt.substring(0, 50) + '...' : 'NOT FOUND'}`);

if (!jwt) {
    console.log('\n[FAIL] No JWT token in Python credential');
    process.exit(1);
}

// Test JWT with get_me
console.log('\n[Test] Call get_me with Bearer JWT');
console.log('-'.repeat(80));

async function testGetMe() {
    const requestBody = {
        jsonrpc: '2.0',
        method: 'get_me',
        params: {},
        id: 1
    };
    
    try {
        const response = await axios.post(
            'https://awiki.ai/user-service/did-auth/rpc',
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwt}`
                },
                timeout: 30000
            }
        );
        
        const result = response.data;
        
        if (result.result) {
            console.log('[PASS] get_me SUCCESS');
            console.log(`DID: ${result.result.did}`);
            console.log(`User ID: ${result.result.user_id}`);
            console.log(`Name: ${result.result.name || 'N/A'}`);
            return true;
        } else {
            const error = result.error || {};
            console.log('[FAIL] get_me FAILED');
            console.log(`Error: ${error.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        console.log('[FAIL] Request failed:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        }
        return false;
    }
}

// Test JWT with send message
console.log('\n[Test] Call send with Bearer JWT');
console.log('-'.repeat(80));

async function testSendMessage() {
    const requestBody = {
        jsonrpc: '2.0',
        method: 'send',
        params: {
            sender_did: did,
            receiver_did: did,  // Send to self
            content: 'Test message from Node.js using Python JWT',
            type: 'text'
        },
        id: 1
    };
    
    try {
        const response = await axios.post(
            'https://awiki.ai/message/rpc',
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwt}`
                },
                timeout: 30000
            }
        );
        
        const result = response.data;
        
        if (result.result) {
            console.log('[PASS] send SUCCESS');
            console.log(`Message ID: ${result.result.id || 'N/A'}`);
            console.log(`Server Seq: ${result.result.server_seq || 'N/A'}`);
            return true;
        } else {
            const error = result.error || {};
            console.log('[FAIL] send FAILED');
            console.log(`Error: ${error.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        console.log('[FAIL] Request failed:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        }
        return false;
    }
}

// Save JWT to Node.js credential
console.log('\n[Action] Save JWT to Node.js credential');
console.log('-'.repeat(80));

function saveJwtToNodejsCred() {
    const nodejsCredPath = join(__dirname, '..', '.credentials', 'python_jwt.json');
    
    const nodejsCred = {
        did: did,
        jwt_token: jwt,
        source: 'Python bearertest credential',
        created_at: new Date().toISOString()
    };
    
    try {
        writeFileSync(nodejsCredPath, JSON.stringify(nodejsCred, null, 2), 'utf-8');
        console.log(`[PASS] JWT saved to: ${nodejsCredPath}`);
        return true;
    } catch (error) {
        console.log(`[FAIL] Failed to save JWT: ${error.message}`);
        return false;
    }
}

// Run all tests
async function main() {
    const results = [];
    
    results.push(await testGetMe());
    results.push(await testSendMessage());
    results.push(saveJwtToNodejsCred());
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    
    const passCount = results.filter(r => r).length;
    console.log(`Total: ${passCount}/${results.length} passed`);
    
    if (passCount === results.length) {
        console.log('\n[PASS] All tests passed!');
        console.log('Node.js can now use Python JWT for authentication.');
    } else {
        console.log('\n[FAIL] Some tests failed.');
    }
}

await main();

console.log('\n' + '='.repeat(80));
