/**
 * E2EE 模块基本测试
 */

import { strict as assert } from 'assert';
import {
  E2eeClient,
  SUPPORTED_E2EE_VERSION,
  buildE2eeErrorContent,
  buildE2eeErrorMessage,
  classifyProtocolError,
  detectMessageType,
  extractProofVerificationMethod,
  ensureSupportedE2eeVersion,
} from '../dist/index.js';

// 测试常量
console.log('Testing constants...');
assert.strictEqual(SUPPORTED_E2EE_VERSION, '1.1');
console.log('✓ Constants OK');

// 测试 extractProofVerificationMethod
console.log('Testing extractProofVerificationMethod...');
assert.strictEqual(extractProofVerificationMethod({ verification_method: 'test#key-2' }), 'test#key-2');
assert.strictEqual(extractProofVerificationMethod({ verificationMethod: 'test#key-2' }), 'test#key-2');
assert.strictEqual(extractProofVerificationMethod('not_a_dict'), '');
assert.strictEqual(extractProofVerificationMethod(null), '');
console.log('✓ extractProofVerificationMethod OK');

// 测试 ensureSupportedE2eeVersion
console.log('Testing ensureSupportedE2eeVersion...');
assert.strictEqual(ensureSupportedE2eeVersion({ e2ee_version: '1.1' }), '1.1');
try {
  ensureSupportedE2eeVersion({});
  assert.fail('Should throw error for missing version');
} catch (e) {
  assert.ok(e.message.includes('unsupported_version'));
}
try {
  ensureSupportedE2eeVersion({ e2ee_version: '1.0' });
  assert.fail('Should throw error for unsupported version');
} catch (e) {
  assert.ok(e.message.includes('unsupported_version'));
}
console.log('✓ ensureSupportedE2eeVersion OK');

// 测试 buildE2eeErrorContent
console.log('Testing buildE2eeErrorContent...');
const errorContent = buildE2eeErrorContent('session_not_found', {
  session_id: 'test123',
  retry_hint: 'resend',
});
assert.strictEqual(errorContent.e2ee_version, '1.1');
assert.strictEqual(errorContent.error_code, 'session_not_found');
assert.strictEqual(errorContent.session_id, 'test123');
assert.strictEqual(errorContent.retry_hint, 'resend');
console.log('✓ buildE2eeErrorContent OK');

// 测试 buildE2eeErrorMessage
console.log('Testing buildE2eeErrorMessage...');
const msg1 = buildE2eeErrorMessage('session_expired');
assert.ok(msg1.includes('expired'), `Message should include 'expired': ${msg1}`);
const msg2 = buildE2eeErrorMessage('decryption_failed', { detail: 'HPKE failed' });
assert.ok(msg2.includes('Detail: HPKE failed'));
console.log('✓ buildE2eeErrorMessage OK');

// 测试 classifyProtocolError
console.log('Testing classifyProtocolError...');
const err1 = classifyProtocolError(new Error('proof_expired'));
assert.deepStrictEqual(err1, ['proof_expired', 'resend']);
const err2 = classifyProtocolError(new Error('unsupported_version'));
assert.deepStrictEqual(err2, ['unsupported_version', 'drop']);
const err3 = classifyProtocolError(new Error('unknown error'));
assert.strictEqual(err3, null);
console.log('✓ classifyProtocolError OK');

// 测试 detectMessageType
console.log('Testing detectMessageType...');
assert.strictEqual(detectMessageType('e2ee_init'), 'e2ee_init');
assert.strictEqual(detectMessageType('e2ee_ack'), 'e2ee_ack');
assert.strictEqual(detectMessageType('e2ee_msg'), 'e2ee_msg');
assert.strictEqual(detectMessageType('e2ee_rekey'), 'e2ee_rekey');
assert.strictEqual(detectMessageType('e2ee_error'), 'e2ee_error');
assert.strictEqual(detectMessageType('invalid_type'), null);
console.log('✓ detectMessageType OK');

// 测试 E2eeClient 构造函数
console.log('Testing E2eeClient constructor...');
const client1 = new E2eeClient('did:wba:awiki.ai:user:k1_test');
assert.strictEqual(client1.local_did, 'did:wba:awiki.ai:user:k1_test');
assert.strictEqual(client1.has_active_session('peer'), false);

// 生成测试密钥
const { generateKeyPairSync } = await import('crypto');
const signingKeys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const x25519Keys = generateKeyPairSync('x25519');

const signingPem = signingKeys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const x25519Pem = x25519Keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

const client2 = new E2eeClient('did:wba:awiki.ai:user:k1_test2', {
  signingPem,
  x25519Pem,
});
assert.strictEqual(client2.local_did, 'did:wba:awiki.ai:user:k1_test2');
console.log('✓ E2eeClient constructor OK');

// 测试状态导出/恢复
console.log('Testing export_state/from_state...');
const state = client2.export_state();
assert.strictEqual(state.version, 'hpke_v1');
assert.strictEqual(state.local_did, 'did:wba:awiki.ai:user:k1_test2');
assert.ok(Array.isArray(state.sessions));
assert.ok(Array.isArray(state.confirmed_session_ids));

const restoredClient = E2eeClient.from_state(state);
assert.strictEqual(restoredClient.local_did, 'did:wba:awiki.ai:user:k1_test2');
console.log('✓ export_state/from_state OK');

// 测试旧格式状态检测
console.log('Testing old format state detection...');
const oldState = {
  local_did: 'did:wba:awiki.ai:user:k1_old',
  signing_pem: signingPem,
  x25519_pem: x25519Pem,
};
// 旧状态没有 version 字段，from_state 会抛出 Unsupported state version 错误
// 这是预期行为，因为需要明确的状态版本
try {
  E2eeClient.from_state(oldState);
  assert.fail('Should throw error for old state format');
} catch (e) {
  assert.ok(e.message.includes('Unsupported state version'));
}
console.log('✓ Old format state detection OK');

// 测试 has_session_id 和 is_session_confirmed
console.log('Testing has_session_id and is_session_confirmed...');
assert.strictEqual(client2.has_session_id(null), false);
assert.strictEqual(client2.has_session_id(undefined), false);
assert.strictEqual(client2.has_session_id(''), false);
assert.strictEqual(client2.has_session_id('nonexistent'), false);
assert.strictEqual(client2.is_session_confirmed(null), false);
assert.strictEqual(client2.is_session_confirmed('nonexistent'), false);
console.log('✓ has_session_id and is_session_confirmed OK');

console.log('\n✅ All tests passed!');
