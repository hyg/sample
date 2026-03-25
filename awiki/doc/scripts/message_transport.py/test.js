/**
 * Unit tests for message_transport module
 * 
 * Based on distillation data from:
 * doc/scripts/message_transport.py/py.json
 * 
 * Python source: python/scripts/message_transport.py
 */

const assert = require('assert');

// Mock SDKConfig
class MockSDKConfig {
  constructor() {
    this.data_dir = process.env.AWIKI_DATA_DIR || '/tmp/awiki-test';
  }
  
  static load() {
    return new MockSDKConfig();
  }
}

// Mock settings.json path
const getSettingsPath = () => {
  const path = require('path');
  return path.join(process.env.AWIKI_DATA_DIR || '/tmp/awiki-test', 'config', 'settings.json');
};

// Load module under test
const messageTransport = require('../../scripts/message_transport');

describe('message_transport', () => {
  const fs = require('fs');
  const path = require('path');
  
  beforeEach(() => {
    // Clean up test settings
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath);
    }
  });
  
  afterEach(() => {
    // Clean up test settings
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath);
    }
  });

  describe('Constants', () => {
    it('should have RECEIVE_MODE_HTTP constant', () => {
      // Based on py.json: RECEIVE_MODE_HTTP = "http"
      assert.strictEqual(messageTransport.RECEIVE_MODE_HTTP, 'http');
    });

    it('should have RECEIVE_MODE_WEBSOCKET constant', () => {
      // Based on py.json: RECEIVE_MODE_WEBSOCKET = "websocket"
      assert.strictEqual(messageTransport.RECEIVE_MODE_WEBSOCKET, 'websocket');
    });
  });

  describe('write_receive_mode', () => {
    it('should write WebSocket mode to settings.json', () => {
      // Based on py.json scenario: write_websocket
      // Input: { mode: "websocket" }
      // Output: { config_written: true, mode: "websocket" }
      
      messageTransport.write_receive_mode('websocket');
      
      const settingsPath = getSettingsPath();
      assert.ok(fs.existsSync(settingsPath), 'settings.json should be created');
      
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      assert.strictEqual(settings.receive_mode, 'websocket');
    });

    it('should write HTTP mode to settings.json', () => {
      // Based on py.json scenario: write_http
      // Input: { mode: "http" }
      // Output: { config_written: true, mode: "http" }
      
      messageTransport.write_receive_mode('http');
      
      const settingsPath = getSettingsPath();
      assert.ok(fs.existsSync(settingsPath), 'settings.json should be created');
      
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      assert.strictEqual(settings.receive_mode, 'http');
    });

    it('should switch between modes', () => {
      // Based on py.json scenario: mode_switch
      // Input: { switch_from: "websocket", switch_to: "http" }
      // Output: { initial_mode: "websocket", final_mode: "http", switched: true }
      
      // Set initial mode
      messageTransport.write_receive_mode('websocket');
      let settings = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8'));
      assert.strictEqual(settings.receive_mode, 'websocket', 'Initial mode should be websocket');
      
      // Switch mode
      messageTransport.write_receive_mode('http');
      settings = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8'));
      assert.strictEqual(settings.receive_mode, 'http', 'Final mode should be http');
    });
  });

  describe('load_receive_mode', () => {
    it('should load receive mode from settings.json', () => {
      // Based on py.json scenario: load_mode
      // Input: {}
      // Output: { mode_read: "websocket", default: "http" }
      
      // First write a mode
      messageTransport.write_receive_mode('websocket');
      
      // Then read it back
      const config = new MockSDKConfig();
      const mode = messageTransport.load_receive_mode(config);
      
      assert.strictEqual(mode, 'websocket');
    });

    it('should return HTTP as default when settings.json is missing', () => {
      // Based on py.json: default = "http"
      const config = new MockSDKConfig();
      const mode = messageTransport.load_receive_mode(config);
      
      assert.strictEqual(mode, 'http', 'Should default to HTTP mode');
    });
  });

  describe('is_websocket_mode', () => {
    it('should return true when WebSocket mode is enabled', () => {
      // Based on py.json scenario: is_websocket
      // Input: { mode_to_set: "websocket" }
      // Output: { is_websocket: true }
      
      messageTransport.write_receive_mode('websocket');
      const config = new MockSDKConfig();
      
      assert.strictEqual(messageTransport.is_websocket_mode(config), true);
    });

    it('should return false when HTTP mode is enabled', () => {
      messageTransport.write_receive_mode('http');
      const config = new MockSDKConfig();
      
      assert.strictEqual(messageTransport.is_websocket_mode(config), false);
    });
  });
});
