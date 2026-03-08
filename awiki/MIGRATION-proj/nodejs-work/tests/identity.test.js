/**
 * Unit tests for identity module.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createIdentity, generateE2eeKeys, publicKeyToJwk, loadPrivateKeyFromPem } from '../src/utils/identity.js';

describe('identity module', () => {
    
    describe('createIdentity', () => {
        it('should create a valid DID identity', () => {
            const identity = createIdentity({
                hostname: 'awiki.ai',
                pathPrefix: ['user']
            });
            
            // Check DID format
            assert.ok(identity.did.startsWith('did:wba:awiki.ai:user:k1_'), 'DID should start with did:wba:awiki.ai:user:k1_');
            
            // Check DID document structure
            assert.ok(identity.did_document, 'DID document should exist');
            assert.strictEqual(identity.did_document.id, identity.did, 'DID document ID should match');
            assert.ok(identity.did_document.proof, 'Proof should exist');
            assert.strictEqual(identity.did_document.proof.type, 'EcdsaSecp256k1Signature2019');
            
            // Check keys
            assert.ok(identity.privateKey, 'Private key should exist');
            assert.ok(identity.publicKey, 'Public key should exist');
            assert.strictEqual(identity.privateKey.length, 32, 'Private key should be 32 bytes');
            assert.strictEqual(identity.publicKey.length, 65, 'Public key should be 65 bytes');
            
            // Check PEM format
            assert.ok(identity.privateKeyPem.startsWith('-----BEGIN PRIVATE KEY-----'), 'Private key PEM should be valid');
            assert.ok(identity.publicKeyPem.startsWith('-----BEGIN PUBLIC KEY-----'), 'Public key PEM should be valid');
        });
        
        it('should generate E2EE keys', () => {
            const identity = createIdentity({
                hostname: 'awiki.ai',
                pathPrefix: ['user']
            });
            
            const identityWithE2ee = generateE2eeKeys(identity);
            
            assert.ok(identityWithE2ee.e2ee_signing_private_pem, 'E2EE signing private key should exist');
            assert.ok(identityWithE2ee.e2ee_signing_public_pem, 'E2EE signing public key should exist');
            assert.ok(identityWithE2ee.e2ee_agreement_private_pem, 'E2EE agreement private key should exist');
            assert.ok(identityWithE2ee.e2ee_agreement_public_pem, 'E2EE agreement public key should exist');
            
            // Check PEM format
            assert.ok(identityWithE2ee.e2ee_signing_private_pem.startsWith('-----BEGIN PRIVATE KEY-----'));
            assert.ok(identityWithE2ee.e2ee_agreement_private_pem.startsWith('-----BEGIN PRIVATE KEY-----'));
        });
    });
    
    describe('publicKeyToJwk', () => {
        it('should convert public key to JWK format', () => {
            const identity = createIdentity({
                hostname: 'awiki.ai',
                pathPrefix: ['user']
            });
            
            const jwk = publicKeyToJwk(identity.publicKey);
            
            assert.strictEqual(jwk.kty, 'EC', 'JWK kty should be EC');
            assert.strictEqual(jwk.crv, 'secp256k1', 'JWK crv should be secp256k1');
            assert.ok(jwk.x, 'JWK x should exist');
            assert.ok(jwk.y, 'JWK y should exist');
            assert.ok(jwk.kid, 'JWK kid should exist');
        });
    });
    
    describe('loadPrivateKeyFromPem', () => {
        it('should load private key from PEM', () => {
            const identity = createIdentity({
                hostname: 'awiki.ai',
                pathPrefix: ['user']
            });
            
            const loadedKey = loadPrivateKeyFromPem(identity.privateKeyPem);
            
            // Compare as hex strings to avoid Buffer vs Uint8Array issues
            const loadedHex = Buffer.from(loadedKey).toString('hex');
            const originalHex = Buffer.from(identity.privateKey).toString('hex');
            assert.strictEqual(loadedHex, originalHex, 'Loaded key should match original');
        });
    });
});

console.log('\nidentity unit tests completed.');
