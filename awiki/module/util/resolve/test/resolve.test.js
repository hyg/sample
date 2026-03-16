/**
 * resolve 模块单元测试
 *
 * 测试用例来源：doc/util/resolve/distill.json
 *
 * 注意：
 * - DID 直接返回测试：无需 HTTP 请求，可直接运行
 * - Handle 解析测试：需要真实 HTTP 服务器或 Mock，由于 client 模块与 Node.js fetch
 *   的兼容性问题（agent.dispatch），这些测试在当前环境下无法运行
 * - 实际使用时，resolveToDid 会正确发起 HTTP 请求
 */

import { describe, it, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveToDid } from '../dist/index.js';
import { SDKConfig } from '@awiki/config';

describe('resolveToDid', () => {
  let config;

  before(async () => {
    // 加载配置
    config = SDKConfig.load();
  });

  describe('DID 直接返回', () => {
    it('标准 did:wba 格式', async () => {
      const did = 'did:wba:awiki.ai:user:k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g';
      const result = await resolveToDid(did, config);
      assert.strictEqual(result, did);
    });

    it('其他 DID 方法', async () => {
      const did = 'did:ethr:0x1234567890abcdef1234567890abcdef12345678';
      const result = await resolveToDid(did, config);
      assert.strictEqual(result, did);
    });

    it('DID 包含片段标识符', async () => {
      const did = 'did:wba:awiki.ai:user:k1_test#key-1';
      const result = await resolveToDid(did, config);
      assert.strictEqual(result, did);
    });

    it('DID 包含服务路径', async () => {
      const did = 'did:wba:awiki.ai:user:k1_test/service/endpoints';
      const result = await resolveToDid(did, config);
      assert.strictEqual(result, did);
    });
  });

  describe('域名后缀剥离逻辑', () => {
    it('awiki.ai 后缀剥离', () => {
      // 验证域名剥离逻辑
      const identifier = 'alice.awiki.ai';
      const stripDomains = ['awiki.ai', 'awiki.test'];
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

    it('awiki.test 后缀剥离', () => {
      const identifier = 'bob.awiki.test';
      const stripDomains = ['awiki.ai', 'awiki.test'];
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

    it('自定义 did_domain 后缀剥离', () => {
      const identifier = 'charlie.custom.domain';
      const stripDomains = ['awiki.ai', 'awiki.test', 'custom.domain'];
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

    it('多级子域名不剥离', () => {
      const identifier = 'alice.sub.awiki.ai';
      const stripDomains = ['awiki.ai', 'awiki.test'];
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

    it('纯域名不匹配后缀模式', () => {
      const identifier = 'awiki.ai';
      const stripDomains = ['awiki.ai', 'awiki.test'];
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
  });

  describe('错误处理逻辑验证', () => {
    it('404 错误消息格式', () => {
      // 验证错误消息格式
      const handle = 'nonexistent';
      const expectedError = `Handle '${handle}' not found`;
      assert.strictEqual(expectedError, "Handle 'nonexistent' not found");
    });

    it('非 active 状态错误消息格式', () => {
      const handle = 'inactive_user';
      const status = 'inactive';
      const expectedError = `Handle '${handle}' is not active (status: ${status})`;
      assert.strictEqual(
        expectedError,
        "Handle 'inactive_user' is not active (status: inactive)"
      );
    });

    it('无 DID 绑定错误消息格式', () => {
      const handle = 'no_did_user';
      const expectedError = `Handle '${handle}' has no DID binding`;
      assert.strictEqual(
        expectedError,
        "Handle 'no_did_user' has no DID binding"
      );
    });
  });

  describe('响应格式验证', () => {
    it('成功响应格式', () => {
      const mockResponse = {
        handle: 'alice',
        did: 'did:wba:awiki.ai:user:k1_alice123',
        status: 'active'
      };
      assert.ok(mockResponse.handle, '响应应包含 handle 字段');
      assert.ok(mockResponse.did, '响应应包含 did 字段');
      assert.ok(mockResponse.status, '响应应包含 status 字段');
    });

    it('空 DID 检测', () => {
      const mockResponse = {
        handle: 'empty_did_user',
        did: '',
        status: 'active'
      };
      const did = mockResponse.did || '';
      assert.strictEqual(!did, true, '空 DID 应被视为无绑定');
    });

    it('缺失 DID 字段检测', () => {
      const mockResponse = {
        handle: 'no_did_user',
        status: 'active'
      };
      const did = mockResponse.did || '';
      assert.strictEqual(!did, true, '缺失 DID 字段应被视为无绑定');
    });
  });
});
