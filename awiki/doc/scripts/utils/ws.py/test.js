/**
 * Unit tests for ws module
 *
 * Based on distillation data from:
 * doc/scripts/utils/ws.py/py.json
 */

const assert = require('assert');

describe('ws (utils)', () => {
  describe('Module Import', () => {
    it('should import ws module', () => {
      const ws = require('../../scripts/utils/ws');
      assert.ok(ws, 'ws module should be loaded');
    });
  });

  describe('createWebSocketClient', () => {
    it('should exist as a function', () => {
      const ws = require('../../scripts/utils/ws');
      assert.ok(typeof ws.createWebSocketClient === 'function');
    });

    it('should require config parameter', () => {
      const ws = require('../../scripts/utils/ws');
      assert.ok(ws.createWebSocketClient.length >= 1);
    });
  });

  describe('SDKConfig integration', () => {
    it('should load SDK configuration', () => {
      const { SDKConfig } = require('../../scripts/utils/config');
      const config = SDKConfig.load();
      assert.ok(config, 'SDKConfig should be loaded');
      assert.ok(config.molt_message_ws_url !== undefined, 'molt_message_ws_url should be set');
    });
  });
});
