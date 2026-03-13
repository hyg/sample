/**
 * DID 管理器 - 统一管理多种 DID 方法
 */

import { didRegistry } from './registry.js';
import { didKeyHandler } from './did-key.js';
import { didEthrHandler } from './did-ethr.js';

export class DIDManager {
  constructor() {
    // 注册所有支持的 DID 方法
    didRegistry.register('key', didKeyHandler);
    didRegistry.register('ethr', didEthrHandler);
    
    // 存储本地身份
    this.identities = new Map();
  }

  generate(method, options = {}) {
    const handler = didRegistry.get(method);
    if (!handler) {
      throw new Error(`Unsupported DID method: ${method}. Supported: ${didRegistry.getSupportedMethods().join(', ')}`);
    }

    const identity = handler.generate(options.keyType || options.chainId);
    
    this.identities.set(identity.did, {
      ...identity,
      method
    });

    return identity;
  }

  import(method, privateKey, options = {}) {
    const handler = didRegistry.get(method);
    if (!handler) {
      throw new Error(`Unsupported DID method: ${method}`);
    }

    const identity = handler.fromPrivateKey(privateKey, options.keyType || options.chainId);

    this.identities.set(identity.did, {
      ...identity,
      method
    });

    return identity;
  }

  getIdentity(did) {
    return this.identities.get(did) || null;
  }

  listIdentities() {
    return Array.from(this.identities.values()).map(({ did, method, keyType }) => ({
      did,
      method,
      keyType
    }));
  }

  async resolve(did) {
    const { method } = didRegistry.parse(did);
    const handler = didRegistry.get(method);
    
    if (!handler) {
      throw new Error(`Unsupported DID method: ${method}`);
    }

    const localIdentity = this.identities.get(did);
    if (localIdentity) {
      return localIdentity.didDocument;
    }

    if (method === 'key') {
      const { didDocument } = handler.resolvePublicKey(did);
      return didDocument;
    } else if (method === 'ethr') {
      const { didDocument } = handler.resolve(did);
      return didDocument;
    }

    throw new Error(`Cannot resolve DID: ${did}`);
  }

  async getPublicKey(did) {
    const { method } = didRegistry.parse(did);
    const handler = didRegistry.get(method);

    if (method === 'key') {
      const { publicKey } = handler.resolvePublicKey(did);
      return publicKey;
    }

    throw new Error(`Public key resolution not implemented for ${method}. Please provide the public key.`);
  }

  sign(did, message) {
    const identity = this.identities.get(did);
    if (!identity) {
      throw new Error(`Identity not found: ${did}`);
    }

    const handler = didRegistry.get(identity.method);
    return handler.sign(message, identity.privateKey, identity.keyType);
  }

  async verify(did, message, signature, publicKey) {
    const { method } = didRegistry.parse(did);
    const handler = didRegistry.get(method);
    return handler.verify(message, signature, publicKey, 'p256');
  }

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
      keyType: identity.keyType
    };
  }

  delete(did) {
    return this.identities.delete(did);
  }
}

// 创建全局管理器实例
export const didManager = new DIDManager();
