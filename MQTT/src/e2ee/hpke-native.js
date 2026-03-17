/**
 * HPKE 加密模块 - 基于 @noble/curves 实现
 * 
 * 使用 RFC 9180 HPKE 标准实现
 * 套件：DHKEM-X25519-HKDF-SHA256/HKDF-SHA256/AES-128-GCM
 */

import { x25519 } from '@noble/curves/ed25519.js';
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
 * Labeled Extract (HPKE RFC 9180)
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
 * Labeled Expand (HPKE RFC 9180)
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
 * X25519 KEM 封装
 */
function kemEncrypt(recipientPublicKey, info) {
  // 验证公钥长度
  if (!recipientPublicKey || recipientPublicKey.length !== 32) {
    throw new Error(`Invalid X25519 public key length: ${recipientPublicKey ? recipientPublicKey.length : 'null'} (expected 32)`);
  }
  
  // 生成临时密钥对
  const ephemeralPrivateKey = x25519.utils.randomPrivateKey();
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);
  
  // DH 密钥交换
  const sharedSecret = x25519.getSharedSecret(ephemeralPrivateKey, recipientPublicKey);
  
  // 派生共享密钥
  const suiteContext = 'KEM-X25519';
  const dh = labeledExtract(suiteContext, 'shared_secret', sharedSecret);
  
  return {
    enc: ephemeralPublicKey,
    sharedSecret: dh
  };
}

/**
 * X25519 KEM 解封装
 */
function kemDecrypt(enc, recipientPrivateKey, info) {
  // DH 密钥交换
  const sharedSecret = x25519.getSharedSecret(recipientPrivateKey, enc);
  
  // 派生共享密钥
  const suiteContext = 'KEM-X25519';
  const dh = labeledExtract(suiteContext, 'shared_secret', sharedSecret);
  
  return dh;
}

/**
 * AES-GCM 加密 (使用 Web Crypto API)
 */
async function aesGcmEncrypt(key, nonce, plaintext, aad) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'AES-GCM', length: 128 }, false, ['encrypt']
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad },
    cryptoKey,
    plaintext
  );
  return new Uint8Array(encrypted);
}

/**
 * AES-GCM 解密
 */
async function aesGcmDecrypt(key, nonce, ciphertext, aad) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'AES-GCM', length: 128 }, false, ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad },
    cryptoKey,
    ciphertext
  );
  return new Uint8Array(decrypted);
}

/**
 * XOR nonce with sequence number
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

/**
 * HPKE Base 模式封装 (加密)
 */
export async function hpkeSeal({ recipientPublicKey, plaintext, info = new Uint8Array() }) {
  // KEM 封装
  const { enc, sharedSecret } = kemEncrypt(recipientPublicKey, info);
  
  // 派生密钥和 nonce
  const suiteContext = 'KEM-X25519';
  const key = labeledExpand(sharedSecret, suiteContext, 'key', info, 16);
  const baseNonce = labeledExpand(sharedSecret, suiteContext, 'base_nonce', info, 12);
  
  // 使用序列号 0 (Base 模式)
  const seq = 0n;
  const nonce = xorNonce(seq, baseNonce);
  
  // AES-GCM 加密
  const ciphertext = await aesGcmEncrypt(key, nonce, plaintext, info);
  
  return { enc, ciphertext };
}

/**
 * HPKE Base 模式解封装 (解密)
 */
export async function hpkeOpen({ recipientPrivateKey, enc, ciphertext, info = new Uint8Array() }) {
  // KEM 解封装
  const sharedSecret = kemDecrypt(enc, recipientPrivateKey, info);
  
  // 派生密钥和 nonce
  const suiteContext = 'KEM-X25519';
  const key = labeledExpand(sharedSecret, suiteContext, 'key', info, 16);
  const baseNonce = labeledExpand(sharedSecret, suiteContext, 'base_nonce', info, 12);
  
  // 使用序列号 0
  const seq = 0n;
  const nonce = xorNonce(seq, baseNonce);
  
  // AES-GCM 解密
  const plaintext = await aesGcmDecrypt(key, nonce, ciphertext, info);
  
  return plaintext;
}

/**
 * 派生链密钥 (用于双棘轮)
 */
export function deriveChainKeys(rootSeed) {
  const encoder = new TextEncoder();
  const initChainKey = hkdfSingle(
    new Uint8Array(),
    rootSeed,
    encoder.encode('anp-e2ee-init'),
    32
  );
  const respChainKey = hkdfSingle(
    new Uint8Array(),
    rootSeed,
    encoder.encode('anp-e2ee-resp'),
    32
  );
  return { initChainKey, respChainKey };
}

/**
 * 派生消息密钥
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
 * 加密消息
 */
export async function encryptMessage(plaintext, chainKey, seq, aad = new Uint8Array()) {
  const { encKey, nonce, newChainKey } = deriveMessageKey(chainKey, seq);
  const ciphertext = await aesGcmEncrypt(encKey, nonce, plaintext, aad);
  return { ciphertext, newChainKey };
}

/**
 * 解密消息
 */
export async function decryptMessage(ciphertext, chainKey, seq, aad = new Uint8Array()) {
  const { encKey, nonce, newChainKey } = deriveMessageKey(chainKey, seq);
  const plaintext = await aesGcmDecrypt(encKey, nonce, ciphertext, aad);
  return { plaintext, newChainKey };
}

/**
 * 生成 X25519 密钥对
 */
export function generateKeyPair() {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}
