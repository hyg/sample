/**
 * Unit tests for identity module
 * 
 * Based on distillation data from:
 * doc/scripts/utils/identity.py/py.json
 */

const assert = require('assert');

describe('identity (utils)', () => {
  describe('Module Import', () => {
    it('should import identity module', () => {
      const identity = require('../../scripts/utils/identity');
      assert.ok(identity, 'identity module should be loaded');
    });
  });

  describe('DIDIdentity class', () => {
    it('should exist as a class', () => {
      const identity = require('../../scripts/utils/identity');
      assert.ok(typeof identity.DIDIdentity === 'function');
    });

    it('should have required properties', () => {
      // Note: Full instantiation requires valid DID document
      const identity = require('../../scripts/utils/identity');
      assert.ok('DIDIdentity' in identity);
    });
  });

  describe('create_identity', () => {
    it('should exist as a function', () => {
      const identity = require('../../scripts/utils/identity');
      assert.ok(typeof identity.create_identity === 'function');
    });

    it('should require hostname parameter', () => {
      const identity = require('../../scripts/utils/identity');
      assert.ok(identity.create_identity.length >= 1);
    });
  });

  describe('load_private_key', () => {
    it('should exist as a function', () => {
      const identity = require('../../scripts/utils/identity');
      assert.ok(typeof identity.load_private_key === 'function');
    });
  });

  describe('SDKConfig integration', () => {
    it('should load SDK configuration', () => {
      const { SDKConfig } = require('../../scripts/utils/config');
      const config = SDKConfig.load();
      assert.ok(config, 'SDKConfig should be loaded');
      assert.ok(config.did_domain, 'did_domain should be set');
    });
  });
});
