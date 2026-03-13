/**
 * did:key 方法实现
 * 
 * 基于 W3C DID Key 规范:
 * https://w3c-ccg.github.io/did-method-key/
 * 
 * 支持的密钥类型:
 * - X25519 (密钥协商)
 * - Ed25519 (签名)
 * - P-256 (签名，用于与 ANP 兼容)
 */

import { ed25519, x25519 } from '@noble/curves/ed25519';
import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';

// Base58 编码表
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Base58 编码
 */
export function base58Encode(bytes) {
  let num = BigInt('0x' + Buffer.from(bytes).toString('hex'));
  let encoded = '';
  
  while (num > 0n) {
    const remainder = num % 58n;
    num = num / 58n;
    encoded = BASE58_ALPHABET[Number(remainder)] + encoded;
  }
  
  // 处理前导零
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    encoded = '1' + encoded;
  }
  
  return encoded;
}

/**
 * Base58 解码
 */
export function base58Decode(str) {
  let num = 0n;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const value = BASE58_ALPHABET.indexOf(char);
    if (value === -1) throw new Error('Invalid base58 character');
    num = num * 58n + BigInt(value);
  }
  
  let hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  
  const bytes = Uint8Array.from(Buffer.from(hex, 'hex'));
  
  // 处理前导零
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    const zero = new Uint8Array([0]);
    const newBytes = new Uint8Array(zero.length + bytes.length);
    newBytes.set(zero, 0);
    newBytes.set(bytes, zero.length);
    bytes = newBytes;
  }
  
  return bytes;
}

// 多字节编码 (用于 DID Key)
const MULTICODEC_PREFIXES = {
  x25519: new Uint8Array([0xec, 0x01]), // 0x00ec = X25519
  ed25519: new Uint8Array([0xed, 0x01]), // 0x00ed = Ed25519
  p256: new Uint8Array([0x80, 0x24]), // 0x8024 = P-256 (NIST P-256)
};

export class DIDKeyHandler {
  /**
   * 生成新的 DID Key 身份
   * @param {string} keyType - 密钥类型：'x25519', 'ed25519', 'p256'
   * @returns {Object} - 包含私钥、公钥和 DID 文档
   */
  generate(keyType = 'x25519') {  // 默认使用 X25519 (ANP 推荐)
    let privateKey, publicKey, publicKeyBytes;

    // 转换为小写处理
    const type = keyType.toLowerCase();

    switch (type) {
      case 'x25519':
        privateKey = x25519.utils.randomPrivateKey();
        publicKey = x25519.getPublicKey(privateKey);
        publicKeyBytes = this.concatTypedArrays(MULTICODEC_PREFIXES.x25519, publicKey);
        break;

      case 'ed25519':
        privateKey = ed25519.utils.randomPrivateKey();
        publicKey = ed25519.getPublicKey(privateKey);
        publicKeyBytes = this.concatTypedArrays(MULTICODEC_PREFIXES.ed25519, publicKey);
        break;

      case 'p256':
      default:
        privateKey = p256.utils.randomPrivateKey();
        publicKey = p256.getPublicKey(privateKey);
        publicKeyBytes = this.concatTypedArrays(MULTICODEC_PREFIXES.p256, publicKey);
        break;
    }

    const did = `did:key:${base58Encode(publicKeyBytes)}`;

    return {
      did,
      privateKey: Buffer.from(privateKey),
      publicKey: Buffer.from(publicKey),  // 32 字节原始公钥
      keyType,
      didDocument: this.createDIDDocument(did, publicKey, keyType)
    };
  }

  /**
   * 从私钥恢复身份
   * @param {Uint8Array|Buffer} privateKey 
   * @param {string} keyType 
   * @returns {Object}
   */
  fromPrivateKey(privateKey, keyType = 'p256') {
    let publicKey, publicKeyBytes, did;

    switch (keyType) {
      case 'x25519':
        publicKey = x25519.getPublicKey(privateKey);
        publicKeyBytes = this.concatTypedArrays(MULTICODEC_PREFIXES.x25519, publicKey);
        break;
      
      case 'ed25519':
        publicKey = ed25519.getPublicKey(privateKey);
        publicKeyBytes = this.concatTypedArrays(MULTICODEC_PREFIXES.ed25519, publicKey);
        break;
      
      case 'p256':
      default:
        publicKey = p256.getPublicKey(privateKey);
        publicKeyBytes = this.concatTypedArrays(MULTICODEC_PREFIXES.p256, publicKey);
        break;
    }

    did = `did:key:${base58Encode(publicKeyBytes)}`;

    return {
      did,
      privateKey: Buffer.from(privateKey),
      publicKey: Buffer.from(publicKey),
      keyType,
      didDocument: this.createDIDDocument(did, publicKey, keyType)
    };
  }

  /**
   * 从 DID 解析公钥
   * @param {string} did 
   * @returns {Object} - { publicKey, keyType }
   */
  resolvePublicKey(did) {
    const keyBytes = base58Decode(did.replace('did:key:', ''));
    
    // 读取多字节前缀
    const prefix = Buffer.from(keyBytes.slice(0, 2)).toString('hex');
    const publicKeyBytes = keyBytes.slice(2);
    
    let keyType;
    switch (prefix) {
      case 'ec01':
        keyType = 'x25519';
        break;
      case 'ed01':
        keyType = 'ed25519';
        break;
      case '8024':
        keyType = 'p256';
        break;
      default:
        throw new Error(`Unsupported multicodec prefix: ${prefix}`);
    }
    
    return {
      publicKey: Buffer.from(publicKeyBytes),
      keyType,
      didDocument: this.createDIDDocument(did, publicKeyBytes, keyType)
    };
  }

  /**
   * 创建 DID 文档
   */
  createDIDDocument(did, publicKey, keyType) {
    const keyId = `${did}#${did.substring(0, 16)}`;
    
    let verificationMethod;
    switch (keyType) {
      case 'x25519':
        verificationMethod = {
          id: keyId,
          type: 'X25519KeyAgreementKey2020',
          controller: did,
          publicKeyMultibase: 'z' + base58Encode(this.concatTypedArrays(MULTICODEC_PREFIXES.x25519, publicKey))
        };
        break;
      
      case 'ed25519':
        verificationMethod = {
          id: keyId,
          type: 'Ed25519VerificationKey2020',
          controller: did,
          publicKeyMultibase: 'z' + base58Encode(this.concatTypedArrays(MULTICODEC_PREFIXES.ed25519, publicKey))
        };
        break;
      
      case 'p256':
      default:
        // JWK 格式 (用于 ECDSA P-256)
        const jwk = this.publicKeyToJWK(publicKey);
        verificationMethod = {
          id: keyId,
          type: 'JsonWebKey2020',
          controller: did,
          publicKeyJwk: jwk
        };
        break;
    }

    const didDocument = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/jws-2020/v1'
      ],
      id: did,
      verificationMethod: [verificationMethod],
      authentication: [keyId],
      assertionMethod: [keyId],
      keyAgreement: [keyId]
    };

    return didDocument;
  }

  /**
   * 将原始公钥转换为 JWK 格式
   */
  publicKeyToJWK(publicKey) {
    // 确保公钥是未压缩格式 (65 字节：0x04 + x + y)
    let uncompressed;
    if (publicKey.length === 33) {
      // 压缩格式：0x02 或 0x03 + x 坐标，需要解压缩
      const point = p256.ProjectivePoint.fromHex(publicKey);
      uncompressed = point.toRawBytes(false); // false = 未压缩
    } else if (publicKey.length === 65 && publicKey[0] === 0x04) {
      uncompressed = publicKey;
    } else {
      throw new Error(`Invalid P-256 public key length: ${publicKey.length}`);
    }

    const x = uncompressed.slice(1, 33);
    const y = uncompressed.slice(33, 65);

    return {
      kty: 'EC',
      crv: 'P-256',
      x: Buffer.from(x).toString('base64url'),
      y: Buffer.from(y).toString('base64url')
    };
  }

  /**
   * 签名消息
   * @param {Uint8Array} message 
   * @param {Uint8Array} privateKey 
   * @returns {Uint8Array} 签名
   */
  sign(message, privateKey, keyType = 'p256') {
    if (keyType === 'p256') {
      const signature = p256.sign(message, privateKey);
      return new Uint8Array(signature.toCompactRawBytes());
    } else if (keyType === 'ed25519') {
      return ed25519.sign(message, privateKey);
    }
    throw new Error(`Unsupported key type for signing: ${keyType}`);
  }

  /**
   * 验证签名
   * @param {Uint8Array} message 
   * @param {Uint8Array} signature 
   * @param {Uint8Array} publicKey 
   * @param {string} keyType 
   * @returns {boolean}
   */
  verify(message, signature, publicKey, keyType = 'p256') {
    if (keyType === 'p256') {
      try {
        return p256.verify(signature, message, publicKey);
      } catch {
        return false;
      }
    } else if (keyType === 'ed25519') {
      try {
        return ed25519.verify(signature, message, publicKey);
      } catch {
        return false;
      }
    }
    throw new Error(`Unsupported key type for verification: ${keyType}`);
  }

  /**
   * 连接 TypedArray
   */
  concatTypedArrays(...arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }
}

// 创建全局处理器实例
export const didKeyHandler = new DIDKeyHandler();
