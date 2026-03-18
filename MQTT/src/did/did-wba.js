/**
 * did:wba 方法实现（符合 ANP 规范 v0.1）
 * 
 * 规范：https://www.agent-network-protocol.com/specs/did-method
 * GitHub: https://github.com/agent-network-protocol/AgentNetworkProtocol/blob/main/03-did-wba-method-design-specification.md
 * 
 * DID 格式：
 * - did:wba:example.com
 * - did:wba:example.com:user:alice
 * - did:wba:example.com%3A3000 (带端口)
 * 
 * 部署位置：
 * - did:wba:example.com → https://example.com/.well-known/did.json
 * - did:wba:example.com:user:alice → https://example.com/user/alice/did.json
 * - did:wba:example.com%3A3000 → https://example.com:3000/.well-known/did.json
 * 
 * 注意：当前实现为简化版本，用于 E2EE 通信标识
 * 完整实现需要：域名、HTTPS 服务器、did.json 部署
 */

import { x25519 } from '@noble/curves/ed25519';
import { p256 } from '@noble/curves/p256';
import { ed25519 } from '@noble/curves/ed25519';
import { randomBytes } from '@noble/hashes/utils';

export class DIDWbaHandler {
  constructor(options = {}) {
    this.defaultDomain = options.defaultDomain || 'example.com';
    this.chains = options.chains || {}; // 保留链配置用于兼容
  }

  /**
   * 解析 DID 字符串
   * 格式：did:wba:<domain>[:<path>]
   * 端口编码：%3A 表示冒号
   */
  parseDID(did) {
    if (!did.startsWith('did:wba:')) {
      throw new Error('Invalid did:wba format');
    }

    const methodSpecificId = did.substring(8); // 去掉 'did:wba:'
    
    // 分割域名和路径
    const parts = methodSpecificId.split(':');
    const domainWithPort = parts[0];
    const path = parts.slice(1).join('/'); // 路径用 / 连接

    // 解析域名和端口
    let domain = domainWithPort;
    let port = null;
    
    if (domainWithPort.includes('%3A')) {
      const decoded = domainWithPort.replace('%3A', ':');
      const colonIndex = decoded.lastIndexOf(':');
      domain = decoded.substring(0, colonIndex);
      port = parseInt(decoded.substring(colonIndex + 1));
    }

    return {
      domain,
      port,
      path: path || null,
      full: did
    };
  }

  /**
   * 生成 did.json URL
   */
  getDidJsonUrl(did) {
    const { domain, port, path } = this.parseDID(did);
    
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
   * 生成新的 DID WBA 身份
   * @param {Object} options - 选项
   * @param {string} options.domain - 域名（必需）
   * @param {string} options.path - 可选路径（如 'user:alice'）
   * @param {string} options.keyType - 密钥类型：'x25519', 'p256', 'ed25519'
   * @returns {Object}
   */
  generate(options = {}) {
    const domain = options.domain;
    const path = options.path || null;
    const keyType = (options.keyType || 'x25519').toLowerCase();
    
    if (!domain) {
      throw new Error('did:wba requires a domain name. Use: { domain: "example.com" }');
    }

    let privateKey, publicKey;

    // 生成密钥对
    if (keyType === 'x25519') {
      privateKey = Buffer.from(x25519.utils.randomPrivateKey());
      publicKey = Buffer.from(x25519.getPublicKey(privateKey));
    } else if (keyType === 'p256') {
      privateKey = Buffer.from(p256.utils.randomPrivateKey());
      publicKey = Buffer.from(p256.getPublicKey(privateKey));
    } else if (keyType === 'ed25519') {
      privateKey = Buffer.from(ed25519.utils.randomPrivateKey());
      publicKey = Buffer.from(ed25519.getPublicKey(privateKey));
    } else {
      throw new Error(`Unsupported key type: ${keyType}. Use 'x25519', 'p256', or 'ed25519'.`);
    }

    // 构建 DID: did:wba:<domain>[:<path>]
    let did = `did:wba:${domain}`;
    if (path) {
      did += `:${path.replace(/\//g, ':')}`; // 路径中的 / 用 : 连接
    }

    return {
      did,
      privateKey,
      publicKey,
      keyType,
      domain,
      path,
      didDocument: this.createDIDDocument(did, publicKey, keyType)
    };
  }

  /**
   * 从公钥创建身份（用于跨 DID 通信）
   */
  fromPublicKey(publicKey, domain, keyType = 'x25519', path = null, did = null) {
    const finalDid = did || this.buildDID(domain, path);

    return {
      did: finalDid,
      publicKey: Buffer.from(publicKey),
      keyType: keyType.toLowerCase(),
      domain,
      path,
      didDocument: this.createDIDDocument(finalDid, publicKey, keyType)
    };
  }

  /**
   * 从私钥恢复身份
   */
  fromPrivateKey(privateKey, domain, keyType = 'x25519', path = null) {
    const type = keyType.toLowerCase();
    let publicKey;

    if (type === 'x25519') {
      publicKey = Buffer.from(x25519.getPublicKey(privateKey));
    } else if (type === 'p256') {
      publicKey = Buffer.from(p256.getPublicKey(privateKey));
    } else if (type === 'ed25519') {
      publicKey = Buffer.from(ed25519.getPublicKey(privateKey));
    } else {
      throw new Error(`Unsupported key type: ${keyType}`);
    }

    const did = this.buildDID(domain, path);

    return {
      did,
      privateKey: Buffer.from(privateKey),
      publicKey,
      keyType: type,
      domain,
      path,
      didDocument: this.createDIDDocument(did, publicKey, type)
    };
  }

  /**
   * 构建 DID 字符串
   */
  buildDID(domain, path = null) {
    let did = `did:wba:${domain}`;
    if (path) {
      did += `:${path.replace(/\//g, ':')}`;
    }
    return did;
  }

  /**
   * 从 DID 解析公钥（需要从 did.json 获取）
   */
  resolvePublicKey(did) {
    const { domain, path } = this.parseDID(did);
    
    return {
      domain,
      path,
      didJsonUrl: this.getDidJsonUrl(did),
      didDocument: {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: did,
        verificationMethod: [{
          id: `${did}#key-1`,
          type: 'JsonWebKey2020',
          controller: did,
          publicKeyJwk: { /* 需要从服务器获取 */ }
        }]
      }
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
   * 创建 DID 文档（符合 ANP 规范）
   */
  createDIDDocument(did, publicKey, keyType) {
    const keyId = `${did}#key-1`;
    
    // 根据密钥类型创建验证方法
    let verificationMethod;
    
    if (keyType === 'x25519') {
      verificationMethod = {
        id: `${did}#key-agreement`,
        type: 'X25519KeyAgreementKey2019',
        controller: did,
        publicKeyMultibase: 'z' + Buffer.from(publicKey).toString('hex')
      };
    } else if (keyType === 'p256') {
      const jwk = this.publicKeyToJWK(publicKey);
      verificationMethod = {
        id: keyId,
        type: 'EcdsaSecp256r1VerificationKey2019',
        controller: did,
        publicKeyJwk: jwk
      };
    } else if (keyType === 'ed25519') {
      verificationMethod = {
        id: keyId,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyMultibase: 'z' + Buffer.from(publicKey).toString('hex')
      };
    }

    // 构建完整的 DID 文档
    const didDocument = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/jws-2020/v1',
        'https://w3id.org/security/suites/x25519-2019/v1'
      ],
      id: did,
      verificationMethod: [verificationMethod],
      authentication: [keyId],
      assertionMethod: [keyId],
      keyAgreement: keyType === 'x25519' ? [`${did}#key-agreement`] : []
    };

    return didDocument;
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
   * 签名消息（使用 Ed25519 或 P-256）
   */
  sign(message, privateKey, keyType = 'ed25519') {
    if (keyType === 'ed25519') {
      return ed25519.sign(message, privateKey);
    } else if (keyType === 'p256') {
      const signature = p256.sign(message, privateKey);
      return new Uint8Array(signature.toCompactRawBytes());
    }
    throw new Error(`Unsupported key type for signing: ${keyType}`);
  }

  /**
   * 验证签名
   */
  verify(message, signature, publicKey, keyType = 'ed25519') {
    try {
      if (keyType === 'ed25519') {
        return ed25519.verify(signature, message, publicKey);
      } else if (keyType === 'p256') {
        return p256.verify(signature, message, publicKey);
      }
    } catch {
      return false;
    }
    throw new Error(`Unsupported key type for verification: ${keyType}`);
  }

  /**
   * 生成 did.json 文件内容（用于部署）
   */
  generateDidJson(did, publicKey, keyType) {
    return this.createDIDDocument(did, publicKey, keyType);
  }

  /**
   * 获取部署说明
   */
  getDeploymentInstructions(did) {
    const { domain, port, path } = this.parseDID(did);
    const url = this.getDidJsonUrl(did);
    
    return {
      did,
      domain,
      port,
      path,
      didJsonUrl: url,
      deploymentPath: path ? `./${path.replace(/:/g, '/')}/did.json` : './.well-known/did.json',
      instructions: `
将生成的 did.json 文件部署到以下位置：
${url}

部署方式：
1. 如果使用 Nginx/Apache，创建对应的文件路径
2. 确保可以通过 HTTPS 访问
3. 设置正确的 MIME 类型：application/json

验证部署：
curl ${url}
      `.trim()
    };
  }
}

// 创建全局处理器实例
export const didWbaHandler = new DIDWbaHandler();
