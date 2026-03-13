/**
 * DID 方法注册表 - 支持可扩展的 DID 方法
 */

export class DIDMethodRegistry {
  constructor() {
    this.methods = new Map();
  }

  register(methodName, handler) {
    this.methods.set(methodName.toLowerCase(), handler);
  }

  get(methodName) {
    return this.methods.get(methodName.toLowerCase()) || null;
  }

  isSupported(methodName) {
    return this.methods.has(methodName.toLowerCase());
  }

  getSupportedMethods() {
    return Array.from(this.methods.keys());
  }

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

  validate(did) {
    try {
      this.parse(did);
      return true;
    } catch {
      return false;
    }
  }
}

// 创建全局注册表实例
export const didRegistry = new DIDMethodRegistry();
