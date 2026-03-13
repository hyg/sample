/**
 * HPKE 浏览器实现 - 基于 @noble/curves 和 Web Crypto API
 * 与 CLI 的 hpke-native.js 兼容
 */

import { x25519 } from '@noble/curves/x25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';
import { randomBytes } from '@noble/hashes/utils';

// HPKE 套件标识
export const HPKE_SUITE = 'DHKEM-X25519-HKDF-SHA256/HKDF-SHA256/AES-128-GCM';

/**
 * 工具函数：连接字节数组
 */
function concatBytes(...arrays) {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * HKDF-Extract
 */
function hkdfExtract(salt, ikm) {
  return hmac(sha256, salt, ikm);
}

/**
 * HKDF-Expand
 */
function hkdfExpand(prk, info, length) {
  const hashLen = 32;
  const n = Math.ceil(length / hashLen);
  let okm = new Uint8Array();
  let t = new Uint8Array();
  for (let i = 0; i < n; i++) {
    const infoBytes = concatBytes(t, info, new Uint8Array([i + 1]));
    t = hmac(sha256, prk, infoBytes);
    okm = concatBytes(okm, t);
  }
  return okm.slice(0, length);
}

/**
 * HKDF 单次调用
 */
function hkdfSingle(salt, ikm, info, length) {
  const prk = hkdfExtract(salt, ikm);
  return hkdfExpand(prk, info, length);
}

/**
 * Labeled Extract (HPKE RFC 9180) - 与 CLI hpke-native.js 兼容
 */
function labeledExtract(suiteContext, label, info) {
  const hpkeLabel = 'HPKE-v1';
  const context = suiteContext || '';
  const input = concatBytes(
    new TextEncoder().encode(hpkeLabel),
    new TextEncoder().encode(context),
    new TextEncoder().encode(label),
    info
  );
  return hkdfExtract(new Uint8Array(), input);
}

/**
 * Labeled Expand (HPKE RFC 9180) - 与 CLI hpke-native.js 兼容
 */
function labeledExpand(prk, suiteContext, label, info, length) {
  const hpkeLabel = 'HPKE-v1';
  const context = suiteContext || '';
  const lengthBytes = new Uint8Array(2);
  lengthBytes[0] = (length >> 8) & 0xff;
  lengthBytes[1] = length & 0xff;

  const infoInput = concatBytes(
    lengthBytes,
    new TextEncoder().encode(hpkeLabel),
    new TextEncoder().encode(context),
    new TextEncoder().encode(label),
    info
  );
  return hkdfExpand(prk, infoInput, length);
}

/**
 * 派生链密钥 - 与 CLI 兼容
 */
export function deriveChainKeys(rootSeed) {
  const initChainKey = hkdfSingle(new Uint8Array(), rootSeed, new TextEncoder().encode('anp-e2ee-init'), 32);
  const respChainKey = hkdfSingle(new Uint8Array(), rootSeed, new TextEncoder().encode('anp-e2ee-resp'), 32);
  return { initChainKey, respChainKey };
}

/**
 * 加密消息密钥派生 - 与 CLI 兼容
 */
export function deriveMessageKey(chainKey, seq) {
  const encoder = new TextEncoder();
  const seqBytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    seqBytes[7 - i] = Number((seq >> BigInt(i * 8)) & 0xffn);
  }

  const info = concatBytes(encoder.encode('msg'), seqBytes);
  const msgKey = hkdfSingle(new Uint8Array(), chainKey, info, 32);
  const newChainKey = hkdfSingle(new Uint8Array(), chainKey, encoder.encode('ck'), 32);
  const encKey = hkdfSingle(new Uint8Array(), msgKey, encoder.encode('key'), 16);
  const nonce = hkdfSingle(new Uint8Array(), msgKey, encoder.encode('nonce'), 12);

  return { encKey, nonce, newChainKey };
}

/**
 * AES-GCM 加密（使用 Web Crypto API）
 */
export async function aesGcmEncrypt(key, nonce, plaintext, aad = new Uint8Array()) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM', length: 128 }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad }, cryptoKey, plaintext);
  return new Uint8Array(encrypted);
}

/**
 * AES-GCM 解密（使用 Web Crypto API）
 */
export async function aesGcmDecrypt(key, nonce, ciphertext, aad = new Uint8Array()) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM', length: 128 }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad }, cryptoKey, ciphertext);
  return new Uint8Array(decrypted);
}

/**
 * HPKE 封装（发送方）- 与 CLI hpke-native.js 兼容
 */
export async function hpkeSeal({ recipientPublicKey, plaintext, info = new Uint8Array() }) {
  // 生成临时密钥对
  const ephemeralPrivateKey = x25519.utils.randomPrivateKey();
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);

  // ECDH 密钥交换
  const sharedSecret = x25519.getSharedSecret(ephemeralPrivateKey, recipientPublicKey);

  // 派生共享密钥 - 使用 KEM-X25519 上下文
  const suiteContext = 'KEM-X25519';
  const dh = labeledExtract(suiteContext, 'shared_secret', sharedSecret);

  // 派生密钥和 nonce - 使用 labeledExpand
  const key = labeledExpand(dh, suiteContext, 'key', info, 16);
  const baseNonce = labeledExpand(dh, suiteContext, 'base_nonce', info, 12);

  // XOR nonce with sequence number 0 (Base mode)
  const nonce = xorNonce(0n, baseNonce);

  // AES-GCM 加密
  const ciphertext = await aesGcmEncrypt(key, nonce, plaintext, info);

  return {
    enc: ephemeralPublicKey,
    ciphertext
  };
}

/**
 * HPKE 解封（接收方）- 与 CLI hpke-native.js 兼容
 */
export async function hpkeOpen({ recipientPrivateKey, enc, ciphertext, info = new Uint8Array() }) {
  // ECDH 密钥交换
  const sharedSecret = x25519.getSharedSecret(recipientPrivateKey, enc);

  // 派生共享密钥 - 使用 KEM-X25519 上下文
  const suiteContext = 'KEM-X25519';
  const dh = labeledExtract(suiteContext, 'shared_secret', sharedSecret);

  // 派生密钥和 nonce - 使用 labeledExpand
  const key = labeledExpand(dh, suiteContext, 'key', info, 16);
  const baseNonce = labeledExpand(dh, suiteContext, 'base_nonce', info, 12);

  // XOR nonce with sequence number 0 (Base mode)
  const nonce = xorNonce(0n, baseNonce);

  // AES-GCM 解密
  const plaintext = await aesGcmDecrypt(key, nonce, ciphertext, info);

  return plaintext;
}

/**
 * XOR nonce with sequence number - 与 CLI hpke-native.js 兼容
 */
function xorNonce(seq, baseNonce) {
  const nonce = new Uint8Array(baseNonce);
  const seqBytes = new Uint8Array(12);
  for (let i = 0; i < 8; i++) {
    seqBytes[11 - i] = Number((seq >> BigInt(i * 8)) & 0xffn);
  }
  for (let i = 0; i < 12; i++) {
    nonce[i] ^= seqBytes[i];
  }
  return nonce;
}
