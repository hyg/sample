/**
 * message-daemon.js 单元测试
 *
 * 测试覆盖：
 * - LocalDaemonSettings 类
 * - load_local_daemon_settings 函数
 * - call_local_daemon 函数
 * - is_local_daemon_available 函数
 * - LocalMessageDaemon 类
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  DEFAULT_LOCAL_DAEMON_HOST,
  DEFAULT_LOCAL_DAEMON_PORT,
  LocalDaemonSettings,
  LocalMessageDaemon,
  call_local_daemon,
  is_local_daemon_available,
  load_local_daemon_settings
} = require('../../../module/scripts/message-daemon');

const { SDKConfig } = require('../../../module/scripts/utils/config');

describe('message-daemon.js', () => {
  describe('常量', () => {
    test('DEFAULT_LOCAL_DAEMON_HOST 应该是 127.0.0.1', () => {
      expect(DEFAULT_LOCAL_DAEMON_HOST).toBe('127.0.0.1');
    });

    test('DEFAULT_LOCAL_DAEMON_PORT 应该是 18790', () => {
      expect(DEFAULT_LOCAL_DAEMON_PORT).toBe(18790);
    });
  });

  describe('LocalDaemonSettings 类', () => {
    test('应该使用默认值创建实例', () => {
      const settings = new LocalDaemonSettings();
      expect(settings.host).toBe(DEFAULT_LOCAL_DAEMON_HOST);
      expect(settings.port).toBe(DEFAULT_LOCAL_DAEMON_PORT);
      expect(settings.token).toBe('');
    });

    test('应该使用自定义值创建实例', () => {
      const settings = new LocalDaemonSettings({
        host: '192.168.1.1',
        port: 8080,
        token: 'test_token'
      });
      expect(settings.host).toBe('192.168.1.1');
      expect(settings.port).toBe(8080);
      expect(settings.token).toBe('test_token');
    });

    test('实例应该是冻结的', () => {
      const settings = new LocalDaemonSettings();
      expect(Object.isFrozen(settings)).toBe(true);
    });

    test('尝试修改冻结的实例应该静默失败', () => {
      const settings = new LocalDaemonSettings();
      // 在 Node.js 中，冻结对象的属性赋值会静默失败（非严格模式）
      // 或者抛出错误（严格模式），这里验证对象确实被冻结
      expect(Object.isFrozen(settings)).toBe(true);
      // 尝试修改
      settings.host = 'modified';
      // 验证值未改变
      expect(settings.host).toBe(DEFAULT_LOCAL_DAEMON_HOST);
    });
  });

  describe('load_local_daemon_settings 函数', () => {
    let tempDir;
    let originalEnv;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'message-daemon-test-'));
      originalEnv = process.env.AWIKI_DATA_DIR;
      process.env.AWIKI_DATA_DIR = tempDir;
    });

    afterEach(() => {
      if (originalEnv) {
        process.env.AWIKI_DATA_DIR = originalEnv;
      } else {
        delete process.env.AWIKI_DATA_DIR;
      }
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // 忽略清理错误
      }
    });

    test('当 settings.json 不存在时应该返回默认值', () => {
      const settings = load_local_daemon_settings();
      expect(settings.host).toBe(DEFAULT_LOCAL_DAEMON_HOST);
      expect(settings.port).toBe(DEFAULT_LOCAL_DAEMON_PORT);
      expect(settings.token).toBe('');
    });

    test('当 settings.json 存在时应该加载配置', () => {
      const configDir = path.join(tempDir, 'config');
      fs.mkdirSync(configDir, { recursive: true });

      const settingsJson = {
        message_transport: {
          local_daemon_host: '192.168.1.100',
          local_daemon_port: 9999,
          local_daemon_token: 'my_token'
        }
      };

      fs.writeFileSync(
        path.join(configDir, 'settings.json'),
        JSON.stringify(settingsJson, null, 2)
      );

      const settings = load_local_daemon_settings();
      expect(settings.host).toBe('192.168.1.100');
      expect(settings.port).toBe(9999);
      expect(settings.token).toBe('my_token');
    });

    test('当 JSON 无效时应该返回默认值', () => {
      const configDir = path.join(tempDir, 'config');
      fs.mkdirSync(configDir, { recursive: true });

      fs.writeFileSync(
        path.join(configDir, 'settings.json'),
        'invalid json{'
      );

      const settings = load_local_daemon_settings();
      expect(settings.host).toBe(DEFAULT_LOCAL_DAEMON_HOST);
      expect(settings.port).toBe(DEFAULT_LOCAL_DAEMON_PORT);
    });

    test('当端口不是数字时应该使用默认端口', () => {
      const configDir = path.join(tempDir, 'config');
      fs.mkdirSync(configDir, { recursive: true });

      const settingsJson = {
        message_transport: {
          local_daemon_port: 'invalid'
        }
      };

      fs.writeFileSync(
        path.join(configDir, 'settings.json'),
        JSON.stringify(settingsJson, null, 2)
      );

      const settings = load_local_daemon_settings();
      expect(settings.port).toBe(DEFAULT_LOCAL_DAEMON_PORT);
    });
  });

  describe('is_local_daemon_available 函数', () => {
    test('当守护进程不可用时应该返回 false', async () => {
      // 使用一个不太可能被占用的端口
      const config = new SDKConfig({
        data_dir: '/nonexistent'
      });

      const available = await is_local_daemon_available(config);
      expect(available).toBe(false);
    });
  });

  describe('LocalMessageDaemon 类', () => {
    let daemon;
    let testPort;

    beforeEach(() => {
      testPort = 19000 + Math.floor(Math.random() * 1000);
    });

    afterEach(async () => {
      if (daemon) {
        await daemon.close();
        daemon = null;
      }
    });

    test('应该能够启动和关闭服务器', async () => {
      const settings = new LocalDaemonSettings({
        host: '127.0.0.1',
        port: testPort,
        token: 'test_token'
      });

      const handler = jest.fn().mockResolvedValue({ result: 'ok' });
      daemon = new LocalMessageDaemon(settings, handler);

      await daemon.start();

      // 验证服务器已启动
      const isAvailable = await new Promise((resolve) => {
        const socket = net.createConnection(
          { host: '127.0.0.1', port: testPort },
          () => {
            socket.destroy();
            resolve(true);
          }
        );
        socket.on('error', () => resolve(false));
      });

      expect(isAvailable).toBe(true);

      await daemon.close();
    });

    test('应该能够处理有效的 RPC 请求', async () => {
      const settings = new LocalDaemonSettings({
        host: '127.0.0.1',
        port: testPort,
        token: 'test_token'
      });

      const handler = jest.fn().mockImplementation(
        async (method, params, credential_name) => {
          expect(method).toBe('test_method');
          expect(params).toEqual({ key: 'value' });
          expect(credential_name).toBe('test_credential');
          return { success: true };
        }
      );

      daemon = new LocalMessageDaemon(settings, handler);
      await daemon.start();

      // 发送请求
      const response = await new Promise((resolve, reject) => {
        const client = net.createConnection(
          { host: '127.0.0.1', port: testPort },
          () => {
            const request = {
              token: 'test_token',
              method: 'test_method',
              params: { key: 'value' },
              credential_name: 'test_credential'
            };
            client.write(Buffer.from(JSON.stringify(request) + '\n', 'utf-8'));
          }
        );

        let data = '';
        client.on('data', (chunk) => {
          data += chunk.toString('utf-8');
        });

        client.on('end', () => {
          try {
            const response = JSON.parse(data.trim());
            resolve(response);
          } catch (e) {
            reject(e);
          }
        });

        client.on('error', reject);
      });

      expect(response.ok).toBe(true);
      expect(response.result).toEqual({ success: true });
      expect(handler).toHaveBeenCalledTimes(1);

      await daemon.close();
    });

    test('应该拒绝无效的令牌', async () => {
      const settings = new LocalDaemonSettings({
        host: '127.0.0.1',
        port: testPort,
        token: 'correct_token'
      });

      const handler = jest.fn();
      daemon = new LocalMessageDaemon(settings, handler);
      await daemon.start();

      // 发送带有错误令牌的请求
      const response = await new Promise((resolve, reject) => {
        const client = net.createConnection(
          { host: '127.0.0.1', port: testPort },
          () => {
            const request = {
              token: 'wrong_token',
              method: 'test_method',
              params: {},
              credential_name: 'default'
            };
            client.write(Buffer.from(JSON.stringify(request) + '\n', 'utf-8'));
          }
        );

        let data = '';
        client.on('data', (chunk) => {
          data += chunk.toString('utf-8');
        });

        client.on('end', () => {
          try {
            const response = JSON.parse(data.trim());
            resolve(response);
          } catch (e) {
            reject(e);
          }
        });

        client.on('error', reject);
      });

      expect(response.ok).toBe(false);
      expect(response.error.message).toBe('Unauthorized local daemon request');
      expect(handler).not.toHaveBeenCalled();

      await daemon.close();
    });

    test('应该拒绝无效的 JSON', async () => {
      const settings = new LocalDaemonSettings({
        host: '127.0.0.1',
        port: testPort,
        token: 'test_token'
      });

      const handler = jest.fn();
      daemon = new LocalMessageDaemon(settings, handler);
      await daemon.start();

      // 发送无效的 JSON
      const response = await new Promise((resolve, reject) => {
        const client = net.createConnection(
          { host: '127.0.0.1', port: testPort },
          () => {
            client.write(Buffer.from('invalid json\n', 'utf-8'));
          }
        );

        let data = '';
        client.on('data', (chunk) => {
          data += chunk.toString('utf-8');
        });

        client.on('end', () => {
          try {
            const response = JSON.parse(data.trim());
            resolve(response);
          } catch (e) {
            reject(e);
          }
        });

        client.on('error', reject);
      });

      expect(response.ok).toBe(false);
      expect(response.error.message).toBe('Invalid local daemon JSON request');
      expect(handler).not.toHaveBeenCalled();

      await daemon.close();
    });

    test('应该拒绝缺少 method 的请求', async () => {
      const settings = new LocalDaemonSettings({
        host: '127.0.0.1',
        port: testPort,
        token: 'test_token'
      });

      const handler = jest.fn();
      daemon = new LocalMessageDaemon(settings, handler);
      await daemon.start();

      // 发送缺少 method 的请求
      const response = await new Promise((resolve, reject) => {
        const client = net.createConnection(
          { host: '127.0.0.1', port: testPort },
          () => {
            const request = {
              token: 'test_token',
              params: {},
              credential_name: 'default'
            };
            client.write(Buffer.from(JSON.stringify(request) + '\n', 'utf-8'));
          }
        );

        let data = '';
        client.on('data', (chunk) => {
          data += chunk.toString('utf-8');
        });

        client.on('end', () => {
          try {
            const response = JSON.parse(data.trim());
            resolve(response);
          } catch (e) {
            reject(e);
          }
        });

        client.on('error', reject);
      });

      expect(response.ok).toBe(false);
      expect(response.error.message).toBe('Local daemon request missing method');
      expect(handler).not.toHaveBeenCalled();

      await daemon.close();
    });

    test('应该处理 handler 抛出的错误', async () => {
      const settings = new LocalDaemonSettings({
        host: '127.0.0.1',
        port: testPort,
        token: 'test_token'
      });

      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
      daemon = new LocalMessageDaemon(settings, handler);
      await daemon.start();

      // 发送请求
      const response = await new Promise((resolve, reject) => {
        const client = net.createConnection(
          { host: '127.0.0.1', port: testPort },
          () => {
            const request = {
              token: 'test_token',
              method: 'test_method',
              params: {},
              credential_name: 'default'
            };
            client.write(Buffer.from(JSON.stringify(request) + '\n', 'utf-8'));
          }
        );

        let data = '';
        client.on('data', (chunk) => {
          data += chunk.toString('utf-8');
        });

        client.on('end', () => {
          try {
            const response = JSON.parse(data.trim());
            resolve(response);
          } catch (e) {
            reject(e);
          }
        });

        client.on('error', reject);
      });

      expect(response.ok).toBe(false);
      expect(response.error.message).toBe('Handler error');

      await daemon.close();
    });
  });

  describe('call_local_daemon 函数', () => {
    let daemon;
    let testPort;
    let tempDir;
    let originalEnv;

    beforeEach(() => {
      testPort = 19500 + Math.floor(Math.random() * 500);
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'message-daemon-call-'));
      originalEnv = process.env.AWIKI_DATA_DIR;
      process.env.AWIKI_DATA_DIR = tempDir;

      // 创建 settings.json
      const configDir = path.join(tempDir, 'config');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, 'settings.json'),
        JSON.stringify({
          message_transport: {
            local_daemon_host: '127.0.0.1',
            local_daemon_port: testPort,
            local_daemon_token: 'test_token'
          }
        }, null, 2)
      );
    });

    afterEach(async () => {
      if (daemon) {
        await daemon.close();
        daemon = null;
      }
      if (originalEnv) {
        process.env.AWIKI_DATA_DIR = originalEnv;
      } else {
        delete process.env.AWIKI_DATA_DIR;
      }
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // 忽略清理错误
      }
    });

    test('当守护进程未运行时应该抛出错误', async () => {
      await expect(call_local_daemon('test_method', {})).rejects.toThrow(
        'Local message daemon is unavailable'
      );
    });

    test('当令牌缺失时应该抛出错误', async () => {
      // 创建没有令牌的配置
      fs.writeFileSync(
        path.join(tempDir, 'config', 'settings.json'),
        JSON.stringify({
          message_transport: {
            local_daemon_host: '127.0.0.1',
            local_daemon_port: testPort
          }
        }, null, 2)
      );

      await expect(call_local_daemon('test_method', {})).rejects.toThrow(
        'Local message daemon token is missing'
      );
    });

    test('应该成功调用守护进程', async () => {
      const settings = new LocalDaemonSettings({
        host: '127.0.0.1',
        port: testPort,
        token: 'test_token'
      });

      const handler = jest.fn().mockResolvedValue({ data: 'response' });
      daemon = new LocalMessageDaemon(settings, handler);
      await daemon.start();

      const result = await call_local_daemon(
        'test_method',
        { param: 'value' },
        { credential_name: 'test_cred' }
      );

      expect(result.data).toBe('response');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('test_method', { param: 'value' }, 'test_cred');
    });
  });
});
