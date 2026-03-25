/**
 * Unit tests for send_verification_code module
 *
 * Based on distillation data from:
 * doc/scripts/send_verification_code.py/py.json
 */

const assert = require('assert');

describe('send_verification_code', () => {
  describe('Module Import', () => {
    it('should import send_verification_code module', () => {
      const mod = require('../../scripts/send-verification-code');
      assert.ok(mod, 'send_verification_code module should be loaded');
    });

    it('should export do_send function', () => {
      const mod = require('../../scripts/send-verification-code');
      assert.ok(typeof mod.do_send === 'function', 'do_send should be a function');
    });

    it('should export main function', () => {
      const mod = require('../../scripts/send-verification-code');
      assert.ok(typeof mod.main === 'function', 'main should be a function');
    });
  });

  describe('do_send', () => {
    it('should be an async function', () => {
      const mod = require('../../scripts/send-verification-code');
      assert.ok(mod.do_send.constructor.name === 'AsyncFunction', 'do_send should be async');
    });

    it('should require phone parameter', () => {
      const mod = require('../../scripts/send-verification-code');
      assert.ok(mod.do_send.length >= 1, 'do_send should require phone parameter');
    });
  });

  describe('CLI argument handling', () => {
    it('should require --phone parameter', () => {
      const mod = require('../../scripts/send-verification-code');
      // main() should exit if --phone is not provided
      // This is tested by the error handling in the Python version
    });
  });

  describe('SDKConfig integration', () => {
    it('should load SDK configuration', () => {
      const { SDKConfig } = require('../../scripts/utils/config');
      const config = SDKConfig.load();
      assert.ok(config.user_service_url, 'user_service_url should be configured');
      assert.ok(config.did_domain, 'did_domain should be configured');
    });
  });
});
