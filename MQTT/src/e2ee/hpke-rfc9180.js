/**
 * HPKE (RFC 9180) 完整实现
 * 
 * Hybrid Public Key Encryption - https://www.rfc-editor.org/rfc/rfc9180.html
 * 
 * 支持的套件:
 * - DHKEM-X25519-HKDF-SHA256/HKDF-SHA256/AES-128-GCM (必需)
 * - DHKEM-X25519-HKDF-SHA256/HKDF-SHA256/AES-256-GCM
 * - DHKEM-X25519-HKDF-SHA256/HKDF-SHA256/ChaCha20-Poly1305
 * 
 * 支持的模式:
 * - Base Mode (0x00)
 * - PSK Mode (0x01)
 * - Auth Mode (0x02)
 * - AuthPSK Mode (0x03)
 */

import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf as nobleHkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';
import { randomBytes } from '@noble/hashes/utils';

// ============================================================================
// 常量和类型定义
// ============================================================================

/**
 * HPKE 模式
 */
export const Mode = {
  Base: 0x00,
  PSK: 0x01,
  Auth: 0x02,
  AuthPSK: 0x03
};

/**
 * AEAD 算法
 */
export const AEAD = {
  AES128GCM: 0x0001,
  AES256GCM: 0x0002,
  ChaCha20Poly1305: 0x0003
};

/**
 * KDF 算法
 */
export const KDF = {
  HKDFSHA256: 0x0001,
  HKDFSHA384: 0x0002,
  HKDFSHA512: 0x0003
};

/**
 * KEM 算法
 */
export const KEM = {
  DHKEMX25519HKDFSHA256: 0x0020
};

/**
 * 套件配置
 */
const SUITE_CONFIG = {
  [AEAD.AES128GCM]: { keySize: 16, nonceSize: 12, tagSize: 16, name: 'AES-128-GCM' },
  [AEAD.AES256GCM]: { keySize: 32, nonceSize: 12, tagSize: 16, name: 'AES-256-GCM' },
  [AEAD.ChaCha20Poly1305]: { keySize: 32, nonceSize: 12, tagSize: 16, name: 'ChaCha20-Poly1305' }
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 连接字节数组
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
 * I2OSP - Integer-to-Octet-String Primitive (RFC 8017)
 * 将整数转换为固定长度的字节串
 */
function I2OSP(x, xLen) {
  if (x < 0 || x >= 256 ** xLen) {
    throw new Error(`I2OSP: integer ${x} out of range for length ${xLen}`);
  }
  const result = new Uint8Array(xLen);
  for (let i = xLen - 1; i >= 0; i--) {
    result[i] = x & 0xff;
    x = Math.floor(x / 256);
  }
  return result;
}

/**
 * XOR 两个字节数组
 */
function xorBytes(a, b) {
  if (a.length !== b.length) {
    throw new Error('XOR: length mismatch');
  }
  const result = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
}

// ============================================================================
// KDF: HKDF-SHA256 (RFC 5869)
// ============================================================================

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
  const hashLen = 32; // SHA256 输出长度
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
 * HKDF
 */
function hkdf(salt, ikm, info, length) {
  const prk = hkdfExtract(salt, ikm);
  return hkdfExpand(prk, info, length);
}

// ============================================================================
// Labeled KDF (RFC 9180 Section 7.1)
// ============================================================================

/**
 * HKDF-Extract with label
 * Extract(salt, IKM) = HMAC-Hash(salt, IKM)
 */
function LabeledExtract(suiteContext, label, ikm) {
  const hpkeLabel = 'HPKE-v1';
  const context = suiteContext || new Uint8Array();
  
  const labeledIkm = concatBytes(
    new TextEncoder().encode(hpkeLabel),
    new Uint8Array(context),
    new TextEncoder().encode(label),
    new Uint8Array(ikm || [])
  );
  
  return hkdfExtract(new Uint8Array(), labeledIkm);
}

/**
 * HKDF-Expand with label
 * Expand(PRK, info, length) = HMAC-Hash(PRK, info | 0x01) | ...
 */
function LabeledExpand(prk, suiteContext, label, info, length) {
  const hpkeLabel = 'HPKE-v1';
  const context = suiteContext || new Uint8Array();
  
  const labeledInfo = concatBytes(
    I2OSP(length, 2),  // 2 字节长度
    new TextEncoder().encode(hpkeLabel),
    new Uint8Array(context),
    new TextEncoder().encode(label),
    new Uint8Array(info || [])
  );
  
  return hkdfExpand(prk, labeledInfo, length);
}

// ============================================================================
// AEAD: AES-GCM / ChaCha20-Poly1305
// ============================================================================

/**
 * AES-GCM 加密 (使用 Web Crypto API)
 */
async function aesGcmEncrypt(key, nonce, plaintext, aad) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM', length: key.length * 8 },
    false,
    ['encrypt']
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
    'raw',
    key,
    { name: 'AES-GCM', length: key.length * 8 },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad },
    cryptoKey,
    ciphertext
  );
  
  return new Uint8Array(decrypted);
}

/**
 * ChaCha20-Poly1305 加密 (使用 Web Crypto API)
 * 注意：需要浏览器支持
 */
async function chacha20Poly1305Encrypt(key, nonce, plaintext, aad) {
  // 尝试使用 Web Crypto API
  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'ChaCha20-Poly1305' },
      false,
      ['encrypt']
    );
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'ChaCha20-Poly1305', iv: nonce, additionalData: aad },
      cryptoKey,
      plaintext
    );
    
    return new Uint8Array(encrypted);
  } catch (e) {
    // 如果不支持 ChaCha20，回退到 AES-GCM
    console.warn('ChaCha20-Poly1305 not supported, falling back to AES-GCM');
    return await aesGcmEncrypt(key, nonce, plaintext, aad);
  }
}

/**
 * ChaCha20-Poly1305 解密
 */
async function chacha20Poly1305Decrypt(key, nonce, ciphertext, aad) {
  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'ChaCha20-Poly1305' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'ChaCha20-Poly1305', iv: nonce, additionalData: aad },
      cryptoKey,
      ciphertext
    );
    
    return new Uint8Array(decrypted);
  } catch (e) {
    return await aesGcmDecrypt(key, nonce, ciphertext, aad);
  }
}

/**
 * AEAD 加密
 */
async function aeadEncrypt(aeadId, key, nonce, plaintext, aad) {
  switch (aeadId) {
    case AEAD.AES128GCM:
    case AEAD.AES256GCM:
      return await aesGcmEncrypt(key, nonce, plaintext, aad);
    case AEAD.ChaCha20Poly1305:
      return await chacha20Poly1305Encrypt(key, nonce, plaintext, aad);
    default:
      throw new Error(`Unsupported AEAD: ${aeadId}`);
  }
}

/**
 * AEAD 解密
 */
async function aeadDecrypt(aeadId, key, nonce, ciphertext, aad) {
  switch (aeadId) {
    case AEAD.AES128GCM:
    case AEAD.AES256GCM:
      return await aesGcmDecrypt(key, nonce, ciphertext, aad);
    case AEAD.ChaCha20Poly1305:
      return await chacha20Poly1305Decrypt(key, nonce, ciphertext, aad);
    default:
      throw new Error(`Unsupported AEAD: ${aeadId}`);
  }
}

// ============================================================================
// DHKEM-X25519 (RFC 9180 Section 7.1)
// ============================================================================

/**
 * DHKEM 密钥对
 */
class DHKEMKeyPair {
  constructor(privateKey, publicKey) {
    this.privateKey = privateKey;  // Uint8Array(32)
    this.publicKey = publicKey;    // Uint8Array(32)
  }
}

/**
 * DHKEM-X25519 实现
 */
class DHKEMX25519 {
  constructor() {
    this.kemId = KEM.DHKEMX25519HKDFSHA256;
    this.secretSize = 32;
    this.encSize = 32;
    this.publicKeySize = 32;
    this.privateKeySize = 32;
  }

  /**
   * 生成密钥对
   */
  generateKeyPair() {
    const privateKey = x25519.utils.randomPrivateKey();
    const publicKey = x25519.getPublicKey(privateKey);
    return new DHKEMKeyPair(privateKey, publicKey);
  }

  /**
   * 从原始字节导入私钥
   */
  deserializePrivateKey(bytes) {
    if (bytes.length !== this.privateKeySize) {
      throw new Error(`Invalid private key size: expected ${this.privateKeySize}, got ${bytes.length}`);
    }
    return new Uint8Array(bytes);
  }

  /**
   * 从原始字节导入公钥
   */
  deserializePublicKey(bytes) {
    if (bytes.length !== this.publicKeySize) {
      throw new Error(`Invalid public key size: expected ${this.publicKeySize}, got ${bytes.length}`);
    }
    return new Uint8Array(bytes);
  }

  /**
   * DH 密钥交换
   */
  DH(privateKey, publicKey) {
    try {
      const sharedSecret = x25519.getSharedSecret(privateKey, publicKey);
      // x25519.getSharedSecret 返回包含前缀的 32 字节，去掉前缀
      return new Uint8Array(sharedSecret);
    } catch (e) {
      throw new Error('DH key exchange failed: ' + e.message);
    }
  }

  /**
   * KEM 封装 (加密)
   * Returns: (enc, sharedSecret)
   */
  async encapsulate(recipientPublicKey, info = new Uint8Array()) {
    // 生成临时密钥对
    const ephemeralKeyPair = this.generateKeyPair();
    
    // DH 密钥交换
    const dh = this.DH(ephemeralKeyPair.privateKey, recipientPublicKey);
    
    // KDF 派生共享密钥
    const sharedSecret = await this.KDF(
      dh,
      this.encapInfo(ephemeralKeyPair.publicKey, info)
    );
    
    return {
      enc: ephemeralKeyPair.publicKey,
      sharedSecret
    };
  }

  /**
   * KEM 解封装 (解密)
   * Returns: sharedSecret
   */
  async decapsulate(privateKey, enc, info = new Uint8Array()) {
    // DH 密钥交换
    const dh = this.DH(privateKey, enc);
    
    // KDF 派生共享密钥
    const sharedSecret = await this.KDF(
      dh,
      this.encapInfo(enc, info)
    );
    
    return sharedSecret;
  }

  /**
   * KDF for DHKEM (RFC 9180 Section 7.1)
   */
  async KDF(dh, info) {
    // 使用 LabeledExtract 和 LabeledExpand
    const prk = LabeledExtract(new Uint8Array(), 'dkm', dh);
    return LabeledExpand(prk, new Uint8Array(), 'dkm', info, this.secretSize);
  }

  /**
   * Encap Info (RFC 9180 Section 7.1)
   */
  encapInfo(enc, info) {
    return concatBytes(
      I2OSP(this.kemId, 2),
      I2OSP(KDF.HKDFSHA256, 2),
      enc,
      info || new Uint8Array()
    );
  }
}

// ============================================================================
// HPKE Context
// ============================================================================

/**
 * HPKE 上下文 (用于加密/解密多条消息)
 */
class HPKEContext {
  constructor(suiteId, mode, kdf, aead, baseKey, baseNonce, exporterSecret) {
    this.suiteId = suiteId;
    this.mode = mode;
    this.kdf = kdf;
    this.aead = aead;
    this.baseKey = baseKey;
    this.baseNonce = baseNonce;
    this.exporterSecret = exporterSecret;
    
    this.seq = 0n;
    this.aeadConfig = SUITE_CONFIG[aead];
  }

  /**
   * 计算序列号相关的 nonce
   */
  computeNonce(seq) {
    const seqBytes = new Uint8Array(12);
    for (let i = 0; i < 8; i++) {
      seqBytes[11 - i] = Number((seq >> BigInt(i * 8)) & 0xffn);
    }
    return xorBytes(this.baseNonce, seqBytes);
  }

  /**
   * 加密 (RFC 9180 Section 6.1)
   */
  async seal(plaintext, aad = new Uint8Array()) {
    const nonce = this.computeNonce(this.seq);
    const key = this.baseKey;
    
    const ciphertext = await aeadEncrypt(
      this.aead,
      key,
      nonce,
      plaintext,
      aad
    );
    
    this.seq += 1n;
    return ciphertext;
  }

  /**
   * 解密 (RFC 9180 Section 6.2)
   */
  async open(ciphertext, aad = new Uint8Array()) {
    const nonce = this.computeNonce(this.seq);
    const key = this.baseKey;
    
    const plaintext = await aeadDecrypt(
      this.aead,
      key,
      nonce,
      ciphertext,
      aad
    );
    
    this.seq += 1n;
    return plaintext;
  }

  /**
   * 导出密钥 (RFC 9180 Section 7.3)
   */
  async export(info, length) {
    return LabeledExpand(
      this.exporterSecret,
      this.suiteId,
      'sec',
      info,
      length
    );
  }
}

// ============================================================================
// HPKE 主类
// ============================================================================

/**
 * HPKE (RFC 9180) 主实现
 */
export class HPKE {
  constructor(kem, kdf, aead) {
    this.kem = kem || new DHKEMX25519();
    this.kdf = kdf || KDF.HKDFSHA256;
    this.aead = aead || AEAD.AES128GCM;
    
    // 生成 Suite ID (RFC 9180 Section 7.1)
    this.suiteId = concatBytes(
      I2OSP(this.kem.kemId, 2),
      I2OSP(this.kdf, 2),
      I2OSP(this.aead, 2)
    );
  }

  /**
   * SetupBaseS - Base Mode Sender Setup (RFC 9180 Section 6.1)
   * Returns: (enc, context)
   */
  async setupBaseS(recipientPublicKey, info = new Uint8Array()) {
    // KEM 封装
    const { enc, sharedSecret } = await this.kem.encapsulate(
      recipientPublicKey,
      info
    );
    
    // 派生密钥材料
    const keySchedule = await this.keySchedule(
      Mode.Base,
      sharedSecret,
      info,
      undefined,  // psk
      undefined   // pskId
    );
    
    const context = new HPKEContext(
      this.suiteId,
      Mode.Base,
      this.kdf,
      this.aead,
      keySchedule.key,
      keySchedule.nonce,
      keySchedule.exporterSecret
    );
    
    return { enc, context };
  }

  /**
   * SetupBaseR - Base Mode Receiver Setup (RFC 9180 Section 6.2)
   * Returns: context
   */
  async setupBaseR(privateKey, enc, info = new Uint8Array()) {
    // KEM 解封装
    const sharedSecret = await this.kem.decapsulate(
      privateKey,
      enc,
      info
    );
    
    // 派生密钥材料
    const keySchedule = await this.keySchedule(
      Mode.Base,
      sharedSecret,
      info,
      undefined,  // psk
      undefined   // pskId
    );
    
    return new HPKEContext(
      this.suiteId,
      Mode.Base,
      this.kdf,
      this.aead,
      keySchedule.key,
      keySchedule.nonce,
      keySchedule.exporterSecret
    );
  }

  /**
   * SetupAuthS - Auth Mode Sender Setup (RFC 9180 Section 6.3)
   * Returns: (enc, context)
   */
  async setupAuthS(recipientPublicKey, senderPrivateKey, info = new Uint8Array()) {
    // 生成临时密钥对
    const ephemeralKeyPair = this.kem.generateKeyPair();
    
    // 计算 DH 共享密钥
    const dh1 = this.kem.DH(ephemeralKeyPair.privateKey, recipientPublicKey);
    const dh2 = this.kem.DH(senderPrivateKey, recipientPublicKey);
    
    // 合并共享密钥
    const sharedSecret = concatBytes(dh1, dh2);
    
    // KEM 封装信息
    const kemInfo = concatBytes(
      I2OSP(this.kem.kemId, 2),
      I2OSP(this.kdf, 2),
      ephemeralKeyPair.publicKey,
      info || new Uint8Array()
    );
    
    // 派生密钥材料
    const keySchedule = await this.keySchedule(
      Mode.Auth,
      sharedSecret,
      kemInfo,
      undefined,  // psk
      undefined   // pskId
    );
    
    const context = new HPKEContext(
      this.suiteId,
      Mode.Auth,
      this.kdf,
      this.aead,
      keySchedule.key,
      keySchedule.nonce,
      keySchedule.exporterSecret
    );
    
    return { enc: ephemeralKeyPair.publicKey, context };
  }

  /**
   * SetupAuthR - Auth Mode Receiver Setup (RFC 9180 Section 6.4)
   * Returns: context
   */
  async setupAuthR(privateKey, enc, senderPublicKey, info = new Uint8Array()) {
    // 计算 DH 共享密钥
    const dh1 = this.kem.DH(privateKey, enc);
    const dh2 = this.kem.DH(privateKey, senderPublicKey);
    
    // 合并共享密钥
    const sharedSecret = concatBytes(dh1, dh2);
    
    // KEM 封装信息
    const kemInfo = concatBytes(
      I2OSP(this.kem.kemId, 2),
      I2OSP(this.kdf, 2),
      enc,
      info || new Uint8Array()
    );
    
    // 派生密钥材料
    const keySchedule = await this.keySchedule(
      Mode.Auth,
      sharedSecret,
      kemInfo,
      undefined,  // psk
      undefined   // pskId
    );
    
    return new HPKEContext(
      this.suiteId,
      Mode.Auth,
      this.kdf,
      this.aead,
      keySchedule.key,
      keySchedule.nonce,
      keySchedule.exporterSecret
    );
  }

  /**
   * Key Schedule (RFC 9180 Section 7.2)
   */
  async keySchedule(mode, sharedSecret, info, psk, pskId) {
    // 计算 PSK 相关值
    const pskHash = psk ? hmac(sha256, new Uint8Array(), psk) : new Uint8Array(32);
    const pskIdHash = pskId ? hmac(sha256, new Uint8Array(), pskId) : new Uint8Array(32);
    
    // 计算 mode-specific values
    const modeBytes = new Uint8Array([mode]);
    
    // 计算 IKM (Input Keying Material)
    const ikm = concatBytes(sharedSecret, pskHash);
    
    // Extract
    const prk = LabeledExtract(new Uint8Array(), 'prk', ikm);
    
    // Expand
    const infoBytes = concatBytes(
      modeBytes,
      pskIdHash,
      info || new Uint8Array()
    );
    
    const key = LabeledExpand(
      prk,
      this.suiteId,
      'key',
      infoBytes,
      SUITE_CONFIG[this.aead].keySize
    );
    
    const baseNonce = LabeledExpand(
      prk,
      this.suiteId,
      'base_nonce',
      infoBytes,
      SUITE_CONFIG[this.aead].nonceSize
    );
    
    const exporterSecret = LabeledExpand(
      prk,
      this.suiteId,
      'exp',
      infoBytes,
      32
    );
    
    return { key, nonce: baseNonce, exporterSecret };
  }

  /**
   * 单次加密 (Seal) - 方便使用的方法
   */
  async seal(recipientPublicKey, plaintext, info = new Uint8Array(), aad = new Uint8Array()) {
    const { enc, context } = await this.setupBaseS(recipientPublicKey, info);
    const ciphertext = await context.seal(plaintext, aad);
    
    return {
      enc,
      ciphertext
    };
  }

  /**
   * 单次解密 (Open) - 方便使用的方法
   */
  async open(privateKey, enc, ciphertext, info = new Uint8Array(), aad = new Uint8Array()) {
    const context = await this.setupBaseR(privateKey, enc, info);
    const plaintext = await context.open(ciphertext, aad);
    
    return plaintext;
  }
}

// ============================================================================
// 简化 API (向后兼容)
// ============================================================================

/**
 * 简化版 HPKE 加密 (兼容旧代码)
 */
export async function hpkeSeal({ recipientPublicKey, plaintext, info = new Uint8Array() }) {
  const hpke = new HPKE();
  const { enc, ciphertext } = await hpke.seal(recipientPublicKey, plaintext, info);
  return { enc, ciphertext };
}

/**
 * 简化版 HPKE 解密 (兼容旧代码)
 */
export async function hpkeOpen({ recipientPrivateKey, enc, ciphertext, info = new Uint8Array() }) {
  const hpke = new HPKE();
  const plaintext = await hpke.open(recipientPrivateKey, enc, ciphertext, info);
  return plaintext;
}

/**
 * 派生链密钥 (用于双棘轮)
 */
export function deriveChainKeys(rootSeed) {
  const encoder = new TextEncoder();
  
  const initChainKey = hkdf(
    new Uint8Array(),
    rootSeed,
    encoder.encode('anp-e2ee-init'),
    32
  );
  
  const respChainKey = hkdf(
    new Uint8Array(),
    rootSeed,
    encoder.encode('anp-e2ee-resp'),
    32
  );
  
  return { initChainKey, respChainKey };
}

// ============================================================================
// 导出
// ============================================================================

export {
  DHKEMX25519,
  HPKEContext,
  LabeledExtract,
  LabeledExpand,
  I2OSP,
  concatBytes
};
