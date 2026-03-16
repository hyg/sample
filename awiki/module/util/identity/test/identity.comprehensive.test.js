/**
 * DID Identity 模块全面测试
 *
 * 基于 python/scripts/utils/identity.py 的测试用例移植
 *
 * 测试范围：
 * 1. 单元测试 - DIDIdentity 类、create_identity 函数、load_private_key 函数
 * 2. 集成测试 - 完整身份创建流程、DID 文档验证、密钥对验证
 * 3. 边界测试 - 空参数处理、自定义 path_prefix、自定义 services、无效 PEM 处理
 * 4. 命名规范检查 - 验证 snake_case 命名与 Python 版本一致
 * 5. Python 版本兼容性 - DID 格式、path_prefix 默认值、字段名称、challenge 生成逻辑
 */

import { strict as assert } from 'assert';
import {
  DIDIdentity,
  create_identity,
  load_private_key,
} from '../dist/index.js';

// ============================================================================
// 测试计数器
// ============================================================================
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failedTests++;
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`  ✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// 第一部分：DIDIdentity 类测试
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('第一部分：DIDIdentity 类测试');
console.log('='.repeat(60));

// TC-001: 构造函数参数验证 - 必需字段
test('DIDIdentity 构造函数 - 必需字段验证', () => {
  const identity = new DIDIdentity({
    did: 'did:wba:awiki.ai:user:k1_test',
    did_document: { id: 'did:wba:awiki.ai:user:k1_test' },
    private_key_pem: Buffer.from('test'),
    public_key_pem: Buffer.from('test'),
  });

  assert.strictEqual(identity.did, 'did:wba:awiki.ai:user:k1_test');
  assert.strictEqual(identity.did_document.id, 'did:wba:awiki.ai:user:k1_test');
  assert.ok(Buffer.isBuffer(identity.private_key_pem));
  assert.ok(Buffer.isBuffer(identity.public_key_pem));
});

// TC-002: 构造函数参数验证 - 可选字段默认值
test('DIDIdentity 构造函数 - 可选字段默认值', () => {
  const identity = new DIDIdentity({
    did: 'did:wba:awiki.ai:user:k1_test',
    did_document: { id: 'did:wba:awiki.ai:user:k1_test' },
    private_key_pem: Buffer.from('test'),
    public_key_pem: Buffer.from('test'),
  });

  assert.strictEqual(identity.user_id, null);
  assert.strictEqual(identity.jwt_token, null);
  assert.strictEqual(identity.e2ee_signing_private_pem, null);
  assert.strictEqual(identity.e2ee_signing_public_pem, null);
  assert.strictEqual(identity.e2ee_agreement_private_pem, null);
  assert.strictEqual(identity.e2ee_agreement_public_pem, null);
});

// TC-003: 构造函数参数验证 - 可选字段自定义值
test('DIDIdentity 构造函数 - 可选字段自定义值', () => {
  const identity = new DIDIdentity({
    did: 'did:wba:awiki.ai:user:k1_test',
    did_document: { id: 'did:wba:awiki.ai:user:k1_test' },
    private_key_pem: Buffer.from('test'),
    public_key_pem: Buffer.from('test'),
    user_id: '77ec3f44-f94f-4c19-b315-49c0f0bf4a37',
    jwt_token: 'eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ...',
    e2ee_signing_private_pem: Buffer.from('e2ee_signing_private'),
    e2ee_signing_public_pem: Buffer.from('e2ee_signing_public'),
    e2ee_agreement_private_pem: Buffer.from('e2ee_agreement_private'),
    e2ee_agreement_public_pem: Buffer.from('e2ee_agreement_public'),
  });

  assert.strictEqual(identity.user_id, '77ec3f44-f94f-4c19-b315-49c0f0bf4a37');
  assert.strictEqual(identity.jwt_token, 'eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ...');
  assert.ok(identity.e2ee_signing_private_pem);
  assert.ok(identity.e2ee_signing_public_pem);
  assert.ok(identity.e2ee_agreement_private_pem);
  assert.ok(identity.e2ee_agreement_public_pem);
});

// TC-004: unique_id getter - 从 DID 提取
test('DIDIdentity.unique_id getter - 从 DID 提取', () => {
  const identity = new DIDIdentity({
    did: 'did:wba:awiki.ai:user:k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g',
    did_document: { id: 'did:wba:awiki.ai:user:k1_test' },
    private_key_pem: Buffer.from('test'),
    public_key_pem: Buffer.from('test'),
  });

  assert.strictEqual(
    identity.unique_id,
    'k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g',
    'unique_id 应为 DID 最后一段'
  );
});

// TC-005: unique_id getter - 不同 DID 格式
test('DIDIdentity.unique_id getter - 不同 DID 格式', () => {
  const testCases = [
    {
      did: 'did:wba:localhost:user:k1_test123',
      expected: 'k1_test123',
    },
    {
      did: 'did:wba:awiki.ai:agent:k1_xyz',
      expected: 'k1_xyz',
    },
    {
      did: 'did:wba:example.com:org:dept:user:k1_abc',
      expected: 'k1_abc',
    },
  ];

  for (const { did, expected } of testCases) {
    const identity = new DIDIdentity({
      did,
      did_document: { id: did },
      private_key_pem: Buffer.from('test'),
      public_key_pem: Buffer.from('test'),
    });
    assert.strictEqual(identity.unique_id, expected, `DID: ${did}`);
  }
});

// TC-006: get_private_key() 方法 - 返回 KeyObject
test('DIDIdentity.get_private_key() 方法 - 返回 KeyObject', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });
  const privateKey = identity.get_private_key();

  assert.strictEqual(privateKey.type, 'private');
  assert.strictEqual(privateKey.asymmetricKeyType, 'ec');
});

// TC-007: 字段可更新性
test('DIDIdentity 字段可更新性', () => {
  const identity = new DIDIdentity({
    did: 'did:wba:awiki.ai:user:k1_test',
    did_document: { id: 'did:wba:awiki.ai:user:k1_test' },
    private_key_pem: Buffer.from('test'),
    public_key_pem: Buffer.from('test'),
  });

  // 更新字段
  identity.user_id = 'new-user-id';
  identity.jwt_token = 'new-jwt-token';

  assert.strictEqual(identity.user_id, 'new-user-id');
  assert.strictEqual(identity.jwt_token, 'new-jwt-token');
});

// ============================================================================
// 第二部分：create_identity 函数测试
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('第二部分：create_identity 函数测试');
console.log('='.repeat(60));

// TC-008: 默认参数验证 - hostname
test('create_identity - 默认参数验证 (hostname)', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });

  assert.ok(identity.did.startsWith('did:wba:awiki.ai:user:k1_'));
  assert.strictEqual(identity.did_document.id, identity.did);
  assert.ok(identity.did_document.proof);
});

// TC-009: 默认参数验证 - path_prefix 默认为 ["user"]
test('create_identity - path_prefix 默认值为 ["user"]', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });

  assert.ok(
    identity.did.includes(':user:'),
    `DID 应包含 :user:，实际：${identity.did}`
  );
});

// TC-010: 默认参数验证 - proof_purpose 默认为 "authentication"
test('create_identity - proof_purpose 默认为 "authentication"', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });

  assert.strictEqual(
    identity.did_document.proof.proofPurpose,
    'authentication'
  );
});

// TC-011: challenge 自动生成
test('create_identity - challenge 自动生成', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });
  const proof = identity.did_document.proof;
  const challenge = proof.challenge;

  assert.ok(challenge, 'challenge 应存在');
  assert.strictEqual(challenge.length, 32, 'challenge 长度应为 32 (16 字节 hex)');
  assert.ok(/^[0-9a-f]+$/.test(challenge), 'challenge 应为有效 hex 字符串');
});

// TC-012: 自定义 path_prefix
test('create_identity - 自定义 path_prefix', () => {
  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['agent'],
  });

  assert.ok(
    identity.did.startsWith('did:wba:awiki.ai:agent:k1_'),
    `DID 应以 'did:wba:awiki.ai:agent:k1_' 开头，实际：${identity.did}`
  );
});

// TC-013: 自定义多级 path_prefix
test('create_identity - 自定义多级 path_prefix', () => {
  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['org', 'department', 'user'],
  });

  assert.ok(
    identity.did.includes('org:department:user'),
    `DID 应包含 'org:department:user'，实际：${identity.did}`
  );
});

// TC-014: 空 path_prefix
test('create_identity - 空 path_prefix', () => {
  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: [],
  });

  assert.ok(
    identity.did.startsWith('did:wba:awiki.ai:k1_'),
    `DID 应以 'did:wba:awiki.ai:k1_' 开头，实际：${identity.did}`
  );
});

// TC-015: 自定义 proof_purpose
test('create_identity - 自定义 proof_purpose', () => {
  const identity = create_identity({
    hostname: 'awiki.ai',
    proof_purpose: 'assertionMethod',
  });

  assert.strictEqual(
    identity.did_document.proof.proofPurpose,
    'assertionMethod'
  );
});

// TC-016: 自定义 domain
test('create_identity - 自定义 domain', () => {
  const identity = create_identity({
    hostname: 'awiki.ai',
    domain: 'https://awiki.ai',
  });

  assert.strictEqual(
    identity.did_document.proof.domain,
    'https://awiki.ai'
  );
});

// TC-017: 自定义 challenge
test('create_identity - 自定义 challenge', () => {
  const identity = create_identity({
    hostname: 'awiki.ai',
    challenge: 'custom_challenge_12345',
  });

  assert.strictEqual(
    identity.did_document.proof.challenge,
    'custom_challenge_12345'
  );
});

// TC-018: 自定义 services
test('create_identity - 自定义 services', () => {
  const identity = create_identity({
    hostname: 'awiki.ai',
    services: [
      {
        id: '#messaging',
        type: 'MessagingService',
        serviceEndpoint: 'https://awiki.ai/messaging',
      },
    ],
  });

  const service = identity.did_document.service[0];
  assert.ok(service.id.endsWith('#messaging'), '服务 ID 应以 #messaging 结尾');
  assert.ok(service.id.startsWith(identity.did), '服务 ID 应以 DID 开头');
});

// TC-019: key-1 提取 (secp256k1)
test('create_identity - key-1 提取 (secp256k1)', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });

  assert.ok(identity.private_key_pem, 'private_key_pem 应存在');
  assert.ok(identity.public_key_pem, 'public_key_pem 应存在');
  assert.ok(Buffer.isBuffer(identity.private_key_pem));
  assert.ok(Buffer.isBuffer(identity.public_key_pem));
  assert.ok(identity.private_key_pem.length > 0);
});

// TC-020: key-2 提取 (secp256r1)
test('create_identity - key-2 提取 (secp256r1)', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });

  assert.ok(identity.e2ee_signing_private_pem, 'e2ee_signing_private_pem 应存在');
  assert.ok(identity.e2ee_signing_public_pem, 'e2ee_signing_public_pem 应存在');
  assert.ok(Buffer.isBuffer(identity.e2ee_signing_private_pem));
  assert.ok(Buffer.isBuffer(identity.e2ee_signing_public_pem));
});

// TC-021: key-3 提取 (X25519)
test('create_identity - key-3 提取 (X25519)', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });

  assert.ok(identity.e2ee_agreement_private_pem, 'e2ee_agreement_private_pem 应存在');
  assert.ok(identity.e2ee_agreement_public_pem, 'e2ee_agreement_public_pem 应存在');
  assert.ok(Buffer.isBuffer(identity.e2ee_agreement_private_pem));
  assert.ok(Buffer.isBuffer(identity.e2ee_agreement_public_pem));
});

// TC-022: 多次调用生成不同身份
test('create_identity - 多次调用生成不同身份', () => {
  const identities = [
    create_identity({ hostname: 'awiki.ai' }),
    create_identity({ hostname: 'awiki.ai' }),
    create_identity({ hostname: 'awiki.ai' }),
  ];

  const dids = new Set(identities.map((id) => id.did));
  assert.strictEqual(dids.size, 3, '3 次调用生成的 DID 应互不相同');

  const privateKeys = new Set(
    identities.map((id) => id.private_key_pem.toString('hex'))
  );
  assert.strictEqual(privateKeys.size, 3, '3 次调用生成的私钥应互不相同');
});

// ============================================================================
// 第三部分：load_private_key 函数测试
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('第三部分：load_private_key 函数测试');
console.log('='.repeat(60));

// TC-023: 有效 PEM 加载
test('load_private_key - 有效 PEM 加载', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });
  const privateKey = load_private_key(identity.private_key_pem);

  assert.strictEqual(privateKey.type, 'private');
  assert.strictEqual(privateKey.asymmetricKeyType, 'ec');
});

// TC-024: 无效 PEM 处理
test('load_private_key - 无效 PEM 处理', () => {
  assert.throws(() => {
    load_private_key(Buffer.from('invalid pem data'));
  }, /Error/);
});

// TC-025: 空 Buffer 处理
test('load_private_key - 空 Buffer 处理', () => {
  assert.throws(() => {
    load_private_key(Buffer.from([]));
  }, /Error/);
});

// ============================================================================
// 第四部分：集成测试
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('第四部分：集成测试');
console.log('='.repeat(60));

// TC-026: 完整身份创建流程
test('集成测试 - 完整身份创建流程', () => {
  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['user'],
    proof_purpose: 'authentication',
    domain: 'https://awiki.ai',
  });

  // 验证 DID 格式
  assert.ok(identity.did.startsWith('did:wba:awiki.ai:user:k1_'));

  // 验证 DID 文档结构
  assert.strictEqual(identity.did_document.id, identity.did);
  assert.ok(identity.did_document.verificationMethod);
  assert.ok(identity.did_document.authentication);
  assert.ok(identity.did_document.proof);

  // 验证密钥可用性
  const privateKey = identity.get_private_key();
  assert.strictEqual(privateKey.type, 'private');

  // 验证 unique_id
  assert.strictEqual(identity.unique_id, identity.did.split(':').pop());
});

// TC-027: DID 文档验证
test('集成测试 - DID 文档验证', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });
  const doc = identity.did_document;

  // 验证必需字段
  assert.ok(doc.id, 'DID 文档应有 id');
  assert.ok(doc.verificationMethod, 'DID 文档应有 verificationMethod');
  assert.ok(doc.authentication, 'DID 文档应有 authentication');
  assert.ok(doc.keyAgreement, 'DID 文档应有 keyAgreement');
  assert.ok(doc.proof, 'DID 文档应有 proof');

  // 验证 proof 字段
  const proof = doc.proof;
  assert.ok(proof.type, 'proof 应有 type');
  assert.ok(proof.created, 'proof 应有 created');
  assert.ok(proof.proofPurpose, 'proof 应有 proofPurpose');
  assert.ok(proof.challenge, 'proof 应有 challenge');
  assert.ok(proof.verificationMethod, 'proof 应有 verificationMethod');
  assert.ok(proof.proofValue, 'proof 应有 proofValue');
});

// TC-028: 密钥对验证
test('集成测试 - 密钥对验证', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });

  // 验证所有密钥对存在
  const keyPairs = [
    { private: identity.private_key_pem, public: identity.public_key_pem, name: 'key-1' },
    { private: identity.e2ee_signing_private_pem, public: identity.e2ee_signing_public_pem, name: 'key-2' },
    { private: identity.e2ee_agreement_private_pem, public: identity.e2ee_agreement_public_pem, name: 'key-3' },
  ];

  for (const { private: priv, public: pub, name } of keyPairs) {
    assert.ok(priv, `${name} private key 应存在`);
    assert.ok(pub, `${name} public key 应存在`);
    assert.ok(Buffer.isBuffer(priv), `${name} private key 应为 Buffer`);
    assert.ok(Buffer.isBuffer(pub), `${name} public key 应为 Buffer`);
    assert.ok(priv.length > 0, `${name} private key 应非空`);
    assert.ok(pub.length > 0, `${name} public key 应非空`);
  }
});

// ============================================================================
// 第五部分：边界测试
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('第五部分：边界测试');
console.log('='.repeat(60));

// TC-029: 空 services 数组
test('边界测试 - 空 services 数组', () => {
  const identity = create_identity({
    hostname: 'awiki.ai',
    services: [],
  });

  // 空 services 应不影响 DID 创建
  assert.ok(identity.did.startsWith('did:wba:awiki.ai:user:k1_'));
});

// TC-030: 特殊字符 hostname
test('边界测试 - 特殊字符 hostname', () => {
  const identity = create_identity({
    hostname: 'test.example.com',
  });

  assert.ok(identity.did.startsWith('did:wba:test.example.com:user:k1_'));
});

// TC-031: 服务 ID 自动添加 DID 前缀
test('边界测试 - 服务 ID 自动添加 DID 前缀', () => {
  const identity = create_identity({
    hostname: 'awiki.ai',
    services: [
      { id: '#endpoint1', type: 'TestService', serviceEndpoint: 'https://test.com/1' },
      { id: '#endpoint2', type: 'TestService', serviceEndpoint: 'https://test.com/2' },
    ],
  });

  const services = identity.did_document.service;
  assert.strictEqual(services.length, 2);

  for (const service of services) {
    assert.ok(service.id.startsWith(identity.did), '服务 ID 应以 DID 开头');
  }
});

// TC-032: 完整 DID 的服务 ID 保持不变
test('边界测试 - 完整 DID 的服务 ID 保持不变', () => {
  const identity = create_identity({
    hostname: 'awiki.ai',
    services: [
      {
        id: 'did:wba:awiki.ai:user:k1_test#profile',
        type: 'ProfileService',
        serviceEndpoint: 'https://awiki.ai/profile',
      },
    ],
  });

  const service = identity.did_document.service[0];
  assert.strictEqual(
    service.id,
    'did:wba:awiki.ai:user:k1_test#profile',
    '完整 DID 的服务 ID 应保持不变'
  );
});

// ============================================================================
// 第六部分：命名规范检查（snake_case）
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('第六部分：命名规范检查（snake_case）');
console.log('='.repeat(60));

// TC-033: 类属性名 snake_case 检查
test('命名规范 - 类属性名 snake_case', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });

  // 验证 snake_case 属性存在
  assert.ok('did' in identity, '应有 did 属性');
  assert.ok('did_document' in identity, '应有 did_document 属性');
  assert.ok('private_key_pem' in identity, '应有 private_key_pem 属性');
  assert.ok('public_key_pem' in identity, '应有 public_key_pem 属性');
  assert.ok('user_id' in identity, '应有 user_id 属性');
  assert.ok('jwt_token' in identity, '应有 jwt_token 属性');
  assert.ok('e2ee_signing_private_pem' in identity, '应有 e2ee_signing_private_pem 属性');
  assert.ok('e2ee_signing_public_pem' in identity, '应有 e2ee_signing_public_pem 属性');
  assert.ok('e2ee_agreement_private_pem' in identity, '应有 e2ee_agreement_private_pem 属性');
  assert.ok('e2ee_agreement_public_pem' in identity, '应有 e2ee_agreement_public_pem 属性');

  // 验证 camelCase 属性不存在
  assert.ok(!('didDocument' in identity), '不应有 didDocument 属性 (camelCase)');
  assert.ok(!('privateKeyPem' in identity), '不应有 privateKeyPem 属性 (camelCase)');
  assert.ok(!('publicKeyPem' in identity), '不应有 publicKeyPem 属性 (camelCase)');
  assert.ok(!('userId' in identity), '不应有 userId 属性 (camelCase)');
  assert.ok(!('jwtToken' in identity), '不应有 jwtToken 属性 (camelCase)');
});

// TC-034: 类方法名 snake_case 检查
test('命名规范 - 类方法名 snake_case', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });

  // 验证 snake_case 方法存在
  assert.ok(typeof identity.get_private_key === 'function', '应有 get_private_key 方法');
  assert.ok(typeof identity.unique_id !== 'undefined', '应有 unique_id getter');

  // 验证 camelCase 方法不存在
  assert.ok(typeof identity.getPrivateKey === 'undefined', '不应有 getPrivateKey 方法 (camelCase)');
  assert.ok(typeof identity.uniqueId === 'undefined', '不应有 uniqueId getter (camelCase)');
});

// TC-035: 函数名 snake_case 检查
test('命名规范 - 函数名 snake_case', () => {
  // 验证 snake_case 函数存在
  assert.ok(typeof create_identity === 'function', '应有 create_identity 函数');
  assert.ok(typeof load_private_key === 'function', '应有 load_private_key 函数');
});

// TC-036: 字段值一致性检查
test('命名规范 - 字段值一致性检查', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });

  // 验证 snake_case 字段可正常访问和修改
  identity.user_id = 'test-user-id';
  identity.jwt_token = 'test-jwt-token';

  assert.strictEqual(identity.user_id, 'test-user-id');
  assert.strictEqual(identity.jwt_token, 'test-jwt-token');
});

// ============================================================================
// 第七部分：Python 版本兼容性测试
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('第七部分：Python 版本兼容性测试');
console.log('='.repeat(60));

// TC-037: DID 格式兼容性
test('Python 兼容 - DID 格式', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });

  // Python 格式：did:wba:{hostname}:user:k1_{fingerprint}
  const expectedPattern = /^did:wba:awiki\.ai:user:k1_[A-Za-z0-9_-]+$/;
  assert.ok(
    expectedPattern.test(identity.did),
    `DID 格式应为 'did:wba:awiki.ai:user:k1_{{fingerprint}}'，实际：${identity.did}`
  );
});

// TC-038: path_prefix 默认值兼容性
test('Python 兼容 - path_prefix 默认值 ["user"]', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });

  assert.ok(
    identity.did.includes(':user:'),
    `path_prefix 默认值应为 ["user"]，DID: ${identity.did}`
  );
});

// TC-039: proof_purpose 默认值兼容性
test('Python 兼容 - proof_purpose 默认值 "authentication"', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });
  const proof = identity.did_document.proof;

  assert.strictEqual(
    proof.proofPurpose,
    'authentication',
    'proof_purpose 默认值应为 "authentication"'
  );
});

// TC-040: challenge 自动生成逻辑兼容性
test('Python 兼容 - challenge 自动生成逻辑', () => {
  // Python 使用 secrets.token_hex(16) 生成 32 字符 hex 字符串
  const identity = create_identity({ hostname: 'awiki.ai' });
  const proof = identity.did_document.proof;
  const challenge = proof.challenge;

  assert.strictEqual(challenge.length, 32, 'challenge 长度应为 32 (16 字节 hex)');
  assert.ok(/^[0-9a-f]+$/.test(challenge), 'challenge 应为小写 hex 字符串');
});

// TC-041: 字段名称完全一致
test('Python 兼容 - 字段名称完全一致', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });

  // Python 字段名列表
  const pythonFields = [
    'did',
    'did_document',
    'private_key_pem',
    'public_key_pem',
    'user_id',
    'jwt_token',
    'e2ee_signing_private_pem',
    'e2ee_signing_public_pem',
    'e2ee_agreement_private_pem',
    'e2ee_agreement_public_pem',
  ];

  for (const field of pythonFields) {
    assert.ok(field in identity, `字段 '${field}' 应存在 (与 Python 一致)`);
  }
});

// TC-042: unique_id 提取逻辑兼容性
test('Python 兼容 - unique_id 提取逻辑', () => {
  const testCases = [
    {
      did: 'did:wba:awiki.ai:user:k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g',
      expected: 'k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g',
    },
    {
      did: 'did:wba:localhost:user:k1_test',
      expected: 'k1_test',
    },
  ];

  for (const { did, expected } of testCases) {
    const identity = new DIDIdentity({
      did,
      did_document: { id: did },
      private_key_pem: Buffer.from('test'),
      public_key_pem: Buffer.from('test'),
    });
    assert.strictEqual(identity.unique_id, expected, `DID: ${did}`);
  }
});

// ============================================================================
// 第八部分：Python vs Node.js 输出对比测试
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('第八部分：Python vs Node.js 输出对比测试');
console.log('='.repeat(60));

// TC-043: 对比 DID 格式
test('Python vs Node.js - DID 格式对比', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });

  // Python 输出示例：did:wba:awiki.ai:user:k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g
  const pythonPattern = /^did:wba:[^:]+:user:k1_[A-Za-z0-9_-]+$/;
  assert.ok(
    pythonPattern.test(identity.did),
    `Node.js DID 格式应与 Python 一致，实际：${identity.did}`
  );
});

// TC-044: 对比 proof 结构
test('Python vs Node.js - proof 结构对比', () => {
  const identity = create_identity({
    hostname: 'awiki.ai',
    proof_purpose: 'authentication',
    domain: 'https://awiki.ai',
    challenge: 'test_challenge',
  });

  const proof = identity.did_document.proof;

  // Python proof 字段
  const pythonProofFields = ['type', 'created', 'proofPurpose', 'challenge', 'domain', 'verificationMethod', 'proofValue'];

  for (const field of pythonProofFields) {
    assert.ok(field in proof, `proof 应包含 '${field}' 字段 (与 Python 一致)`);
  }

  // 验证字段值
  assert.strictEqual(proof.proofPurpose, 'authentication');
  assert.strictEqual(proof.challenge, 'test_challenge');
  assert.strictEqual(proof.domain, 'https://awiki.ai');
});

// TC-045: 对比密钥对结构
test('Python vs Node.js - 密钥对结构对比', () => {
  const identity = create_identity({ hostname: 'awiki.ai' });

  // 验证 PEM 格式
  const privateKeyPem = identity.private_key_pem.toString('utf-8');
  const publicKeyPem = identity.public_key_pem.toString('utf-8');

  assert.ok(
    privateKeyPem.startsWith('-----BEGIN ') && privateKeyPem.includes('PRIVATE KEY-----'),
    'private_key_pem 应为 PEM 格式'
  );
  assert.ok(
    publicKeyPem.startsWith('-----BEGIN ') && publicKeyPem.includes('PUBLIC KEY-----'),
    'public_key_pem 应为 PEM 格式'
  );
});

// ============================================================================
// 测试结果汇总
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('测试结果汇总');
console.log('='.repeat(60));
console.log(`总测试用例数：${totalTests}`);
console.log(`通过：${passedTests}`);
console.log(`失败：${failedTests}`);
console.log(`通过率：${((passedTests / totalTests) * 100).toFixed(2)}%`);

if (failures.length > 0) {
  console.log('\n失败详情:');
  for (const failure of failures) {
    console.log(`  - ${failure}`);
  }
}

// 退出码
if (failedTests > 0) {
  process.exit(1);
}
