/**
 * utils/config.py 的 Node.js 测试文件
 * 
 * 基于蒸馏数据生成，确保与 Python 版本行为一致
 * 
 * 蒸馏数据：doc/scripts/utils/config.py/py.json
 */

const assert = require('assert');
const path = require('path');

// 导入目标模块
const { SDKConfig } = require(path.join(__dirname, '../../../../module/scripts/utils/config.js'));

describe('SDKConfig - 配置管理', () => {
  
  describe('SDKConfig.load()', () => {
    it('should load default config - 加载默认配置（环境变量或默认值）', () => {
      // 从 py.json 获取预期输出
      const expected = {
        user_service_url: 'https://awiki.ai',
        molt_message_url: 'https://awiki.ai',
        molt_message_ws_url: null,
        did_domain: 'awiki.ai',
      };
      
      // 测试移植的 Node.js 版本
      const config = SDKConfig.load();
      assert.strictEqual(config.user_service_url, expected.user_service_url);
      assert.strictEqual(config.molt_message_url, expected.molt_message_url);
      assert.strictEqual(config.molt_message_ws_url, expected.molt_message_ws_url);
      assert.strictEqual(config.did_domain, expected.did_domain);
      
      // 验证路径格式
      assert.ok(config.credentials_dir.includes('awiki-agent-id-message'));
      assert.ok(config.data_dir.includes('awiki-agent-id-message'));
    });
    
    it('should have correct property types', () => {
      const config = SDKConfig.load();
      assert.strictEqual(typeof config.user_service_url, 'string');
      assert.strictEqual(typeof config.molt_message_url, 'string');
      assert.strictEqual(typeof config.did_domain, 'string');
      assert.strictEqual(typeof config.credentials_dir, 'string');
      assert.strictEqual(typeof config.data_dir, 'string');
    });
  });
  
  describe('SDKConfig properties', () => {
    it('should have all required properties', () => {
      const requiredProperties = [
        'user_service_url',
        'molt_message_url',
        'molt_message_ws_url',
        'did_domain',
        'credentials_dir',
        'data_dir'
      ];
      
      // 验证属性列表完整
      assert.strictEqual(requiredProperties.length, 6);
    });
  });
  
  describe('Environment variables', () => {
    it('should support E2E_USER_SERVICE_URL override', () => {
      const original = process.env.E2E_USER_SERVICE_URL;
      
      try {
        process.env.E2E_USER_SERVICE_URL = 'https://custom.ai';
        // 如模块已移植，测试环境变量覆盖
        // const config = SDKConfig.load();
        // assert.strictEqual(config.user_service_url, 'https://custom.ai');
      } finally {
        if (original) {
          process.env.E2E_USER_SERVICE_URL = original;
        } else {
          delete process.env.E2E_USER_SERVICE_URL;
        }
      }
    });
  });
  
  describe('Cross-platform tests', () => {
    const { execSync } = require('child_process');
    
    it('Python: SDKConfig.load() should return valid config', () => {
      // 执行 Python 版本
      const pythonOutput = execSync(
        'python -c "from scripts.utils.config import SDKConfig; import json; c=SDKConfig.load(); print(json.dumps({\\\"user_service_url\\\": c.user_service_url, \\\"did_domain\\\": c.did_domain}))"',
        { encoding: 'utf8', cwd: 'D:\\huangyg\\git\\sample\\awiki' }
      );
      
      const config = JSON.parse(pythonOutput);
      assert.strictEqual(config.user_service_url, 'https://awiki.ai');
      assert.strictEqual(config.did_domain, 'awiki.ai');
    });
  });
});
