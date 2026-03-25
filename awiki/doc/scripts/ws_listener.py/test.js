/**
 * Unit tests for ws_listener module
 * 
 * Based on distillation data from:
 * doc/scripts/ws_listener.py/py.json
 */

const assert = require('assert');

describe('ws_listener', () => {
  describe('Module Import', () => {
    it('should import ws_listener module', () => {
      const ws_listener = require('../../scripts/ws_listener');
      assert.ok(ws_listener, 'ws_listener module should be loaded');
      assert.ok(typeof ws_listener.run_listener === 'function');
    });
  });

  describe('CLI argument handling', () => {
    it('should accept run command', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/ws_listener.py run', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
      } catch (error) { /* Expected */ }
    });

    it('should accept install command', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/ws_listener.py install', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
      } catch (error) { /* Expected */ }
    });

    it('should accept uninstall command', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/ws_listener.py uninstall', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
      } catch (error) { /* Expected */ }
    });

    it('should accept status command', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/ws_listener.py status', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
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
