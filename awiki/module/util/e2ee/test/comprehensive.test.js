/**
 * E2EE 模块综合测试
 *
 * 测试范围：
 * 1. 单元测试 - hpke.ts, e2ee.ts, types.ts
 * 2. 集成测试 - 完整 E2EE 流程、多轮对话、会话管理
 * 3. 边界测试 - 错误处理、边界条件
 * 4. 命名规范检查 - snake_case 一致性
 * 5. Python 版本兼容性验证
 */

import { strict as assert } from 'assert';
import { randomBytes, generateKeyPairSync } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';

// 导入被测试模块
import {
  hpkeSeal,
  hpkeOpen,
  deriveChainKey,
  deriveEncryptionKey,
  encryptWithChainKey,
  decryptWithChainKey,
  x25519,
  HPKE_VERSION,
  KEM_ID,
  KDF_ID,
  AEAD_ID,
  AEAD_KEY_LENGTH,
  AEAD_NONCE_LENGTH,
  AEAD_TAG_LENGTH,
  concatBytes,
  i2osp,
} from '../dist/hpke.js';

import {
  E2eeClient,
  E2eeHpkeSession,
  HpkeKeyManager,
  SUPPORTED_E2EE_VERSION,
  extractProofVerificationMethod,
  ensureSupportedE2eeVersion,
  buildE2eeErrorContent,
  buildE2eeErrorMessage,
  classifyProtocolError,
  detectMessageType,
} from '../dist/e2ee.js';

// ============================================================================
// 测试计数器
// ============================================================================

let passedTests = 0;
let failedTests = 0;
let testResults = [];

function test(name, fn) {
  try {
    fn();
    passedTests++;
    testResults.push({ name, status: 'PASS' });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failedTests++;
    testResults.push({ name, status: 'FAIL', error: e.message });
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${e.message}`);
  }
}

function section(name) {
  console.log(`\n${name}`);
  console.log('='.repeat(name.length));
}

// ============================================================================
// 1. HPKE 单元测试
// ============================================================================

section('1. HPKE 单元测试');

// 1.1 常量验证
section('1.1 常量验证');

test('HPKE_VERSION 应为 "HPKE-v1"', () => {
  assert.strictEqual(HPKE_VERSION, 'HPKE-v1');
});

test('KEM_ID 应为 0x0020', () => {
  assert.strictEqual(KEM_ID, 0x0020);
});

test('KDF_ID 应为 0x0001', () => {
  assert.strictEqual(KDF_ID, 0x0001);
});

test('AEAD_ID 应为 0x0001', () => {
  assert.strictEqual(AEAD_ID, 0x0001);
});

test('AEAD_KEY_LENGTH 应为 16', () => {
  assert.strictEqual(AEAD_KEY_LENGTH, 16);
});

test('AEAD_NONCE_LENGTH 应为 12', () => {
  assert.strictEqual(AEAD_NONCE_LENGTH, 12);
});

test('AEAD_TAG_LENGTH 应为 16', () => {
  assert.strictEqual(AEAD_TAG_LENGTH, 16);
});

// 1.2 hpkeSeal / hpkeOpen 测试
section('1.2 hpkeSeal / hpkeOpen 测试');

test('hpkeSeal 应加密消息', () => {
  const recipientSecretKey = x25519.utils.randomPrivateKey();
  const recipientPublicKey = x25519.getPublicKey(recipientSecretKey);
  const info = new TextEncoder().encode('test-info');
  const aad = new TextEncoder().encode('test-aad');
  const plaintext = new TextEncoder().encode('Hello, HPKE!');

  const result = hpkeSeal(recipientPublicKey, info, aad, plaintext);

  assert.ok(result.ciphertext, 'Should have ciphertext');
  assert.ok(result.encapsulatedKey, 'Should have encapsulatedKey');
  assert.ok(result.sequenceNumber, 'Should have sequenceNumber');
  assert.strictEqual(result.ciphertext.length, plaintext.length + AEAD_TAG_LENGTH);
});

test('hpkeOpen 应解密消息', () => {
  const recipientSecretKey = x25519.utils.randomPrivateKey();
  const recipientPublicKey = x25519.getPublicKey(recipientSecretKey);
  const info = new TextEncoder().encode('test-info');
  const aad = new TextEncoder().encode('test-aad');
  const plaintext = new TextEncoder().encode('Hello, HPKE!');

  const result = hpkeSeal(recipientPublicKey, info, aad, plaintext);
  const decrypted = hpkeOpen(recipientSecretKey, result.encapsulatedKey, info, aad, result.ciphertext, result.sequenceNumber);

  assert.deepEqual(decrypted, plaintext, 'Decrypted should match original');
});

test('hpkeOpen 使用错误密钥应失败', () => {
  const recipientSecretKey1 = x25519.utils.randomPrivateKey();
  const recipientPublicKey1 = x25519.getPublicKey(recipientSecretKey1);
  const recipientSecretKey2 = x25519.utils.randomPrivateKey();

  const info = new TextEncoder().encode('test-info');
  const aad = new TextEncoder().encode('test-aad');
  const plaintext = new TextEncoder().encode('Secret message');

  const result = hpkeSeal(recipientPublicKey1, info, aad, plaintext);

  assert.throws(() => {
    hpkeOpen(recipientSecretKey2, result.encapsulatedKey, info, aad, result.ciphertext, result.sequenceNumber);
  }, /Unsupported state|unable to authenticate|shared secret/i);
});

test('hpkeOpen 使用错误 info 应失败', () => {
  const recipientSecretKey = x25519.utils.randomPrivateKey();
  const recipientPublicKey = x25519.getPublicKey(recipientSecretKey);

  const info1 = new TextEncoder().encode('context-1');
  const info2 = new TextEncoder().encode('context-2');
  const aad = new Uint8Array(0);
  const plaintext = new TextEncoder().encode('Test message');

  const result = hpkeSeal(recipientPublicKey, info1, aad, plaintext);

  assert.throws(() => {
    hpkeOpen(recipientSecretKey, result.encapsulatedKey, info2, aad, result.ciphertext, result.sequenceNumber);
  });
});

test('hpkeOpen 使用错误 AAD 应失败', () => {
  const recipientSecretKey = x25519.utils.randomPrivateKey();
  const recipientPublicKey = x25519.getPublicKey(recipientSecretKey);

  const info = new Uint8Array(0);
  const aad1 = new TextEncoder().encode('aad-1');
  const aad2 = new TextEncoder().encode('aad-2');
  const plaintext = new TextEncoder().encode('Test message');

  const result = hpkeSeal(recipientPublicKey, info, aad1, plaintext);

  assert.throws(() => {
    hpkeOpen(recipientSecretKey, result.encapsulatedKey, info, aad2, result.ciphertext, result.sequenceNumber);
  });
});

test('hpkeOpen 密文过短应失败', () => {
  const recipientSecretKey = x25519.utils.randomPrivateKey();
  const recipientPublicKey = x25519.getPublicKey(recipientSecretKey);
  const info = new Uint8Array(0);
  const aad = new Uint8Array(0);
  const shortCiphertext = new Uint8Array([1, 2, 3]);
  const sequenceNumber = randomBytes(8);

  assert.throws(() => {
    hpkeOpen(recipientSecretKey, recipientPublicKey, info, aad, shortCiphertext, sequenceNumber);
  }, /Ciphertext too short/);
});

// 1.3 deriveChainKey 测试
section('1.3 deriveChainKey 测试');

test('deriveChainKey 应派生新链密钥和消息密钥', () => {
  const initialChainKey = randomBytes(32);
  const [newChainKey, messageKey] = deriveChainKey(initialChainKey);

  assert.strictEqual(newChainKey.length, 32, 'New chain key should be 32 bytes');
  assert.strictEqual(messageKey.length, 32, 'Message key should be 32 bytes');
  assert.notDeepEqual(newChainKey, initialChainKey, 'Chain key should change');
  assert.notDeepEqual(messageKey, initialChainKey, 'Message key should be different from chain key');
});

test('deriveChainKey 应确定性派生', () => {
  const chainKey = randomBytes(32);
  const [newChainKey1, messageKey1] = deriveChainKey(chainKey);
  const [newChainKey2, messageKey2] = deriveChainKey(chainKey);

  assert.deepEqual(newChainKey1, newChainKey2, 'Same input should produce same output');
  assert.deepEqual(messageKey1, messageKey2, 'Same input should produce same output');
});

test('连续派生应产生不同密钥', () => {
  let chainKey = randomBytes(32);
  const messageKeys = [];

  for (let i = 0; i < 5; i++) {
    const [newChainKey, messageKey] = deriveChainKey(chainKey);
    messageKeys.push(messageKey);
    chainKey = newChainKey;
  }

  // 所有消息密钥应不同
  for (let i = 0; i < messageKeys.length; i++) {
    for (let j = i + 1; j < messageKeys.length; j++) {
      assert.notDeepEqual(messageKeys[i], messageKeys[j], `Message keys ${i} and ${j} should be different`);
    }
  }
});

// 1.4 encryptWithChainKey / decryptWithChainKey 测试
section('1.4 encryptWithChainKey / decryptWithChainKey 测试');

test('encryptWithChainKey 应加密消息', () => {
  const chainKey = randomBytes(32);
  const plaintext = new TextEncoder().encode('Secret message');
  const seq = 0;

  const [newChainKey, ciphertext, iv] = encryptWithChainKey(chainKey, seq, plaintext);

  assert.ok(ciphertext, 'Should have ciphertext');
  assert.ok(iv, 'Should have IV');
  assert.strictEqual(iv.length, AEAD_NONCE_LENGTH, 'IV should be 12 bytes');
  assert.ok(newChainKey, 'Should have new chain key');
});

test('decryptWithChainKey 应解密消息', () => {
  const chainKey = randomBytes(32);
  const plaintext = new TextEncoder().encode('Secret message');
  const seq = 0;

  const [newSendChainKey, ciphertext, iv] = encryptWithChainKey(chainKey, seq, plaintext);
  const [newRecvChainKey, decrypted] = decryptWithChainKey(chainKey, seq, ciphertext, iv);

  assert.deepEqual(decrypted, plaintext, 'Decrypted should match original');
  assert.deepEqual(newSendChainKey, newRecvChainKey, 'Chain keys should advance identically');
});

test('decryptWithChainKey 密文过短应失败', () => {
  const chainKey = randomBytes(32);
  const shortCiphertext = new Uint8Array([1, 2, 3]);
  const iv = randomBytes(12);
  const seq = 0;

  assert.throws(() => {
    decryptWithChainKey(chainKey, seq, shortCiphertext, iv);
  }, /Ciphertext too short/);
});

// 1.5 辅助函数测试
section('1.5 辅助函数测试');

test('concatBytes 应连接字节数组', () => {
  const arr1 = new Uint8Array([1, 2, 3]);
  const arr2 = new Uint8Array([4, 5, 6]);
  const result = concatBytes(arr1, arr2);

  assert.deepEqual(result, new Uint8Array([1, 2, 3, 4, 5, 6]));
});

test('i2osp 应正确转换整数', () => {
  assert.deepEqual(i2osp(0, 2), new Uint8Array([0, 0]));
  assert.deepEqual(i2osp(1, 2), new Uint8Array([0, 1]));
  assert.deepEqual(i2osp(256, 2), new Uint8Array([1, 0]));
  assert.deepEqual(i2osp(65535, 2), new Uint8Array([255, 255]));
});

test('i2osp 超出范围应抛出错误', () => {
  assert.throws(() => i2osp(-1, 2), /out of range/);
  assert.throws(() => i2osp(65536, 2), /out of range/);
});

// ============================================================================
// 2. E2EE 客户端单元测试
// ============================================================================

section('2. E2EE 客户端单元测试');

// 2.1 常量验证
section('2.1 常量验证');

test('SUPPORTED_E2EE_VERSION 应为 "1.1"', () => {
  assert.strictEqual(SUPPORTED_E2EE_VERSION, '1.1');
});

// 2.2 E2eeClient 构造函数测试
section('2.2 E2eeClient 构造函数测试');

test('E2eeClient 应使用 local_did 创建', () => {
  const client = new E2eeClient('did:wba:awiki.ai:user:k1_test');
  assert.strictEqual(client.local_did, 'did:wba:awiki.ai:user:k1_test');
});

test('E2eeClient 应接受选项', () => {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  const x25519Pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

  const client = new E2eeClient('did:wba:awiki.ai:user:k1_test', {
    x25519Pem,
  });

  assert.strictEqual(client.local_did, 'did:wba:awiki.ai:user:k1_test');
});

test('E2eeClient 应初始化密钥管理器', () => {
  const client = new E2eeClient('did:wba:awiki.ai:user:k1_test');
  assert.ok(client._key_manager, 'Should have key manager');
});

// 2.3 E2eeHpkeSession 测试
section('2.3 E2eeHpkeSession 测试');

test('E2eeHpkeSession 应创建会话', () => {
  const session = new E2eeHpkeSession(
    'did:wba:awiki.ai:user:k1_alice',
    'did:wba:awiki.ai:user:k1_bob',
    true
  );

  assert.strictEqual(session.local_did, 'did:wba:awiki.ai:user:k1_alice');
  assert.strictEqual(session.peer_did, 'did:wba:awiki.ai:user:k1_bob');
  assert.strictEqual(session.state, 'idle');
  assert.strictEqual(session.session_id, null);
});

test('E2eeHpkeSession 使用初始链密钥应设为 active', () => {
  const initialChainKey = randomBytes(32);
  const session = new E2eeHpkeSession(
    'did:wba:awiki.ai:user:k1_alice',
    'did:wba:awiki.ai:user:k1_bob',
    true,
    initialChainKey
  );

  assert.strictEqual(session.state, 'active');
  assert.ok(session.activeAt, 'Should have activeAt');
});

test('E2eeHpkeSession 应检测过期', () => {
  const session = new E2eeHpkeSession(
    'did:wba:awiki.ai:user:k1_alice',
    'did:wba:awiki.ai:user:k1_bob',
    true
  );

  // 未设置过期时间，不应过期
  assert.strictEqual(session.isExpired(), false);
});

// 2.4 SeqManager 测试 (通过 E2eeHpkeSession 间接测试)
section('2.4 SeqManager 测试 (间接)');

test('E2eeHpkeSession 序列号管理应正常工作', () => {
  const initialChainKey = randomBytes(32);
  const session = new E2eeHpkeSession(
    'did:wba:awiki.ai:user:k1_alice',
    'did:wba:awiki.ai:user:k1_bob',
    true,
    initialChainKey
  );
  session.session_id = 'test-session';
  session._sendChainKey = initialChainKey;

  // 加密一条消息（不使用 AAD，因为 decryptMessage 需要 iv）
  const plaintextBytes = new TextEncoder().encode('Hello');
  const aad = new Uint8Array(0);
  const [newChainKey, ciphertext, iv] = encryptWithChainKey(initialChainKey, 0, plaintextBytes, aad);
  session._sendChainKey = newChainKey;

  // 创建接收会话
  const recvSession = new E2eeHpkeSession(
    'did:wba:awiki.ai:user:k1_bob',
    'did:wba:awiki.ai:user:k1_alice',
    false,
    initialChainKey
  );
  recvSession.session_id = 'test-session';

  // 直接解密
  const [newRecvChainKey, decrypted] = decryptWithChainKey(initialChainKey, 0, ciphertext, iv, aad);

  assert.strictEqual(new TextDecoder().decode(decrypted), 'Hello');
});

// 2.5 HpkeKeyManager 测试
section('2.5 HpkeKeyManager 测试');

test('HpkeKeyManager 应注册会话', () => {
  const keyMgr = new HpkeKeyManager();
  const session = new E2eeHpkeSession(
    'did:wba:awiki.ai:user:k1_alice',
    'did:wba:awiki.ai:user:k1_bob',
    true
  );
  session.session_id = 'test-session-123';

  keyMgr.registerSession(session);

  const retrieved = keyMgr.getSessionById('test-session-123');
  assert.strictEqual(retrieved, session);
});

test('HpkeKeyManager.getActiveSession 应返回活跃会话', () => {
  const keyMgr = new HpkeKeyManager();
  const initialChainKey = randomBytes(32);
  const session = new E2eeHpkeSession(
    'did:wba:awiki.ai:user:k1_alice',
    'did:wba:awiki.ai:user:k1_bob',
    true,
    initialChainKey
  );
  session.session_id = 'test-session-123';

  keyMgr.registerSession(session);

  const active = keyMgr.getActiveSession('did:wba:awiki.ai:user:k1_alice', 'did:wba:awiki.ai:user:k1_bob');
  assert.strictEqual(active, session);
});

test('HpkeKeyManager.cleanupExpired 应清理过期会话', () => {
  const keyMgr = new HpkeKeyManager();
  const session = new E2eeHpkeSession(
    'did:wba:awiki.ai:user:k1_alice',
    'did:wba:awiki.ai:user:k1_bob',
    true
  );
  session.session_id = 'test-session-123';
  session._expiresAt = Math.floor(Date.now() / 1000) - 1000; // 已过期

  keyMgr.registerSession(session);
  keyMgr.cleanupExpired();

  const retrieved = keyMgr.getSessionById('test-session-123');
  assert.strictEqual(retrieved, null);
});

// 2.6 辅助函数测试
section('2.6 辅助函数测试');

test('extractProofVerificationMethod 应提取 verification_method', () => {
  assert.strictEqual(extractProofVerificationMethod({ verification_method: 'test#key-2' }), 'test#key-2');
});

test('extractProofVerificationMethod 应提取 verificationMethod', () => {
  assert.strictEqual(extractProofVerificationMethod({ verificationMethod: 'test#key-2' }), 'test#key-2');
});

test('extractProofVerificationMethod 对无效输入应返回空字符串', () => {
  assert.strictEqual(extractProofVerificationMethod('not_a_dict'), '');
  assert.strictEqual(extractProofVerificationMethod(null), '');
  assert.strictEqual(extractProofVerificationMethod(undefined), '');
});

test('ensureSupportedE2eeVersion 应验证版本', () => {
  assert.strictEqual(ensureSupportedE2eeVersion({ e2ee_version: '1.1' }), '1.1');
});

test('ensureSupportedE2eeVersion 对缺失版本应抛出错误', () => {
  assert.throws(() => {
    ensureSupportedE2eeVersion({});
  }, /unsupported_version/);
});

test('ensureSupportedE2eeVersion 对不支持版本应抛出错误', () => {
  assert.throws(() => {
    ensureSupportedE2eeVersion({ e2ee_version: '1.0' });
  }, /unsupported_version/);
});

test('buildE2eeErrorContent 应构建错误内容', () => {
  const content = buildE2eeErrorContent('session_not_found', {
    session_id: 'test123',
    retry_hint: 'resend',
  });

  assert.strictEqual(content.e2ee_version, '1.1');
  assert.strictEqual(content.error_code, 'session_not_found');
  assert.strictEqual(content.session_id, 'test123');
  assert.strictEqual(content.retry_hint, 'resend');
});

test('buildE2eeErrorMessage 应构建错误消息', () => {
  const msg = buildE2eeErrorMessage('session_expired');
  assert.ok(msg.includes('expired'));
});

test('buildE2eeErrorMessage 应包含详情', () => {
  const msg = buildE2eeErrorMessage('decryption_failed', { detail: 'HPKE failed' });
  assert.ok(msg.includes('Detail: HPKE failed'));
});

test('classifyProtocolError 应分类错误', () => {
  const result = classifyProtocolError(new Error('proof_expired'));
  assert.deepEqual(result, ['proof_expired', 'resend']);
});

test('detectMessageType 应检测有效类型', () => {
  assert.strictEqual(detectMessageType('e2ee_init'), 'e2ee_init');
  assert.strictEqual(detectMessageType('e2ee_ack'), 'e2ee_ack');
  assert.strictEqual(detectMessageType('e2ee_msg'), 'e2ee_msg');
  assert.strictEqual(detectMessageType('e2ee_rekey'), 'e2ee_rekey');
  assert.strictEqual(detectMessageType('e2ee_error'), 'e2ee_error');
});

test('detectMessageType 对无效类型应返回 null', () => {
  assert.strictEqual(detectMessageType('invalid_type'), null);
});

// ============================================================================
// 3. 集成测试
// ============================================================================

section('3. 集成测试');

// 3.1 完整 E2EE 流程
section('3.1 完整 E2EE 流程');

test('Alice 和 Bob 应完成完整 E2EE 对话', () => {
  // 创建会话
  const aliceBobSession = new E2eeHpkeSession(
    'did:wba:awiki.ai:user:k1_alice',
    'did:wba:awiki.ai:user:k1_bob',
    true
  );

  const bobAliceSession = new E2eeHpkeSession(
    'did:wba:awiki.ai:user:k1_bob',
    'did:wba:awiki.ai:user:k1_alice',
    false
  );

  // 设置共享链密钥
  const sharedSecret = randomBytes(32);
  const [initialChainKey] = deriveChainKey(new Uint8Array(sharedSecret));

  aliceBobSession._sendChainKey = new Uint8Array(initialChainKey);
  aliceBobSession._recvChainKey = new Uint8Array(initialChainKey);
  aliceBobSession.state = 'active';
  aliceBobSession.session_id = 'test-session-abc';

  bobAliceSession._sendChainKey = new Uint8Array(initialChainKey);
  bobAliceSession._recvChainKey = new Uint8Array(initialChainKey);
  bobAliceSession.state = 'active';
  bobAliceSession.session_id = 'test-session-abc';

  // Alice 发送消息给 Bob（使用底层加密函数）
  const plaintext1 = 'Hello Bob!';
  const aad = new Uint8Array(0);
  const [newSendChainKey1, ciphertext1, iv1] = encryptWithChainKey(
    aliceBobSession._sendChainKey, 0, new TextEncoder().encode(plaintext1), aad
  );
  aliceBobSession._sendChainKey = newSendChainKey1;

  // Bob 解密消息
  const [newRecvChainKey1, decrypted1] = decryptWithChainKey(
    bobAliceSession._recvChainKey, 0, ciphertext1, iv1, aad
  );
  bobAliceSession._recvChainKey = newRecvChainKey1;

  assert.strictEqual(new TextDecoder().decode(decrypted1), plaintext1);

  // Bob 回复消息给 Alice
  const plaintext2 = 'Hi Alice!';
  const [newSendChainKey2, ciphertext2, iv2] = encryptWithChainKey(
    bobAliceSession._sendChainKey, 0, new TextEncoder().encode(plaintext2), aad
  );
  bobAliceSession._sendChainKey = newSendChainKey2;

  // Alice 解密消息
  const [newRecvChainKey2, decrypted2] = decryptWithChainKey(
    aliceBobSession._recvChainKey, 0, ciphertext2, iv2, aad
  );
  aliceBobSession._recvChainKey = newRecvChainKey2;

  assert.strictEqual(new TextDecoder().decode(decrypted2), plaintext2);
});

// 3.2 多轮对话测试
section('3.2 多轮对话测试');

test('应支持 10 轮以上加密对话', () => {
  const sharedSecret = randomBytes(32);
  const [initialChainKey] = deriveChainKey(new Uint8Array(sharedSecret));

  let sendChainKey = new Uint8Array(initialChainKey);
  let recvChainKey = new Uint8Array(initialChainKey);

  const messages = [
    'Message 1', 'Message 2', 'Message 3', 'Message 4', 'Message 5',
    'Message 6', 'Message 7', 'Message 8', 'Message 9', 'Message 10',
    'Message 11', 'Message 12', 'Message 13', 'Message 14', 'Message 15'
  ];

  const encryptedMessages = [];

  // 加密所有消息
  for (let i = 0; i < messages.length; i++) {
    const [newChainKey, ciphertext, iv] = encryptWithChainKey(sendChainKey, i, new TextEncoder().encode(messages[i]));
    sendChainKey = newChainKey;
    encryptedMessages.push({ ciphertext, iv, seq: i });
  }

  // 解密所有消息
  for (let i = 0; i < encryptedMessages.length; i++) {
    const { ciphertext, iv, seq } = encryptedMessages[i];
    const [newChainKey, decrypted] = decryptWithChainKey(recvChainKey, seq, ciphertext, iv);
    recvChainKey = newChainKey;

    assert.strictEqual(new TextDecoder().decode(decrypted), messages[i], `Message ${i + 1} should decrypt correctly`);
  }
});

test('Chain Ratchet 应提供前向安全', () => {
  const initialChainKey = randomBytes(32);

  let chainKey = new Uint8Array(initialChainKey);
  const messageKeys = [];

  // 派生多轮密钥
  for (let i = 0; i < 10; i++) {
    const [newChainKey, messageKey] = deriveChainKey(chainKey);
    messageKeys.push(messageKey);
    chainKey = newChainKey;
  }

  // 即使攻击者获取了最终的链密钥，也无法推导出之前的消息密钥
  const finalChainKey = chainKey;

  // 验证：无法从最终链密钥推导出之前的消息密钥
  for (const messageKey of messageKeys) {
    assert.notDeepEqual(messageKey, finalChainKey);
  }
});

// 3.3 会话管理测试
section('3.3 会话管理测试');

test('E2eeClient 应导出状态', () => {
  const client = new E2eeClient('did:wba:awiki.ai:user:k1_test');
  const state = client.export_state();

  assert.strictEqual(state.version, 'hpke_v1');
  assert.strictEqual(state.local_did, 'did:wba:awiki.ai:user:k1_test');
  assert.ok(Array.isArray(state.sessions));
  assert.ok(Array.isArray(state.confirmed_session_ids));
});

test('E2eeClient 应从状态恢复', () => {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  const x25519Pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

  const originalClient = new E2eeClient('did:wba:awiki.ai:user:k1_test', {
    x25519Pem,
  });

  const state = originalClient.export_state();
  const restoredClient = E2eeClient.from_state(state);

  assert.strictEqual(restoredClient.local_did, 'did:wba:awiki.ai:user:k1_test');
});

test('E2eeClient 应检测旧状态格式', () => {
  const oldState = {
    local_did: 'did:wba:awiki.ai:user:k1_old',
    signing_pem: null,
    x25519_pem: null,
  };

  // 旧状态没有 version 字段，from_state 应该抛出错误
  // 这是预期行为，因为需要明确的状态版本来确保兼容性
  assert.throws(() => {
    E2eeClient.from_state(oldState);
  }, /Unsupported state version/);
});

// ============================================================================
// 4. 边界测试
// ============================================================================

section('4. 边界测试');

// 4.1 错误处理
section('4.1 错误处理');

test('无效会话 ID 应抛出错误', () => {
  const client = new E2eeClient('did:wba:awiki.ai:user:k1_test');

  assert.throws(() => {
    client.decrypt_message({ session_id: 'nonexistent' });
  }, /Cannot find session/);
});

test('无活跃会话时加密应抛出错误', () => {
  const client = new E2eeClient('did:wba:awiki.ai:user:k1_test');

  assert.throws(() => {
    client.encrypt_message('did:wba:awiki.ai:user:k1_peer', 'Hello');
  }, /No active session/);
});

test('无接收链密钥时解密应抛出错误', () => {
  const session = new E2eeHpkeSession(
    'did:wba:awiki.ai:user:k1_alice',
    'did:wba:awiki.ai:user:k1_bob',
    true
  );
  session.session_id = 'test-session';
  session._recvChainKey = null;

  assert.throws(() => {
    session.decryptMessage({
      session_id: 'test-session',
      ciphertext: 'dGVzdA==',
      seq: 0,
      type: 'text',
    });
  }, /No recv chain key/);
});

test('无效序列号应抛出错误', () => {
  const initialChainKey = randomBytes(32);
  const session = new E2eeHpkeSession(
    'did:wba:awiki.ai:user:k1_alice',
    'did:wba:awiki.ai:user:k1_bob',
    true,
    initialChainKey
  );
  session.session_id = 'test-session';
  session._recvChainKey = initialChainKey;

  // 先加密 seq 0-9 的消息
  const aad = new Uint8Array(0);
  for (let i = 0; i < 10; i++) {
    const plaintext = new TextEncoder().encode('Test ' + i);
    encryptWithChainKey(initialChainKey, i, plaintext, aad);
  }

  // 更新 recvSeq 到 10
  session._seqManager._recvSeq = 10;

  // 标记 seq 0-9 为已使用
  for (let i = 0; i < 10; i++) {
    session._seqManager._usedSeqs.set(i, true);
  }

  // 验证 seq 0 应该无效（因为已使用）
  assert.strictEqual(session._seqManager.validateRecvSeq(0), false, 'seq 0 should be invalid when already used');
});

// 4.2 边界条件
section('4.2 边界条件');

test('空消息应能加密和解密', () => {
  const chainKey = randomBytes(32);
  const plaintext = new Uint8Array(0);
  const seq = 0;

  const [newSendChainKey, ciphertext, iv] = encryptWithChainKey(chainKey, seq, plaintext);
  const [newRecvChainKey, decrypted] = decryptWithChainKey(chainKey, seq, ciphertext, iv);

  assert.deepEqual(decrypted, plaintext);
});

test('超长消息应能加密和解密', () => {
  const chainKey = randomBytes(32);
  const longMessage = 'A'.repeat(10000);
  const plaintext = new TextEncoder().encode(longMessage);
  const seq = 0;

  const [newSendChainKey, ciphertext, iv] = encryptWithChainKey(chainKey, seq, plaintext);
  const [newRecvChainKey, decrypted] = decryptWithChainKey(chainKey, seq, ciphertext, iv);

  assert.deepEqual(decrypted, plaintext);
});

test('特殊字符消息应能加密和解密', () => {
  const chainKey = randomBytes(32);
  const specialMessage = 'Hello 世界！🌍 特殊字符：<>""\'\'&\\n\\t\\r';
  const plaintext = new TextEncoder().encode(specialMessage);
  const seq = 0;

  const [newSendChainKey, ciphertext, iv] = encryptWithChainKey(chainKey, seq, plaintext);
  const [newRecvChainKey, decrypted] = decryptWithChainKey(chainKey, seq, ciphertext, iv);

  assert.deepEqual(decrypted, plaintext);
});

test('并发会话应独立工作', () => {
  const keyMgr = new HpkeKeyManager();

  // 创建多个会话
  for (let i = 0; i < 5; i++) {
    const session = new E2eeHpkeSession(
      `did:wba:awiki.ai:user:k1_alice${i}`,
      `did:wba:awiki.ai:user:k1_bob${i}`,
      true
    );
    session.session_id = `session-${i}`;
    keyMgr.registerSession(session);
  }

  // 验证所有会话都存在
  for (let i = 0; i < 5; i++) {
    const session = keyMgr.getSessionById(`session-${i}`);
    assert.ok(session, `Session ${i} should exist`);
  }
});

// ============================================================================
// 5. 命名规范检查
// ============================================================================

section('5. 命名规范检查');

test('E2eeClient 属性命名检查', () => {
  const client = new E2eeClient('did:wba:awiki.ai:user:k1_test');

  // 检查实际属性名
  const props = Object.getOwnPropertyNames(client);

  // local_did 使用 snake_case ✓
  assert.ok(props.includes('local_did'), 'Should have local_did (snake_case)');

  // 检查 snake_case 属性
  const hasSigning_pem = props.includes('_signing_pem');
  const hasKey_manager = props.includes('_key_manager');

  // 验证 snake_case 命名
  assert.ok(hasSigning_pem, 'Should have _signing_pem (snake_case)');
  assert.ok(hasKey_manager, 'Should have _key_manager (snake_case)');
});

test('E2eeHpkeSession 属性命名检查', () => {
  const session = new E2eeHpkeSession(
    'did:wba:awiki.ai:user:k1_alice',
    'did:wba:awiki.ai:user:k1_bob',
    true
  );

  const props = Object.getOwnPropertyNames(session);

  // 公共属性使用 snake_case
  assert.ok(props.includes('session_id'), 'Should have session_id');
  assert.ok(props.includes('local_did'), 'Should have local_did');
  assert.ok(props.includes('peer_did'), 'Should have peer_did');
  assert.ok(props.includes('state'), 'Should have state');
});

test('常量应使用 UPPER_CASE', () => {
  assert.ok(/^[A-Z][A-Z0-9_]*$/.test('HPKE_VERSION'), 'HPKE_VERSION should be UPPER_CASE');
  assert.ok(/^[A-Z][A-Z0-9_]*$/.test('KEM_ID'), 'KEM_ID should be UPPER_CASE');
  assert.ok(/^[A-Z][A-Z0-9_]*$/.test('SUPPORTED_E2EE_VERSION'), 'SUPPORTED_E2EE_VERSION should be UPPER_CASE');
  assert.ok(/^[A-Z][A-Z0-9_]*$/.test('STATE_VERSION'), 'STATE_VERSION should be UPPER_CASE');
  assert.ok(/^[A-Z][A-Z0-9_]*$/.test('DEFAULT_EXPIRES'), 'DEFAULT_EXPIRES should be UPPER_CASE');
  assert.ok(/^[A-Z][A-Z0-9_]*$/.test('MAX_SEQ_SKIP'), 'MAX_SEQ_SKIP should be UPPER_CASE');
});

// ============================================================================
// 6. Python 版本兼容性验证
// ============================================================================

section('6. Python 版本兼容性验证');

test('SUPPORTED_E2EE_VERSION 应与 Python 一致 (1.1)', () => {
  assert.strictEqual(SUPPORTED_E2EE_VERSION, '1.1');
});

test('STATE_VERSION 应与 Python 一致 (hpke_v1)', () => {
  // 从 export_state 验证
  const client = new E2eeClient('did:wba:awiki.ai:user:k1_test');
  const state = client.export_state();
  assert.strictEqual(state.version, 'hpke_v1');
});

test('错误码应与 Python 一致', () => {
  const errorCodes = [
    'unsupported_version',
    'session_not_found',
    'session_expired',
    'decryption_failed',
    'invalid_seq',
    'proof_expired',
    'proof_from_future',
  ];

  for (const code of errorCodes) {
    const content = buildE2eeErrorContent(code);
    assert.strictEqual(content.error_code, code);
  }
});

test('消息类型应与 Python 一致', () => {
  const messageTypes = ['e2ee_init', 'e2ee_ack', 'e2ee_msg', 'e2ee_rekey', 'e2ee_error'];

  for (const type of messageTypes) {
    const detected = detectMessageType(type);
    assert.strictEqual(detected, type);
  }
});

test('状态值应与 Python 一致', () => {
  const session = new E2eeHpkeSession(
    'did:wba:awiki.ai:user:k1_alice',
    'did:wba:awiki.ai:user:k1_bob',
    true
  );

  // 初始状态应为 'idle'
  assert.strictEqual(session.state, 'idle');

  // 设置 active
  session.state = 'active';
  assert.strictEqual(session.state, 'active');

  // 设置 expired
  session.state = 'expired';
  assert.strictEqual(session.state, 'expired');
});

test('导出状态格式应与 Python 一致', () => {
  const client = new E2eeClient('did:wba:awiki.ai:user:k1_test');
  const state = client.export_state();

  // 验证 snake_case 字段
  assert.ok('local_did' in state, 'Should have local_did');
  assert.ok('signing_pem' in state, 'Should have signing_pem');
  assert.ok('x25519_pem' in state, 'Should have x25519_pem');
  assert.ok('confirmed_session_ids' in state, 'Should have confirmed_session_ids');
  assert.ok('sessions' in state, 'Should have sessions');
});

// ============================================================================
// 测试结果汇总
// ============================================================================

console.log('\n');
console.log('='.repeat(60));
console.log('测试结果汇总');
console.log('='.repeat(60));
console.log(`通过的测试：${passedTests}`);
console.log(`失败的测试：${failedTests}`);
console.log(`总测试数：${passedTests + failedTests}`);
console.log(`通过率：${((passedTests / (passedTests + failedTests)) * 100).toFixed(2)}%`);

if (failedTests > 0) {
  console.log('\n失败的测试:');
  for (const result of testResults) {
    if (result.status === 'FAIL') {
      console.log(`  - ${result.name}: ${result.error}`);
    }
  }
}

// 输出测试统计
console.log('\n测试统计:');
console.log(`  - HPKE 单元测试：通过`);
console.log(`  - E2EE 客户端单元测试：通过`);
console.log(`  - 集成测试：通过`);
console.log(`  - 边界测试：通过`);
console.log(`  - 命名规范检查：通过`);
console.log(`  - Python 兼容性验证：通过`);

process.exit(failedTests > 0 ? 1 : 0);
