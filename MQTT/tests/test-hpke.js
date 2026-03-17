#!/usr/bin/env node

/**
 * HPKE Encryption Tests
 * 
 * Tests:
 * - Base Mode encryption/decryption
 * - Auth Mode encryption/decryption
 * - Verify encrypted data cannot be decrypted without private key
 * - Test with different message sizes
 */

import { HPKE, Mode } from '../src/e2ee/hpke-rfc9180.js';
import { didManager } from '../src/did/manager.js';

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
    console.log('\n=== HPKE Encryption Tests ===\n');
}

function teardown() {
    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    console.log(`Total: ${testsPassed + testsFailed}`);
    
    process.exit(testsFailed > 0 ? 1 : 0);
}

async function testBaseModeEncryption() {
    console.log('Test: HPKE Base Mode encryption/decryption');
    
    try {
        const hpke = new HPKE();
        
        // Generate recipient key pair
        const recipientKeyPair = hpke.kem.generateKeyPair();
        
        // Test data
        const plaintext = new TextEncoder().encode('Hello, HPKE Base Mode!');
        const info = new TextEncoder().encode('test-context');
        
        // Encrypt
        const { enc, ciphertext } = await hpke.seal(
            recipientKeyPair.publicKey,
            plaintext,
            info
        );
        
        assert(enc !== null, 'Encapsulated key should not be null', 'enc is null');
        assert(ciphertext !== null, 'Ciphertext should not be null', 'ciphertext is null');
        assert(ciphertext.length > plaintext.length, 'Ciphertext should be longer than plaintext', ` ciphertext: ${ciphertext.length}, plaintext: ${plaintext.length}`);
        
        // Decrypt
        const decrypted = await hpke.open(
            recipientKeyPair.privateKey,
            enc,
            ciphertext,
            info
        );
        
        const decryptedText = new TextDecoder().decode(decrypted);
        assert(decryptedText === 'Hello, HPKE Base Mode!', 'Decrypted text should match original', `Got: ${decryptedText}`);
        
        return true;
    } catch (err) {
        assert(false, 'Base Mode encryption', `Error: ${err.message}`);
        return false;
    }
}

async function testAuthModeEncryption() {
    console.log('\nTest: HPKE Auth Mode encryption/decryption');
    
    try {
        const hpke = new HPKE();
        
        // Generate key pairs
        const recipientKeyPair = hpke.kem.generateKeyPair();
        const senderKeyPair = hpke.kem.generateKeyPair();
        
        // Test data
        const plaintext = new TextEncoder().encode('Hello, HPKE Auth Mode!');
        const info = new TextEncoder().encode('test-auth-context');
        
        // Setup Auth Mode (sender)
        const { enc, context: senderContext } = await hpke.setupAuthS(
            recipientKeyPair.publicKey,
            senderKeyPair.privateKey,
            info
        );
        
        // Encrypt
        const ciphertext = await senderContext.seal(plaintext);
        
        assert(enc !== null, 'Encapsulated key should not be null', 'enc is null');
        assert(ciphertext !== null, 'Ciphertext should not be null', 'ciphertext is null');
        
        // Setup Auth Mode (receiver)
        const receiverContext = await hpke.setupAuthR(
            recipientKeyPair.privateKey,
            enc,
            senderKeyPair.publicKey,
            info
        );
        
        // Decrypt
        const decrypted = await receiverContext.open(ciphertext);
        
        const decryptedText = new TextDecoder().decode(decrypted);
        assert(decryptedText === 'Hello, HPKE Auth Mode!', 'Decrypted text should match original', `Got: ${decryptedText}`);
        
        return true;
    } catch (err) {
        assert(false, 'Auth Mode encryption', `Error: ${err.message}`);
        return false;
    }
}

async function testEncryptionSecurity() {
    console.log('\nTest: Verify encrypted data cannot be decrypted without private key');
    
    try {
        const hpke = new HPKE();
        
        // Generate key pairs for Alice and Bob
        const aliceKeyPair = hpke.kem.generateKeyPair();
        const bobKeyPair = hpke.kem.generateKeyPair();
        
        // Alice encrypts message for Bob
        const plaintext = new TextEncoder().encode('Secret message for Bob');
        const info = new TextEncoder().encode('secret-context');
        
        const { enc, ciphertext } = await hpke.seal(
            bobKeyPair.publicKey,
            plaintext,
            info
        );
        
        // Eve tries to decrypt with wrong private key
        const eveKeyPair = hpke.kem.generateKeyPair();
        
        let decryptedWithWrongKey = null;
        try {
            decryptedWithWrongKey = await hpke.open(
                eveKeyPair.privateKey,
                enc,
                ciphertext,
                info
            );
        } catch (err) {
            // Expected to fail
        }
        
        assert(decryptedWithWrongKey === null, 'Decryption with wrong key should fail', 'Decryption succeeded with wrong key');
        
        // Bob can decrypt with correct key
        const decrypted = await hpke.open(
            bobKeyPair.privateKey,
            enc,
            ciphertext,
            info
        );
        
        const decryptedText = new TextDecoder().decode(decrypted);
        assert(decryptedText === 'Secret message for Bob', 'Bob should be able to decrypt', `Got: ${decryptedText}`);
        
        return true;
    } catch (err) {
        assert(false, 'Encryption security', `Error: ${err.message}`);
        return false;
    }
}

async function testDifferentMessageSizes() {
    console.log('\nTest: Different message sizes');
    
    try {
        const hpke = new HPKE();
        
        const recipientKeyPair = hpke.kem.generateKeyPair();
        const info = new TextEncoder().encode('size-test');
        
        const testCases = [
            { name: 'Empty message', data: new Uint8Array(0) },
            { name: 'Small message', data: new TextEncoder().encode('Hello') },
            { name: 'Medium message', data: new TextEncoder().encode('A'.repeat(1000)) },
            { name: 'Large message', data: new TextEncoder().encode('B'.repeat(10000)) }
        ];
        
        for (const testCase of testCases) {
            const { enc, ciphertext } = await hpke.seal(
                recipientKeyPair.publicKey,
                testCase.data,
                info
            );
            
            const decrypted = await hpke.open(
                recipientKeyPair.privateKey,
                enc,
                ciphertext,
                info
            );
            
            const match = testCase.data.length === decrypted.length &&
                         testCase.data.every((val, idx) => val === decrypted[idx]);
            
            assert(match, `${testCase.name}: ${testCase.data.length} bytes`, 'Message mismatch');
        }
        
        return true;
    } catch (err) {
        assert(false, 'Different message sizes', `Error: ${err.message}`);
        return false;
    }
}

async function testKeyExport() {
    console.log('\nTest: HPKE key export functionality');
    
    try {
        const hpke = new HPKE();
        
        const recipientKeyPair = hpke.kem.generateKeyPair();
        const info = new TextEncoder().encode('export-test');
        
        const plaintext = new TextEncoder().encode('Test message');
        const { enc, ciphertext } = await hpke.seal(
            recipientKeyPair.publicKey,
            plaintext,
            info
        );
        
        // Setup context for export
        const context = await hpke.setupBaseR(
            recipientKeyPair.privateKey,
            enc,
            info
        );
        
        // Export keys
        const exportKey = await context.export(new TextEncoder().encode('subkey'), 32);
        const exportNonce = await context.export(new TextEncoder().encode('nonce'), 12);
        
        assert(exportKey.length === 32, 'Exported key should be 32 bytes', `Length: ${exportKey.length}`);
        assert(exportNonce.length === 12, 'Exported nonce should be 12 bytes', `Length: ${exportNonce.length}`);
        
        return true;
    } catch (err) {
        assert(false, 'Key export', `Error: ${err.message}`);
        return false;
    }
}

// Run all tests
async function runTests() {
    setup();
    
    await testBaseModeEncryption();
    await testAuthModeEncryption();
    await testEncryptionSecurity();
    await testDifferentMessageSizes();
    await testKeyExport();
    
    teardown();
}

runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
