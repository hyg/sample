/**
 * Unit tests for client module
 * 
 * Based on distillation data from:
 * doc/scripts/utils/client.py/py.json
 */

const assert = require('assert');

describe('client (utils)', () => {
  describe('Module Import', () => {
    it('should import client module', () => {
      const client = require('../../scripts/utils/client');
      assert.ok(client, 'client module should be loaded');
    });
  });

  describe('create_user_service_client', () => {
    it('should exist as a function', () => {
      const client = require('../../scripts/utils/client');
      assert.ok(typeof client.create_user_service_client === 'function');
    });

    it('should require config parameter', () => {
      const client = require('../../scripts/utils/client');
      assert.ok(client.create_user_service_client.length >= 1);
    });
  });

  describe('create_molt_message_client', () => {
    it('should exist as a function', () => {
      const client = require('../../scripts/utils/client');
      assert.ok(typeof client.create_molt_message_client === 'function');
    });
  });

  describe('SDKConfig integration', () => {
    it('should load SDK configuration', () => {
      const { SDKConfig } = require('../../scripts/utils/config');
      const config = SDKConfig.load();
      assert.ok(config, 'SDKConfig should be loaded');
      assert.ok(config.user_service_url, 'user_service_url should be set');
      assert.ok(config.molt_message_url, 'molt_message_url should be set');
    });
  });
});
