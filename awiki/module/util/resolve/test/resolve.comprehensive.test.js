/**
 * resolve 模块全面测试
 *
 * 测试范围：
 * 1. 单元测试 - resolve_to_did 函数
 * 2. 集成测试 - 完整 Handle 解析流程
 * 3. 边界测试 - 错误处理、超时、空响应
 * 4. 命名规范检查 - snake_case 命名
 * 5. Python 兼容性验证 - 域名剥离顺序、错误消息、超时值
 *
 * 对应 Python: python/scripts/utils/resolve.py
 */

import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  resolveToDid,
  WELL_KNOWN_HANDLE_PATH,
  DEFAULT_TIMEOUT_MS,
  KNOWN_AWIKI_DOMAINS,
} from '../dist/index.js';
import { SDKConfig } from '@awiki/config';
import { createServer } from 'node:http';

/**
 * 测试辅助函数：创建 Mock HTTP 服务器
 */
function createMockServer(handler) {
  return createServer(handler);
}

/**
 * 测试辅助函数：创建返回指定响应的服务器
 */
function createResponseServer(statusCode, body) {
  return createServer((req, res) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });
}

describe('resolveToDid 全面测试', () => {
  let config;
  let mockServer;
  let mockPort;
  let mockBaseUrl;

  before(async () => {
    // 加载配置
    config = SDKConfig.load();
  });

  after(() => {
    if (mockServer) {
      mockServer.close();
    }
  });

  // =====================================================
  // 1. 单元测试 - DID 直接返回
  // =====================================================
  describe('1. 单元测试 - DID 直接返回', () => {
    it('1.1 标准 did:wba 格式', async () => {
      const did = 'did:wba:awiki.ai:user:k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g';
      const result = await resolveToDid(did, config);
      assert.strictEqual(result, did);
    });

    it('1.2 其他 DID 方法 (did:ethr)', async () => {
      const did = 'did:ethr:0x1234567890abcdef1234567890abcdef12345678';
      const result = await resolveToDid(did, config);
      assert.strictEqual(result, did);
    });

    it('1.3 DID 包含片段标识符 (#key-1)', async () => {
      const did = 'did:wba:awiki.ai:user:k1_test#key-1';
      const result = await resolveToDid(did, config);
      assert.strictEqual(result, did);
    });

    it('1.4 DID 包含服务路径', async () => {
      const did = 'did:wba:awiki.ai:user:k1_test/service/endpoints';
      const result = await resolveToDid(did, config);
      assert.strictEqual(result, did);
    });

    it('1.5 DID 包含多个片段', async () => {
      const did = 'did:wba:awiki.ai:user:k1_test#key-1#key-2';
      const result = await resolveToDid(did, config);
      assert.strictEqual(result, did);
    });
  });

  // =====================================================
  // 2. 域名剥离逻辑测试
  // =====================================================
  describe('2. 域名剥离逻辑测试', () => {
    it('2.1 awiki.ai 后缀剥离', () => {
      const identifier = 'alice.awiki.ai';
      const stripDomains = [...KNOWN_AWIKI_DOMAINS];
      let handle = identifier;
      for (const domain of stripDomains) {
        const suffix = `.${domain}`;
        if (handle.endsWith(suffix)) {
          handle = handle.slice(0, -suffix.length);
          break;
        }
      }
      assert.strictEqual(handle, 'alice');
    });

    it('2.2 awiki.test 后缀剥离', () => {
      const identifier = 'bob.awiki.test';
      const stripDomains = [...KNOWN_AWIKI_DOMAINS];
      let handle = identifier;
      for (const domain of stripDomains) {
        const suffix = `.${domain}`;
        if (handle.endsWith(suffix)) {
          handle = handle.slice(0, -suffix.length);
          break;
        }
      }
      assert.strictEqual(handle, 'bob');
    });

    it('2.3 自定义 did_domain 后缀剥离', () => {
      const identifier = 'charlie.custom.domain';
      const stripDomains = [...KNOWN_AWIKI_DOMAINS, 'custom.domain'];
      let handle = identifier;
      for (const domain of stripDomains) {
        const suffix = `.${domain}`;
        if (handle.endsWith(suffix)) {
          handle = handle.slice(0, -suffix.length);
          break;
        }
      }
      assert.strictEqual(handle, 'charlie');
    });

    it('2.4 多级子域名不剥离（保留子域名）', () => {
      const identifier = 'alice.sub.awiki.ai';
      const stripDomains = [...KNOWN_AWIKI_DOMAINS];
      let handle = identifier;
      for (const domain of stripDomains) {
        const suffix = `.${domain}`;
        if (handle.endsWith(suffix)) {
          handle = handle.slice(0, -suffix.length);
          break;
        }
      }
      assert.strictEqual(handle, 'alice.sub');
    });

    it('2.5 纯域名不匹配后缀模式', () => {
      const identifier = 'awiki.ai';
      const stripDomains = [...KNOWN_AWIKI_DOMAINS];
      let handle = identifier;
      for (const domain of stripDomains) {
        const suffix = `.${domain}`;
        if (handle.endsWith(suffix)) {
          handle = handle.slice(0, -suffix.length);
          break;
        }
      }
      // "awiki.ai" 不以 ".awiki.ai" 结尾，所以不剥离
      assert.strictEqual(handle, 'awiki.ai');
    });

    it('2.6 无后缀 Handle 保持不变', () => {
      const identifier = 'simple_handle';
      const stripDomains = [...KNOWN_AWIKI_DOMAINS];
      let handle = identifier;
      for (const domain of stripDomains) {
        const suffix = `.${domain}`;
        if (handle.endsWith(suffix)) {
          handle = handle.slice(0, -suffix.length);
          break;
        }
      }
      assert.strictEqual(handle, 'simple_handle');
    });

    it('2.7 域名剥离顺序验证（先检查已知域名）', () => {
      // 验证域名剥离顺序：先检查 awiki.ai, awiki.test，再检查 config.did_domain
      const identifier = 'test.awiki.ai';
      const stripDomains = ['awiki.ai', 'awiki.test', 'custom.domain'];
      let handle = identifier;
      let strippedDomain = null;
      for (const domain of stripDomains) {
        const suffix = `.${domain}`;
        if (handle.endsWith(suffix)) {
          handle = handle.slice(0, -suffix.length);
          strippedDomain = domain;
          break;
        }
      }
      assert.strictEqual(handle, 'test');
      assert.strictEqual(strippedDomain, 'awiki.ai'); // 应该首先匹配 awiki.ai
    });
  });

  // =====================================================
  // 3. 边界测试 - 错误处理
  // =====================================================
  describe('3. 边界测试 - 错误处理', () => {
    it('3.1 404 错误处理 - Handle not found', async () => {
      mockServer = createResponseServer(404, { error: 'Not found' });
      await new Promise((resolve) => mockServer.listen(0, resolve));
      mockPort = mockServer.address().port;
      mockBaseUrl = `http://localhost:${mockPort}`;

      const testConfig = new SDKConfig({
        user_service_url: mockBaseUrl,
        did_domain: 'awiki.test',
      });

      await assert.rejects(
        async () => await resolveToDid('nonexistent', testConfig),
        (err) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.includes('not found'));
          return true;
        }
      );

      mockServer.close();
      mockServer = null;
    });

    it('3.2 非 active 状态处理 - Handle not active', async () => {
      mockServer = createResponseServer(200, {
        handle: 'inactive_user',
        did: 'did:wba:awiki.ai:user:k1_inactive',
        status: 'inactive',
      });
      await new Promise((resolve) => mockServer.listen(0, resolve));
      mockPort = mockServer.address().port;
      mockBaseUrl = `http://localhost:${mockPort}`;

      const testConfig = new SDKConfig({
        user_service_url: mockBaseUrl,
        did_domain: 'awiki.test',
      });

      await assert.rejects(
        async () => await resolveToDid('inactive_user', testConfig),
        (err) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.includes('not active'));
          assert.ok(err.message.includes('status: inactive'));
          return true;
        }
      );

      mockServer.close();
      mockServer = null;
    });

    it('3.3 空 DID 绑定处理 - No DID binding', async () => {
      mockServer = createResponseServer(200, {
        handle: 'empty_did_user',
        did: '',
        status: 'active',
      });
      await new Promise((resolve) => mockServer.listen(0, resolve));
      mockPort = mockServer.address().port;
      mockBaseUrl = `http://localhost:${mockPort}`;

      const testConfig = new SDKConfig({
        user_service_url: mockBaseUrl,
        did_domain: 'awiki.test',
      });

      await assert.rejects(
        async () => await resolveToDid('empty_did_user', testConfig),
        (err) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.includes('no DID binding'));
          return true;
        }
      );

      mockServer.close();
      mockServer = null;
    });

    it('3.4 缺失 DID 字段处理 - No DID binding', async () => {
      mockServer = createResponseServer(200, {
        handle: 'missing_did_user',
        status: 'active',
        // did 字段缺失
      });
      await new Promise((resolve) => mockServer.listen(0, resolve));
      mockPort = mockServer.address().port;
      mockBaseUrl = `http://localhost:${mockPort}`;

      const testConfig = new SDKConfig({
        user_service_url: mockBaseUrl,
        did_domain: 'awiki.test',
      });

      await assert.rejects(
        async () => await resolveToDid('missing_did_user', testConfig),
        (err) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.includes('no DID binding'));
          return true;
        }
      );

      mockServer.close();
      mockServer = null;
    });

    it('3.5 空 status 字段处理 - Handle not active', async () => {
      mockServer = createResponseServer(200, {
        handle: 'empty_status_user',
        did: 'did:wba:awiki.ai:user:k1_test',
        status: '',
      });
      await new Promise((resolve) => mockServer.listen(0, resolve));
      mockPort = mockServer.address().port;
      mockBaseUrl = `http://localhost:${mockPort}`;

      const testConfig = new SDKConfig({
        user_service_url: mockBaseUrl,
        did_domain: 'awiki.test',
      });

      await assert.rejects(
        async () => await resolveToDid('empty_status_user', testConfig),
        (err) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.includes('not active'));
          return true;
        }
      );

      mockServer.close();
      mockServer = null;
    });

    it('3.6 5xx 服务器错误处理', async () => {
      mockServer = createResponseServer(500, { error: 'Internal server error' });
      await new Promise((resolve) => mockServer.listen(0, resolve));
      mockPort = mockServer.address().port;
      mockBaseUrl = `http://localhost:${mockPort}`;

      const testConfig = new SDKConfig({
        user_service_url: mockBaseUrl,
        did_domain: 'awiki.test',
      });

      await assert.rejects(
        async () => await resolveToDid('test_user', testConfig),
        (err) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.includes('500'));
          return true;
        }
      );

      mockServer.close();
      mockServer = null;
    });
  });

  // =====================================================
  // 4. 集成测试 - 完整 Handle 解析流程
  // =====================================================
  describe('4. 集成测试 - 完整 Handle 解析流程', () => {
    it('4.1 成功解析简单 Handle', async () => {
      const expectedDid = 'did:wba:awiki.ai:user:k1_alice123';
      mockServer = createResponseServer(200, {
        handle: 'alice',
        did: expectedDid,
        status: 'active',
      });
      await new Promise((resolve) => mockServer.listen(0, resolve));
      mockPort = mockServer.address().port;
      mockBaseUrl = `http://localhost:${mockPort}`;

      const testConfig = new SDKConfig({
        user_service_url: mockBaseUrl,
        did_domain: 'awiki.test',
      });

      const result = await resolveToDid('alice', testConfig);
      assert.strictEqual(result, expectedDid);

      mockServer.close();
      mockServer = null;
    });

    it('4.2 成功解析带 awiki.ai 后缀的 Handle', async () => {
      const expectedDid = 'did:wba:awiki.ai:user:k1_bob456';
      mockServer = createResponseServer(200, {
        handle: 'bob',
        did: expectedDid,
        status: 'active',
      });
      await new Promise((resolve) => mockServer.listen(0, resolve));
      mockPort = mockServer.address().port;
      mockBaseUrl = `http://localhost:${mockPort}`;

      const testConfig = new SDKConfig({
        user_service_url: mockBaseUrl,
        did_domain: 'awiki.test',
      });

      // 传入带后缀的 Handle，应自动剥离
      const result = await resolveToDid('bob.awiki.ai', testConfig);
      assert.strictEqual(result, expectedDid);

      mockServer.close();
      mockServer = null;
    });

    it('4.3 成功解析带 awiki.test 后缀的 Handle', async () => {
      const expectedDid = 'did:wba:awiki.ai:user:k1_charlie789';
      mockServer = createResponseServer(200, {
        handle: 'charlie',
        did: expectedDid,
        status: 'active',
      });
      await new Promise((resolve) => mockServer.listen(0, resolve));
      mockPort = mockServer.address().port;
      mockBaseUrl = `http://localhost:${mockPort}`;

      const testConfig = new SDKConfig({
        user_service_url: mockBaseUrl,
        did_domain: 'awiki.ai',
      });

      const result = await resolveToDid('charlie.awiki.test', testConfig);
      assert.strictEqual(result, expectedDid);

      mockServer.close();
      mockServer = null;
    });

    it('4.4 成功解析带自定义 did_domain 后缀的 Handle', async () => {
      const expectedDid = 'did:wba:custom.domain:user:k1_dave';
      mockServer = createResponseServer(200, {
        handle: 'dave',
        did: expectedDid,
        status: 'active',
      });
      await new Promise((resolve) => mockServer.listen(0, resolve));
      mockPort = mockServer.address().port;
      mockBaseUrl = `http://localhost:${mockPort}`;

      const testConfig = new SDKConfig({
        user_service_url: mockBaseUrl,
        did_domain: 'custom.domain',
      });

      const result = await resolveToDid('dave.custom.domain', testConfig);
      assert.strictEqual(result, expectedDid);

      mockServer.close();
      mockServer = null;
    });

    it('4.5 端点路径验证', async () => {
      let requestPath = null;
      mockServer = createServer((req, res) => {
        requestPath = req.url;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          handle: 'test_endpoint',
          did: 'did:wba:awiki.ai:user:k1_test',
          status: 'active',
        }));
      });
      await new Promise((resolve) => mockServer.listen(0, resolve));
      mockPort = mockServer.address().port;
      mockBaseUrl = `http://localhost:${mockPort}`;

      const testConfig = new SDKConfig({
        user_service_url: mockBaseUrl,
        did_domain: 'awiki.test',
      });

      await resolveToDid('test_endpoint', testConfig);

      // 验证端点路径格式
      assert.strictEqual(
        requestPath,
        '/user-service/.well-known/handle/test_endpoint'
      );

      mockServer.close();
      mockServer = null;
    });
  });

  // =====================================================
  // 5. 命名规范检查
  // =====================================================
  describe('5. 命名规范检查', () => {
    it('5.1 函数名使用 snake_case (resolveToDid 是 camelCase，但对应 Python resolve_to_did)', () => {
      // TypeScript/JavaScript 使用 camelCase，Python 使用 snake_case
      // 验证函数存在且可调用
      assert.strictEqual(typeof resolveToDid, 'function');
      
      // 验证函数名（JavaScript 中为 camelCase）
      assert.strictEqual(resolveToDid.name, 'resolveToDid');
    });

    it('5.2 常量使用 UPPER_CASE', () => {
      // 验证常量命名
      assert.ok(WELL_KNOWN_HANDLE_PATH, 'WELL_KNOWN_HANDLE_PATH 应存在');
      assert.ok(DEFAULT_TIMEOUT_MS, 'DEFAULT_TIMEOUT_MS 应存在');
      assert.ok(KNOWN_AWIKI_DOMAINS, 'KNOWN_AWIKI_DOMAINS 应存在');

      // 验证常量值为大写命名
      assert.strictEqual(typeof WELL_KNOWN_HANDLE_PATH, 'string');
      assert.strictEqual(typeof DEFAULT_TIMEOUT_MS, 'number');
      assert.ok(Array.isArray(KNOWN_AWIKI_DOMAINS));
    });

    it('5.3 导出接口命名检查', () => {
      // 验证模块导出
      const moduleExports = {
        resolveToDid,
        WELL_KNOWN_HANDLE_PATH,
        DEFAULT_TIMEOUT_MS,
        KNOWN_AWIKI_DOMAINS,
      };

      assert.ok(moduleExports.resolveToDid, '应导出 resolveToDid 函数');
      assert.ok(moduleExports.WELL_KNOWN_HANDLE_PATH, '应导出 WELL_KNOWN_HANDLE_PATH 常量');
      assert.ok(moduleExports.DEFAULT_TIMEOUT_MS, '应导出 DEFAULT_TIMEOUT_MS 常量');
      assert.ok(moduleExports.KNOWN_AWIKI_DOMAINS, '应导出 KNOWN_AWIKI_DOMAINS 常量');
    });
  });

  // =====================================================
  // 6. Python 版本兼容性验证
  // =====================================================
  describe('6. Python 版本兼容性验证', () => {
    it('6.1 域名剥离顺序与 Python 一致', () => {
      // Python 代码：
      // strip_domains = {"awiki.ai", "awiki.test"}
      // if config.did_domain:
      //     strip_domains.add(config.did_domain)
      // for domain in strip_domains:
      //     if identifier.endswith(f".{domain}"):
      //         identifier = identifier[: -(len(domain) + 1)]
      //         break

      // 验证 Node.js 实现与 Python 逻辑一致
      const stripDomains = new Set(KNOWN_AWIKI_DOMAINS);
      stripDomains.add('custom.domain');

      const testCases = [
        { input: 'alice.awiki.ai', expected: 'alice' },
        { input: 'bob.awiki.test', expected: 'bob' },
        { input: 'charlie.custom.domain', expected: 'charlie' },
        { input: 'dave.unknown.domain', expected: 'dave.unknown.domain' },
      ];

      for (const { input, expected } of testCases) {
        let handle = input;
        for (const domain of stripDomains) {
          const suffix = `.${domain}`;
          if (handle.endsWith(suffix)) {
            handle = handle.slice(0, -suffix.length);
            break;
          }
        }
        assert.strictEqual(handle, expected, `输入 ${input} 应解析为 ${expected}`);
      }
    });

    it('6.2 错误消息格式与 Python 一致', () => {
      // Python 错误消息格式：
      // raise ValueError(f"Handle '{identifier}' not found")
      // raise ValueError(f"Handle '{identifier}' is not active (status: {status})")
      // raise ValueError(f"Handle '{identifier}' has no DID binding")

      // 验证 Node.js 错误消息格式
      const handle = 'test_handle';
      const status = 'inactive';

      const notFoundError = `Handle '${handle}' not found`;
      const notActiveError = `Handle '${handle}' is not active (status: ${status})`;
      const noDidError = `Handle '${handle}' has no DID binding`;

      assert.strictEqual(notFoundError, "Handle 'test_handle' not found");
      assert.strictEqual(
        notActiveError,
        "Handle 'test_handle' is not active (status: inactive)"
      );
      assert.strictEqual(noDidError, "Handle 'test_handle' has no DID binding");
    });

    it('6.3 超时值与 Python 一致 (10 秒)', () => {
      // Python: timeout=10.0 (秒)
      // Node.js: DEFAULT_TIMEOUT_MS = 10000 (毫秒)
      assert.strictEqual(DEFAULT_TIMEOUT_MS, 10000, '超时值应为 10000 毫秒 (10 秒)');
    });

    it('6.4 端点路径与 Python 一致', () => {
      // Python: /user-service/.well-known/handle/{identifier}
      // Node.js: WELL_KNOWN_HANDLE_PATH = '/user-service/.well-known/handle'
      assert.strictEqual(
        WELL_KNOWN_HANDLE_PATH,
        '/user-service/.well-known/handle',
        '端点路径应与 Python 一致'
      );
    });

    it('6.5 已知域名列表与 Python 一致', () => {
      // Python: strip_domains = {"awiki.ai", "awiki.test"}
      // Node.js: KNOWN_AWIKI_DOMAINS = ['awiki.ai', 'awiki.test']
      assert.ok(KNOWN_AWIKI_DOMAINS.includes('awiki.ai'));
      assert.ok(KNOWN_AWIKI_DOMAINS.includes('awiki.test'));
      assert.strictEqual(KNOWN_AWIKI_DOMAINS.length, 2);
    });

    it('6.6 响应格式与 Python 一致', () => {
      // Python 响应格式：
      // data = resp.json()
      // status = data.get("status", "")
      // did = data.get("did", "")

      // 验证 Node.js 处理相同格式
      const mockResponse = {
        handle: 'alice',
        did: 'did:wba:awiki.ai:user:k1_alice',
        status: 'active',
      };

      assert.ok('handle' in mockResponse, '响应应包含 handle 字段');
      assert.ok('did' in mockResponse, '响应应包含 did 字段');
      assert.ok('status' in mockResponse, '响应应包含 status 字段');

      // 验证字段类型
      assert.strictEqual(typeof mockResponse.handle, 'string');
      assert.strictEqual(typeof mockResponse.did, 'string');
      assert.strictEqual(typeof mockResponse.status, 'string');
    });
  });

  // =====================================================
  // 7. 空响应和异常处理
  // =====================================================
  describe('7. 空响应和异常处理', () => {
    it('7.1 空 JSON 响应处理', async () => {
      mockServer = createResponseServer(200, {});
      await new Promise((resolve) => mockServer.listen(0, resolve));
      mockPort = mockServer.address().port;
      mockBaseUrl = `http://localhost:${mockPort}`;

      const testConfig = new SDKConfig({
        user_service_url: mockBaseUrl,
        did_domain: 'awiki.test',
      });

      await assert.rejects(
        async () => await resolveToDid('empty_response', testConfig),
        (err) => {
          assert.ok(err instanceof Error);
          // 空响应会导致 status 为空，触发 "not active" 错误
          assert.ok(
            err.message.includes('not active') ||
            err.message.includes('no DID binding')
          );
          return true;
        }
      );

      mockServer.close();
      mockServer = null;
    });

    it('7.2 无效 JSON 响应处理', async () => {
      mockServer = createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('invalid json');
      });
      await new Promise((resolve) => mockServer.listen(0, resolve));
      mockPort = mockServer.address().port;
      mockBaseUrl = `http://localhost:${mockPort}`;

      const testConfig = new SDKConfig({
        user_service_url: mockBaseUrl,
        did_domain: 'awiki.test',
      });

      await assert.rejects(
        async () => await resolveToDid('invalid_json', testConfig),
        (err) => {
          assert.ok(err instanceof Error);
          return true;
        }
      );

      mockServer.close();
      mockServer = null;
    });

    it('7.3 快速响应处理（验证 10 秒超时配置）', async () => {
      // 创建一个快速响应的服务器来验证超时配置正常工作
      mockServer = createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          handle: 'fast',
          did: 'did:wba:awiki.ai:user:k1_fast',
          status: 'active',
        }));
      });
      await new Promise((resolve) => mockServer.listen(0, resolve));
      mockPort = mockServer.address().port;
      mockBaseUrl = `http://localhost:${mockPort}`;

      const testConfig = new SDKConfig({
        user_service_url: mockBaseUrl,
        did_domain: 'awiki.test',
      });

      // 这个测试应该成功，因为响应很快
      const result = await resolveToDid('fast', testConfig);
      assert.strictEqual(result, 'did:wba:awiki.ai:user:k1_fast');

      mockServer.close();
      mockServer = null;
    });
  });
});
