/**
 * DID Identity 模块测试
 *
 * 基于 python/scripts/utils/identity.py 的测试用例移植
 *
 * 命名规范：snake_case（与 Python 版本保持一致）
 */

import { strict as assert } from 'assert';
import { DIDIdentity, create_identity, load_private_key } from '../dist/index.js';

// 测试用例：TC-001 - 创建基础 DID 身份 - 默认参数
function testCreateIdentityDefaultParams() {
  console.log('TC-001: 创建基础 DID 身份 - 默认参数');

  const identity = create_identity({
    hostname: 'awiki.ai',
  });

  // 验证 DID 格式
  assert.ok(
    identity.did.startsWith('did:wba:awiki.ai:user:k1_'),
    `DID 应以 'did:wba:awiki.ai:user:k1_' 开头，实际：${identity.did}`
  );

  // 验证 DID 文档
  assert.strictEqual(
    identity.did_document.id,
    identity.did,
    'did_document.id 应与 did 一致'
  );
  assert.ok(identity.did_document.proof, 'did_document 应包含 proof 字段');

  // 验证密钥
  assert.ok(Buffer.isBuffer(identity.private_key_pem), 'private_key_pem 应为 Buffer');
  assert.ok(identity.private_key_pem.length > 0, 'private_key_pem 应非空');
  assert.ok(Buffer.isBuffer(identity.public_key_pem), 'public_key_pem 应为 Buffer');

  // 验证 E2EE 密钥
  assert.ok(identity.e2ee_signing_private_pem, 'e2ee_signing_private_pem 应存在');
  assert.ok(identity.e2ee_agreement_private_pem, 'e2ee_agreement_private_pem 应存在');

  console.log('  ✓ PASSED');
}

// 测试用例：TC-002 - 创建 DID 身份 - 自定义路径前缀
function testCreateIdentityCustomPathPrefix() {
  console.log('TC-002: 创建 DID 身份 - 自定义路径前缀');

  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['agent'],
  });

  assert.ok(
    identity.did.startsWith('did:wba:awiki.ai:agent:k1_'),
    `DID 应以 'did:wba:awiki.ai:agent:k1_' 开头，实际：${identity.did}`
  );

  console.log('  ✓ PASSED');
}

// 测试用例：TC-003 - 创建 DID 身份 - 自定义主机名
function testCreateIdentityCustomHostname() {
  console.log('TC-003: 创建 DID 身份 - 自定义主机名');

  const identity = create_identity({
    hostname: 'localhost',
    path_prefix: ['user'],
  });

  assert.ok(
    identity.did.startsWith('did:wba:localhost:user:k1_'),
    `DID 应以 'did:wba:localhost:user:k1_' 开头，实际：${identity.did}`
  );

  console.log('  ✓ PASSED');
}

// 测试用例：TC-004 - 创建 DID 身份 - 带证明目的
function testCreateIdentityProofPurpose() {
  console.log('TC-004: 创建 DID 身份 - 带证明目的');

  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['user'],
    proof_purpose: 'assertionMethod',
  });

  assert.strictEqual(
    identity.did_document.proof.proofPurpose,
    'assertionMethod',
    'proof_purpose 应为 assertionMethod'
  );

  console.log('  ✓ PASSED');
}

// 测试用例：TC-005 - 创建 DID 身份 - 带服务域名
function testCreateIdentityWithDomain() {
  console.log('TC-005: 创建 DID 身份 - 带服务域名');

  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['user'],
    domain: 'https://awiki.ai',
  });

  assert.strictEqual(
    identity.did_document.proof.domain,
    'https://awiki.ai',
    'proof.domain 应为 https://awiki.ai'
  );

  console.log('  ✓ PASSED');
}

// 测试用例：TC-006 - 创建 DID 身份 - 自定义 challenge
function testCreateIdentityCustomChallenge() {
  console.log('TC-006: 创建 DID 身份 - 自定义 challenge');

  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['user'],
    challenge: 'custom_challenge_12345',
  });

  assert.strictEqual(
    identity.did_document.proof.challenge,
    'custom_challenge_12345',
    'proof.challenge 应为 custom_challenge_12345'
  );

  console.log('  ✓ PASSED');
}

// 测试用例：TC-007 - 创建 DID 身份 - 带自定义服务
function testCreateIdentityWithServices() {
  console.log('TC-007: 创建 DID 身份 - 带自定义服务');

  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['user'],
    services: [
      {
        id: '#messaging',
        type: 'MessagingService',
        serviceEndpoint: 'https://awiki.ai/messaging',
      },
      {
        id: 'did:wba:awiki.ai:user:k1_test#profile',
        type: 'ProfileService',
        serviceEndpoint: 'https://awiki.ai/profile',
      },
    ],
  });

  assert.strictEqual(
    identity.did_document.service?.length,
    2,
    'service 长度应为 2'
  );

  // 验证服务 ID 自动添加 DID 前缀
  const service0 = identity.did_document.service[0];
  assert.ok(
    service0.id.endsWith('#messaging'),
    '服务 ID 应以 #messaging 结尾'
  );
  assert.ok(
    service0.id.startsWith(identity.did),
    '服务 ID 应以 DID 开头'
  );

  // 验证完整 DID 的服务 ID 保持不变
  const service1 = identity.did_document.service[1];
  assert.strictEqual(
    service1.id,
    'did:wba:awiki.ai:user:k1_test#profile',
    '完整 DID 的服务 ID 应保持不变'
  );

  console.log('  ✓ PASSED');
}

// 测试用例：TC-008 - 创建 DID 身份 - 带 E2EE 密钥
function testCreateIdentityWithE2eeKeys() {
  console.log('TC-008: 创建 DID 身份 - 带 E2EE 密钥');

  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['user'],
  });

  // 验证 key-1 (secp256k1)
  assert.ok(identity.private_key_pem, 'private_key_pem 应存在');
  assert.ok(identity.public_key_pem, 'public_key_pem 应存在');

  // 验证 key-2 (secp256r1)
  assert.ok(identity.e2ee_signing_private_pem, 'e2ee_signing_private_pem 应存在');
  assert.ok(identity.e2ee_signing_public_pem, 'e2ee_signing_public_pem 应存在');

  // 验证 key-3 (X25519)
  assert.ok(identity.e2ee_agreement_private_pem, 'e2ee_agreement_private_pem 应存在');
  assert.ok(identity.e2ee_agreement_public_pem, 'e2ee_agreement_public_pem 应存在');

  console.log('  ✓ PASSED');
}

// 测试用例：TC-009 - DIDIdentity.unique_id 属性
function testUniqueIdProperty() {
  console.log('TC-009: DIDIdentity.unique_id 属性');

  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['user'],
  });

  const expectedUniqueId = identity.did.split(':').pop();
  assert.strictEqual(
    identity.unique_id,
    expectedUniqueId,
    `unique_id 应为 ${expectedUniqueId}`
  );

  console.log('  ✓ PASSED');
}

// 测试用例：TC-010 - DIDIdentity.get_private_key() 方法
function testGetPrivateKeyMethod() {
  console.log('TC-010: DIDIdentity.get_private_key() 方法');

  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['user'],
  });

  const privateKey = identity.get_private_key();

  assert.strictEqual(privateKey.type, 'private', '应为私钥');
  assert.strictEqual(privateKey.asymmetricKeyType, 'ec', '应为椭圆曲线密钥');

  console.log('  ✓ PASSED');
}

// 测试用例：TC-011 - load_private_key() 函数 - 有效 PEM
function testLoadPrivateKeyValidPem() {
  console.log('TC-011: load_private_key() 函数 - 有效 PEM');

  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['user'],
  });

  const privateKey = load_private_key(identity.private_key_pem);

  assert.strictEqual(privateKey.type, 'private', '应为私钥');
  assert.strictEqual(privateKey.asymmetricKeyType, 'ec', '应为椭圆曲线密钥');

  console.log('  ✓ PASSED');
}

// 测试用例：TC-012 - load_private_key() 函数 - 无效 PEM
function testLoadPrivateKeyInvalidPem() {
  console.log('TC-012: load_private_key() 函数 - 无效 PEM');

  try {
    load_private_key(Buffer.from('invalid pem data'));
    assert.fail('应抛出异常');
  } catch (error) {
    assert.ok(error instanceof Error, '应抛出 Error');
  }

  console.log('  ✓ PASSED');
}

// 测试用例：TC-014 - DIDIdentity 数据类 - 完整字段初始化
function testDIDIdentityFullFields() {
  console.log('TC-014: DIDIdentity 数据类 - 完整字段初始化');

  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['user'],
  });

  // 验证初始值
  assert.strictEqual(identity.user_id, null, 'user_id 初始值应为 null');
  assert.strictEqual(identity.jwt_token, null, 'jwt_token 初始值应为 null');

  // 验证可更新字段
  identity.user_id = '77ec3f44-f94f-4c19-b315-49c0f0bf4a37';
  identity.jwt_token = 'eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ...';

  assert.strictEqual(
    identity.user_id,
    '77ec3f44-f94f-4c19-b315-49c0f0bf4a37',
    'user_id 应可更新'
  );
  assert.strictEqual(
    identity.jwt_token,
    'eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ...',
    'jwt_token 应可更新'
  );

  console.log('  ✓ PASSED');
}

// 测试用例：TC-016 - create_identity() - 空路径前缀
function testCreateIdentityEmptyPathPrefix() {
  console.log('TC-016: create_identity() - 空路径前缀');

  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: [],
  });

  assert.ok(
    identity.did.startsWith('did:wba:awiki.ai:k1_'),
    `DID 应以 'did:wba:awiki.ai:k1_' 开头，实际：${identity.did}`
  );

  console.log('  ✓ PASSED');
}

// 测试用例：TC-017 - create_identity() - 多级路径前缀
function testCreateIdentityMultiLevelPathPrefix() {
  console.log('TC-017: create_identity() - 多级路径前缀');

  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['org', 'department', 'user'],
  });

  assert.ok(
    identity.did.includes('org:department:user'),
    `DID 应包含 'org:department:user'，实际：${identity.did}`
  );

  console.log('  ✓ PASSED');
}

// 测试用例：TC-018 - create_identity() - 自动生成 challenge
function testCreateIdentityAutoChallenge() {
  console.log('TC-018: create_identity() - 自动生成 challenge');

  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['user'],
  });

  const challenge = identity.did_document.proof.challenge;

  assert.strictEqual(
    challenge.length,
    32,
    'challenge 长度应为 32 (16 字节的 hex)'
  );
  assert.ok(
    /^[0-9a-f]+$/.test(challenge),
    'challenge 应为有效的 hex 字符串'
  );

  console.log('  ✓ PASSED');
}

// 测试用例：TC-019 - create_identity() - 多次调用生成不同身份
function testCreateIdentityMultipleUnique() {
  console.log('TC-019: create_identity() - 多次调用生成不同身份');

  const identities = [];
  for (let i = 0; i < 3; i++) {
    identities.push(
      create_identity({
        hostname: 'awiki.ai',
        path_prefix: ['user'],
      })
    );
  }

  // 验证 DID 互不相同
  const dids = new Set(identities.map((id) => id.did));
  assert.strictEqual(dids.size, 3, '3 次调用生成的 DID 应互不相同');

  // 验证私钥互不相同
  const privateKeys = new Set(
    identities.map((id) => id.private_key_pem.toString('hex'))
  );
  assert.strictEqual(privateKeys.size, 3, '3 次调用生成的私钥应互不相同');

  console.log('  ✓ PASSED');
}

// 测试用例：TC-020 - create_identity() - 服务 ID 自动添加 DID 前缀
function testCreateIdentityServiceIdPrefix() {
  console.log('TC-020: create_identity() - 服务 ID 自动添加 DID 前缀');

  const identity = create_identity({
    hostname: 'awiki.ai',
    path_prefix: ['user'],
    services: [
      {
        id: '#endpoint1',
        type: 'TestService',
        serviceEndpoint: 'https://test.com/1',
      },
      {
        id: '#endpoint2',
        type: 'TestService',
        serviceEndpoint: 'https://test.com/2',
      },
    ],
  });

  const service0 = identity.did_document.service[0];
  const service1 = identity.did_document.service[1];

  assert.ok(
    service0.id.endsWith('#endpoint1'),
    '服务 ID 应以 #endpoint1 结尾'
  );
  assert.ok(
    service0.id.startsWith(identity.did),
    '服务 ID 应以 DID 开头'
  );

  assert.ok(
    service1.id.endsWith('#endpoint2'),
    '服务 ID 应以 #endpoint2 结尾'
  );
  assert.ok(
    service1.id.startsWith(identity.did),
    '服务 ID 应以 DID 开头'
  );

  console.log('  ✓ PASSED');
}

// 运行所有测试
function runAllTests() {
  console.log('='.repeat(60));
  console.log('DID Identity 模块测试 (snake_case)');
  console.log('='.repeat(60));
  console.log('');

  const tests = [
    testCreateIdentityDefaultParams,
    testCreateIdentityCustomPathPrefix,
    testCreateIdentityCustomHostname,
    testCreateIdentityProofPurpose,
    testCreateIdentityWithDomain,
    testCreateIdentityCustomChallenge,
    testCreateIdentityWithServices,
    testCreateIdentityWithE2eeKeys,
    testUniqueIdProperty,
    testGetPrivateKeyMethod,
    testLoadPrivateKeyValidPem,
    testLoadPrivateKeyInvalidPem,
    testDIDIdentityFullFields,
    testCreateIdentityEmptyPathPrefix,
    testCreateIdentityMultiLevelPathPrefix,
    testCreateIdentityAutoChallenge,
    testCreateIdentityMultipleUnique,
    testCreateIdentityServiceIdPrefix,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test();
      passed++;
    } catch (error) {
      failed++;
      console.log(`  ✗ FAILED: ${error.message}`);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`测试结果：${passed} 通过，${failed} 失败，共 ${tests.length} 项`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

// 执行测试
runAllTests();
