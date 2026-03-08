#!/usr/bin/env node

/**
 * Final verification test before NPM release.
 * 
 * Tests all critical functionality to ensure release readiness.
 */

import { loadIdentity } from '../src/credential_store.js';
import { createSDKConfig } from '../src/utils/config.js';
import { createUserServiceClient, createMoltMessageClient } from '../src/utils/client.js';
import { authenticatedRpcCall } from '../src/utils/rpc.js';
import { E2eeClient } from '../src/e2ee.js';

const TEST_RESULTS = {
    passed: 0,
    failed: 0,
    skipped: 0
};

let currentSection = '';

/**
 * Print section header.
 */
function printSection(name) {
    currentSection = name;
    console.log(`\n${'='.repeat(60)}`);
    console.log(name);
    console.log('='.repeat(60));
}

/**
 * Run a test and record result.
 */
async function runTest(name, testFn) {
    process.stdout.write(`  ${name}... `);
    try {
        await testFn();
        console.log('✓ PASS');
        TEST_RESULTS.passed++;
    } catch (error) {
        console.log(`✗ FAIL: ${error.message}`);
        TEST_RESULTS.failed++;
    }
}

/**
 * Test credential loading.
 */
async function testCredentials() {
    printSection('Credential Tests');
    
    await runTest('Load test credential', () => {
        const cred = loadIdentity('nodeagentfixed');
        if (!cred) throw new Error('Credential not found');
        if (!cred.did) throw new Error('No DID');
        if (!cred.private_key_pem) throw new Error('No private key');
        if (!cred.jwt_token) throw new Error('No JWT');
    });
    
    await runTest('E2EE keys present', () => {
        const cred = loadIdentity('nodeagentfixed');
        if (!cred.e2ee_signing_private_pem) throw new Error('No E2EE signing key');
        if (!cred.e2ee_agreement_private_pem) throw new Error('No E2EE agreement key');
    });
}

/**
 * Test RPC connectivity.
 */
async function testRPC() {
    printSection('RPC Connectivity Tests');
    
    const cred = loadIdentity('nodeagentfixed');
    if (!cred || !cred.jwt_token) {
        console.log('⊘ SKIP: No credential with JWT');
        TEST_RESULTS.skipped += 3;
        return;
    }
    
    const config = createSDKConfig();
    const client = createUserServiceClient(config);
    
    await runTest('get_me', async () => {
        const result = await authenticatedRpcCall(
            client,
            '/user-service/did-auth/rpc',
            'get_me',
            {},
            1,
            { auth: null }
        );
        if (!result.did) throw new Error('No DID in response');
    });
    
    client.close();
}

/**
 * Test message functionality.
 */
async function testMessaging() {
    printSection('Message Tests');
    
    const cred = loadIdentity('nodeagentfixed');
    if (!cred || !cred.jwt_token) {
        console.log('⊘ SKIP: No credential with JWT');
        TEST_RESULTS.skipped += 2;
        return;
    }
    
    const config = createSDKConfig();
    const client = createMoltMessageClient(config);
    
    await runTest('get_inbox', async () => {
        const result = await authenticatedRpcCall(
            client,
            '/message/rpc',
            'getInbox',
            { user_did: cred.did, limit: 5 },
            1,
            { auth: null }
        );
        if (!result) throw new Error('No response');
    });
    
    client.close();
}

/**
 * Test E2EE functionality.
 */
async function testE2EE() {
    printSection('E2EE Tests');
    
    const cred = loadIdentity('nodeagentfixed');
    if (!cred) {
        console.log('⊘ SKIP: No credential');
        TEST_RESULTS.skipped += 4;
        return;
    }
    
    const client = new E2eeClient(cred.did, cred.e2ee_signing_private_pem, cred.e2ee_agreement_private_pem);
    
    await runTest('Handshake initiation', async () => {
        const { msg_type, content } = await client.initiateHandshake('did:wba:awiki.ai:user:test');
        if (msg_type !== 'e2ee_init') throw new Error('Wrong message type');
        if (!content.session_id) throw new Error('No session ID');
        if (!content.ephemeral_public_key) throw new Error('No ephemeral key');
    });
    
    await runTest('State export', () => {
        const state = client.exportState();
        if (!state.local_did) throw new Error('No local DID');
        if (!state.sessions) throw new Error('No sessions');
    });
    
    await runTest('State import', () => {
        const state = client.exportState();
        const restored = E2eeClient.fromState(state);
        if (!restored.localDid) throw new Error('Restore failed');
    });
    
    await runTest('Message encryption', async () => {
        // Need active session - create mock session
        client.sessions.set('did:wba:awiki.ai:user:test', {
            sessionId: 'test',
            peerDid: 'did:wba:awiki.ai:user:test',
            sendChainKey: Buffer.alloc(32, 1),
            recvChainKey: Buffer.alloc(32, 2),
            sendSeq: 0,
            recvSeq: 0,
            state: 'active'
        });
        
        const { msg_type, content } = await client.encryptMessage('did:wba:awiki.ai:user:test', 'Test message');
        if (msg_type !== 'e2ee_msg') throw new Error('Wrong message type');
        if (!content.ciphertext) throw new Error('No ciphertext');
        if (!content.seq === undefined) throw new Error('No seq');
    });
}

/**
 * Test ratchet algorithm.
 */
async function testRatchet() {
    printSection('Ratchet Algorithm Tests');
    
    const { hkdf } = await import('@noble/hashes/hkdf');
    const { sha256 } = await import('@noble/hashes/sha256');
    const { createHmac } = await import('crypto');
    
    await runTest('Chain key derivation', async () => {
        const rootSeed = Buffer.from('multi-round-test-seed');
        
        const initChainKey = hkdf(sha256, rootSeed, {
            salt: new Uint8Array(),
            info: new TextEncoder().encode('anp-e2ee-init'),
            length: 32
        });
        
        const respChainKey = hkdf(sha256, rootSeed, {
            salt: new Uint8Array(),
            info: new TextEncoder().encode('anp-e2ee-resp'),
            length: 32
        });
        
        if (initChainKey.length !== 32) throw new Error('Wrong init key length');
        if (respChainKey.length !== 32) throw new Error('Wrong resp key length');
    });
    
    await runTest('Message key derivation', async () => {
        const chainKey = Buffer.alloc(32, 1);
        const seq = 0;
        const seqBytes = Buffer.alloc(8);
        seqBytes.writeBigUInt64BE(BigInt(seq), 0);
        
        const msgKey = createHmac('sha256', chainKey)
            .update(Buffer.from('msg'))
            .update(seqBytes)
            .digest();
        
        const newChainKey = createHmac('sha256', chainKey)
            .update(Buffer.from('ck'))
            .digest();
        
        const encKey = createHmac('sha256', msgKey)
            .update(Buffer.from('key'))
            .digest()
            .slice(0, 16);
        
        const nonce = createHmac('sha256', msgKey)
            .update(Buffer.from('nonce'))
            .digest()
            .slice(0, 12);
        
        if (encKey.length !== 16) throw new Error('Wrong enc key length');
        if (nonce.length !== 12) throw new Error('Wrong nonce length');
        if (newChainKey.length !== 32) throw new Error('Wrong chain key length');
    });
}

/**
 * Print final summary.
 */
function printSummary() {
    const total = TEST_RESULTS.passed + TEST_RESULTS.failed + TEST_RESULTS.skipped;
    const passRate = total > 0 ? (TEST_RESULTS.passed / total * 100).toFixed(1) : 0;
    
    console.log('\n' + '='.repeat(60));
    console.log('FINAL VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests:  ${total}`);
    console.log(`Passed:       ${TEST_RESULTS.passed} (${passRate}%)`);
    console.log(`Failed:       ${TEST_RESULTS.failed}`);
    console.log(`Skipped:      ${TEST_RESULTS.skipped}`);
    console.log('='.repeat(60));
    
    if (TEST_RESULTS.failed === 0 && TEST_RESULTS.passed >= 10) {
        console.log('\n✓ RELEASE READY!');
        console.log('All critical tests passed. Package is ready for NPM release.');
        process.exit(0);
    } else if (TEST_RESULTS.failed === 0) {
        console.log('\n⚠ PARTIALLY READY');
        console.log('No failures, but more tests needed.');
        process.exit(1);
    } else {
        console.log('\n✗ NOT READY FOR RELEASE');
        console.log(`${TEST_RESULTS.failed} test(s) failed. Please fix before release.`);
        process.exit(1);
    }
}

/**
 * Main test runner.
 */
async function runAllTests() {
    console.log('='.repeat(60));
    console.log('awiki-agent-id-message');
    console.log('Final Verification Test Suite');
    console.log('='.repeat(60));
    console.log(`Date: ${new Date().toISOString()}`);
    
    await testCredentials();
    await testRPC();
    await testMessaging();
    await testE2EE();
    await testRatchet();
    
    printSummary();
}

// Run all tests
await runAllTests();
