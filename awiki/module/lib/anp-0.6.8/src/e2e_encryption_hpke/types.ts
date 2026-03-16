/**
 * 基于 HPKE 的端到端加密协议 - 数据模型
 * 协议规范：09-ANP-端到端即时消息协议规范.md
 */

// ─── 常量 ────────────────────────────────────────────────────────────────────────

export const HPKE_SUITE = "DHKEM-X25519-HKDF-SHA256/HKDF-SHA256/AES-128-GCM";
export const PROOF_TYPE = "EcdsaSecp256r1Signature2019";
export const E2EE_VERSION = "1.1";
export const DEFAULT_EXPIRES = 86400; // 会话/Sender Key 默认有效期（秒）
export const DEFAULT_MAX_SKIP = 256; // 窗口模式最大允许跳跃量
export const DEFAULT_SKIP_KEY_TTL = 300; // 跳跃 msg_key 缓存有效期（秒）
export const OLD_EPOCH_TTL = 3600; // 旧 epoch Sender Key 保留时间（秒）

/**
 * 验证 E2EE 内容版本
 */
export function ensureSupportedE2eeVersion(content: Record<string, unknown>): string {
  const version = String(content.e2ee_version || "").trim();
  if (!version) {
    throw new Error(`unsupported_version: missing e2ee_version (required ${E2EE_VERSION})`);
  }
  if (version !== E2EE_VERSION) {
    throw new Error(`unsupported_version: expected ${E2EE_VERSION}, got ${version}`);
  }
  return version;
}

// ─── 枚举 ────────────────────────────────────────────────────────────────────────

/**
 * 消息 type 字段的 E2EE 类型
 */
export enum MessageType {
  E2EE_INIT = "e2ee_init",
  E2EE_ACK = "e2ee_ack",
  E2EE_MSG = "e2ee_msg",
  E2EE_REKEY = "e2ee_rekey",
  E2EE_ERROR = "e2ee_error",
  GROUP_E2EE_KEY = "group_e2ee_key",
  GROUP_E2EE_MSG = "group_e2ee_msg",
  GROUP_EPOCH_ADVANCE = "group_epoch_advance",
}

/**
 * E2EE 错误码
 */
export enum ErrorCode {
  SESSION_NOT_FOUND = "session_not_found",
  SESSION_EXPIRED = "session_expired",
  DECRYPTION_FAILED = "decryption_failed",
  INVALID_SEQ = "invalid_seq",
  UNSUPPORTED_SUITE = "unsupported_suite",
  NO_KEY_AGREEMENT = "no_key_agreement",
  SENDER_KEY_NOT_FOUND = "sender_key_not_found",
  PROOF_EXPIRED = "proof_expired",
  PROOF_FROM_FUTURE = "proof_from_future",
  UNSUPPORTED_VERSION = "unsupported_version",
}

/**
 * epoch 轮转原因
 */
export enum EpochReason {
  MEMBER_ADDED = "member_added",
  MEMBER_REMOVED = "member_removed",
  KEY_ROTATION = "key_rotation",
}

/**
 * 序号验证策略
 */
export enum SeqMode {
  STRICT = "strict",
  WINDOW = "window",
}

/**
 * E2EE 会话状态
 */
export enum SessionState {
  IDLE = "idle",
  ACTIVE = "active",
}

// ─── 接口定义 ────────────────────────────────────────────────────────────────────

/**
 * EcdsaSecp256r1Signature2019 签名证明
 */
export interface Proof {
  type: string;
  created: string;
  verification_method: string;
  proof_value?: string;
}

/**
 * e2ee_init / e2ee_rekey 消息 content 结构
 */
export interface E2eeInitContent {
  e2ee_version: string;
  session_id: string;
  hpke_suite?: string;
  sender_did: string;
  recipient_did: string;
  recipient_key_id: string;
  enc: string; // Base64，32 字节 X25519 临时公钥
  encrypted_seed: string; // Base64，AEAD 密文 + GCM tag
  expires: number;
  proof: Proof;
}

/**
 * e2ee_msg 加密消息 content 结构
 */
export interface E2eeMsgContent {
  e2ee_version: string;
  session_id: string;
  seq: number;
  original_type: string;
  ciphertext: string; // Base64，AES-128-GCM 密文 + tag
}

/**
 * e2ee_ack 会话确认消息 content 结构
 */
export interface E2eeAckContent {
  e2ee_version: string;
  session_id: string;
  sender_did: string;
  recipient_did: string;
  expires: number;
  proof: Proof;
}

/**
 * e2ee_error 错误通知 content 结构
 */
export interface E2eeErrorContent {
  e2ee_version: string;
  error_code: string;
  session_id?: string;
  failed_msg_id?: string;
  failed_server_seq?: number;
  retry_hint?: string;
  required_e2ee_version?: string;
  message?: string;
}

/**
 * group_e2ee_key - Sender Key 分发 content 结构
 */
export interface GroupE2eeKeyContent {
  e2ee_version: string;
  group_did: string;
  epoch: number;
  sender_did: string;
  sender_key_id: string;
  recipient_key_id: string;
  hpke_suite?: string;
  enc: string; // Base64
  encrypted_sender_key: string; // Base64
  expires: number;
  proof: Proof;
}

/**
 * group_e2ee_msg 群密文消息 content 结构
 */
export interface GroupE2eeMsgContent {
  e2ee_version: string;
  group_did: string;
  epoch: number;
  sender_did: string;
  sender_key_id: string;
  seq: number;
  original_type: string;
  ciphertext: string; // Base64
}

/**
 * group_epoch_advance 群纪元变化通知 content 结构
 */
export interface GroupEpochAdvanceContent {
  e2ee_version: string;
  group_did: string;
  new_epoch: number;
  reason: string;
  members_added?: string[];
  members_removed?: string[];
  proof: Proof;
}

/**
 * E2EE 内容通用类型
 */
export type E2eeContent = 
  | E2eeInitContent 
  | E2eeMsgContent 
  | E2eeAckContent 
  | E2eeErrorContent
  | GroupE2eeKeyContent
  | GroupE2eeMsgContent
  | GroupEpochAdvanceContent;

/**
 * 密钥对类型
 */
export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/**
 * DID 文档中的验证方法
 */
export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
  publicKeyJwk?: {
    kty: string;
    crv: string;
    x: string;
    y: string;
  };
  publicKeyHex?: string;
}

/**
 * DID 文档中的服务入口
 */
export interface ServiceEntry {
  id: string;
  type: string;
  serviceEndpoint: string;
}

/**
 * DID 文档结构
 */
export interface DidDocument {
  "@context": string[];
  id: string;
  verificationMethod: VerificationMethod[];
  authentication?: string[];
  assertionMethod?: string[];
  keyAgreement?: string[];
  service?: ServiceEntry[];
  proof?: Proof;
}

/**
 * 提取公钥结果
 */
export interface ExtractPublicKeyResult {
  publicKey: Uint8Array;
  keyId: string;
}
