/**
 * DID 方法注册表 - 支持可扩展的 DID 方法
 * 
 * 设计原则:
 * 1. 统一接口：所有 DID 方法实现相同的接口
 * 2. 动态注册：支持运行时注册新的 DID 方法
 * 3. 跨方法通信：不同 DID 方法之间可以互相通信
 * 4. 公共密钥格式：统一使用原始字节作为公钥格式用于 E2EE
 */

export class DIDMethodRegistry {
  constructor() {
    this.methods = new Map();
  }

  /**
   * 注册 DID 方法处理器
   * @param {string} methodName - DID 方法名称（如 'key', 'ethr', 'wba'）
   * @param {Object} handler - DID 方法处理器，必须实现统一接口
   */
  register(methodName, handler) {
    const normalized = methodName.toLowerCase();
    
    // 验证处理器接口
    this.validateHandler(handler, methodName);
    
    this.methods.set(normalized, handler);
    console.log(`[DID Registry] Registered method: ${normalized}`);
  }

  /**
   * 验证处理器是否实现必需接口
   */
  validateHandler(handler, methodName) {
    const requiredMethods = [
      'generate',
      'fromPublicKey',
      'resolvePublicKey',
      'getSharedSecret'
    ];

    for (const method of requiredMethods) {
      if (typeof handler[method] !== 'function') {
        throw new Error(`DID handler for '${methodName}' must implement method: ${method}`);
      }
    }
  }

  /**
   * 获取 DID 方法处理器
   * @param {string} methodName 
   * @returns {Object|null}
   */
  get(methodName) {
    return this.methods.get(methodName.toLowerCase()) || null;
  }

  /**
   * 检查是否支持某 DID 方法
   */
  isSupported(methodName) {
    return this.methods.has(methodName.toLowerCase());
  }

  /**
   * 获取所有支持的方法列表
   */
  getSupportedMethods() {
    return Array.from(this.methods.keys());
  }

  /**
   * 解析 DID 字符串
   * @param {string} did - DID 字符串
   * @returns {Object} - { method, id, fragment, full }
   */
  parse(did) {
    if (!did || !did.startsWith('did:')) {
      throw new Error('Invalid DID format: must start with "did:"');
    }

    const parts = did.split(':');
    if (parts.length < 3) {
      throw new Error('Invalid DID format: did:<method>:<id>');
    }

    const method = parts[1];
    const id = parts.slice(2).join(':');

    let fragment = null;
    const fragmentIndex = id.indexOf('#');
    if (fragmentIndex !== -1) {
      fragment = id.substring(fragmentIndex);
    }

    return { method, id, fragment, full: did };
  }

  /**
   * 验证 DID 格式
   */
  validate(did) {
    try {
      this.parse(did);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 跨 DID 方法获取共享密钥
   * 这是实现跨 DID 通信的关键方法
   * 
   * @param {string} myDid - 我的 DID
   * @param {string} myPrivateKey - 我的私钥
   * @param {string} theirDid - 对方的 DID
   * @param {Uint8Array} theirPublicKey - 对方的公钥（原始字节）
   * @returns {Promise<Uint8Array>} - 共享密钥
   */
  async getSharedSecret(myDid, myPrivateKey, theirDid, theirPublicKey) {
    const { method: myMethod } = this.parse(myDid);
    const { method: theirMethod } = this.parse(theirDid);

    const myHandler = this.get(myMethod);
    if (!myHandler) {
      throw new Error(`Unsupported DID method: ${myMethod}`);
    }

    // 使用统一的 getSharedSecret 接口
    // 所有 DID 方法都必须实现这个方法，确保跨方法通信
    return await myHandler.getSharedSecret(myPrivateKey, theirPublicKey, {
      myMethod,
      theirMethod,
      theirDid
    });
  }
}

// 创建全局注册表实例
export const didRegistry = new DIDMethodRegistry();
