/**
 * did:ethr 方法实现
 * 
 * 基于以太坊的 DID 方法，支持多链
 * 规范：https://github.com/uport-project/ethr-did/blob/develop/doc/did-method-spec.md
 * 
 * DID 格式:
 * - did:ethr:<chainId>:<address>
 * - did:ethr:<chainId>:<publicKey>
 * 
 * 跨 DID 通信：
 * - 统一使用 X25519 或 P-256 进行 E2EE 密钥协商
 * - 以太坊地址用于身份标识，不直接用于加密
 */

import { x25519 } from '@noble/curves/ed25519.js';
import { p256 } from '@noble/curves/p256';
import { randomBytes } from '@noble/hashes/utils';

// 支持的以太坊网络
const ETHEREUM_NETWORKS = {
  mainnet: { chainId: 1, name: 'Ethereum Mainnet' },
  sepolia: { chainId: 11155111, name: 'Sepolia Testnet' },
  bsc: { chainId: 56, name: 'BSC Mainnet' },
  polygon: { chainId: 137, name: 'Polygon' },
  arbitrum: { chainId: 42161, name: 'Arbitrum One' },
  optimism: { chainId: 10, name: 'Optimism' }
};

export class DIDEthrHandler {
  constructor(options = {}) {
    this.defaultNetwork = options.network || 'mainnet';
  }

  /**
   * 获取网络配置
   */
  getNetwork(chainId) {
    for (const [name, config] of Object.entries(ETHEREUM_NETWORKS)) {
      if (config.chainId === chainId) {
        return { name, ...config };
      }
    }
    return ETHEREUM_NETWORKS.mainnet;
  }

  /**
   * 生成新的 DID Ethr 身份
   * @param {string|number} chainIdOrNetwork - 链 ID 或网络名称
   * @param {string} keyType - 密钥类型：'x25519', 'p256' (用于 E2EE)
   * @returns {Object}
   */
  generate(chainIdOrNetwork = 'mainnet', keyType = 'x25519') {
    const network = typeof chainIdOrNetwork === 'string' 
      ? (ETHEREUM_NETWORKS[chainIdOrNetwork] || ETHEREUM_NETWORKS.mainnet)
      : this.getNetwork(chainIdOrNetwork);

    const type = keyType.toLowerCase();
    let privateKey, publicKey;

    // 生成 E2EE 密钥（X25519 或 P-256）
    if (type === 'x25519') {
      privateKey = Buffer.from(x25519.utils.randomPrivateKey());
      publicKey = Buffer.from(x25519.getPublicKey(privateKey));
    } else if (type === 'p256') {
      privateKey = Buffer.from(p256.utils.randomPrivateKey());
      publicKey = Buffer.from(p256.getPublicKey(privateKey));
    } else {
      throw new Error(`Unsupported key type: ${keyType}. Use 'x25519' or 'p256' for E2EE.`);
    }

    // 从公钥派生地址（用于 DID 标识）
    const address = '0x' + publicKey.slice(0, 20).toString('hex');
    
    // DID 格式：did:ethr:<chainIdHex>:<address>
    const chainIdHex = '0x' + network.chainId.toString(16);
    const did = `did:ethr:${chainIdHex}:${address}`;

    return {
      did,
      privateKey,
      publicKey,
      address,
      keyType,
      chainId: network.chainId,
      network: network.name,
      didDocument: this.createDIDDocument(did, publicKey, address, network.chainId, keyType)
    };
  }

  /**
   * 从公钥创建身份（用于跨 DID 通信）
   * @param {Uint8Array} publicKey - 原始公钥字节
   * @param {string} keyType - 密钥类型
   * @param {string} did - 目标 DID（可选）
   * @returns {Object}
   */
  fromPublicKey(publicKey, keyType = 'x25519', did = null) {
    const address = '0x' + Buffer.from(publicKey).slice(0, 20).toString('hex');
    const finalDid = did || `did:ethr:0x1:${address}`;

    return {
      did: finalDid,
      publicKey: Buffer.from(publicKey),
      address,
      keyType: keyType.toLowerCase(),
      didDocument: this.createDIDDocument(finalDid, publicKey, address, 1, keyType)
    };
  }

  /**
   * 从私钥恢复身份
   */
  fromPrivateKey(privateKey, chainIdOrNetwork = 'mainnet', keyType = 'x25519') {
    const network = typeof chainIdOrNetwork === 'string' 
      ? (ETHEREUM_NETWORKS[chainIdOrNetwork] || ETHEREUM_NETWORKS.mainnet)
      : this.getNetwork(chainIdOrNetwork);

    const type = keyType.toLowerCase();
    let publicKey;

    if (type === 'x25519') {
      publicKey = Buffer.from(x25519.getPublicKey(privateKey));
    } else if (type === 'p256') {
      publicKey = Buffer.from(p256.getPublicKey(privateKey));
    } else {
      throw new Error(`Unsupported key type: ${keyType}`);
    }

    const address = '0x' + publicKey.slice(0, 20).toString('hex');
    const chainIdHex = '0x' + network.chainId.toString(16);
    const did = `did:ethr:${chainIdHex}:${address}`;

    return {
      did,
      privateKey: Buffer.from(privateKey),
      publicKey,
      address,
      keyType: type,
      chainId: network.chainId,
      didDocument: this.createDIDDocument(did, publicKey, address, network.chainId, type)
    };
  }

  /**
   * 从 DID 解析公钥
   */
  resolvePublicKey(did) {
    const parts = did.split(':');
    const id = parts[parts.length - 1];
    
    return {
      address: id,
      didDocument: {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: did,
        verificationMethod: [{
          id: `${did}#controller`,
          type: 'EcdsaSecp256k1RecoveryMethod2020',
          controller: did,
          blockchainAccountId: `eip155:1:${id}`
        }]
      }
    };
  }

  /**
   * 获取共享密钥（跨 DID 通信的关键方法）
   * 
   * 无论对方是什么 DID 方法，只要公钥格式正确就可以进行密钥协商
   * 
   * @param {Uint8Array} myPrivateKey - 我的私钥
   * @param {Uint8Array} theirPublicKey - 对方的公钥（原始字节）
   * @param {Object} options
   * @returns {Promise<Uint8Array>}
   */
  async getSharedSecret(myPrivateKey, theirPublicKey, options = {}) {
    // 尝试 X25519 密钥协商（优先）
    try {
      if (theirPublicKey.length === 32) {
        const sharedSecret = x25519.getSharedSecret(myPrivateKey, theirPublicKey);
        return new Uint8Array(sharedSecret);
      }
    } catch (e) {
      // 继续尝试其他方法
    }

    // 尝试 P-256 密钥协商
    try {
      if (theirPublicKey.length === 65 || theirPublicKey.length === 33) {
        const sharedSecret = p256.getSharedSecret(myPrivateKey, theirPublicKey);
        return new Uint8Array(sharedSecret);
      }
    } catch (e) {
      // 继续尝试其他方法
    }

    throw new Error(`Cannot derive shared secret: incompatible key types (my: did:ethr, their: ${options.theirMethod})`);
  }

  /**
   * 创建 DID 文档
   */
  createDIDDocument(did, publicKey, address, chainId, keyType) {
    const keyId = `${did}#controller`;
    
    let verificationMethod;
    
    if (keyType === 'x25519') {
      verificationMethod = {
        id: `${did}#key-agreement`,
        type: 'X25519KeyAgreementKey2020',
        controller: did,
        publicKeyMultibase: 'z' + Buffer.from(publicKey).toString('hex')
      };
    } else if (keyType === 'p256') {
      const jwk = this.publicKeyToJWK(publicKey);
      verificationMethod = {
        id: keyId,
        type: 'JsonWebKey2020',
        controller: did,
        publicKeyJwk: jwk
      };
    } else {
      verificationMethod = {
        id: keyId,
        type: 'EcdsaSecp256k1RecoveryMethod2020',
        controller: did,
        blockchainAccountId: `eip155:${chainId}:${address}`
      };
    }

    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/secp256k1recovery-2020/v2'
      ],
      id: did,
      verificationMethod: [verificationMethod],
      authentication: [keyId],
      assertionMethod: [keyId],
      keyAgreement: keyType !== 'secp256k1' ? [`${did}#key-agreement`] : []
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
   * 签名消息（使用 P-256）
   */
  sign(message, privateKey) {
    const signature = p256.sign(message, privateKey);
    return new Uint8Array(signature.toCompactRawBytes());
  }

  /**
   * 验证签名（使用 P-256）
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
export const didEthrHandler = new DIDEthrHandler();
