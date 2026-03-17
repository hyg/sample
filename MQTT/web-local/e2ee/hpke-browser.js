/**
 * HPKE (RFC 9180) 浏览器完整实现
 * 
 * Hybrid Public Key Encryption - https://www.rfc-editor.org/rfc/rfc9180.html
 * 
 * 与 CLI 的 hpke-rfc9180.js 完全兼容
 */

import { x25519 } from '../lib/curves/ed25519.js';
import { sha256 } from '../lib/hashes/sha256.js';
import { hmac } from '../lib/hashes/hmac.js';
import { randomBytes } from '../lib/hashes/utils.js';

// ============================================================================
// 常量和类型定义
// ============================================================================

export const Mode = {
  Base: 0x00,
  PSK: 0x01,
  Auth: 0x02,
  AuthPSK: 0x03
};

export const AEAD = {
  AES128GCM: 0x0001,
  AES256GCM: 0x0002,
  ChaCha20Poly1305: 0x0003
};

export const KDF = {
  HKDFSHA256: 0x0001,
  HKDFSHA384: 0x0002,
  HKDFSHA512: 0x0003
};

export const KEM = {
  DHKEMX25519HKDFSHA256: 0x0020
};

const SUITE_CONFIG = {
  [AEAD.AES128GCM]: { keySize: 16, nonceSize: 12, tagSize: 16, name: 'AES-128-GCM' },
  [AEAD.AES256GCM]: { keySize: 32, nonceSize: 12, tagSize: 16, name: 'AES-256-GCM' },
  [AEAD.ChaCha20Poly1305]: { keySize: 32, nonceSize: 12, tagSize: 16, name: 'ChaCha20-Poly1305' }
};

// ============================================================================
// 工具函数
// ============================================================================

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
// KDF: HKDF-SHA256
// ============================================================================

function hkdfExtract(salt, ikm) {
  return hmac(sha256, salt, ikm);
}

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

function hkdf(salt, ikm, info, length) {
  const prk = hkdfExtract(salt, ikm);
  return hkdfExpand(prk, info, length);
}

// ============================================================================
// Labeled KDF (RFC 9180 Section 7.1)
// ============================================================================

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

function LabeledExpand(prk, suiteContext, label, info, length) {
  const hpkeLabel = 'HPKE-v1';
  const context = suiteContext || new Uint8Array();
  
  const labeledInfo = concatBytes(
    I2OSP(length, 2),
    new TextEncoder().encode(hpkeLabel),
    new Uint8Array(context),
    new TextEncoder().encode(label),
    new Uint8Array(info || [])
  );
  
  return hkdfExpand(prk, labeledInfo, length);
}

// ============================================================================
// AEAD
// ============================================================================

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

async function aeadEncrypt(aeadId, key, nonce, plaintext, aad) {
  return await aesGcmEncrypt(key, nonce, plaintext, aad);
}

async function aeadDecrypt(aeadId, key, nonce, ciphertext, aad) {
  return await aesGcmDecrypt(key, nonce, ciphertext, aad);
}

// ============================================================================
// DHKEM-X25519
// ============================================================================

class DHKEMKeyPair {
  constructor(privateKey, publicKey) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }
}

class DHKEMX25519 {
  constructor() {
    this.kemId = KEM.DHKEMX25519HKDFSHA256;
    this.secretSize = 32;
    this.encSize = 32;
    this.publicKeySize = 32;
    this.privateKeySize = 32;
  }

  generateKeyPair() {
    const privateKey = x25519.utils.randomPrivateKey();
    const publicKey = x25519.getPublicKey(privateKey);
    return new DHKEMKeyPair(privateKey, publicKey);
  }

  deserializePrivateKey(bytes) {
    if (bytes.length !== this.privateKeySize) {
      throw new Error(`Invalid private key size: expected ${this.privateKeySize}, got ${bytes.length}`);
    }
    return new Uint8Array(bytes);
  }

  deserializePublicKey(bytes) {
    if (bytes.length !== this.publicKeySize) {
      throw new Error(`Invalid public key size: expected ${this.publicKeySize}, got ${bytes.length}`);
    }
    return new Uint8Array(bytes);
  }

  DH(privateKey, publicKey) {
    try {
      const sharedSecret = x25519.getSharedSecret(privateKey, publicKey);
      return new Uint8Array(sharedSecret);
    } catch (e) {
      throw new Error('DH key exchange failed: ' + e.message);
    }
  }

  async encapsulate(recipientPublicKey, info = new Uint8Array()) {
    const ephemeralKeyPair = this.generateKeyPair();
    const dh = this.DH(ephemeralKeyPair.privateKey, recipientPublicKey);
    const sharedSecret = await this.KDF(dh, this.encapInfo(ephemeralKeyPair.publicKey, info));
    
    return {
      enc: ephemeralKeyPair.publicKey,
      sharedSecret
    };
  }

  async decapsulate(privateKey, enc, info = new Uint8Array()) {
    const dh = this.DH(privateKey, enc);
    const sharedSecret = await this.KDF(dh, this.encapInfo(enc, info));
    return sharedSecret;
  }

  async KDF(dh, info) {
    const prk = LabeledExtract(new Uint8Array(), 'dkm', dh);
    return LabeledExpand(prk, new Uint8Array(), 'dkm', info, this.secretSize);
  }

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

  computeNonce(seq) {
    const seqBytes = new Uint8Array(12);
    for (let i = 0; i < 8; i++) {
      seqBytes[11 - i] = Number((seq >> BigInt(i * 8)) & 0xffn);
    }
    return xorBytes(this.baseNonce, seqBytes);
  }

  async seal(plaintext, aad = new Uint8Array()) {
    const nonce = this.computeNonce(this.seq);
    const ciphertext = await aeadEncrypt(this.aead, this.baseKey, nonce, plaintext, aad);
    this.seq += 1n;
    return ciphertext;
  }

  async open(ciphertext, aad = new Uint8Array()) {
    const nonce = this.computeNonce(this.seq);
    const plaintext = await aeadDecrypt(this.aead, this.baseKey, nonce, ciphertext, aad);
    this.seq += 1n;
    return plaintext;
  }

  async export(info, length) {
    return LabeledExpand(this.exporterSecret, this.suiteId, 'sec', info, length);
  }
}

// ============================================================================
// HPKE 主类
// ============================================================================

export class HPKE {
  constructor(kem, kdf, aead) {
    this.kem = kem || new DHKEMX25519();
    this.kdf = kdf || KDF.HKDFSHA256;
    this.aead = aead || AEAD.AES128GCM;
    
    this.suiteId = concatBytes(
      I2OSP(this.kem.kemId, 2),
      I2OSP(this.kdf, 2),
      I2OSP(this.aead, 2)
    );
  }

  async setupBaseS(recipientPublicKey, info = new Uint8Array()) {
    const { enc, sharedSecret } = await this.kem.encapsulate(recipientPublicKey, info);
    const keySchedule = await this.keySchedule(Mode.Base, sharedSecret, info, undefined, undefined);
    
    return {
      enc,
      context: new HPKEContext(
        this.suiteId,
        Mode.Base,
        this.kdf,
        this.aead,
        keySchedule.key,
        keySchedule.nonce,
        keySchedule.exporterSecret
      )
    };
  }

  async setupBaseR(privateKey, enc, info = new Uint8Array()) {
    const sharedSecret = await this.kem.decapsulate(privateKey, enc, info);
    const keySchedule = await this.keySchedule(Mode.Base, sharedSecret, info, undefined, undefined);
    
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

  async setupAuthS(recipientPublicKey, senderPrivateKey, info = new Uint8Array()) {
    const ephemeralKeyPair = this.kem.generateKeyPair();
    const dh1 = this.kem.DH(ephemeralKeyPair.privateKey, recipientPublicKey);
    const dh2 = this.kem.DH(senderPrivateKey, recipientPublicKey);
    const sharedSecret = concatBytes(dh1, dh2);
    
    const kemInfo = concatBytes(
      I2OSP(this.kem.kemId, 2),
      I2OSP(this.kdf, 2),
      ephemeralKeyPair.publicKey,
      info || new Uint8Array()
    );
    
    const keySchedule = await this.keySchedule(Mode.Auth, sharedSecret, kemInfo, undefined, undefined);
    
    return {
      enc: ephemeralKeyPair.publicKey,
      context: new HPKEContext(
        this.suiteId,
        Mode.Auth,
        this.kdf,
        this.aead,
        keySchedule.key,
        keySchedule.nonce,
        keySchedule.exporterSecret
      )
    };
  }

  async setupAuthR(privateKey, enc, senderPublicKey, info = new Uint8Array()) {
    const dh1 = this.kem.DH(privateKey, enc);
    const dh2 = this.kem.DH(privateKey, senderPublicKey);
    const sharedSecret = concatBytes(dh1, dh2);
    
    const kemInfo = concatBytes(
      I2OSP(this.kem.kemId, 2),
      I2OSP(this.kdf, 2),
      enc,
      info || new Uint8Array()
    );
    
    const keySchedule = await this.keySchedule(Mode.Auth, sharedSecret, kemInfo, undefined, undefined);
    
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

  async keySchedule(mode, sharedSecret, info, psk, pskId) {
    const pskHash = psk ? hmac(sha256, new Uint8Array(), psk) : new Uint8Array(32);
    const pskIdHash = pskId ? hmac(sha256, new Uint8Array(), pskId) : new Uint8Array(32);
    const modeBytes = new Uint8Array([mode]);
    const ikm = concatBytes(sharedSecret, pskHash);
    
    const prk = LabeledExtract(new Uint8Array(), 'prk', ikm);
    const infoBytes = concatBytes(modeBytes, pskIdHash, info || new Uint8Array());
    
    const key = LabeledExpand(prk, this.suiteId, 'key', infoBytes, SUITE_CONFIG[this.aead].keySize);
    const baseNonce = LabeledExpand(prk, this.suiteId, 'base_nonce', infoBytes, SUITE_CONFIG[this.aead].nonceSize);
    const exporterSecret = LabeledExpand(prk, this.suiteId, 'exp', infoBytes, 32);
    
    return { key, nonce: baseNonce, exporterSecret };
  }

  async seal(recipientPublicKey, plaintext, info = new Uint8Array(), aad = new Uint8Array()) {
    const { enc, context } = await this.setupBaseS(recipientPublicKey, info);
    const ciphertext = await context.seal(plaintext, aad);
    return { enc, ciphertext };
  }

  async open(privateKey, enc, ciphertext, info = new Uint8Array(), aad = new Uint8Array()) {
    const context = await this.setupBaseR(privateKey, enc, info);
    return await context.open(ciphertext, aad);
  }
}

// ============================================================================
// 简化 API (向后兼容)
// ============================================================================

export async function hpkeSeal({ recipientPublicKey, plaintext, info = new Uint8Array() }) {
  const hpke = new HPKE();
  return await hpke.seal(recipientPublicKey, plaintext, info);
}

export async function hpkeOpen({ recipientPrivateKey, enc, ciphertext, info = new Uint8Array() }) {
  const hpke = new HPKE();
  return await hpke.open(recipientPrivateKey, enc, ciphertext, info);
}

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

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * HKDF 单次调用
 */
function hkdfSingle(salt, ikm, info, length) {
  const prk = hkdfExtract(salt, ikm);
  return hkdfExpand(prk, info, length);
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

export {
  DHKEMX25519,
  HPKEContext,
  LabeledExtract,
  LabeledExpand,
  I2OSP,
  concatBytes
};
