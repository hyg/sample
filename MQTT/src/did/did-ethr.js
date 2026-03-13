/**
 * did:ethr 方法实现
 * 
 * 基于以太坊的 DID 方法:
 * https://github.com/decentralized-identity/ethr-did-resolver
 * 
 * DID 格式：did:ethr:<chainId>:<address>
 * 简化格式：did:ethr:<address> (默认主网)
 */

import { p256 } from '@noble/curves/p256';
import { keccak_256 } from '@noble/hashes/sha3';

/**
 * 地址工具函数
 */
export const addressUtils = {
  /**
   * 从公钥推导以太坊地址
   * @param {Uint8Array} publicKey - 65 字节原始公钥 (0x04 + x + y)
   * @returns {string} - 42 字节地址 (带 0x 前缀)
   */
  fromPublicKey(publicKey) {
    if (publicKey.length !== 65 || publicKey[0] !== 0x04) {
      throw new Error('Invalid P-256 public key');
    }
    
    // 跳过 0x04 前缀，取 x+y
    const pubKeyBytes = publicKey.slice(1);
    
    // Keccak-256 哈希
    const hash = keccak_256(pubKeyBytes);
    
    // 取最后 20 字节
    const addressBytes = hash.slice(-20);
    
    // 转换为十六进制
    return '0x' + Buffer.from(addressBytes).toString('hex');
  },

  /**
   * 验证地址格式
   * @param {string} address 
   * @returns {boolean}
   */
  isValid(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
};

export class DIDETHRHandler {
  constructor(defaultChainId = '0x1') {
    this.defaultChainId = defaultChainId;
  }

  /**
   * 生成新的 DID ETHR 身份
   * @param {string} chainId - 以太坊链 ID (可选)
   * @returns {Object}
   */
  generate(chainId = this.defaultChainId) {
    // 生成 P-256 密钥对 (用于签名和密钥协商)
    const privateKey = p256.utils.randomPrivateKey();
    const publicKey = p256.getPublicKey(privateKey);
    
    // 推导以太坊地址
    const address = addressUtils.fromPublicKey(publicKey);
    
    // 构建 DID
    const did = chainId && chainId !== '0x1' 
      ? `did:ethr:${chainId}:${address}`
      : `did:ethr:${address}`;

    return {
      did,
      address,
      chainId,
      privateKey: Buffer.from(privateKey),
      publicKey: Buffer.from(publicKey),
      keyType: 'p256',
      didDocument: this.createDIDDocument(did, publicKey, address, chainId)
    };
  }

  /**
   * 从私钥恢复身份
   * @param {Uint8Array|Buffer} privateKey 
   * @param {string} chainId 
   * @returns {Object}
   */
  fromPrivateKey(privateKey, chainId = this.defaultChainId) {
    const publicKey = p256.getPublicKey(privateKey);
    const address = addressUtils.fromPublicKey(publicKey);
    
    const did = chainId && chainId !== '0x1'
      ? `did:ethr:${chainId}:${address}`
      : `did:ethr:${address}`;

    return {
      did,
      address,
      chainId,
      privateKey: Buffer.from(privateKey),
      publicKey: Buffer.from(publicKey),
      keyType: 'p256',
      didDocument: this.createDIDDocument(did, publicKey, address, chainId)
    };
  }

  /**
   * 从地址解析 DID 文档
   * @param {string} did 
   * @param {Uint8Array} publicKey - 实际使用中需要从链上查询
   * @returns {Object}
   */
  resolve(did, publicKey = null) {
    const parsed = this.parse(did);
    
    if (!publicKey) {
      return {
        did,
        address: parsed.address,
        chainId: parsed.chainId,
        didDocument: this.createMinimalDIDDocument(did, parsed.address, parsed.chainId)
      };
    }

    return {
      did,
      address: parsed.address,
      chainId: parsed.chainId,
      publicKey: Buffer.from(publicKey),
      keyType: 'p256',
      didDocument: this.createDIDDocument(did, publicKey, parsed.address, parsed.chainId)
    };
  }

  /**
   * 解析 DID 字符串
   * @param {string} did 
   * @returns {Object}
   */
  parse(did) {
    const parts = did.split(':');
    
    if (parts.length < 3 || parts[1] !== 'ethr') {
      throw new Error('Invalid did:ethr format');
    }

    let chainId, address;
    if (parts.length === 3) {
      chainId = this.defaultChainId;
      address = parts[2];
    } else if (parts.length === 4) {
      chainId = parts[2];
      address = parts[3];
    } else {
      throw new Error('Invalid did:ethr format');
    }

    if (!addressUtils.isValid(address)) {
      throw new Error('Invalid Ethereum address');
    }

    return { method: 'ethr', chainId, address, full: did };
  }

  /**
   * 创建完整的 DID 文档
   */
  createDIDDocument(did, publicKey, address, chainId) {
    const keyId = `${did}#controller`;
    const jwk = this.publicKeyToJWK(publicKey);

    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/secp256k1-2019/v1',
        'https://w3id.org/security/suites/jws-2020/v1'
      ],
      id: did,
      controller: did,
      verificationMethod: [
        {
          id: keyId,
          type: 'JsonWebKey2020',
          controller: did,
          publicKeyJwk: jwk
        }
      ],
      authentication: [keyId],
      assertionMethod: [keyId],
      keyAgreement: [keyId],
      blockchainAccountId: `${chainId}:${address}`
    };
  }

  /**
   * 创建最小 DID 文档 (当公钥未知时)
   */
  createMinimalDIDDocument(did, address, chainId) {
    return {
      '@context': 'https://www.w3.org/ns/did/v1',
      id: did,
      controller: did,
      verificationMethod: [],
      authentication: [],
      assertionMethod: [],
      keyAgreement: [],
      blockchainAccountId: `${chainId}:${address}`
    };
  }

  /**
   * 将原始公钥转换为 JWK 格式
   */
  publicKeyToJWK(publicKey) {
    let uncompressed;
    if (publicKey.length === 33) {
      const point = p256.ProjectivePoint.fromHex(publicKey);
      uncompressed = point.toRawBytes(false);
    } else if (publicKey.length === 65 && publicKey[0] === 0x04) {
      uncompressed = publicKey;
    } else {
      throw new Error('Invalid P-256 public key');
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
   */
  sign(message, privateKey) {
    const signature = p256.sign(message, privateKey);
    return new Uint8Array(signature.toCompactRawBytes());
  }

  /**
   * 验证签名
   */
  verify(message, signature, publicKey) {
    try {
      return p256.verify(signature, message, publicKey);
    } catch {
      return false;
    }
  }
}

// 创建全局处理器实例
export const didEthrHandler = new DIDETHRHandler();
