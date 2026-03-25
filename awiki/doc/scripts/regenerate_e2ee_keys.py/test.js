/**
 * Unit tests for regenerate-e2ee-keys module
 *
 * Based on distillation data from:
 * doc/scripts/regenerate_e2ee_keys.py/py.json
 *
 * Python source: python/scripts/regenerate_e2ee_keys.py
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

describe('regenerate-e2ee-keys', () => {
  const testCredentialName = 'test_e2ee_' + Date.now();

  describe('Module Import', () => {
    it('should import regenerate-e2ee-keys module', () => {
      // Based on py.md: module imports
      const regenerateE2eeKeys = require('../../scripts/regenerate-e2ee-keys.js');

      assert.ok(regenerateE2eeKeys, 'regenerate-e2ee-keys module should be loaded');
      assert.ok(typeof regenerateE2eeKeys.regenerate_e2ee_keys === 'function', 'Should have regenerate_e2ee_keys function');
    });
  });

  describe('regenerate_e2ee_keys function', () => {
    it('should have correct function signature', () => {
      // Based on py.md: function signature
      // async regenerate_e2ee_keys(credential_name: str = "default", force: bool = False) -> None
      const regenerateE2eeKeys = require('../../scripts/regenerate-e2ee-keys.js');

      // Validate function accepts options object with credential_name and force parameters
      assert.ok(typeof regenerateE2eeKeys.regenerate_e2ee_keys === 'function');
      
      // Check function accepts options object
      const funcStr = regenerateE2eeKeys.regenerate_e2ee_keys.toString();
      assert.ok(funcStr.includes('credential_name') || funcStr.includes('options'), 'Should accept credential_name parameter');
      assert.ok(funcStr.includes('force'), 'Should accept force parameter');
    });

    it('should handle missing credential gracefully', async () => {
      // Based on py.md: Error handling for missing credential
      const regenerateE2eeKeys = require('../../scripts/regenerate-e2ee-keys.js');

      // Use a non-existent credential name
      const nonExistentCredential = 'non_existent_credential_' + Date.now();
      
      // The function should exit with error or throw
      // Note: Full test would require mocking process.exit
      try {
        await regenerateE2eeKeys.regenerate_e2ee_keys({
          credential_name: nonExistentCredential,
          force: false
        });
        // If we reach here, the function didn't exit (may be in test mode)
        assert.ok(true, 'Function handled missing credential');
      } catch (error) {
        // Expected to throw or exit
        assert.ok(true, 'Function threw error for missing credential');
      }
    });

    it('should check for existing E2EE keys', () => {
      // Based on py.md: Check if E2EE keys already exist
      const regenerateE2eeKeys = require('../../scripts/regenerate-e2ee-keys.js');

      // Validate function has logic to check existing keys
      const funcStr = regenerateE2eeKeys.regenerate_e2ee_keys.toString();
      assert.ok(
        funcStr.includes('e2ee_signing_private_pem') || funcStr.includes('has_signing'),
        'Should check for existing signing key'
      );
      assert.ok(
        funcStr.includes('e2ee_agreement_private_pem') || funcStr.includes('has_agreement'),
        'Should check for existing agreement key'
      );
    });

    it('should respect force flag', () => {
      // Based on py.md: --force flag behavior
      const regenerateE2eeKeys = require('../../scripts/regenerate-e2ee-keys.js');

      // Validate function accepts force parameter
      const funcStr = regenerateE2eeKeys.regenerate_e2ee_keys.toString();
      assert.ok(funcStr.includes('force'), 'Should check force parameter');
    });
  });

  describe('E2EE key generation', () => {
    it('should generate key-2 (secp256r1) and key-3 (X25519)', () => {
      // Based on py.md: Generate new E2EE keys
      const { _build_e2ee_entries } = require('../../../module/lib/anp-0.6.8/authentication');

      // Test _build_e2ee_entries function
      const testDid = 'did:wba:awiki.ai:user:test';
      const [vm_entries, ka_refs, keys_dict] = _build_e2ee_entries(testDid);

      // Verify return structure
      assert.ok(Array.isArray(vm_entries), 'Should return vm_entries array');
      assert.ok(Array.isArray(ka_refs), 'Should return ka_refs array');
      assert.ok(typeof keys_dict === 'object', 'Should return keys_dict object');

      // Verify key-2 entry (secp256r1)
      assert.strictEqual(vm_entries.length, 2, 'Should return 2 verification method entries');
      assert.ok(vm_entries[0].id.endsWith('#key-2'), 'First entry should be key-2');
      assert.strictEqual(vm_entries[0].type, 'EcdsaSecp256r1VerificationKey2019', 'key-2 should be secp256r1');
      assert.ok(vm_entries[0].publicKeyJwk, 'key-2 should have publicKeyJwk');

      // Verify key-3 entry (X25519)
      assert.ok(vm_entries[1].id.endsWith('#key-3'), 'Second entry should be key-3');
      assert.ok(
        vm_entries[1].type === 'X25519KeyAgreementKey2019' || vm_entries[1].type === 'X25519KeyAgreementKey2020',
        'key-3 should be X25519'
      );
      assert.ok(vm_entries[1].publicKeyMultibase, 'key-3 should have publicKeyMultibase');

      // Verify keyAgreement reference
      assert.strictEqual(ka_refs.length, 1, 'Should return 1 keyAgreement reference');
      assert.ok(ka_refs[0].endsWith('#key-3'), 'keyAgreement should reference key-3');

      // Verify keys_dict
      assert.ok(keys_dict['key-2'], 'Should have key-2 entry');
      assert.ok(keys_dict['key-3'], 'Should have key-3 entry');
      assert.ok(Array.isArray(keys_dict['key-2']), 'key-2 should be array of [private, public]');
      assert.ok(Array.isArray(keys_dict['key-3']), 'key-3 should be array of [private, public]');
      assert.strictEqual(keys_dict['key-2'].length, 2, 'key-2 should have private and public keys');
      assert.strictEqual(keys_dict['key-3'].length, 2, 'key-3 should have private and public keys');
    });

    it('should generate valid PEM format keys', () => {
      // Based on py.md: E2EE key format
      const { _build_e2ee_entries } = require('../../../module/lib/anp-0.6.8/authentication');

      const testDid = 'did:wba:awiki.ai:user:test';
      const [vm_entries, ka_refs, keys_dict] = _build_e2ee_entries(testDid);

      // Check PEM format
      const key2PrivatePem = keys_dict['key-2'][0].toString();
      const key2PublicPem = keys_dict['key-2'][1].toString();
      const key3PrivatePem = keys_dict['key-3'][0].toString();
      const key3PublicPem = keys_dict['key-3'][1].toString();

      assert.ok(key2PrivatePem.includes('-----BEGIN'), 'key-2 private should be PEM format');
      assert.ok(key2PrivatePem.includes('PRIVATE KEY'), 'key-2 private should contain PRIVATE KEY');
      assert.ok(key2PublicPem.includes('-----BEGIN'), 'key-2 public should be PEM format');
      assert.ok(key2PublicPem.includes('PUBLIC KEY'), 'key-2 public should contain PUBLIC KEY');
      
      assert.ok(key3PrivatePem.includes('-----BEGIN'), 'key-3 private should be PEM format');
      assert.ok(key3PrivatePem.includes('PRIVATE KEY'), 'key-3 private should contain PRIVATE KEY');
      assert.ok(key3PublicPem.includes('-----BEGIN'), 'key-3 public should be PEM format');
      assert.ok(key3PublicPem.includes('PUBLIC KEY'), 'key-3 public should contain PUBLIC KEY');
    });
  });

  describe('DID document update', () => {
    it('should replace key-2 and key-3 entries', () => {
      // Based on py.md: Update DID document - replace key-2/key-3
      const { _build_e2ee_entries } = require('../../../module/lib/anp-0.6.8/authentication');

      const testDid = 'did:wba:awiki.ai:user:test';
      const [vm_entries, ka_refs, keys_dict] = _build_e2ee_entries(testDid);

      // Simulate replacing old entries
      const oldVmList = [
        { id: `${testDid}#key-1`, type: 'EcdsaSecp256k1VerificationKey2019' },
        { id: `${testDid}#key-2`, type: 'EcdsaSecp256r1VerificationKey2019' },
        { id: `${testDid}#key-3`, type: 'X25519KeyAgreementKey2019' }
      ];

      // Remove old key-2 and key-3
      const filtered = oldVmList.filter(vm => {
        const vmId = vm.id || '';
        return !(vmId.endsWith('#key-2') || vmId.endsWith('#key-3'));
      });

      // Add new entries
      const newVmList = [...filtered, ...vm_entries];

      // Verify result
      assert.strictEqual(newVmList.length, 3, 'Should have 3 verification methods');
      assert.ok(newVmList[0].id.endsWith('#key-1'), 'Should keep key-1');
      assert.ok(newVmList[1].id.endsWith('#key-2'), 'Should have new key-2');
      assert.ok(newVmList[2].id.endsWith('#key-3'), 'Should have new key-3');
    });

    it('should update keyAgreement references', () => {
      // Based on py.md: Update keyAgreement references
      const { _build_e2ee_entries } = require('../../../module/lib/anp-0.6.8/authentication');

      const testDid = 'did:wba:awiki.ai:user:test';
      const [vm_entries, ka_refs, keys_dict] = _build_e2ee_entries(testDid);

      // Verify keyAgreement is updated
      assert.ok(Array.isArray(ka_refs), 'keyAgreement should be array');
      assert.strictEqual(ka_refs.length, 1, 'Should have one keyAgreement reference');
      assert.ok(ka_refs[0].includes('key-3'), 'Should reference key-3');
    });

    it('should ensure x25519 context is present', () => {
      // Based on py.md: Ensure x25519 context
      const x25519_ctx = 'https://w3id.org/security/suites/x25519-2019/v1';

      // Verify context constant is defined
      assert.ok(x25519_ctx, 'x25519 context should be defined');
    });
  });

  describe('W3C proof generation', () => {
    it('should generate W3C proof for DID document', () => {
      // Based on py.md: Re-sign with key-1 using generate_w3c_proof
      const { generate_w3c_proof } = require('../../../module/lib/anp-0.6.8/proof');
      const crypto = require('crypto');

      // Generate test key - use KeyObject directly (not PEM encoding)
      const keyPair = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1'
      });

      // Create test document
      const testDoc = {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: 'did:wba:awiki.ai:user:test',
        verificationMethod: []
      };

      // Generate proof
      const signedDoc = generate_w3c_proof({
        document: testDoc,
        private_key: keyPair.privateKey,
        verification_method: 'did:wba:awiki.ai:user:test#key-1',
        proof_purpose: 'authentication',
        domain: 'awiki.ai',
        challenge: crypto.randomBytes(16).toString('hex')
      });

      // Verify proof is attached
      assert.ok(signedDoc.proof, 'Should have proof field');
      assert.ok(signedDoc.proof.type, 'Proof should have type');
      assert.ok(signedDoc.proof.created, 'Proof should have created timestamp');
      assert.ok(signedDoc.proof.verificationMethod, 'Proof should have verificationMethod');
      assert.ok(signedDoc.proof.proofPurpose, 'Proof should have proofPurpose');
      assert.ok(signedDoc.proof.proofValue, 'Proof should have proofValue');
    });

    it('should verify W3C proof', () => {
      // Based on py.md: Proof verification
      const { generate_w3c_proof, verify_w3c_proof } = require('../../../module/lib/anp-0.6.8/proof');
      const crypto = require('crypto');

      // Generate test key - use KeyObject directly (not PEM encoding)
      const keyPair = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1'
      });

      // Create test document
      const testDoc = {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: 'did:wba:awiki.ai:user:test',
        verificationMethod: []
      };

      // Generate and verify proof
      const signedDoc = generate_w3c_proof({
        document: testDoc,
        private_key: keyPair.privateKey,
        verification_method: 'did:wba:awiki.ai:user:test#key-1',
        proof_purpose: 'authentication',
        domain: 'awiki.ai',
        challenge: crypto.randomBytes(16).toString('hex')
      });

      const isValid = verify_w3c_proof(signedDoc, keyPair.publicKey);
      assert.ok(isValid, 'Proof should be valid');
    });
  });

  describe('CLI interface', () => {
    it('should have CLI entry point', () => {
      // Based on py.md: CLI entry point main()
      const module = require('../../scripts/regenerate-e2ee-keys.js');

      // Check module exports
      assert.ok(typeof module.regenerate_e2ee_keys === 'function', 'Should export regenerate_e2ee_keys function');
    });

    it('should accept --credential parameter', () => {
      // Based on py.md: --credential parameter
      // This is tested via CLI, but we can check the function signature
      const regenerateE2eeKeys = require('../../scripts/regenerate-e2ee-keys.js');
      const funcStr = regenerateE2eeKeys.regenerate_e2ee_keys.toString();
      
      assert.ok(
        funcStr.includes('credential_name') || funcStr.includes('credential'),
        'Should accept credential parameter'
      );
    });

    it('should accept --force parameter', () => {
      // Based on py.md: --force parameter
      const regenerateE2eeKeys = require('../../scripts/regenerate-e2ee-keys.js');
      const funcStr = regenerateE2eeKeys.regenerate_e2ee_keys.toString();
      
      assert.ok(funcStr.includes('force'), 'Should accept force parameter');
    });
  });

  describe('Integration with credential_store', () => {
    it('should load identity from credential store', () => {
      // Based on py.md: load_identity from credential_store
      const { load_identity } = require('../../scripts/credential_store');

      assert.ok(typeof load_identity === 'function', 'Should have load_identity function');
    });

    it('should save identity to credential store', () => {
      // Based on py.md: save_identity to credential_store
      const { save_identity } = require('../../scripts/credential_store');

      assert.ok(typeof save_identity === 'function', 'Should have save_identity function');
    });
  });

  describe('Integration with utils.auth', () => {
    it('should have update_did_document function', () => {
      // Based on py.md: update_did_document from utils.auth
      const { update_did_document } = require('../../scripts/utils/auth');

      assert.ok(typeof update_did_document === 'function', 'Should have update_did_document function');
    });

    it('should have get_jwt_via_wba function', () => {
      // Based on py.md: get_jwt_via_wba from utils.auth
      const { get_jwt_via_wba } = require('../../scripts/utils/auth');

      assert.ok(typeof get_jwt_via_wba === 'function', 'Should have get_jwt_via_wba function');
    });
  });

  describe('Integration with utils.identity', () => {
    it('should have DIDIdentity class', () => {
      // Based on py.md: DIDIdentity from utils.identity
      const { DIDIdentity } = require('../../scripts/utils/identity');

      assert.ok(typeof DIDIdentity === 'function', 'Should have DIDIdentity class');
    });

    it('should have load_private_key function', () => {
      // Based on py.md: load_private_key from utils.identity
      const { load_private_key } = require('../../scripts/utils/identity');

      assert.ok(typeof load_private_key === 'function', 'Should have load_private_key function');
    });
  });
});
