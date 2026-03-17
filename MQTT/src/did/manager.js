/**
 * DID 管理器 - 统一管理多种 DID 方法
 * 
 * 支持的 DID 方法:
 * - did:key   - 基于密钥的 DID
 * - did:ethr  - 基于以太坊的 DID
 * - did:wba   - 基于 WBA 的跨链 DID
 * 
 * 跨 DID 通信:
 * - 所有 DID 方法都实现统一的 getSharedSecret 接口
 * - 使用 X25519 或 P-256 进行 E2EE 密钥协商
 * - 不同 DID 方法之间可以互相通信
 */

import { didRegistry } from './registry.js';
import { didKeyHandler } from './did-key.js';
import { didEthrHandler } from './did-ethr.js';
import { didWbaHandler } from './did-wba.js';

export class DIDManager {
  constructor() {
    // 注册所有支持的 DID 方法
    didRegistry.register('key', didKeyHandler);
    didRegistry.register('ethr', didEthrHandler);
    didRegistry.register('wba', didWbaHandler);

    // 存储本地身份
    this.identities = new Map();
  }

  /**
   * 生成新的 DID 身份
   * @param {string} method - DID 方法：'key', 'ethr', 'wba'
   * @param {Object} options - 选项
   * @returns {Object} 身份对象
   */
  generate(method, options = {}) {
    const handler = didRegistry.get(method);
    if (!handler) {
      const supported = didRegistry.getSupportedMethods().join(', ');
      throw new Error(`Unsupported DID method: ${method}. Supported: ${supported}`);
    }

    // 不同方法有不同的参数
    let identity;
    if (method === 'key') {
      identity = handler.generate(options.keyType || 'x25519');
    } else if (method === 'ethr') {
      identity = handler.generate(options.chainId || options.network || 'mainnet', options.keyType || 'x25519');
    } else if (method === 'wba') {
      identity = handler.generate(options.chain || 'eth', options.keyType || 'x25519');
    }

    // 存储身份
    this.identities.set(identity.did, {
      ...identity,
      method
    });

    return identity;
  }

  /**
   * 从私钥导入身份
   */
  import(method, privateKey, options = {}) {
    const handler = didRegistry.get(method);
    if (!handler) {
      throw new Error(`Unsupported DID method: ${method}`);
    }

    let identity;
    if (method === 'key') {
      identity = handler.fromPrivateKey(privateKey, options.keyType || 'x25519');
    } else if (method === 'ethr') {
      identity = handler.fromPrivateKey(privateKey, options.chainId || options.network || 'mainnet', options.keyType || 'x25519');
    } else if (method === 'wba') {
      identity = handler.fromPrivateKey(privateKey, options.chain || 'eth', options.keyType || 'x25519');
    }

    this.identities.set(identity.did, {
      ...identity,
      method
    });

    return identity;
  }

  /**
   * 从公钥创建身份（用于跨 DID 通信）
   */
  fromPublicKey(method, publicKey, options = {}) {
    const handler = didRegistry.get(method);
    if (!handler) {
      throw new Error(`Unsupported DID method: ${method}`);
    }

    let identity;
    if (method === 'key') {
      identity = handler.fromPublicKey(publicKey, options.keyType || 'x25519', options.did);
    } else if (method === 'ethr') {
      identity = handler.fromPublicKey(publicKey, options.keyType || 'x25519', options.did);
    } else if (method === 'wba') {
      identity = handler.fromPublicKey(publicKey, options.chain || 'eth', options.keyType || 'x25519', options.did);
    }

    return identity;
  }

  /**
   * 获取本地存储的身份
   */
  getIdentity(did) {
    return this.identities.get(did) || null;
  }

  /**
   * 列出所有身份
   */
  listIdentities() {
    return Array.from(this.identities.values()).map(({ did, method, keyType, chain, chainId }) => ({
      did,
      method,
      keyType,
      chain,
      chainId
    }));
  }

  /**
   * 解析 DID 文档
   */
  async resolve(did) {
    const { method } = didRegistry.parse(did);
    const handler = didRegistry.get(method);

    if (!handler) {
      throw new Error(`Unsupported DID method: ${method}`);
    }

    // 先查找本地身份
    const localIdentity = this.identities.get(did);
    if (localIdentity) {
      return localIdentity.didDocument;
    }

    // 否则解析公钥
    if (method === 'key') {
      const { didDocument } = handler.resolvePublicKey(did);
      return didDocument;
    } else if (method === 'ethr' || method === 'wba') {
      const { didDocument } = handler.resolvePublicKey(did);
      return didDocument;
    }

    throw new Error(`Cannot resolve DID: ${did}`);
  }

  /**
   * 获取公钥
   */
  async getPublicKey(did) {
    const { method } = didRegistry.parse(did);
    const handler = didRegistry.get(method);

    if (method === 'key') {
      const { publicKey } = handler.resolvePublicKey(did);
      return publicKey;
    }

    // ethr 和 wba 需要用户提供公钥
    throw new Error(`Public key resolution not implemented for ${method}. Please provide the public key.`);
  }

  /**
   * 签名消息
   */
  sign(did, message) {
    const identity = this.identities.get(did);
    if (!identity) {
      throw new Error(`Identity not found: ${did}`);
    }

    const handler = didRegistry.get(identity.method);
    return handler.sign(message, identity.privateKey, identity.keyType);
  }

  /**
   * 验证签名
   */
  async verify(did, message, signature, publicKey) {
    const { method } = didRegistry.parse(did);
    const handler = didRegistry.get(method);
    return handler.verify(message, signature, publicKey, 'p256');
  }

  /**
   * 获取共享密钥（跨 DID 通信的关键方法）
   * 
   * @param {string} myDid - 我的 DID
   * @param {Uint8Array} myPrivateKey - 我的私钥
   * @param {string} theirDid - 对方的 DID
   * @param {Uint8Array} theirPublicKey - 对方的公钥（原始字节）
   * @returns {Promise<Uint8Array>} 共享密钥
   */
  async getSharedSecret(myDid, myPrivateKey, theirDid, theirPublicKey) {
    return await didRegistry.getSharedSecret(myDid, myPrivateKey, theirDid, theirPublicKey);
  }

  /**
   * 导出身份
   */
  export(did) {
    const identity = this.identities.get(did);
    if (!identity) {
      return null;
    }

    return {
      did: identity.did,
      method: identity.method,
      privateKey: identity.privateKey.toString('hex'),
      publicKey: identity.publicKey.toString('hex'),
      keyType: identity.keyType,
      chain: identity.chain,
      chainId: identity.chainId
    };
  }

  /**
   * 删除身份
   */
  delete(did) {
    return this.identities.delete(did);
  }

  /**
   * 获取支持的 DID 方法列表
   */
  getSupportedMethods() {
    return didRegistry.getSupportedMethods();
  }
}

// 创建全局管理器实例
export const didManager = new DIDManager();
