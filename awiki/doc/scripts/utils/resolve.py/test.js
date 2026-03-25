/**
 * Unit tests for resolve module
 * 
 * Based on distillation data from:
 * doc/scripts/utils/resolve.py/py.json
 */

const assert = require('assert');

describe('resolve (utils)', () => {
  describe('Module Import', () => {
    it('should import resolve module', () => {
      const resolve = require('../../scripts/utils/resolve');
      assert.ok(resolve, 'resolve module should be loaded');
    });
  });

  describe('resolve_to_did', () => {
    it('should exist as a function', () => {
      const resolve = require('../../scripts/utils/resolve');
      assert.ok(typeof resolve.resolve_to_did === 'function');
    });

    it('should require handle or did parameter', () => {
      const resolve = require('../../scripts/utils/resolve');
      assert.ok(resolve.resolve_to_did.length >= 1);
    });
  });

  describe('SDKConfig integration', () => {
    it('should load SDK configuration', () => {
      const { SDKConfig } = require('../../scripts/utils/config');
      const config = SDKConfig.load();
      assert.ok(config, 'SDKConfig should be loaded');
      assert.ok(config.user_service_url, 'user_service_url should be set');
    });
  });
});
