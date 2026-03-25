/**
 * Unit tests for service_manager module
 * 
 * Based on distillation data from:
 * doc/scripts/service_manager.py/py.json
 */

const assert = require('assert');

describe('service_manager', () => {
  describe('Module Import', () => {
    it('should import service_manager module', () => {
      const service_manager = require('../../scripts/service_manager');
      assert.ok(service_manager, 'service_manager module should be loaded');
    });
  });

  describe('get_service_manager', () => {
    it('should exist as a function', () => {
      const service_manager = require('../../scripts/service_manager');
      assert.ok(typeof service_manager.get_service_manager === 'function');
    });
  });

  describe('Platform detection', () => {
    it('should detect platform', () => {
      const service_manager = require('../../scripts/service_manager');
      const manager = service_manager.get_service_manager();
      assert.ok(manager, 'Service manager should be created');
      assert.ok('platform' in manager, 'Should have platform property');
    });
  });

  describe('SDKConfig integration', () => {
    it('should load SDK configuration', () => {
      const { SDKConfig } = require('../../scripts/utils/config');
      const config = SDKConfig.load();
      assert.ok(config, 'SDKConfig should be loaded');
    });
  });
});
