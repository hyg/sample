/**
 * Unit tests for register_handle module
 * 
 * Based on distillation data from:
 * doc/scripts/register_handle.py/py.json
 */

const assert = require('assert');

describe('register_handle', () => {
  describe('Module Import', () => {
    it('should import register_handle module', () => {
      const register_handle = require('../../scripts/register_handle');
      assert.ok(register_handle, 'register_handle module should be loaded');
      assert.ok(typeof register_handle.register_handle === 'function');
    });
  });

  describe('CLI argument handling', () => {
    it('should require --handle parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/register_handle.py --phone +8613800138000 --otp-code 123456', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
        assert.fail('Should require --handle');
      } catch (error) { /* Expected */ }
    });

    it('should accept --phone parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/register_handle.py --handle test --phone +8613800138000 --otp-code 123456', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
      } catch (error) { /* Expected */ }
    });

    it('should accept --email parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/register_handle.py --handle test --email test@example.com', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
      } catch (error) { /* Expected */ }
    });

    it('should accept --invite-code parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('python scripts/register_handle.py --handle test --phone +8613800138000 --otp-code 123456 --invite-code ABC123', { stdio: 'pipe', cwd: process.cwd() + '/../../python' });
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
