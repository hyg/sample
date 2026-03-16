/**
 * DID Identity 模块
 *
 * 移植自：python/scripts/utils/identity.py
 *
 * 功能：DID 身份创建（包装 ANP 库）
 *
 * 命名规范：snake_case（与 Python 版本保持一致）
 */

import crypto from 'crypto';
import { KeyObject } from 'crypto';
import {
  DIDIdentityData,
  CreateIdentityOptions,
} from './types.js';

// 从 anp-auth 导入
import {
  createDidWbaDocumentWithKeyBinding,
} from '@awiki/anp-auth';

/**
 * DID 身份类
 *
 * 包含完整的 DID 身份信息，包括密钥对、DID 文档、JWT 等
 *
 * 命名规范：所有属性和方法使用 snake_case 与 Python 版本一致
 */
export class DIDIdentity {
  /** DID 标识符 */
  did: string;
  /** DID 文档（包含 ANP 生成的 proof） */
  did_document: Record<string, unknown>;
  /** PEM 编码的 secp256k1 私钥 */
  private_key_pem: Buffer;
  /** PEM 编码的 secp256k1 公钥 */
  public_key_pem: Buffer;
  /** 注册后填充的用户 ID */
  user_id: string | null;
  /** WBA 认证后填充的 JWT Token */
  jwt_token: string | null;
  /** E2EE 签名私钥 PEM (key-2 secp256r1) */
  e2ee_signing_private_pem: Buffer | null;
  /** E2EE 签名公钥 PEM (key-2 secp256r1) */
  e2ee_signing_public_pem: Buffer | null;
  /** E2EE 协议私钥 PEM (key-3 X25519) */
  e2ee_agreement_private_pem: Buffer | null;
  /** E2EE 协议公钥 PEM (key-3 X25519) */
  e2ee_agreement_public_pem: Buffer | null;

  constructor(data: DIDIdentityData) {
    this.did = data.did;
    this.did_document = data.did_document;
    this.private_key_pem = data.private_key_pem;
    this.public_key_pem = data.public_key_pem;
    this.user_id = data.user_id ?? null;
    this.jwt_token = data.jwt_token ?? null;
    this.e2ee_signing_private_pem = data.e2ee_signing_private_pem ?? null;
    this.e2ee_signing_public_pem = data.e2ee_signing_public_pem ?? null;
    this.e2ee_agreement_private_pem = data.e2ee_agreement_private_pem ?? null;
    this.e2ee_agreement_public_pem = data.e2ee_agreement_public_pem ?? null;
  }

  /**
   * 从 DID 提取 unique_id（最后一段路径）
   *
   * 例如：did:wba:awiki.ai:user:k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g
   * 返回：k1_AB8G0We3oboQNZldVTWdfTyqSrwQPV7QSCSeP3P8O1g
   *
   * @returns unique_id
   */
  get unique_id(): string {
    const parts = this.did.split(':');
    return parts[parts.length - 1];
  }

  /**
   * 从 PEM 加载 secp256k1 私钥对象
   *
   * @returns 私钥对象
   */
  get_private_key(): KeyObject {
    return load_private_key(this.private_key_pem);
  }
}

/**
 * 创建 DID 身份（secp256k1 密钥对 + DID 文档 + proof）
 *
 * 使用 ANP 的 createDidWbaDocumentWithKeyBinding() 生成完整的 DID 文档。
 * 自动从公钥计算指纹，构造 k1_{fingerprint} 作为 DID 路径的最后一段。
 *
 * @param options - 创建选项
 * @param options.hostname - DID 域名
 * @param options.path_prefix - DID 路径前缀，如 ["user"]（默认）或 ["agent"]
 * @param options.proof_purpose - 证明用途（默认 "authentication"，用于注册）
 * @param options.domain - 绑定到证明的服务域名（由服务器验证）
 * @param options.challenge - 证明 nonce（默认自动生成，用于防止重放）
 * @param options.services - 自定义服务条目列表
 * @returns DIDIdentity 实例
 */
export function create_identity(options: CreateIdentityOptions): DIDIdentity {
  const {
    hostname,
    path_prefix = ['user'],
    proof_purpose = 'authentication',
    domain = null,
    challenge = null,
    services = null,
  } = options;

  // 自动生成 challenge（如果未提供）
  const final_challenge = challenge ?? crypto.randomBytes(16).toString('hex');

  // 调用 ANP 库创建 DID 文档
  const { didDocument, keys } = createDidWbaDocumentWithKeyBinding({
    hostname,
    pathPrefix: path_prefix ?? undefined,
    proofPurpose: proof_purpose,
    domain: domain ?? undefined,
    challenge: final_challenge,
    services: services ?? undefined,
  });

  // 提取 key-1 (secp256k1)
  const [private_key_pem, public_key_pem] = keys['key-1'];

  // 提取 E2EE 密钥（如果存在）
  let e2ee_signing_private_pem: Buffer | null = null;
  let e2ee_signing_public_pem: Buffer | null = null;
  let e2ee_agreement_private_pem: Buffer | null = null;
  let e2ee_agreement_public_pem: Buffer | null = null;

  if ('key-2' in keys) {
    [e2ee_signing_private_pem, e2ee_signing_public_pem] = keys['key-2'];
  }
  if ('key-3' in keys) {
    [e2ee_agreement_private_pem, e2ee_agreement_public_pem] = keys['key-3'];
  }

  return new DIDIdentity({
    did: didDocument.id as string,
    did_document: didDocument,
    private_key_pem,
    public_key_pem,
    e2ee_signing_private_pem,
    e2ee_signing_public_pem,
    e2ee_agreement_private_pem,
    e2ee_agreement_public_pem,
  });
}

/**
 * 从 PEM 字节加载私钥
 *
 * @param pem_bytes - PEM 格式的私钥字节
 * @returns 私钥对象
 * @throws TypeError 如果不是 EllipticCurvePrivateKey
 */
export function load_private_key(pem_bytes: Buffer): KeyObject {
  const keyObject = crypto.createPrivateKey({
    key: pem_bytes,
    format: 'pem',
    type: 'pkcs8',
  });

  if (keyObject.type !== 'private' || keyObject.asymmetricKeyType !== 'ec') {
    throw new TypeError(
      `Expected EllipticCurvePrivateKey, got ${keyObject.asymmetricKeyType}`
    );
  }

  return keyObject;
}
