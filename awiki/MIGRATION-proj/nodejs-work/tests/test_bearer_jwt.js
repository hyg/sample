#!/usr/bin/env node

/**
 * Test JWT Bearer authentication with registered identity.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('Test: Bearer JWT Authentication');
console.log('='.repeat(80));

// Load credential
const credPath = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message', 'bearertest.json');

console.log(`\nLoading credential from: ${credPath}`);

const cred = JSON.parse(readFileSync(credPath, 'utf-8'));
const did = cred.did;
const userId = cred.user_id;
const jwtToken = cred.jwt_token;

console.log(`DID: ${did}`);
console.log(`User ID: ${userId}`);
console.log(`JWT Token: ${jwtToken?.substring(0, 50)}...`);

if (!jwtToken) {
    console.log('\nError: No JWT token found in credential');
    process.exit(1);
}

// Test 1: get_me with Bearer JWT
console.log('\n' + '-'.repeat(80));
console.log('Test 1: get_me with Bearer JWT');
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
                    'Authorization': `Bearer ${jwtToken}`
                },
                timeout: 30000
            }
        );
        
        const result = response.data;
        
        if (result.result) {
            console.log('Result: SUCCESS');
            console.log(`DID: ${result.result.did}`);
            console.log(`User ID: ${result.result.user_id}`);
            console.log(`Name: ${result.result.name || 'N/A'}`);
            return true;
        } else {
            const error = result.error || {};
            console.log('Result: FAILED');
            console.log(`Error: ${error.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        console.log('Request failed:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        }
        return false;
    }
}

// Test 2: send message with Bearer JWT
console.log('\n' + '-'.repeat(80));
console.log('Test 2: send message with Bearer JWT');
console.log('-'.repeat(80));

async function testSendMessage() {
    const requestBody = {
        jsonrpc: '2.0',
        method: 'send',
        params: {
            sender_did: did,
            receiver_did: did,  // Send to self for testing
            content: 'Test message from Node.js with Bearer JWT',
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
                    'Authorization': `Bearer ${jwtToken}`
                },
                timeout: 30000
            }
        );
        
        const result = response.data;
        
        if (result.result) {
            console.log('Result: SUCCESS');
            console.log(`Message ID: ${result.result.id || 'N/A'}`);
            console.log(`Server Seq: ${result.result.server_seq || 'N/A'}`);
            return true;
        } else {
            const error = result.error || {};
            console.log('Result: FAILED');
            console.log(`Error: ${error.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        console.log('Request failed:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        }
        return false;
    }
}

// Run tests
async function main() {
    const results = [];
    
    results.push(await testGetMe());
    results.push(await testSendMessage());
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    
    const successCount = results.filter(r => r).length;
    console.log(`Total: ${successCount}/${results.length} successful`);
    
    if (successCount === results.length) {
        console.log('\nAll tests passed! Bearer JWT authentication works correctly.');
    } else {
        console.log('\nSome tests failed. Check the output above for details.');
    }
}

await main();

console.log('\n' + '='.repeat(80));
