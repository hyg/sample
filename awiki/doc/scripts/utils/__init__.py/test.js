/**
 * Unit tests for __init__ module (utils package)
 * 
 * Based on distillation data from:
 * doc/scripts/utils/__init__.py/py.json
 */

const assert = require('assert');

describe('utils/__init__', () => {
  describe('Module Import', () => {
    it('should import utils index module', () => {
      const utils = require('../../scripts/utils');
      assert.ok(utils, 'utils index module should be loaded');
    });

    it('should export SDKConfig', () => {
      const utils = require('../../scripts/utils');
      assert.ok(utils.SDKConfig, 'Should export SDKConfig');
    });

    it('should export E2eeClient', () => {
      const utils = require('../../scripts/utils');
      assert.ok(utils.E2eeClient, 'Should export E2eeClient');
    });

    it('should export create_user_service_client', () => {
      const utils = require('../../scripts/utils');
      assert.ok(typeof utils.create_user_service_client === 'function');
    });

    it('should export authenticated_rpc_call', () => {
      const utils = require('../../scripts/utils');
      assert.ok(typeof utils.authenticated_rpc_call === 'function');
    });
  });

  describe('SDKConfig integration', () => {
    it('should load SDK configuration', () => {
      const { SDKConfig } = require('../../scripts/utils');
      const config = SDKConfig.load();
      assert.ok(config, 'SDKConfig should be loaded');
    });
  });
});
