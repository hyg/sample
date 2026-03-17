#!/usr/bin/env node

/**
 * Cross-DID Communication Tests
 * 
 * Tests:
 * - did:key ↔ did:ethr communication
 * - did:ethr ↔ did:wba communication
 * - did:wba ↔ did:key communication
 * - Verify shared secret consistency
 */

import { didManager } from '../src/did/manager.js';
import { hpkeSeal, hpkeOpen } from '../src/e2ee/hpke-native.js';

// Test results
let testsPassed = 0;
let testsFailed = 0;

// Helper functions
function assert(condition, testName, errorMsg) {
    if (condition) {
        console.log(`✓ ${testName}`);
        testsPassed++;
        return true;
    } else {
        console.error(`✗ ${testName}: ${errorMsg}`);
        testsFailed++;
        return false;
    }
}

function setup() {
    console.log('\n=== Cross-DID Communication Tests ===\n');
}

function teardown() {
    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    console.log(`Total: ${testsPassed + testsFailed}`);
    
    process.exit(testsFailed > 0 ? 1 : 0);
}

async function testDidKeyToDidEthr() {
    console.log('Test: did:key ↔ did:ethr communication');
    
    try {
        // Create identities
        const didKeyIdentity = didManager.generate('key', { keyType: 'x25519' });
        const didEthrIdentity = didManager.generate('ethr', { keyType: 'x25519' });
        
        assert(didKeyIdentity !== null, 'did:key identity created', 'did:key identity is null');
        assert(didEthrIdentity !== null, 'did:ethr identity created', 'did:ethr identity is null');
        
        // Test encryption from did:key to did:ethr
        const plaintext1 = new TextEncoder().encode('Message from did:key to did:ethr');
        const { enc: enc1, ciphertext: ciphertext1 } = await hpkeSeal({
            recipientPublicKey: didEthrIdentity.publicKey,
            plaintext: plaintext1,
            info: new TextEncoder().encode('cross-did-test')
        });
        
        // Decrypt on did:ethr side
        const decrypted1 = await hpkeOpen({
            recipientPrivateKey: didEthrIdentity.privateKey,
            enc: enc1,
            ciphertext: ciphertext1,
            info: new TextEncoder().encode('cross-did-test')
        });
        
        const decryptedText1 = new TextDecoder().decode(decrypted1);
        assert(decryptedText1 === 'Message from did:key to did:ethr', 'did:key to did:ethr encryption works', `Got: ${decryptedText1}`);
        
        // Test encryption from did:ethr to did:key
        const plaintext2 = new TextEncoder().encode('Message from did:ethr to did:key');
        const { enc: enc2, ciphertext: ciphertext2 } = await hpkeSeal({
            recipientPublicKey: didKeyIdentity.publicKey,
            plaintext: plaintext2,
            info: new TextEncoder().encode('cross-did-test')
        });
        
        // Decrypt on did:key side
        const decrypted2 = await hpkeOpen({
            recipientPrivateKey: didKeyIdentity.privateKey,
            enc: enc2,
            ciphertext: ciphertext2,
            info: new TextEncoder().encode('cross-did-test')
        });
        
        const decryptedText2 = new TextDecoder().decode(decrypted2);
        assert(decryptedText2 === 'Message from did:ethr to did:key', 'did:ethr to did:key encryption works', `Got: ${decryptedText2}`);
        
        return true;
    } catch (err) {
        assert(false, 'did:key ↔ did:ethr communication', `Error: ${err.message}`);
        return false;
    }
}

async function testDidEthrToDidWba() {
    console.log('\nTest: did:ethr ↔ did:wba communication');
    
    try {
        // Create identities
        const didEthrIdentity = didManager.generate('ethr', { keyType: 'x25519' });
        const didWbaIdentity = didManager.generate('wba', { keyType: 'x25519' });
        
        assert(didEthrIdentity !== null, 'did:ethr identity created', 'did:ethr identity is null');
        assert(didWbaIdentity !== null, 'did:wba identity created', 'did:wba identity is null');
        
        // Test encryption from did:ethr to did:wba
        const plaintext1 = new TextEncoder().encode('Message from did:ethr to did:wba');
        const { enc: enc1, ciphertext: ciphertext1 } = await hpkeSeal({
            recipientPublicKey: didWbaIdentity.publicKey,
            plaintext: plaintext1,
            info: new TextEncoder().encode('cross-did-test')
        });
        
        // Decrypt on did:wba side
        const decrypted1 = await hpkeOpen({
            recipientPrivateKey: didWbaIdentity.privateKey,
            enc: enc1,
            ciphertext: ciphertext1,
            info: new TextEncoder().encode('cross-did-test')
        });
        
        const decryptedText1 = new TextDecoder().decode(decrypted1);
        assert(decryptedText1 === 'Message from did:ethr to did:wba', 'did:ethr to did:wba encryption works', `Got: ${decryptedText1}`);
        
        // Test encryption from did:wba to did:ethr
        const plaintext2 = new TextEncoder().encode('Message from did:wba to did:ethr');
        const { enc: enc2, ciphertext: ciphertext2 } = await hpkeSeal({
            recipientPublicKey: didEthrIdentity.publicKey,
            plaintext: plaintext2,
            info: new TextEncoder().encode('cross-did-test')
        });
        
        // Decrypt on did:ethr side
        const decrypted2 = await hpkeOpen({
            recipientPrivateKey: didEthrIdentity.privateKey,
            enc: enc2,
            ciphertext: ciphertext2,
            info: new TextEncoder().encode('cross-did-test')
        });
        
        const decryptedText2 = new TextDecoder().decode(decrypted2);
        assert(decryptedText2 === 'Message from did:wba to did:ethr', 'did:wba to did:ethr encryption works', `Got: ${decryptedText2}`);
        
        return true;
    } catch (err) {
        assert(false, 'did:ethr ↔ did:wba communication', `Error: ${err.message}`);
        return false;
    }
}

async function testDidWbaToDidKey() {
    console.log('\nTest: did:wba ↔ did:key communication');
    
    try {
        // Create identities
        const didWbaIdentity = didManager.generate('wba', { keyType: 'x25519' });
        const didKeyIdentity = didManager.generate('key', { keyType: 'x25519' });
        
        assert(didWbaIdentity !== null, 'did:wba identity created', 'did:wba identity is null');
        assert(didKeyIdentity !== null, 'did:key identity created', 'did:key identity is null');
        
        // Test encryption from did:wba to did:key
        const plaintext1 = new TextEncoder().encode('Message from did:wba to did:key');
        const { enc: enc1, ciphertext: ciphertext1 } = await hpkeSeal({
            recipientPublicKey: didKeyIdentity.publicKey,
            plaintext: plaintext1,
            info: new TextEncoder().encode('cross-did-test')
        });
        
        // Decrypt on did:key side
        const decrypted1 = await hpkeOpen({
            recipientPrivateKey: didKeyIdentity.privateKey,
            enc: enc1,
            ciphertext: ciphertext1,
            info: new TextEncoder().encode('cross-did-test')
        });
        
        const decryptedText1 = new TextDecoder().decode(decrypted1);
        assert(decryptedText1 === 'Message from did:wba to did:key', 'did:wba to did:key encryption works', `Got: ${decryptedText1}`);
        
        // Test encryption from did:key to did:wba
        const plaintext2 = new TextEncoder().encode('Message from did:key to did:wba');
        const { enc: enc2, ciphertext: ciphertext2 } = await hpkeSeal({
            recipientPublicKey: didWbaIdentity.publicKey,
            plaintext: plaintext2,
            info: new TextEncoder().encode('cross-did-test')
        });
        
        // Decrypt on did:wba side
        const decrypted2 = await hpkeOpen({
            recipientPrivateKey: didWbaIdentity.privateKey,
            enc: enc2,
            ciphertext: ciphertext2,
            info: new TextEncoder().encode('cross-did-test')
        });
        
        const decryptedText2 = new TextDecoder().decode(decrypted2);
        assert(decryptedText2 === 'Message from did:key to did:wba', 'did:key to did:wba encryption works', `Got: ${decryptedText2}`);
        
        return true;
    } catch (err) {
        assert(false, 'did:wba ↔ did:key communication', `Error: ${err.message}`);
        return false;
    }
}

async function testSharedSecretConsistency() {
    console.log('\nTest: Verify shared secret consistency');
    
    try {
        // Create identities
        const identityA = didManager.generate('key', { keyType: 'x25519' });
        const identityB = didManager.generate('ethr', { keyType: 'x25519' });
        
        // Test that both parties can derive the same shared secret
        const plaintext = new TextEncoder().encode('Test shared secret');
        
        // A encrypts for B
        const { enc, ciphertext } = await hpkeSeal({
            recipientPublicKey: identityB.publicKey,
            plaintext: plaintext,
            info: new TextEncoder().encode('shared-secret-test')
        });
        
        // B decrypts
        const decrypted = await hpkeOpen({
            recipientPrivateKey: identityB.privateKey,
            enc: enc,
            ciphertext: ciphertext,
            info: new TextEncoder().encode('shared-secret-test')
        });
        
        const decryptedText = new TextDecoder().decode(decrypted);
        assert(decryptedText === 'Test shared secret', 'Shared secret derivation works', `Got: ${decryptedText}`);
        
        return true;
    } catch (err) {
        assert(false, 'Shared secret consistency', `Error: ${err.message}`);
        return false;
    }
}

// Run all tests
async function runTests() {
    setup();
    
    await testDidKeyToDidEthr();
    await testDidEthrToDidWba();
    await testDidWbaToDidKey();
    await testSharedSecretConsistency();
    
    teardown();
}

runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
