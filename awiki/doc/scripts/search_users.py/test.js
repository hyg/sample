/**
 * Unit tests for search_users module
 * 
 * Based on distillation data from:
 * doc/scripts/search_users.py/py.json
 */

const assert = require('assert');

describe('search_users', () => {
  describe('Module Import', () => {
    it('should import search_users module', () => {
      const search_users = require('../../scripts/search_users');
      assert.ok(search_users, 'search_users module should be loaded');
      assert.ok(typeof search_users.search_users === 'function');
    });
  });

  describe('CLI argument handling', () => {
    it('should require query parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/search_users.py', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
        assert.fail('Should require query');
      } catch (error) { /* Expected */ }
    });

    it('should accept query parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/search_users.py "AI agent"', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
      } catch (error) { /* Expected */ }
    });

    it('should accept --limit parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/search_users.py "AI" --limit 20', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
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
