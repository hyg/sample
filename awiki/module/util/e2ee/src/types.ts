/**
 * E2EE 模块类型定义
 *
 * 端到端加密客户端类型定义 - HPKE 协议
 * 
 * 严格保持与 Python 版本 (python/scripts/utils/e2ee.py) 的类型一致
 */

/**
 * E2EE 消息类型
 */
export type E2eeMessageType =
  | 'e2ee_init'
  | 'e2ee_ack'
  | 'e2ee_msg'
  | 'e2ee_rekey'
  | 'e2ee_error';

/**
 * E2EE 错误码
 */
export type E2eeErrorCode =
  | 'unsupported_version'
  | 'session_not_found'
  | 'session_expired'
  | 'decryption_failed'
  | 'invalid_seq'
  | 'proof_expired'
  | 'proof_from_future'
  | 'unknown';

/**
 * E2EE 会话状态 - 使用小写与 Python 版本一致
 */
export type SessionState = 'idle' | 'active' | 'expired';

/**
 * E2EE 内容接口
 */
export interface E2eeContent {
  e2ee_version: string;
  session_id?: string;
  sender_did?: string;
  recipient_did?: string;
  sender_x25519_key_id?: string;
  expires?: number;
  proof?: {
    verification_method: string;
    signature: string;
    timestamp: string;
  };
  ciphertext?: string;
  seq?: number;
  type?: string;
  [key: string]: unknown;
}

/**
 * E2EE 错误内容接口
 */
export interface E2eeErrorContent extends E2eeContent {
  error_code: E2eeErrorCode;
  session_id?: string;
  failed_msg_id?: string;
  failed_server_seq?: number;
  retry_hint?: string;
  required_e2ee_version?: string;
  message?: string;
}

/**
 * E2EE 会话导出数据结构 - 使用 snake_case 与 Python 版本一致
 */
export interface ExportedSession {
  session_id: string;
  local_did: string;
  peer_did: string;
  is_initiator: boolean;
  send_chain_key: string;  // base64 编码
  recv_chain_key: string;  // base64 编码
  send_seq: number;
  recv_seq: number;
  expires_at: number;
  created_at: number;
  active_at: number;
}

/**
 * E2EE 客户端导出状态结构 - 使用 snake_case 与 Python 版本一致
 */
export interface E2eeClientState {
  version: string;
  local_did: string;
  signing_pem?: string | null;
  x25519_pem?: string | null;
  confirmed_session_ids: string[];
  sessions: ExportedSession[];
}

/**
 * 消息类型枚举（与 ANP 兼容）
 */
export enum MessageType {
  E2EE_INIT = 'e2ee_init',
  E2EE_ACK = 'e2ee_ack',
  E2EE_MSG = 'e2ee_msg',
  E2EE_REKEY = 'e2ee_rekey',
  E2EE_ERROR = 'e2ee_error',
}

/**
 * E2EE 握手响应类型
 */
export type HandshakeResponse = [E2eeMessageType, E2eeContent];

/**
 * E2EE 消息处理响应类型
 */
export type MessageProcessResponse = Array<[E2eeMessageType, E2eeContent]>;

/**
 * E2EE 加密响应类型
 */
export type EncryptResponse = [E2eeMessageType, E2eeContent];

/**
 * E2EE 解密响应类型
 */
export type DecryptResponse = [string, string];

/**
 * E2EE 客户端选项
 */
export interface E2eeClientOptions {
  signingPem?: string | null;
  x25519Pem?: string | null;
}

/**
 * HPKE 套件配置
 */
export interface HpkeSuite {
  kemId: number;
  kdfId: number;
  aeadId: number;
  keyLength: number;
  nonceLength: number;
}

/**
 * HPKE 密钥封装结果
 */
export interface HpkeSealResult {
  ciphertext: Uint8Array;
  encapsulatedKey: Uint8Array;
}

/**
 * HPKE 选项
 */
export interface HpkeOptions {
  info?: Uint8Array;
  aad?: Uint8Array;
}
