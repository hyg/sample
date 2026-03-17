/**
 * did:wba 方法实现
 * 
 * WBA (Web3 Blockchain Alliance) DID 方法
 * 支持跨链身份标识
 * 
 * DID 格式:
 * - did:wba:<chain>:<address>
 * - did:wba:eth:<address>      (Ethereum)
 * - did:wba:bsc:<address>      (BSC)
 * - did:wba:polygon:<address>  (Polygon)
 * - did:wba:arb:<address>      (Arbitrum)
 * - did:wba:op:<address>       (Optimism)
 * 
 * 跨 DID 通信：
 * - 统一使用 X25519 或 P-256 进行 E2EE 密钥协商
 * - 区块链地址用于身份标识
 */

import { x25519 } from '@noble/curves/ed25519.js';
import { p256 } from '@noble/curves/p256';
import { randomBytes } from '@noble/hashes/utils';

// 支持的区块链配置
const CHAIN_CONFIGS = {
  eth: { chainId: 1, name: 'Ethereum', explorer: 'https://etherscan.io' },
  sepolia: { chainId: 11155111, name: 'Sepolia', explorer: 'https://sepolia.etherscan.io' },
  bsc: { chainId: 56, name: 'BSC', explorer: 'https://bscscan.com' },
  polygon: { chainId: 137, name: 'Polygon', explorer: 'https://polygonscan.com' },
  arb: { chainId: 42161, name: 'Arbitrum', explorer: 'https://arbiscan.io' },
  op: { chainId: 10, name: 'Optimism', explorer: 'https://optimistic.etherscan.io' },
  avax: { chainId: 43114, name: 'Avalanche', explorer: 'https://snowtrace.io' },
  base: { chainId: 8453, name: 'Base', explorer: 'https://basescan.org' }
};

// 链名称到简写的映射
const CHAIN_ALIASES = {
  ethereum: 'eth',
  eth: 'eth',
  bsc: 'bsc',
  binance: 'bsc',
  polygon: 'polygon',
  matic: 'polygon',
  arbitrum: 'arb',
  arb: 'arb',
  optimism: 'op',
  op: 'op',
  avalanche: 'avax',
  avax: 'avax',
  base: 'base'
};

export class DIDWbaHandler {
  constructor(options = {}) {
    this.defaultChain = options.defaultChain || 'eth';
    this.chains = { ...CHAIN_CONFIGS, ...options.chains };
  }

  /**
   * 规范化链名称
   */
  normalizeChain(chain) {
    const lower = chain.toLowerCase();
    return CHAIN_ALIASES[lower] || lower;
  }

  /**
   * 获取链配置
   */
  getChainConfig(chain) {
    const normalized = this.normalizeChain(chain);
    return this.chains[normalized] || this.chains.eth;
  }

  /**
   * 生成新的 DID WBA 身份
   * @param {string} chain - 链名称或简写
   * @param {string} keyType - 密钥类型：'x25519', 'p256'
   * @returns {Object}
   */
  generate(chain = 'eth', keyType = 'x25519') {
    const chainConfig = this.getChainConfig(chain);
    const normalizedChain = this.normalizeChain(chain);
    const type = keyType.toLowerCase();

    let privateKey, publicKey;

    // 生成 E2EE 密钥
    if (type === 'x25519') {
      privateKey = Buffer.from(x25519.utils.randomPrivateKey());
      publicKey = Buffer.from(x25519.getPublicKey(privateKey));
    } else if (type === 'p256') {
      privateKey = Buffer.from(p256.utils.randomPrivateKey());
      publicKey = Buffer.from(p256.getPublicKey(privateKey));
    } else {
      throw new Error(`Unsupported key type: ${keyType}. Use 'x25519' or 'p256' for E2EE.`);
    }

    // 从公钥派生地址
    const address = '0x' + publicKey.slice(0, 20).toString('hex');
    
    // DID 格式：did:wba:<chain>:<address>
    const did = `did:wba:${normalizedChain}:${address}`;

    return {
      did,
      privateKey,
      publicKey,
      address,
      keyType: type,
      chain: normalizedChain,
      chainId: chainConfig.chainId,
      chainName: chainConfig.name,
      didDocument: this.createDIDDocument(did, publicKey, address, chainConfig, type)
    };
  }

  /**
   * 从公钥创建身份（用于跨 DID 通信）
   */
  fromPublicKey(publicKey, chain = 'eth', keyType = 'x25519', did = null) {
    const chainConfig = this.getChainConfig(chain);
    const normalizedChain = this.normalizeChain(chain);
    const address = '0x' + Buffer.from(publicKey).slice(0, 20).toString('hex');
    const finalDid = did || `did:wba:${normalizedChain}:${address}`;

    return {
      did: finalDid,
      publicKey: Buffer.from(publicKey),
      address,
      keyType: keyType.toLowerCase(),
      chain: normalizedChain,
      chainId: chainConfig.chainId,
      didDocument: this.createDIDDocument(finalDid, publicKey, address, chainConfig, keyType)
    };
  }

  /**
   * 从私钥恢复身份
   */
  fromPrivateKey(privateKey, chain = 'eth', keyType = 'x25519') {
    const chainConfig = this.getChainConfig(chain);
    const normalizedChain = this.normalizeChain(chain);
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
    const did = `did:wba:${normalizedChain}:${address}`;

    return {
      did,
      privateKey: Buffer.from(privateKey),
      publicKey,
      address,
      keyType: type,
      chain: normalizedChain,
      chainId: chainConfig.chainId,
      didDocument: this.createDIDDocument(did, publicKey, address, chainConfig, type)
    };
  }

  /**
   * 从 DID 解析信息
   */
  resolvePublicKey(did) {
    const { chain, id } = this.parseDID(did);
    
    return {
      chain,
      address: id,
      didDocument: {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: did,
        verificationMethod: [{
          id: `${did}#controller`,
          type: 'EcdsaSecp256k1RecoveryMethod2020',
          controller: did,
          blockchainAccountId: `eip155:${this.getChainConfig(chain).chainId}:${id}`
        }]
      }
    };
  }

  /**
   * 解析 DID 字符串
   */
  parseDID(did) {
    if (!did.startsWith('did:wba:')) {
      throw new Error('Invalid did:wba format');
    }

    const parts = did.split(':');
    if (parts.length < 4) {
      throw new Error('Invalid did:wba format: expected did:wba:<chain>:<address>');
    }

    return {
      chain: parts[2],
      id: parts[3],
      full: did
    };
  }

  /**
   * 获取共享密钥（跨 DID 通信的关键方法）
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

    throw new Error(`Cannot derive shared secret: incompatible key types (my: did:wba, their: ${options.theirMethod})`);
  }

  /**
   * 创建 DID 文档
   */
  createDIDDocument(did, publicKey, address, chainConfig, keyType) {
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
        blockchainAccountId: `eip155:${chainConfig.chainId}:${address}`
      };
    }

    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/secp256k1recovery-2020/v2'
      ],
      id: did,
      alsoKnownAs: [`${chainConfig.explorer}/address/${address}`],
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

  /**
   * 获取支持的链列表
   */
  getSupportedChains() {
    return Object.keys(this.chains).map(key => ({
      key,
      ...this.chains[key]
    }));
  }

  /**
   * 添加自定义链
   */
  addChain(key, config) {
    this.chains[key.toLowerCase()] = config;
  }
}

// 创建全局处理器实例
export const didWbaHandler = new DIDWbaHandler();
