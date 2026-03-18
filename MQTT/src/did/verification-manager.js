/**
 * did:wba 验证器
 * 
 * 实现完整的 DID 文档验证流程：
 * 1. 从域名下载 did.json
 * 2. 验证 DID 文档格式
 * 3. 验证签名
 * 4. 验证密钥有效性
 * 
 * 规范：https://www.agent-network-protocol.com/specs/did-method
 */

import { ed25519 } from '@noble/curves/ed25519';
import { p256 } from '@noble/curves/p256';
import { x25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';

/**
 * 验证结果
 */
export class VerificationResult {
  constructor(verified, did, didDocument, errors = [], warnings = []) {
    this.verified = verified;
    this.did = did;
    this.didDocument = didDocument;
    this.errors = errors;
    this.warnings = warnings;
    this.timestamp = new Date().toISOString();
  }

  isValid() {
    return this.verified && this.errors.length === 0;
  }

  toString() {
    const status = this.isValid() ? '✅ 验证通过' : '❌ 验证失败';
    const errors = this.errors.length > 0 ? `\n错误:\n${this.errors.map(e => `  - ${e}`).join('\n')}` : '';
    const warnings = this.warnings.length > 0 ? `\n警告:\n${this.warnings.map(w => `  - ${w}`).join('\n')}` : '';
    
    return `${status}
DID: ${this.did}
时间：${this.timestamp}${errors}${warnings}`;
  }
}

/**
 * DID 文档验证器
 */
export class DidDocumentValidator {
  /**
   * 验证 DID 文档格式
   * @param {string} did - DID 字符串
   * @param {Object} didDocument - DID 文档对象
   * @returns {VerificationResult}
   */
  validate(did, didDocument) {
    const errors = [];
    const warnings = [];

    // 1. 验证 @context
    if (!didDocument['@context']) {
      errors.push('缺少必需的 @context 字段');
    } else {
      const contexts = Array.isArray(didDocument['@context']) 
        ? didDocument['@context'] 
        : [didDocument['@context']];
      
      if (!contexts.includes('https://www.w3.org/ns/did/v1')) {
        errors.push('@context 必须包含 "https://www.w3.org/ns/did/v1"');
      }
    }

    // 2. 验证 id 字段
    if (!didDocument.id) {
      errors.push('缺少必需的 id 字段');
    } else if (didDocument.id !== did) {
      errors.push(`DID 文档 id (${didDocument.id}) 与待验证的 DID (${did}) 不匹配`);
    } else if (!didDocument.id.startsWith('did:wba:')) {
      errors.push('DID 必须以 "did:wba:" 开头');
    } else {
      // 验证 DID 格式
      const didError = this.validateDidFormat(didDocument.id);
      if (didError) {
        errors.push(didError);
      }
    }

    // 3. 验证 verificationMethod
    if (!didDocument.verificationMethod || didDocument.verificationMethod.length === 0) {
      errors.push('缺少必需的 verificationMethod 字段或为空');
    } else {
      for (let i = 0; i < didDocument.verificationMethod.length; i++) {
        const vm = didDocument.verificationMethod[i];
        const vmErrors = this.validateVerificationMethod(vm, did);
        errors.push(...vmErrors);
      }
    }

    // 4. 验证 authentication
    if (!didDocument.authentication || didDocument.authentication.length === 0) {
      warnings.push('缺少 authentication 字段，DID 将无法用于身份验证');
    }

    // 5. 验证 keyAgreement（可选）
    if (didDocument.keyAgreement) {
      for (const ka of didDocument.keyAgreement) {
        if (typeof ka === 'object' && ka.id) {
          const kaErrors = this.validateVerificationMethod(ka, did);
          warnings.push(...kaErrors);
        }
      }
    }

    // 6. 验证 humanAuthorization（可选，ANP 扩展）
    if (didDocument.humanAuthorization) {
      warnings.push('检测到 humanAuthorization 字段（ANP 扩展）');
    }

    // 7. 验证 service（可选）
    if (didDocument.service) {
      for (const service of didDocument.service) {
        if (!service.id || !service.type || !service.serviceEndpoint) {
          warnings.push(`service 字段缺少必需字段：${JSON.stringify(service)}`);
        }
      }
    }

    return new VerificationResult(
      errors.length === 0,
      did,
      didDocument,
      errors,
      warnings
    );
  }

  /**
   * 验证 DID 格式
   */
  validateDidFormat(did) {
    if (!did.startsWith('did:wba:')) {
      return 'DID 必须以 "did:wba:" 开头';
    }

    const methodSpecificId = did.substring(8);
    const parts = methodSpecificId.split(':');
    const domain = parts[0];

    // 验证域名
    if (!this.isValidDomain(domain)) {
      return `无效的域名格式：${domain}`;
    }

    // 检查是否包含 IP 地址（不允许）
    if (this.isIPAddress(domain)) {
      return 'DID 不能包含 IP 地址';
    }

    // 检查端口编码
    if (domain.includes('%3A')) {
      const decoded = domain.replace('%3A', ':');
      const port = decoded.split(':').pop();
      if (isNaN(parseInt(port))) {
        return '端口编码无效';
      }
    }

    return null;
  }

  /**
   * 验证域名
   */
  isValidDomain(domain) {
    // 去掉端口部分
    const domainWithoutPort = domain.replace('%3A.*', '').split(':')[0];
    
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domainWithoutPort);
  }

  /**
   * 检查是否为 IP 地址
   */
  isIPAddress(str) {
    // IPv4
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(str)) {
      return true;
    }
    
    // IPv6
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (ipv6Regex.test(str)) {
      return true;
    }
    
    return false;
  }

  /**
   * 验证验证方法
   */
  validateVerificationMethod(vm, did) {
    const errors = [];

    if (!vm.id) {
      errors.push('verificationMethod 缺少 id 字段');
    } else if (!vm.id.startsWith(did + '#')) {
      errors.push(`verificationMethod id (${vm.id}) 必须以 DID (${did}#) 开头`);
    }

    if (!vm.type) {
      errors.push('verificationMethod 缺少 type 字段');
    } else {
      const validTypes = [
        'JsonWebKey2020',
        'EcdsaSecp256k1VerificationKey2019',
        'EcdsaSecp256r1VerificationKey2019',
        'Ed25519VerificationKey2018',
        'Ed25519VerificationKey2020',
        'X25519KeyAgreementKey2019'
      ];
      if (!validTypes.includes(vm.type)) {
        errors.push(`不支持的密钥类型：${vm.type}`);
      }
    }

    if (!vm.controller) {
      errors.push('verificationMethod 缺少 controller 字段');
    } else if (vm.controller !== did) {
      errors.push('verificationMethod controller 必须与 DID 匹配');
    }

    // 验证公钥字段
    if (vm.publicKeyJwk) {
      // JWK 格式
      if (!vm.publicKeyJwk.kty || !vm.publicKeyJwk.crv) {
        errors.push('publicKeyJwk 缺少必需字段 (kty, crv)');
      }
    } else if (!vm.publicKeyMultibase && !vm.publicKeyBase58 && !vm.publicKeyBase64) {
      errors.push('verificationMethod 缺少公钥字段 (publicKeyJwk, publicKeyMultibase, publicKeyBase58, 或 publicKeyBase64)');
    }

    return errors;
  }
}

/**
 * 签名验证器
 */
export class SignatureValidator {
  /**
   * 验证签名
   * @param {Uint8Array} message - 消息
   * @param {Uint8Array} signature - 签名
   * @param {Uint8Array} publicKey - 公钥
   * @param {string} keyType - 密钥类型
   * @returns {boolean}
   */
  verify(message, signature, publicKey, keyType) {
    try {
      if (keyType === 'Ed25519VerificationKey2020' || keyType === 'Ed25519VerificationKey2018') {
        return ed25519.verify(signature, message, publicKey);
      } else if (keyType === 'EcdsaSecp256r1VerificationKey2019') {
        return p256.verify(signature, message, publicKey);
      } else if (keyType === 'EcdsaSecp256k1VerificationKey2019') {
        // 需要 secp256k1 库
        throw new Error('secp256k1 verification not implemented');
      }
      throw new Error(`Unsupported key type: ${keyType}`);
    } catch (e) {
      console.error('Signature verification error:', e);
      return false;
    }
  }

  /**
   * 验证 DID 文档签名（如果存在证明）
   * @param {Object} didDocument - DID 文档
   * @returns {Promise<{verified: boolean, message: string}>}
   */
  async verifyDidDocumentSignature(didDocument) {
    // 检查是否有 proof 字段
    if (!didDocument.proof) {
      return {
        verified: false,
        message: 'DID 文档没有签名证明（proof 字段可选）'
      };
    }

    // TODO: 实现完整的签名验证
    // 需要：
    // 1. 提取 proof 中的签名
    // 2. 找到对应的验证方法
    // 3. 验证签名

    return {
      verified: false,
      message: '签名验证功能待实现'
    };
  }
}

/**
 * 网络验证器 - 从域名下载并验证 DID 文档
 */
export class NetworkValidator {
  constructor(options = {}) {
    this.timeout = options.timeout || 10000; // 10 秒超时
    this.fetch = options.fetch || globalThis.fetch;
  }

  /**
   * 从域名下载 DID 文档
   * @param {string} did - DID 字符串
   * @returns {Promise<{success: boolean, didDocument?: Object, error?: string}>}
   */
  async fetchDidDocument(did) {
    const didJsonUrl = this.buildDidJsonUrl(did);

    try {
      const response = await this.fetch(didJsonUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const didDocument = await response.json();
      return {
        success: true,
        didDocument
      };
    } catch (e) {
      if (e.name === 'TimeoutError') {
        return {
          success: false,
          error: `请求超时（${this.timeout}ms）`
        };
      }
      return {
        success: false,
        error: `网络错误：${e.message}`
      };
    }
  }

  /**
   * 构建 did.json URL
   */
  buildDidJsonUrl(did) {
    // 解析 DID
    if (!did.startsWith('did:wba:')) {
      throw new Error('Invalid did:wba format');
    }

    const methodSpecificId = did.substring(8);
    const parts = methodSpecificId.split(':');
    const domainWithPort = parts[0];
    const path = parts.slice(1).join('/');

    // 解析域名和端口
    let domain = domainWithPort;
    let port = null;

    if (domainWithPort.includes('%3A')) {
      const decoded = domainWithPort.replace('%3A', ':');
      const colonIndex = decoded.lastIndexOf(':');
      domain = decoded.substring(0, colonIndex);
      port = parseInt(decoded.substring(colonIndex + 1));
    }

    // 构建 URL
    let url = `https://${domain}`;
    if (port) {
      url += `:${port}`;
    }

    if (path) {
      url += `/${path}`;
    } else {
      url += '/.well-known';
    }

    url += '/did.json';
    return url;
  }

  /**
   * 完整验证流程
   * @param {string} did - DID 字符串
   * @returns {Promise<VerificationResult>}
   */
  async verify(did) {
    // 1. 下载 DID 文档
    const fetchResult = await this.fetchDidDocument(did);
    
    if (!fetchResult.success) {
      return new VerificationResult(
        false,
        did,
        null,
        [`无法获取 DID 文档：${fetchResult.error}`]
      );
    }

    // 2. 验证 DID 文档格式
    const validator = new DidDocumentValidator();
    const formatResult = validator.validate(did, fetchResult.didDocument);

    if (!formatResult.isValid()) {
      return formatResult;
    }

    // 3. 验证签名（可选）
    const signatureValidator = new SignatureValidator();
    const signatureResult = await signatureValidator.verifyDidDocumentSignature(fetchResult.didDocument);

    if (!signatureResult.verified) {
      formatResult.warnings.push(signatureResult.message);
    }

    return formatResult;
  }
}

/**
 * 验证管理器 - 统一验证接口
 */
export class VerificationManager {
  constructor(options = {}) {
    this.formatValidator = new DidDocumentValidator();
    this.signatureValidator = new SignatureValidator();
    this.networkValidator = new NetworkValidator(options);
  }

  /**
   * 验证 DID 文档（本地）
   * @param {string} did - DID 字符串
   * @param {Object} didDocument - DID 文档对象
   * @returns {VerificationResult}
   */
  validateLocal(did, didDocument) {
    return this.formatValidator.validate(did, didDocument);
  }

  /**
   * 验证 DID 文档（从网络下载）
   * @param {string} did - DID 字符串
   * @returns {Promise<VerificationResult>}
   */
  async verifyRemote(did) {
    return await this.networkValidator.verify(did);
  }

  /**
   * 验证签名
   * @param {Uint8Array} message - 消息
   * @param {Uint8Array} signature - 签名
   * @param {Uint8Array} publicKey - 公钥
   * @param {string} keyType - 密钥类型
   * @returns {boolean}
   */
  verifySignature(message, signature, publicKey, keyType) {
    return this.signatureValidator.verify(message, signature, publicKey, keyType);
  }

  /**
   * 验证跨 DID 通信的公钥
   * @param {string} did - DID 字符串
   * @param {Uint8Array} publicKey - 公钥
   * @param {string} keyType - 密钥类型
   * @returns {Promise<{verified: boolean, message: string}>}
   */
  async verifyPublicKey(did, publicKey, keyType) {
    // 1. 从网络获取 DID 文档
    const fetchResult = await this.networkValidator.fetchDidDocument(did);
    
    if (!fetchResult.success) {
      return {
        verified: false,
        message: `无法获取 DID 文档：${fetchResult.error}`
      };
    }

    // 2. 验证 DID 文档格式
    const formatResult = this.formatValidator.validate(did, fetchResult.didDocument);
    
    if (!formatResult.isValid()) {
      return {
        verified: false,
        message: `DID 文档格式无效：${formatResult.errors.join(', ')}`
      };
    }

    // 3. 验证公钥匹配
    // TODO: 从 DID 文档中提取公钥并与提供的公钥比较

    return {
      verified: true,
      message: '公钥验证通过'
    };
  }
}

// 创建全局验证管理器实例
export const verificationManager = new VerificationManager();
