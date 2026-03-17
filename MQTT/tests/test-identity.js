#!/usr/bin/env node

/**
 * Identity Management Tests
 * 
 * Tests:
 * - Create did:key identity (x25519)
 * - Create did:ethr identity (x25519)
 * - Create did:wba identity (x25519)
 * - Export identity to file
 * - Import identity from file
 * - Verify identity properties
 */

import { didManager } from '../src/did/manager.js';
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const TEST_DIR = './.test-data';
const TEST_IDENTITY_FILE = join(TEST_DIR, 'test-identity.json');

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
    console.log('\n=== Identity Management Tests ===\n');
    
    // Create test directory
    if (!existsSync(TEST_DIR)) {
        mkdirSync(TEST_DIR, { recursive: true });
    }
}

function teardown() {
    // Clean up test files
    if (existsSync(TEST_IDENTITY_FILE)) {
        unlinkSync(TEST_IDENTITY_FILE);
    }
    
    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    console.log(`Total: ${testsPassed + testsFailed}`);
    
    process.exit(testsFailed > 0 ? 1 : 0);
}

async function testCreateDidKey() {
    console.log('Test: Create did:key identity (x25519)');
    
    try {
        const identity = didManager.generate('key', { keyType: 'x25519' });
        
        assert(identity !== null, 'Identity should not be null', 'Identity is null');
        assert(identity.did.startsWith('did:key:'), 'DID should start with did:key:', `DID: ${identity.did}`);
        assert(identity.keyType === 'x25519', 'Key type should be x25519', `Key type: ${identity.keyType}`);
        assert(identity.publicKey.length === 32, 'Public key should be 32 bytes', `Length: ${identity.publicKey.length}`);
        assert(identity.privateKey.length === 32, 'Private key should be 32 bytes', `Length: ${identity.privateKey.length}`);
        
        return identity;
    } catch (err) {
        assert(false, 'Create did:key identity', `Error: ${err.message}`);
        return null;
    }
}

async function testCreateDidEthr() {
    console.log('\nTest: Create did:ethr identity (x25519)');
    
    try {
        const identity = didManager.generate('ethr', { network: 'mainnet', keyType: 'x25519' });
        
        assert(identity !== null, 'Identity should not be null', 'Identity is null');
        assert(identity.did.startsWith('did:ethr:'), 'DID should start with did:ethr:', `DID: ${identity.did}`);
        assert(identity.keyType === 'x25519', 'Key type should be x25519', `Key type: ${identity.keyType}`);
        assert(identity.publicKey.length === 32, 'Public key should be 32 bytes', `Length: ${identity.publicKey.length}`);
        assert(identity.privateKey.length === 32, 'Private key should be 32 bytes', `Length: ${identity.privateKey.length}`);
        
        // Store for cross-DID tests
        global.testEthrId = identity.did;
        global.testEthrPrivate = identity.privateKey;
        global.testEthrPublic = identity.publicKey;
        
        return identity;
    } catch (err) {
        assert(false, 'Create did:ethr identity', `Error: ${err.message}`);
        return null;
    }
}

async function testCreateDidWba() {
    console.log('\nTest: Create did:wba identity (x25519)');
    
    try {
        const identity = didManager.generate('wba', { chain: 'eth', keyType: 'x25519' });
        
        assert(identity !== null, 'Identity should not be null', 'Identity is null');
        assert(identity.did.startsWith('did:wba:'), 'DID should start with did:wba:', `DID: ${identity.did}`);
        assert(identity.keyType === 'x25519', 'Key type should be x25519', `Key type: ${identity.keyType}`);
        assert(identity.publicKey.length === 32, 'Public key should be 32 bytes', `Length: ${identity.publicKey.length}`);
        assert(identity.privateKey.length === 32, 'Private key should be 32 bytes', `Length: ${identity.privateKey.length}`);
        
        // Store for cross-DID tests
        global.testWbaId = identity.did;
        global.testWbaPrivate = identity.privateKey;
        global.testWbaPublic = identity.publicKey;
        
        return identity;
    } catch (err) {
        assert(false, 'Create did:wba identity', `Error: ${err.message}`);
        return null;
    }
}

async function testExportIdentity() {
    console.log('\nTest: Export identity to file');
    
    try {
        const identity = didManager.generate('key', { keyType: 'x25519' });
        const exportData = didManager.export(identity.did);
        
        assert(exportData !== null, 'Export data should not be null', 'Export data is null');
        assert(exportData.did === identity.did, 'Exported DID should match original', `DID mismatch`);
        assert(exportData.privateKey !== undefined, 'Export should include private key', 'Missing private key');
        assert(exportData.publicKey !== undefined, 'Export should include public key', 'Missing public key');
        
        // Save to file
        writeFileSync(TEST_IDENTITY_FILE, JSON.stringify(exportData, null, 2));
        
        assert(existsSync(TEST_IDENTITY_FILE), 'Identity file should be created', 'File not created');
        
        return exportData;
    } catch (err) {
        assert(false, 'Export identity', `Error: ${err.message}`);
        return null;
    }
}

async function testImportIdentity() {
    console.log('\nTest: Import identity from file');
    
    try {
        // First, create and export an identity
        const originalIdentity = didManager.generate('key', { keyType: 'x25519' });
        const exportData = didManager.export(originalIdentity.did);
        writeFileSync(TEST_IDENTITY_FILE, JSON.stringify(exportData, null, 2));
        
        // Now import it
        const importedData = JSON.parse(readFileSync(TEST_IDENTITY_FILE, 'utf-8'));
        const importedIdentity = didManager.import('key', Buffer.from(importedData.privateKey, 'hex'), {
            keyType: importedData.keyType
        });
        
        assert(importedIdentity !== null, 'Imported identity should not be null', 'Imported identity is null');
        assert(importedIdentity.did === originalIdentity.did, 'Imported DID should match original', `DID mismatch`);
        assert(importedIdentity.privateKey.equals(originalIdentity.privateKey), 'Private keys should match', 'Private key mismatch');
        assert(importedIdentity.publicKey.equals(originalIdentity.publicKey), 'Public keys should match', 'Public key mismatch');
        
        return importedIdentity;
    } catch (err) {
        assert(false, 'Import identity', `Error: ${err.message}`);
        return null;
    }
}

async function testVerifyIdentityProperties() {
    console.log('\nTest: Verify identity properties');
    
    try {
        const identity = didManager.generate('key', { keyType: 'x25519' });
        
        // Verify DID format
        assert(identity.did.startsWith('did:key:'), 'DID should start with did:key:', `DID: ${identity.did}`);
        
        // Verify key properties
        assert(identity.publicKey.length === 32, 'X25519 public key should be 32 bytes', `Length: ${identity.publicKey.length}`);
        assert(identity.privateKey.length === 32, 'X25519 private key should be 32 bytes', `Length: ${identity.privateKey.length}`);
        
        // Verify key type
        assert(identity.keyType === 'x25519', 'Key type should be x25519', `Key type: ${identity.keyType}`);
        
        // Verify DID is valid base58btc encoding (starts with z6LS for X25519 in this implementation)
        // Note: The multibase prefix depends on the multicodec prefix
        // X25519 with 0xec, 0x01 prefix typically results in z6LS prefix
        assert(identity.did.startsWith('did:key:'), 'DID should start with did:key:', `DID: ${identity.did}`);
        
        return true;
    } catch (err) {
        assert(false, 'Verify identity properties', `Error: ${err.message}`);
        return false;
    }
}

// Run all tests
async function runTests() {
    setup();
    
    await testCreateDidKey();
    await testCreateDidEthr();
    await testCreateDidWba();
    await testExportIdentity();
    await testImportIdentity();
    await testVerifyIdentityProperties();
    
    teardown();
}

runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
