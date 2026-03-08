#!/usr/bin/env node

/**
 * Test JWT auto-refresh on 401 error.
 * 
 * Simulates JWT expiration and verifies automatic refresh.
 */

import { loadIdentity, updateJwt } from '../src/credential_store.js';
import { createSDKConfig } from '../src/utils/config.js';
import { createMoltMessageClient } from '../src/utils/client.js';
import { authenticatedRpcCall } from '../src/utils/rpc.js';
import { DIDWbaAuthHeader } from '../src/utils/auth.js';

console.log('='.repeat(60));
console.log('JWT Auto-Refresh Test');
console.log('='.repeat(60));

/**
 * Parse PEM to raw private key bytes
 */
function parsePemToBytes(pem) {
    const normalizedPem = pem.replace(/\\n/g, '\n');
    const pemLines = normalizedPem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
    const der = Buffer.from(pemLines.join(''), 'base64');
    
    let privOffset = -1;
    for (let i = 0; i < der.length - 2; i++) {
        if (der[i] === 0x04 && der[i + 1] === 0x20) {
            privOffset = i + 2;
            break;
        }
    }
    
    return privOffset >= 0 ? der.slice(privOffset, privOffset + 32) : der.slice(-32);
}

/**
 * Test 1: Normal request with valid JWT
 */
async function testNormalRequest() {
    console.log('\n[Test 1] Normal request with valid JWT');
    console.log('-'.repeat(60));
    
    const cred = loadIdentity('nodetest1');
    if (!cred) {
        console.log('  ✗ SKIP: No credential found');
        return 'skipped';
    }
    
    if (!cred.jwt_token) {
        console.log('  ✗ SKIP: No JWT token');
        return 'skipped';
    }
    
    console.log(`  ✓ Credential loaded: ${cred.did}`);
    console.log(`  ✓ JWT: ${cred.jwt_token.substring(0, 50)}...`);
    
    const config = createSDKConfig();
    const client = createMoltMessageClient(config);
    
    const auth = new DIDWbaAuthHeader(null, null);
    const privateKeyBytes = parsePemToBytes(cred.private_key_pem);
    auth.setCredentials(cred.did_document, privateKeyBytes);
    
    try {
        const result = await authenticatedRpcCall(
            client,
            '/message/rpc',
            'get_inbox',
            { user_did: cred.did, limit: 5 },
            1,
            { auth, credentialName: 'nodetest1' }
        );
        
        console.log('  ✓ Request succeeded');
        console.log(`  ✓ Messages: ${result.messages?.length || 0}`);
        
        return 'passed';
    } catch (error) {
        console.log(`  ✗ Request failed: ${error.message}`);
        return 'failed';
    }
}

/**
 * Test 2: Verify JWT persistence
 */
async function testJwtPersistence() {
    console.log('\n[Test 2] Verify JWT persistence');
    console.log('-'.repeat(60));
    
    const cred = loadIdentity('nodetest1');
    if (!cred) {
        console.log('  ✗ SKIP: No credential found');
        return 'skipped';
    }
    
    console.log(`  ✓ Credential loaded`);
    console.log(`  ✓ JWT present: ${!!cred.jwt_token}`);
    console.log(`  ✓ JWT length: ${cred.jwt_token?.length || 0}`);
    
    // Verify JWT format
    if (cred.jwt_token && cred.jwt_token.includes('.')) {
        const parts = cred.jwt_token.split('.');
        if (parts.length === 3) {
            console.log('  ✓ JWT format valid (3 parts)');
            return 'passed';
        }
    }
    
    console.log('  ✗ JWT format invalid');
    return 'failed';
}

/**
 * Test 3: Test with expired JWT (will fail but should attempt refresh)
 */
async function testExpiredJwt() {
    console.log('\n[Test 3] Request with expired JWT');
    console.log('-'.repeat(60));
    
    const cred = loadIdentity('nodetest1');
    if (!cred) {
        console.log('  ✗ SKIP: No credential found');
        return 'skipped';
    }
    
    const originalJwt = cred.jwt_token;
    
    // Set obviously invalid JWT
    const invalidJwt = 'invalid.jwt.token';
    updateJwt('nodetest1', invalidJwt);
    console.log('  ✓ Set invalid JWT');
    
    const config = createSDKConfig();
    const client = createMoltMessageClient(config);
    
    const auth = new DIDWbaAuthHeader(null, null);
    const privateKeyBytes = parsePemToBytes(cred.private_key_pem);
    auth.setCredentials(cred.did_document, privateKeyBytes);
    
    try {
        const result = await authenticatedRpcCall(
            client,
            '/message/rpc',
            'get_inbox',
            { user_did: cred.did, limit: 5 },
            1,
            { auth, credentialName: 'nodetest1' }
        );
        
        console.log('  ✓ Request succeeded (auto-refresh worked!)');
        
        // Restore original JWT
        updateJwt('nodetest1', originalJwt);
        
        return 'passed';
    } catch (error) {
        console.log(`  ⚠ Request failed: ${error.message}`);
        console.log('  Note: Auto-refresh attempted but DID auth may have issues');
        
        // Restore original JWT
        updateJwt('nodetest1', originalJwt);
        
        return 'failed';
    }
}

/**
 * Main test runner
 */
async function runTests() {
    const results = {
        passed: 0,
        failed: 0,
        skipped: 0
    };
    
    // Test 1
    const test1Result = await testNormalRequest();
    results[test1Result === 'passed' ? 'passed' : test1Result === 'failed' ? 'failed' : 'skipped']++;
    
    // Test 2
    const test2Result = await testJwtPersistence();
    results[test2Result === 'passed' ? 'passed' : test2Result === 'failed' ? 'failed' : 'skipped']++;
    
    // Test 3
    const test3Result = await testExpiredJwt();
    results[test3Result === 'passed' ? 'passed' : test3Result === 'failed' ? 'failed' : 'skipped']++;
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Passed:  ${results.passed}`);
    console.log(`Failed:  ${results.failed}`);
    console.log(`Skipped: ${results.skipped}`);
    console.log('='.repeat(60));
    
    const total = results.passed + results.failed + results.skipped;
    const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;
    console.log(`Pass Rate: ${passRate}%`);
    
    if (results.failed === 0 && results.passed >= 2) {
        console.log('\n✓ JWT AUTO-REFRESH WORKING!');
        process.exit(0);
    } else {
        console.log('\n⚠ SOME TESTS FAILED');
        console.log('Note: 401 auto-refresh requires working DID signature auth');
        process.exit(1);
    }
}

// Run tests
await runTests();
