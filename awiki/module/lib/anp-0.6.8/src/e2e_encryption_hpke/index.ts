/**
 * 基于 HPKE (RFC 9180) 的端到端加密模块
 * 协议规范：09-ANP-端到端即时消息协议规范.md
 * 密码栈：DHKEM(X25519, HKDF-SHA256) / HKDF-SHA256 / AES-128-GCM
 * 签名算法：ECDSA secp256r1 (P-256)
 */

// session
export { E2eeHpkeSession, SessionState } from "./session";

// key_manager
export { HpkeKeyManager } from "./key-manager";

// models
export {
  HPKE_SUITE,
  E2EE_VERSION,
  PROOF_TYPE,
  DEFAULT_EXPIRES,
  DEFAULT_MAX_SKIP,
  DEFAULT_SKIP_KEY_TTL,
  OLD_EPOCH_TTL,
  MessageType,
  ErrorCode,
  EpochReason,
  SeqMode,
  ensureSupportedE2eeVersion,
} from "./types";

// types
export type {
  Proof,
  E2eeInitContent,
  E2eeMsgContent,
  E2eeAckContent,
  E2eeErrorContent,
  GroupE2eeKeyContent,
  GroupE2eeMsgContent,
  GroupEpochAdvanceContent,
  E2eeContent,
  KeyPair,
  VerificationMethod,
  ServiceEntry,
  DidDocument,
  ExtractPublicKeyResult,
} from "./types";

// hpke
export {
  hpkeSeal,
  hpkeOpen,
  generateX25519KeyPair,
  publicKeyToBytes,
  publicKeyFromBytes,
  privateKeyToBytes,
  privateKeyFromBytes,
} from "./hpke";

// crypto
export {
  encryptAes128Gcm,
  decryptAes128Gcm,
  encryptAes128GcmSync,
  decryptAes128GcmSync,
} from "./crypto";

// key_pair
export {
  publicKeyToMultibase,
  publicKeyFromMultibase,
  extractX25519PublicKeyFromDidDocument,
  extractSigningPublicKeyFromDidDocument,
} from "./key-pair";

// ratchet
export {
  deriveChainKeys,
  determineDirection,
  assignChainKeys,
  deriveMessageKey,
  deriveGroupMessageKey,
} from "./ratchet";

// seq_manager
export { SeqManager } from "./seq-manager";

// proof
export {
  ProofValidationError,
  generateProof,
  validateProof,
  verifyProof,
  DEFAULT_MAX_FUTURE_SKEW_SECONDS,
  DEFAULT_MAX_PAST_AGE_SECONDS,
} from "./proof";

// message_builder
export {
  buildE2eeInit,
  buildE2eeMsg,
  buildE2eeAck,
  buildE2eeRekey,
  buildE2eeError,
  generateSessionId,
} from "./message-builder";

// message_parser
export {
  detectMessageType,
  parseE2eeInit,
  parseE2eeAck,
  parseE2eeMsg,
  parseE2eeError,
  parseGroupE2eeKey,
  parseGroupE2eeMsg,
  parseGroupEpochAdvance,
} from "./message-parser";
