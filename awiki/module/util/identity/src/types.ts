/**
 * DID Identity 模块类型定义
 *
 * 移植自：python/scripts/utils/identity.py
 * 命名规范：snake_case（与 Python 版本保持一致）
 */

/**
 * DID 身份完整信息
 *
 * 对应 Python 的 DIDIdentity 数据类
 * 所有字段名使用 snake_case 与 Python 版本一致
 */
export interface DIDIdentityData {
  /** DID 标识符 */
  did: string;
  /** DID 文档（包含 ANP 生成的 proof） */
  did_document: Record<string, unknown>;
  /** PEM 编码的 secp256k1 私钥 */
  private_key_pem: Buffer;
  /** PEM 编码的 secp256k1 公钥 */
  public_key_pem: Buffer;
  /** 注册后填充的用户 ID */
  user_id?: string | null;
  /** WBA 认证后填充的 JWT Token */
  jwt_token?: string | null;
  /** E2EE 签名私钥 PEM (key-2 secp256r1) */
  e2ee_signing_private_pem?: Buffer | null;
  /** E2EE 签名公钥 PEM (key-2 secp256r1) */
  e2ee_signing_public_pem?: Buffer | null;
  /** E2EE 协议私钥 PEM (key-3 X25519) */
  e2ee_agreement_private_pem?: Buffer | null;
  /** E2EE 协议公钥 PEM (key-3 X25519) */
  e2ee_agreement_public_pem?: Buffer | null;
}

/**
 * create_identity 函数选项
 */
export interface CreateIdentityOptions {
  /** DID 域名 */
  hostname: string;
  /** DID 路径前缀，如 ["user"]（默认）或 ["agent"] */
  path_prefix?: string[] | null;
  /** 证明用途（默认 "authentication"，用于注册） */
  proof_purpose?: string;
  /** 绑定到证明的服务域名（由服务器验证） */
  domain?: string | null;
  /** 证明 nonce（默认自动生成，用于防止重放） */
  challenge?: string | null;
  /** 自定义服务条目列表 */
  services?: Array<Record<string, unknown>> | null;
}

/**
 * ANP 库返回的密钥对
 */
export interface KeyPair {
  private_key_pem: Buffer;
  public_key_pem: Buffer;
}

/**
 * ANP 库 createDidWbaDocumentWithKeyBinding 返回值
 */
export interface DidDocumentWithKeys {
  didDocument: Record<string, unknown>;
  keys: Record<string, [Buffer, Buffer]>;
}
