/**
 * Unit tests for credential_store module
 * 
 * Based on distillation data from:
 * doc/scripts/credential_store.py/py.json
 * 
 * Python source: python/scripts/credential_store.py
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Load module under test
const credentialStore = require('../../../module/scripts/credential-store');
const { SDKConfig } = require('../../../module/scripts/utils/config');

describe('credential_store', () => {
  const testCredentialName = 'test_credential_' + Date.now();
  let config;
  
  beforeEach(() => {
    config = SDKConfig.load();
  });
  
  afterEach(() => {
    // Clean up test credential
    try {
      credentialStore.delete_identity(testCredentialName, config);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('load_identity', () => {
    it('should return null for non-existent credential', () => {
      // Based on py.json: load non-existent credential
      const identity = credentialStore.load_identity('nonexistent_credential', config);

      assert.strictEqual(identity, null, 'Should return null for non-existent credential');
    });

    it('should load existing identity', () => {
      // Based on py.json: save then load
      // Python signature: save_identity(did, unique_id, user_id, private_key_pem, public_key_pem, ...)
      credentialStore.save_identity({
        did: 'did:wba:awiki.ai:user:k1_test',
        unique_id: 'test_unique_' + Date.now(),
        user_id: 'test_user_001',
        private_key_pem: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
        public_key_pem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
        display_name: 'Test User',
        name: testCredentialName
      }, config);
      
      const loaded = credentialStore.load_identity(testCredentialName, config);

      assert.ok(loaded, 'Identity should be loaded');
      assert.strictEqual(loaded.did, 'did:wba:awiki.ai:user:k1_test');
      assert.strictEqual(loaded.name, 'Test User');
    });
  });

  describe('save_identity', () => {
    it('should save identity to credential storage', () => {
      // Based on py.json: save identity
      const uniqueId = 'test_unique_' + Date.now();
      credentialStore.save_identity({
        did: 'did:wba:awiki.ai:user:k1_test',
        unique_id: uniqueId,
        user_id: 'test_user_001',
        private_key_pem: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
        public_key_pem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
        display_name: 'Test User',
        name: testCredentialName
      }, config);

      // Credential is stored in directory named after unique_id
      const credentialDir = path.join(config.credentials_dir, uniqueId);
      const identityPath = path.join(credentialDir, 'identity.json');

      assert.ok(fs.existsSync(identityPath), 'identity.json should exist');

      const saved = JSON.parse(fs.readFileSync(identityPath, 'utf-8'));
      assert.strictEqual(saved.did, 'did:wba:awiki.ai:user:k1_test');
    });
  });

  describe('list_identities', () => {
    it('should list all identity names', () => {
      // Based on py.json: list identities
      const identities = credentialStore.list_identities(config);
      
      assert.ok(Array.isArray(identities), 'Should return an array');
    });
  });

  describe('delete_identity', () => {
    it('should delete existing identity', () => {
      // Based on py.json: save then delete
      // Save first
      credentialStore.save_identity({
        did: 'did:wba:awiki.ai:user:k1_test',
        unique_id: 'test_unique_' + Date.now(),
        user_id: 'test_user_001',
        private_key_pem: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
        public_key_pem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
        display_name: 'Test User',
        name: testCredentialName
      }, config);

      // Then delete
      const result = credentialStore.delete_identity(testCredentialName, config);

      assert.strictEqual(result, true, 'Should return true on successful delete');

      // Verify deleted
      const loaded = credentialStore.load_identity(testCredentialName, config);
      assert.strictEqual(loaded, null, 'Identity should be deleted');
    });

    it('should return false for non-existent credential', () => {
      const result = credentialStore.delete_identity('nonexistent', config);
      assert.strictEqual(result, false, 'Should return false for non-existent credential');
    });
  });

  describe('SDKConfig integration', () => {
    it('should load SDK configuration', () => {
      // Based on py.json: sdk_integration
      assert.ok(config, 'SDKConfig should be loaded');
      assert.ok(config.credentials_dir, 'credentials_dir should be set');
      assert.ok(config.data_dir, 'data_dir should be set');
    });
  });
});
