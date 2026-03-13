/**
 * HPKE 加密模块 - 基于 hpke npm 包 (panva/hpke)
 * 
 * 使用 RFC 9180 HPKE 标准实现
 * 套件：DHKEM-X25519-HKDF-SHA256/HKDF-SHA256/AES-128-GCM (ANP 推荐)
 */

import * as HPKE from 'hpke';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';

// HPKE 密码套件 - 默认使用 X25519 (ANP 协议推荐)
export const hpkeSuite = new HPKE.CipherSuite(
  HPKE.KEM_DHKEM_X25519_HKDF_SHA256,
  HPKE.KDF_HKDF_SHA256,
  HPKE.AEAD_AES_128_GCM
);

// P-256 套件（备用）
export const hpkeSuiteP256 = new HPKE.CipherSuite(
  HPKE.KEM_DHKEM_P256_HKDF_SHA256,
  HPKE.KDF_HKDF_SHA256,
  HPKE.AEAD_AES_128_GCM
);

/**
 * 生成密钥对 (使用 hpke 包)
 * @returns {Promise<{publicKey: CryptoKey, privateKey: CryptoKey}>}
 */
export async function generateKeyPair() {
  return await hpkeSuite.GenerateKeyPair();
}

/**
 * 从原始字节导入公钥
 * @param {Uint8Array|Buffer} raw - X25519 (32 字节) 或 P-256 (33/65 字节) 公钥
 * @returns {Promise<CryptoKey>}
 */
export async function importPublicKey(raw) {
  const rawBytes = raw instanceof Buffer ? new Uint8Array(raw) : raw;
  
  // 检测密钥类型
  if (rawBytes.length === 32) {
    // X25519 公钥 (32 字节)
    return await importX25519PublicKey(rawBytes);
  } else if (rawBytes.length === 33) {
    // P-256 压缩格式
    return await importP256PublicKey(rawBytes, true);
  } else if (rawBytes.length === 65) {
    // P-256 未压缩格式
    return await importP256PublicKey(rawBytes, false);
  } else {
    throw new Error(`Invalid public key length: ${rawBytes.length}`);
  }
}

/**
 * 导入 X25519 公钥
 */
async function importX25519PublicKey(raw) {
  // X25519 公钥是原始 32 字节
  // hpke 包使用 Web Crypto API，但 X25519 需要特殊处理
  // 我们使用 hpke 包的内部方法来处理
  
  // 对于 X25519，我们直接使用原始字节，hpke 包会处理
  // 这里返回一个标记对象，在 Seal/Open 时特殊处理
  return { type: 'x25519', key: raw };
}

/**
 * 导入 P-256 公钥
 */
async function importP256PublicKey(raw, compressed = false) {
  let jwk;
  if (compressed) {
    jwk = await compressedToJWK(raw);
  } else {
    jwk = uncompressedToJWK(raw);
  }
  
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

/**
 * 从原始字节导入私钥
 * @param {Uint8Array|Buffer} raw - X25519 (32 字节) 或 P-256 (32 字节) 私钥
 * @returns {Promise<CryptoKey>}
 */
export async function importPrivateKey(raw) {
  const rawBytes = raw instanceof Buffer ? new Uint8Array(raw) : raw;
  
  // 检测密钥类型 (通过长度无法区分，需要上下文)
  // 默认尝试 X25519
  return await importX25519PrivateKey(rawBytes);
}

/**
 * 导入 X25519 私钥
 */
async function importX25519PrivateKey(raw) {
  // X25519 私钥是原始 32 字节
  return { type: 'x25519', key: raw };
}

/**
 * 将未压缩的 P-256 公钥转换为 JWK
 */
function uncompressedToJWK(raw) {
  if (raw.length !== 65 || raw[0] !== 0x04) {
    throw new Error('Invalid P-256 public key');
  }
  
  const x = Buffer.from(raw.slice(1, 33)).toString('base64url');
  const y = Buffer.from(raw.slice(33, 65)).toString('base64url');
  
  return {
    kty: 'EC',
    crv: 'P-256',
    x,
    y
  };
}

/**
 * 将压缩的 P-256 公钥转换为 JWK (异步)
 * 压缩格式：0x02 或 0x03 + x 坐标 (33 字节)
 */
async function compressedToJWK(raw) {
  if (raw.length !== 33) {
    throw new Error('Invalid compressed P-256 public key');
  }
  
  const { p256 } = await import('@noble/curves/p256');
  
  try {
    const point = p256.ProjectivePoint.fromHex(raw);
    const uncompressed = point.toRawBytes(false);
    return uncompressedToJWK(uncompressed);
  } catch (e) {
    throw new Error(`Failed to decompress public key: ${e.message}`);
  }
}

/**
 * HPKE 封装 (加密)
 * @param {Object} params
 * @param {Uint8Array} params.recipientPublicKey - 接收者公钥 (32 字节 X25519 公钥)
 * @param {Uint8Array} params.plaintext - 明文
 * @param {Uint8Array} params.info - 附加信息 (AAD)
 * @returns {Promise<{enc: Uint8Array, ciphertext: Uint8Array}>}
 */
export async function hpkeSeal({ recipientPublicKey, plaintext, info = new Uint8Array() }) {
  // hpke 包的 Seal 方法接受原始公钥字节 (Uint8Array)
  const { encapsulatedSecret, ciphertext } = await hpkeSuite.Seal(
    recipientPublicKey,
    plaintext,
    info
  );
  return { enc: encapsulatedSecret, ciphertext };
}

/**
 * HPKE 解封装 (解密)
 * @param {Object} params
 * @param {Uint8Array} params.recipientPrivateKey - 接收者私钥 (32 字节 X25519 私钥)
 * @param {Uint8Array} params.enc - 封装的密钥
 * @param {Uint8Array} params.ciphertext - 密文
 * @param {Uint8Array} params.info - 附加信息 (AAD)
 * @returns {Promise<Uint8Array>} 明文
 */
export async function hpkeOpen({ recipientPrivateKey, enc, ciphertext, info = new Uint8Array() }) {
  // hpke 包的 Open 方法接受原始私钥字节 (Uint8Array)
  const plaintext = await hpkeSuite.Open(
    recipientPrivateKey,
    enc,
    ciphertext,
    info
  );
  
  if (!plaintext) {
    throw new Error('HPKE decryption failed');
  }

  return plaintext;
}

/**
 * 派生链密钥 (用于双棘轮)
 * @param {Uint8Array} rootSeed - 根种子
 * @returns {{initChainKey: Uint8Array, respChainKey: Uint8Array}}
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
 * @param {Uint8Array} chainKey 
 * @param {bigint} seq 
 * @returns {{encKey: Uint8Array, nonce: Uint8Array, newChainKey: Uint8Array}}
 */
export function deriveMessageKey(chainKey, seq) {
  const encoder = new TextEncoder();
  const seqBytes = bigIntToBytes(seq, 8);
  
  // 派生消息密钥
  const info = concatBytes(encoder.encode('msg'), seqBytes);
  const msgKey = hkdfSingle(new Uint8Array(), chainKey, info, 32);
  
  // 更新链密钥
  const newChainKey = hkdfSingle(
    new Uint8Array(),
    chainKey,
    encoder.encode('ck'),
    32
  );
  
  // 派生加密密钥和 nonce
  const encKey = hkdfSingle(
    new Uint8Array(),
    msgKey,
    encoder.encode('key'),
    16
  );
  
  const nonce = hkdfSingle(
    new Uint8Array(),
    msgKey,
    encoder.encode('nonce'),
    12
  );
  
  return { encKey, nonce, newChainKey };
}

/**
 * 加密消息 (使用派生的链密钥)
 * @param {Uint8Array} plaintext 
 * @param {Uint8Array} chainKey 
 * @param {bigint} seq 
 * @param {Uint8Array} aad 
 * @returns {Promise<{ciphertext: Uint8Array, newChainKey: Uint8Array}>}
 */
export async function encryptMessage(plaintext, chainKey, seq, aad = new Uint8Array()) {
  const { encKey, nonce, newChainKey } = deriveMessageKey(chainKey, seq);
  const ciphertext = await aesGcmEncrypt(encKey, nonce, plaintext, aad);
  return { ciphertext, newChainKey };
}

/**
 * 解密消息
 * @param {Uint8Array} ciphertext 
 * @param {Uint8Array} chainKey 
 * @param {bigint} seq 
 * @param {Uint8Array} aad 
 * @returns {Promise<{plaintext: Uint8Array, newChainKey: Uint8Array}>}
 */
export async function decryptMessage(ciphertext, chainKey, seq, aad = new Uint8Array()) {
  const { encKey, nonce, newChainKey } = deriveMessageKey(chainKey, seq);
  const plaintext = await aesGcmDecrypt(encKey, nonce, ciphertext, aad);
  return { plaintext, newChainKey };
}

// ========== HKDF 辅助函数 ==========

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
    
    const newOkm = concatBytes(okm, t);
    okm = newOkm;
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

// ========== AES-GCM 辅助函数 ==========

/**
 * AES-GCM 加密
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

// ========== 工具函数 ==========

/**
 * 连接字节数组
 */
export function concatBytes(...arrays) {
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
 * BigInt 转字节数组
 */
function bigIntToBytes(num, length) {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[length - 1 - i] = Number((num >> BigInt(i * 8)) & 0xffn);
  }
  return bytes;
}

// 导出常量
export const HPKE_SUITE = 'DHKEM-X25519-HKDF-SHA256/HKDF-SHA256/AES-128-GCM';
export const HPKE_SUITE_P256 = 'DHKEM-P256-HKDF-SHA256/HKDF-SHA256/AES-128-GCM';
export const KEM = { P256: 0x0010, X25519: 0x0020 };
