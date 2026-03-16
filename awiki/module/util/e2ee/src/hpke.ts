/**
 * HPKE (Hybrid Public Key Encryption) 协议实现
 */

import { x25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes, createHmac, createCipheriv, createDecipheriv } from 'crypto';

const HPKE_VERSION = 'HPKE-v1';
const KEM_ID = 0x0020;
const KDF_ID = 0x0001;
const AEAD_ID = 0x0001;
const AEAD_KEY_LENGTH = 16;
const AEAD_NONCE_LENGTH = 12;
const AEAD_TAG_LENGTH = 16;

export const HPKE_SUITE = { kemId: KEM_ID, kdfId: KDF_ID, aeadId: AEAD_ID, keyLength: AEAD_KEY_LENGTH, nonceLength: AEAD_NONCE_LENGTH };

const LABEL_INFO = new TextEncoder().encode('info');
const LABEL_BASE_KEY = new TextEncoder().encode('key');
const LABEL_BASE_NONCE = new TextEncoder().encode('base nonce');
const LABEL_SECRET = new TextEncoder().encode('secret');

export function concatBytes(...arrays: (Uint8Array | number[])[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr as Uint8Array, offset);
    offset += arr.length;
  }
  return result;
}

export function i2osp(value: number, length: number): Uint8Array {
  if (value < 0 || value >= 256 ** length) throw new Error('I2OSP: value out of range');
  const result = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) { result[i] = value & 0xff; value >>= 8; }
  return result;
}

function hkdfExtract(salt: Uint8Array | undefined, ikm: Uint8Array): Uint8Array {
  if (!salt || salt.length === 0) salt = new Uint8Array(sha256.outputLen);
  const hmac = createHmac('sha256', Buffer.from(salt));
  hmac.update(Buffer.from(ikm));
  return Uint8Array.from(hmac.digest());
}

function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Uint8Array {
  const hashLen = sha256.outputLen;
  const n = Math.ceil(length / hashLen);
  if (n > 255) throw new Error('HKDF-Expand: output length too large');
  let okm: number[] = [];
  let t: number[] = [];
  for (let i = 1; i <= n; i++) {
    const hmac = createHmac('sha256', Buffer.from(prk));
    hmac.update(Buffer.from(t));
    hmac.update(Buffer.from(info));
    hmac.update(new Uint8Array([i]));
    t = Array.from(hmac.digest());
    okm = okm.concat(t);
  }
  return new Uint8Array(okm.slice(0, length));
}

function labeledExtract(salt: Uint8Array | undefined, label: Uint8Array, ikm: Uint8Array): Uint8Array {
  const labeledIkm = concatBytes(
    new TextEncoder().encode(HPKE_VERSION),
    i2osp(KEM_ID, 2), i2osp(KDF_ID, 2), i2osp(AEAD_ID, 2), label, ikm
  );
  return hkdfExtract(salt, labeledIkm);
}

function labeledExpand(prk: Uint8Array, label: Uint8Array, info: Uint8Array, length: number): Uint8Array {
  const labeledInfo = concatBytes(
    i2osp(length, 2),
    new TextEncoder().encode(HPKE_VERSION),
    i2osp(KEM_ID, 2), i2osp(KDF_ID, 2), i2osp(AEAD_ID, 2), label, info
  );
  return hkdfExpand(prk, labeledInfo, length);
}

function extractAndExpand(sharedSecret: Uint8Array, info: Uint8Array): { key: Uint8Array; baseNonce: Uint8Array } {
  const secret = labeledExtract(new Uint8Array(0), LABEL_SECRET, sharedSecret);
  return {
    key: labeledExpand(secret, LABEL_BASE_KEY, info, AEAD_KEY_LENGTH),
    baseNonce: labeledExpand(secret, LABEL_BASE_NONCE, info, AEAD_NONCE_LENGTH),
  };
}

export interface HpkeSealResult {
  ciphertext: Uint8Array;
  encapsulatedKey: Uint8Array;
  sequenceNumber: Uint8Array;
}

export function hpkeSeal(recipientPublicKey: Uint8Array, info: Uint8Array, aad: Uint8Array, plaintext: Uint8Array): HpkeSealResult {
  const ephemeralPrivateKey = x25519.utils.randomPrivateKey();
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);
  const sharedSecret = x25519.getSharedSecret(ephemeralPrivateKey, recipientPublicKey);
  const { key, baseNonce } = extractAndExpand(sharedSecret, info);
  const sequenceNumber = randomBytes(8);
  const nonce = new Uint8Array(AEAD_NONCE_LENGTH);
  for (let i = 0; i < AEAD_NONCE_LENGTH; i++) nonce[i] = baseNonce[i] ^ sequenceNumber[i];
  const cipher = createCipheriv('aes-128-gcm', Buffer.from(key), Buffer.from(nonce));
  cipher.setAAD(Buffer.from(aad));
  const encrypted = cipher.update(Buffer.from(plaintext));
  const final = cipher.final();
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: concatBytes(Array.from(encrypted), Array.from(final), Array.from(authTag)),
    encapsulatedKey: ephemeralPublicKey,
    sequenceNumber,
  };
}

export function hpkeOpen(recipientSecretKey: Uint8Array, encapsulatedKey: Uint8Array, info: Uint8Array, aad: Uint8Array, ciphertext: Uint8Array, sequenceNumber: Uint8Array): Uint8Array {
  const sharedSecret = x25519.getSharedSecret(recipientSecretKey, encapsulatedKey);
  const { key, baseNonce } = extractAndExpand(sharedSecret, info);
  const nonce = new Uint8Array(AEAD_NONCE_LENGTH);
  for (let i = 0; i < AEAD_NONCE_LENGTH; i++) nonce[i] = baseNonce[i] ^ sequenceNumber[i];
  if (ciphertext.length < AEAD_TAG_LENGTH) throw new Error('Ciphertext too short');
  const authTagStart = ciphertext.length - AEAD_TAG_LENGTH;
  const decipher = createDecipheriv('aes-128-gcm', Buffer.from(key), Buffer.from(nonce));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(ciphertext.slice(authTagStart)));
  const decrypted = decipher.update(Buffer.from(ciphertext.slice(0, authTagStart)));
  const final = decipher.final();
  return concatBytes(Array.from(decrypted), Array.from(final));
}

export function deriveChainKey(chainKey: Uint8Array): [Uint8Array, Uint8Array] {
  const hmac = createHmac('sha256', Buffer.from(chainKey));
  hmac.update(new Uint8Array([0x01]));
  const messageKey = Uint8Array.from(hmac.digest());
  const newChainKey = labeledExpand(chainKey, LABEL_INFO, new Uint8Array(0), sha256.outputLen);
  return [newChainKey, messageKey];
}

export function deriveEncryptionKey(chainKey: Uint8Array, sequenceNumber: number): Uint8Array {
  return labeledExpand(chainKey, LABEL_BASE_KEY, concatBytes(LABEL_INFO, i2osp(sequenceNumber, 8)), 32);
}

export function encryptWithChainKey(chainKey: Uint8Array, sequenceNumber: number, plaintext: Uint8Array, aad: Uint8Array = new Uint8Array(0)): [Uint8Array, Uint8Array, Uint8Array] {
  const [newChainKey, messageKey] = deriveChainKey(chainKey);
  const encryptionKey = deriveEncryptionKey(messageKey, sequenceNumber);
  const iv = randomBytes(AEAD_NONCE_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(encryptionKey.slice(0, 32)), iv);
  cipher.setAAD(Buffer.from(aad));
  const encrypted = cipher.update(Buffer.from(plaintext));
  const final = cipher.final();
  const authTag = cipher.getAuthTag();
  return [newChainKey, concatBytes(Array.from(encrypted), Array.from(final), Array.from(authTag)), iv];
}

export function decryptWithChainKey(chainKey: Uint8Array, sequenceNumber: number, ciphertext: Uint8Array, iv: Uint8Array, aad: Uint8Array = new Uint8Array(0)): [Uint8Array, Uint8Array] {
  const [newChainKey, messageKey] = deriveChainKey(chainKey);
  const decryptionKey = deriveEncryptionKey(messageKey, sequenceNumber);
  if (ciphertext.length < AEAD_TAG_LENGTH) throw new Error('Ciphertext too short');
  const authTagStart = ciphertext.length - AEAD_TAG_LENGTH;
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(decryptionKey.slice(0, 32)), Buffer.from(iv));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(ciphertext.slice(authTagStart)));
  const decrypted = decipher.update(Buffer.from(ciphertext.slice(0, authTagStart)));
  const final = decipher.final();
  return [newChainKey, concatBytes(Array.from(decrypted), Array.from(final))];
}

export { x25519 };
export { HPKE_VERSION, KEM_ID, KDF_ID, AEAD_ID, AEAD_KEY_LENGTH, AEAD_NONCE_LENGTH, AEAD_TAG_LENGTH };
