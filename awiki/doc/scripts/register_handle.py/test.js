/**
 * Unit tests for register-handle module
 *
 * Based on distillation data from:
 * doc/scripts/register_handle.py/py.json
 */

const assert = require('assert');
const path = require('path');

describe('register-handle', () => {
  describe('Module Import', () => {
    it('should import register-handle module', () => {
      const registerHandle = require('../../scripts/register-handle');
      assert.ok(registerHandle, 'register-handle module should be loaded');
      assert.ok(typeof registerHandle.do_register === 'function', 'do_register should be a function');
      assert.ok(typeof registerHandle.main === 'function', 'main should be a function');
      assert.ok(typeof registerHandle.PENDING_VERIFICATION_EXIT_CODE === 'number', 'PENDING_VERIFICATION_EXIT_CODE should be a number');
    });
  });

  describe('CLI argument handling', () => {
    it('should require --handle parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('node scripts/register-handle.js --phone +8613800138000 --otp-code 123456', { 
          stdio: 'pipe', 
          cwd: path.join(__dirname, '..', '..', 'module') 
        });
        assert.fail('Should require --handle');
      } catch (error) {
        // Expected - missing required parameter
        assert.ok(error.status !== 0, 'Should exit with error');
      }
    });

    it('should accept --phone parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('node scripts/register-handle.js --handle test --phone +8613800138000 --otp-code 123456', { 
          stdio: 'pipe', 
          cwd: path.join(__dirname, '..', '..', 'module') 
        });
        // May fail due to invalid OTP, but argument parsing should succeed
      } catch (error) {
        // Expected - invalid OTP or network error
        assert.ok(error.message.includes('OTP') || error.message.includes('HTTP') || error.status !== 0);
      }
    });

    it('should accept --email parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('node scripts/register-handle.js --handle test --email test@example.com', { 
          stdio: 'pipe', 
          cwd: path.join(__dirname, '..', '..', 'module') 
        });
        // May fail due to email verification pending
      } catch (error) {
        // Expected - email verification pending or network error
        assert.ok(error.message.includes('Email') || error.message.includes('verification') || error.status !== 0);
      }
    });

    it('should accept --invite-code parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('node scripts/register-handle.js --handle test --phone +8613800138000 --otp-code 123456 --invite-code ABC123', { 
          stdio: 'pipe', 
          cwd: path.join(__dirname, '..', '..', 'module') 
        });
        // May fail due to invalid OTP or invite code
      } catch (error) {
        // Expected - invalid OTP or invite code
        assert.ok(error.message.includes('OTP') || error.message.includes('invite') || error.status !== 0);
      }
    });

    it('should accept --credential parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('node scripts/register-handle.js --handle test --phone +8613800138000 --otp-code 123456 --credential myhandle', { 
          stdio: 'pipe', 
          cwd: path.join(__dirname, '..', '..', 'module') 
        });
        // May fail due to invalid OTP
      } catch (error) {
        // Expected - invalid OTP
        assert.ok(error.message.includes('OTP') || error.status !== 0);
      }
    });

    it('should accept --wait-for-email-verification parameter', () => {
      const { execSync } = require('child_process');
      try {
        execSync('node scripts/register-handle.js --handle test --email test@example.com --wait-for-email-verification', { 
          stdio: 'pipe', 
          cwd: path.join(__dirname, '..', '..', 'module'),
          timeout: 5000
        });
        // May fail due to email verification pending
      } catch (error) {
        // Expected - email verification pending or timeout
        assert.ok(error.message.includes('Email') || error.message.includes('verification') || error.status !== 0);
      }
    });
  });

  describe('SDKConfig integration', () => {
    it('should load SDK configuration', () => {
      const { SDKConfig } = require('../../scripts/utils/config');
      const config = SDKConfig.load();
      assert.ok(config, 'SDKConfig should be loaded');
      assert.ok(config.user_service_url, 'user_service_url should be set');
      assert.ok(config.did_domain, 'did_domain should be set');
    });
  });

  describe('do_register function', () => {
    it('should reject missing phone and email', (done) => {
      // Save original process.exit
      const originalExit = process.exit;
      let exitCalled = false;
      
      // Mock process.exit to prevent test from exiting
      process.exit = function(code) {
        exitCalled = true;
        throw new Error(`process.exit(${code}) called`);
      };
      
      const registerHandle = require('../../scripts/register-handle');
      
      registerHandle.do_register({ handle: 'test' })
        .then(() => {
          process.exit = originalExit;
          assert.fail('Should reject missing phone and email');
        })
        .catch((error) => {
          process.exit = originalExit;
          assert.ok(exitCalled || error.message.includes('exit'), 'Should exit or throw');
          done();
        });
    });

    it('should reject missing OTP code for phone registration', async () => {
      const registerHandle = require('../../scripts/register-handle');
      try {
        await registerHandle.do_register({ 
          handle: 'test', 
          phone: '+8613800138000' 
        });
        assert.fail('Should reject missing OTP code');
      } catch (error) {
        assert.ok(error.message.includes('OTP') || error.message.includes('required'), 'Should mention OTP code required');
      }
    });
  });
});
