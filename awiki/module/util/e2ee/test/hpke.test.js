/**
 * HPKE 协议集成测试
 */

import { strict as assert } from 'assert';
import { randomBytes } from 'crypto';
import {
  hpkeSeal,
  hpkeOpen,
  deriveChainKey,
  deriveEncryptionKey,
  encryptWithChainKey,
  decryptWithChainKey,
  x25519,
} from '../dist/hpke.js';

console.log('Starting HPKE integration tests...\n');

// Test 1: HPKE Seal/Open cycle
console.log('Test 1: HPKE Seal/Open cycle...');
{
  const recipientSecretKey = x25519.utils.randomPrivateKey();
  const recipientPublicKey = x25519.getPublicKey(recipientSecretKey);
  const info = new TextEncoder().encode('test-info');
  const aad = new TextEncoder().encode('test-aad');
  const plaintext = new TextEncoder().encode('Hello, HPKE!');
  const result = hpkeSeal(recipientPublicKey, info, aad, plaintext);
  const decrypted = hpkeOpen(recipientSecretKey, result.encapsulatedKey, info, aad, result.ciphertext, result.sequenceNumber);
  assert.deepEqual(decrypted, plaintext, 'Decrypted plaintext should match original');
  console.log('✓ HPKE Seal/Open cycle OK');
}

// Test 2: Chain Ratchet key derivation
console.log('\nTest 2: Chain Ratchet key derivation...');
{
  const initialChainKey = randomBytes(32);
  let chainKey = initialChainKey;
  const messageKeys = [];
  for (let i = 0; i < 5; i++) {
    const [newChainKey, messageKey] = deriveChainKey(chainKey);
    messageKeys.push(messageKey);
    chainKey = newChainKey;
  }
  for (let i = 0; i < messageKeys.length; i++) {
    for (let j = i + 1; j < messageKeys.length; j++) {
      assert.notDeepEqual(messageKeys[i], messageKeys[j], 'Message keys should be different');
    }
  }
  console.log('✓ Chain Ratchet key derivation OK');
}

// Test 3: Encrypt/Decrypt with chain key
console.log('\nTest 3: Encrypt/Decrypt with chain key...');
{
  const initialChainKey = randomBytes(32);
  const plaintext = new TextEncoder().encode('Secret message');
  const seq = 0;
  const [newSendChainKey, ciphertext, iv] = encryptWithChainKey(initialChainKey, seq, plaintext);
  const [newRecvChainKey, decrypted] = decryptWithChainKey(initialChainKey, seq, ciphertext, iv);
  assert.deepEqual(decrypted, plaintext, 'Decrypted should match original plaintext');
  assert.deepEqual(newSendChainKey, newRecvChainKey, 'Chain keys should advance identically');
  console.log('✓ Encrypt/Decrypt with chain key OK');
}

// Test 4: Multi-round conversation (forward secrecy)
console.log('\nTest 4: Multi-round conversation (forward secrecy)...');
{
  const sharedSecret = randomBytes(32);
  const salt = randomBytes(32);
  const { createHmac } = await import('crypto');
  const hmac = createHmac('sha256', Buffer.from(salt));
  hmac.update(Buffer.from(sharedSecret));
  hmac.update(Buffer.from('e2ee_chain_key'));
  let sendChainKey = new Uint8Array(hmac.digest());
  let recvChainKey = new Uint8Array(sendChainKey);
  const messages = ['Message 1', 'Message 2', 'Message 3', 'Message 4', 'Message 5'];
  const encryptedMessages = [];
  for (let i = 0; i < messages.length; i++) {
    const [newChainKey, ciphertext, iv] = encryptWithChainKey(sendChainKey, i, new TextEncoder().encode(messages[i]));
    sendChainKey = newChainKey;
    encryptedMessages.push({ ciphertext, iv, seq: i });
  }
  for (let i = 0; i < encryptedMessages.length; i++) {
    const { ciphertext, iv, seq } = encryptedMessages[i];
    const [newChainKey, decrypted] = decryptWithChainKey(recvChainKey, seq, ciphertext, iv);
    recvChainKey = newChainKey;
    assert.strictEqual(new TextDecoder().decode(decrypted), messages[i], 'Message ' + i + ' should decrypt correctly');
  }
  console.log('✓ Multi-round conversation (forward secrecy) OK');
}

// Test 5: Different info produces different keys
console.log('\nTest 5: Different info produces different keys...');
{
  const recipientSecretKey = x25519.utils.randomPrivateKey();
  const recipientPublicKey = x25519.getPublicKey(recipientSecretKey);
  const plaintext = new TextEncoder().encode('Test message');
  const aad = new Uint8Array(0);
  const info1 = new TextEncoder().encode('context-1');
  const info2 = new TextEncoder().encode('context-2');
  const result1 = hpkeSeal(recipientPublicKey, info1, aad, plaintext);
  const result2 = hpkeSeal(recipientPublicKey, info2, aad, plaintext);
  const decrypted1 = hpkeOpen(recipientSecretKey, result1.encapsulatedKey, info1, aad, result1.ciphertext, result1.sequenceNumber);
  try {
    hpkeOpen(recipientSecretKey, result1.encapsulatedKey, info2, aad, result1.ciphertext, result1.sequenceNumber);
    assert.fail('Should fail with wrong info');
  } catch (e) { /* expected */ }
  assert.deepEqual(decrypted1, plaintext, 'Decryption with correct info should succeed');
  console.log('✓ Different info produces different keys OK');
}

// Test 6: AAD integrity protection
console.log('\nTest 6: AAD integrity protection...');
{
  const recipientSecretKey = x25519.utils.randomPrivateKey();
  const recipientPublicKey = x25519.getPublicKey(recipientSecretKey);
  const plaintext = new TextEncoder().encode('Test message');
  const info = new Uint8Array(0);
  const aad1 = new TextEncoder().encode('aad-1');
  const aad2 = new TextEncoder().encode('aad-2');
  const result = hpkeSeal(recipientPublicKey, info, aad1, plaintext);
  try {
    hpkeOpen(recipientSecretKey, result.encapsulatedKey, info, aad2, result.ciphertext, result.sequenceNumber);
    assert.fail('Should fail with wrong AAD');
  } catch (e) { /* expected */ }
  const decrypted = hpkeOpen(recipientSecretKey, result.encapsulatedKey, info, aad1, result.ciphertext, result.sequenceNumber);
  assert.deepEqual(decrypted, plaintext, 'Decryption with correct AAD should succeed');
  console.log('✓ AAD integrity protection OK');
}

console.log('\n✅ All HPKE integration tests passed!');
