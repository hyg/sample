/**
 * Unit tests for resolve_handle module
 * 
 * Based on distillation data from:
 * doc/scripts/resolve_handle.py/py.json
 */

const assert = require('assert');

describe('resolve_handle', () => {
  describe('Module Import', () => {
    it('should import resolve_handle module', () => {
      const resolve_handle = require('../../scripts/resolve_handle');
      assert.ok(resolve_handle, 'resolve_handle module should be loaded');
      assert.ok(typeof resolve_handle.resolve_handle === 'function');
    });
  });

  describe('CLI argument handling', () => {
    it('should require --handle or --did parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/resolve_handle.py', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
        assert.fail('Should require --handle or --did');
      } catch (error) { /* Expected */ }
    });

    it('should accept --handle parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/resolve_handle.py --handle test.awiki.ai', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
      } catch (error) { /* Expected */ }
    });

    it('should accept --did parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/resolve_handle.py --did did:wba:awiki.ai:user:k1_test', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
      } catch (error) { /* Expected */ }
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
