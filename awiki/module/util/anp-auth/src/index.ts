/**
 * @awiki/anp-auth - ANP 认证模块
 * 
 * 移植自 Python anp.authentication 模块
 * 提供 DID WBA 文档创建和验证功能
 */

import crypto from 'crypto';
import canonicalizeModule from 'canonicalize';

// 类型定义
const serialize: (input: unknown) => string | undefined = canonicalizeModule as unknown as (input: unknown) => string | undefined;

// 常量定义
export const VM_KEY_AUTH = 'key-1';
export const VM_KEY_E2EE_SIGNING = 'key-2';
export const VM_KEY_E2EE_AGREEMENT = 'key-3';

const PROOF_TYPE_SECP256K1 = 'EcdsaSecp256k1Signature2019';

/**
 * Base64URL 编码（不带填充）
 */
function encodeBase64UrlNoPad(buffer: Uint8Array | Buffer): string {
  return buffer.toString('base64url').replace(/=/g, '');
}

/**
 * Base58 编码
 */
function encodeBase58(buffer: Uint8Array | Buffer): string {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const BASE = 58n;
  
  const source = Buffer.from(buffer);
  if (source.length === 0) return '';
  
  let digits: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    let carry = source[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = Number(BigInt(carry) % BASE);
      carry = Number(BigInt(carry) / BASE);
    }
    while (carry > 0) {
      digits.push(Number(BigInt(carry) % BASE));
      carry = Number(BigInt(carry) / BASE);
    }
  }
  
  // 处理前导零
  for (let i = 0; i < source.length && source[i] === 0; i++) {
    digits.push(0);
  }
  
  return digits.reverse().map(d => ALPHABET[d]).join('');
}

/**
 * SHA-256 哈希
 */
function sha256(data: string | Buffer | Uint8Array): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

/**
 * 计算 JWK 指纹（RFC 7638）
 * 
 * @param publicKey - secp256k1 公钥
 * @returns 43 字符的 base64url 指纹
 */
export function computeJwkFingerprint(publicKey: crypto.KeyObject): string {
  // 从公钥提取 x, y 坐标
  const jwk = publicKey.export({ format: 'jwk' });
  const x = jwk.x as string;
  const y = jwk.y as string;
  
  // 规范化 JSON（按字母顺序排列字段）
  const canonical = JSON.stringify({
    crv: 'secp256k1',
    kty: 'EC',
    x: x,
    y: y,
  });
  
  // SHA-256 哈希
  const digest = sha256(canonical);
  
  // Base64URL 编码（无填充）
  return encodeBase64UrlNoPad(digest);
}

/**
 * 将公钥转换为 JWK 格式
 */
export function publicKeyToJwk(publicKey: crypto.KeyObject): Record<string, string> {
  const jwk = publicKey.export({ format: 'jwk' });
  
  // 计算 kid（使用 JWK 的 SHA-256，而不是 DER 格式）
  // Node.js 不支持 'ec-public' 类型
  const jwkForKid = JSON.stringify({
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y,
  });
  const kid = encodeBase64UrlNoPad(sha256(jwkForKid));
  
  return {
    kty: 'EC',
    crv: 'secp256k1',
    x: jwk.x as string,
    y: jwk.y as string,
    kid: kid,
  };
}

/**
 * 生成 secp256r1 公钥的 JWK
 */
function secp256r1PublicKeyToJwk(publicKey: crypto.KeyObject): Record<string, string> {
  const jwk = publicKey.export({ format: 'jwk' });
  
  return {
    kty: 'EC',
    crv: 'P-256',
    x: jwk.x as string,
    y: jwk.y as string,
  };
}

/**
 * 生成 X25519 公钥的 multibase 编码
 */
function publicKeyToMultibase(publicKey: crypto.KeyObject): string {
  // 使用 spki 格式导出
  const der = (publicKey as any).export({ format: 'der', type: 'spki' });
  // 提取实际的公钥字节（去掉 ASN.1 头部）
  // X25519 公钥是 32 字节
  const keyBytes = Buffer.from(der.slice(-32));
  // 使用 base58btc 编码（'z' 前缀）
  const base58 = encodeBase58(keyBytes);
  return 'z' + base58;
}

interface E2eeEntries {
  vmEntries: Array<Record<string, unknown>>;
  kaRefs: string[];
  keysDict: Record<string, [Buffer, Buffer]>;
}

/**
 * 构建 E2EE 密钥条目（secp256r1 + X25519）
 */
function buildE2eeEntries(did: string): E2eeEntries {
  // 生成 secp256r1 密钥对
  const secp256r1KeyPair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  
  // 生成 X25519 密钥对
  const x25519KeyPair = crypto.generateKeyPairSync('x25519');
  
  // 构建验证方法条目
  const vmKey2 = {
    id: `${did}#${VM_KEY_E2EE_SIGNING}`,
    type: 'EcdsaSecp256r1VerificationKey2019',
    controller: did,
    publicKeyJwk: secp256r1PublicKeyToJwk(secp256r1KeyPair.publicKey),
  };
  
  const vmKey3 = {
    id: `${did}#${VM_KEY_E2EE_AGREEMENT}`,
    type: 'X25519KeyAgreementKey2019',
    controller: did,
    publicKeyMultibase: publicKeyToMultibase(x25519KeyPair.publicKey),
  };
  
  const vmEntries = [vmKey2, vmKey3];
  const kaRefs = [`${did}#${VM_KEY_E2EE_AGREEMENT}`];
  
  // 序列化密钥为 PEM
  const secp256r1PrivatePem = secp256r1KeyPair.privateKey.export({
    format: 'pem',
    type: 'pkcs8',
  });
  const secp256r1PublicPem = secp256r1KeyPair.publicKey.export({
    format: 'pem',
    type: 'spki',
  });
  
  const x25519PrivatePem = x25519KeyPair.privateKey.export({
    format: 'pem',
    type: 'pkcs8',
  });
  const x25519PublicPem = x25519KeyPair.publicKey.export({
    format: 'pem',
    type: 'spki',
  });
  
  const keysDict: Record<string, [Buffer, Buffer]> = {
    [VM_KEY_E2EE_SIGNING]: [
      Buffer.from(secp256r1PrivatePem),
      Buffer.from(secp256r1PublicPem),
    ],
    [VM_KEY_E2EE_AGREEMENT]: [
      Buffer.from(x25519PrivatePem),
      Buffer.from(x25519PublicPem),
    ],
  };
  
  return { vmEntries, kaRefs, keysDict };
}

/**
 * 计算签名输入（用于 W3C 数据完整性证明）
 */
function computeSigningInput(
  document: Record<string, unknown>,
  proofOptions: Record<string, unknown>
): Buffer {
  // 规范化文档和证明选项
  const canonicalDoc = serialize(document) as string;
  const canonicalProof = serialize(proofOptions) as string;
  
  // 组合并哈希
  const combined = `${canonicalDoc}${canonicalProof}`;
  return sha256(combined);
}

/**
 * 使用 secp256k1 签名
 */
function signSecp256k1(
  privateKey: crypto.KeyObject,
  toBeSigned: Buffer
): Buffer {
  const signature = crypto.sign('sha256', toBeSigned, privateKey);
  // 将 DER 格式转换为 R||S 格式（IEEE P1363）
  let r: Buffer, s: Buffer;
  
  // DER 解析
  if (signature[0] === 0x30) {
    let offset = 2; // 跳过 0x30 和总长度
    const rLen = signature[offset + 1];
    r = signature.slice(offset + 2, offset + 2 + rLen);
    offset += 2 + rLen;
    const sLen = signature[offset + 1];
    s = signature.slice(offset + 2, offset + 2 + sLen);
  } else {
    // 假设已经是 R||S 格式
    const halfLen = signature.length / 2;
    r = signature.slice(0, halfLen);
    s = signature.slice(halfLen);
  }
  
  // 填充到 32 字节
  const rPadded = r.length < 32 ? Buffer.concat([Buffer.alloc(32 - r.length), r]) : r.slice(-32);
  const sPadded = s.length < 32 ? Buffer.concat([Buffer.alloc(32 - s.length), s]) : s.slice(-32);
  
  return Buffer.concat([rPadded, sPadded]);
}

/**
 * 生成 W3C 数据完整性证明
 */
export function generateW3cProof(
  document: Record<string, unknown>,
  privateKey: crypto.KeyObject,
  verificationMethod: string,
  proofPurpose: string = 'assertionMethod',
  domain?: string,
  challenge?: string,
  created?: string
): Record<string, unknown> {
  const proofType = PROOF_TYPE_SECP256K1;
  
  // 准备时间戳
  if (created === undefined) {
    created = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  
  // 构建证明选项
  const proofOptions: Record<string, unknown> = {
    type: proofType,
    created: created,
    verificationMethod: verificationMethod,
    proofPurpose: proofPurpose,
  };
  
  if (domain !== undefined) {
    proofOptions.domain = domain;
  }
  if (challenge !== undefined) {
    proofOptions.challenge = challenge;
  }
  
  // 移除现有 proof 用于签名
  const docWithoutProof: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(document)) {
    if (key !== 'proof') {
      docWithoutProof[key] = value;
    }
  }
  
  // 计算签名输入
  const toBeSigned = computeSigningInput(docWithoutProof, proofOptions);
  
  // 签名
  const signature = signSecp256k1(privateKey, toBeSigned);
  
  // Base64URL 编码
  const proofValue = encodeBase64UrlNoPad(signature);
  
  // 构建完整的证明对象
  const proof: Record<string, unknown> = {
    ...proofOptions,
    proofValue: proofValue,
  };
  
  // 返回带证明的新文档
  return {
    ...document,
    proof: proof,
  };
}

/**
 * 检查是否为 IP 地址
 */
function isIpAddress(hostname: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) {
    return true;
  }
  if (hostname.includes(':')) {
    return true;
  }
  return false;
}

interface CreateDidWbaOptions {
  hostname: string;
  port?: number;
  pathPrefix?: string[];
  agentDescriptionUrl?: string;
  services?: Array<Record<string, unknown>>;
  proofPurpose?: string;
  verificationMethod?: string;
  domain?: string;
  challenge?: string;
  created?: string;
  enableE2ee?: boolean;
}

interface CreateDidWbaResult {
  didDocument: Record<string, unknown>;
  keys: Record<string, [Buffer, Buffer]>;
}

/**
 * 创建带密钥绑定的 DID WBA 文档
 * 
 * @param options - 创建选项
 * @returns DID 文档和密钥对
 */
export function createDidWbaDocumentWithKeyBinding(options: CreateDidWbaOptions): CreateDidWbaResult {
  const {
    hostname,
    port,
    pathPrefix,
    agentDescriptionUrl,
    services,
    proofPurpose = 'assertionMethod',
    verificationMethod,
    domain,
    challenge,
    created,
    enableE2ee = true,
  } = options;
  
  if (!hostname) {
    throw new Error('Hostname cannot be empty');
  }
  
  if (isIpAddress(hostname)) {
    throw new Error('Hostname cannot be an IP address');
  }
  
  const effectivePathPrefix = pathPrefix ?? ['user'];
  
  // 生成 secp256k1 密钥对
  const secp256k1KeyPair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
  });
  
  // 计算 JWK 指纹
  const fp = computeJwkFingerprint(secp256k1KeyPair.publicKey);
  const uniqueId = `k1_${fp}`;
  
  // 构建路径
  const pathSegments = [...effectivePathPrefix, uniqueId];
  
  // 构建 DID
  let didBase = `did:wba:${hostname}`;
  if (port !== undefined) {
    didBase = `${didBase}:${encodeURIComponent(`:${port}`)}`;
  }
  const didPath = pathSegments.join(':');
  const did = `${didBase}:${didPath}`;
  
  // 构建验证方法
  const vmEntry = {
    id: `${did}#${VM_KEY_AUTH}`,
    type: 'EcdsaSecp256k1VerificationKey2019',
    controller: did,
    publicKeyJwk: publicKeyToJwk(secp256k1KeyPair.publicKey),
  };
  
  const verificationMethods: Array<Record<string, unknown>> = [vmEntry];
  const contexts = [
    'https://www.w3.org/ns/did/v1',
    'https://w3id.org/security/suites/jws-2020/v1',
    'https://w3id.org/security/suites/secp256k1-2019/v1',
  ];
  
  // 构建密钥字典
  const secp256k1PrivatePem = secp256k1KeyPair.privateKey.export({
    format: 'pem',
    type: 'pkcs8',
  });
  const secp256k1PublicPem = secp256k1KeyPair.publicKey.export({
    format: 'pem',
    type: 'spki',
  });
  
  const keys: Record<string, [Buffer, Buffer]> = {
    [VM_KEY_AUTH]: [
      Buffer.from(secp256k1PrivatePem),
      Buffer.from(secp256k1PublicPem),
    ],
  };
  
  // 构建 DID 文档
  const didDocument: Record<string, unknown> = {
    '@context': contexts,
    id: did,
    verificationMethod: verificationMethods,
    authentication: [vmEntry.id],
  };
  
  // 添加 E2EE 密钥（如果启用）
  if (enableE2ee) {
    const { vmEntries, kaRefs, keysDict } = buildE2eeEntries(did);
    verificationMethods.push(...vmEntries);
    didDocument['keyAgreement'] = kaRefs;
    contexts.push('https://w3id.org/security/suites/x25519-2019/v1');
    Object.assign(keys, keysDict);
  }
  
  // 合并服务条目
  const allServices: Array<Record<string, unknown>> = [];
  if (agentDescriptionUrl !== undefined) {
    allServices.push({
      id: `${did}#ad`,
      type: 'AgentDescription',
      serviceEndpoint: agentDescriptionUrl,
    });
  }
  if (services !== undefined && services !== null) {
    for (const svc of services) {
      const svcId = (svc.id as string) || '';
      if (svcId.startsWith('#')) {
        allServices.push({ ...svc, id: `${did}${svcId}` });
      } else {
        allServices.push(svc);
      }
    }
  }
  if (allServices.length > 0) {
    didDocument['service'] = allServices;
  }
  
  // 自签名 DID 文档
  const proofVm = verificationMethod ?? (didDocument.verificationMethod as Array<Record<string, unknown>>)[0].id;
  
  const signedDocument = generateW3cProof(
    didDocument,
    secp256k1KeyPair.privateKey,
    proofVm as string,
    proofPurpose,
    domain,
    challenge,
    created
  );
  
  return { didDocument: signedDocument, keys };
}
