/**
 * Unit tests for rpc module
 *
 * Based on distillation data from:
 * doc/scripts/utils/rpc.py/py.json
 */

const assert = require('assert');
const path = require('path');

describe('rpc (utils)', () => {
  describe('Module Import', () => {
    it('should import rpc module', () => {
      const rpc = require(path.join(__dirname, '../../../../module/scripts/utils/rpc.js'));
      assert.ok(rpc, 'rpc module should be loaded');
    });
  });

  describe('JsonRpcError', () => {
    it('should exist as a class', () => {
      const rpc = require(path.join(__dirname, '../../../../module/scripts/utils/rpc.js'));
      assert.ok(typeof rpc.JsonRpcError === 'function');
    });

    it('should accept code and message parameters', () => {
      const rpc = require(path.join(__dirname, '../../../../module/scripts/utils/rpc.js'));
      const error = new rpc.JsonRpcError(-32000, 'Test error');
      assert.ok(error, 'JsonRpcError should be created');
      assert.strictEqual(error.code, -32000);
      assert.strictEqual(error.message, 'Test error');
    });
  });

  describe('rpc_call', () => {
    it('should exist as an async function', () => {
      const rpc = require(path.join(__dirname, '../../../../module/scripts/utils/rpc.js'));
      assert.ok(typeof rpc.rpc_call === 'function');
    });
  });

  describe('authenticated_rpc_call', () => {
    it('should exist as an async function', () => {
      const rpc = require(path.join(__dirname, '../../../../module/scripts/utils/rpc.js'));
      assert.ok(typeof rpc.authenticated_rpc_call === 'function');
    });
  });

  describe('SDKConfig integration', () => {
    it('should load SDK configuration', () => {
      const { SDKConfig } = require(path.join(__dirname, '../../../../module/scripts/utils/config.js'));
      const config = SDKConfig.load();
      assert.ok(config, 'SDKConfig should be loaded');
    });
  });
});
