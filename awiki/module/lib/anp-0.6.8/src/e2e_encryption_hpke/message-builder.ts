/**
 * 7 种消息 content 构建函数
 */

import {
  DEFAULT_EXPIRES,
  E2EE_VERSION,
  HPKE_SUITE,
  E2eeInitContent,
  E2eeMsgContent,
  E2eeAckContent,
  E2eeErrorContent,
} from "./types";
import { hpkeSeal } from "./hpke";
import { generateProof } from "./proof";

/**
 * 生成随机 hex 字符串
 */
function generateRandomHex(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Uint8Array 转 Base64
 */
function toBase64(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data));
}

/**
 * 构建 e2ee_init 消息 content
 * @param sessionId - 会话 ID（32 hex 字符）
 * @param senderDid - 发送方 DID
 * @param recipientDid - 接收方 DID
 * @param recipientKeyId - 接收方 keyAgreement 的 id
 * @param recipientPk - 接收方 X25519 公钥（32 字节）
 * @param rootSeed - 32 字节随机种子
 * @param signingKey - 发送方 secp256r1 签名私钥（32 字节）
 * @param verificationMethod - 签名用的 verificationMethod id
 * @param expires - 会话有效期（秒）
 * @returns 含 proof 签名的 content dict
 */
export function buildE2eeInit(
  sessionId: string,
  senderDid: string,
  recipientDid: string,
  recipientKeyId: string,
  recipientPk: Uint8Array,
  rootSeed: Uint8Array,
  signingKey: Uint8Array,
  verificationMethod: string,
  expires: number = DEFAULT_EXPIRES
): E2eeInitContent {
  const aad = new TextEncoder().encode(sessionId);
  const { enc, ciphertext } = hpkeSeal(recipientPk, rootSeed, aad);

  const content: E2eeInitContent = {
    e2ee_version: E2EE_VERSION,
    session_id: sessionId,
    hpke_suite: HPKE_SUITE,
    sender_did: senderDid,
    recipient_did: recipientDid,
    recipient_key_id: recipientKeyId,
    enc: toBase64(enc),
    encrypted_seed: toBase64(ciphertext),
    expires: expires,
    proof: {
      type: "",
      created: "",
      verification_method: "",
    },
  };

  const signedContent = generateProof(
    content as unknown as Record<string, unknown>,
    signingKey,
    verificationMethod
  ) as unknown as E2eeInitContent;

  return signedContent;
}

/**
 * 构建 e2ee_msg 消息 content（无 proof）
 */
export function buildE2eeMsg(
  sessionId: string,
  seq: number,
  originalType: string,
  ciphertextB64: string
): E2eeMsgContent {
  return {
    e2ee_version: E2EE_VERSION,
    session_id: sessionId,
    seq: seq,
    original_type: originalType,
    ciphertext: ciphertextB64,
  };
}

/**
 * 构建 e2ee_ack 消息 content
 */
export function buildE2eeAck(
  sessionId: string,
  senderDid: string,
  recipientDid: string,
  signingKey: Uint8Array,
  verificationMethod: string,
  expires: number = DEFAULT_EXPIRES
): E2eeAckContent {
  const content: E2eeAckContent = {
    e2ee_version: E2EE_VERSION,
    session_id: sessionId,
    sender_did: senderDid,
    recipient_did: recipientDid,
    expires: expires,
    proof: {
      type: "",
      created: "",
      verification_method: "",
    },
  };

  const signedContent = generateProof(
    content as unknown as Record<string, unknown>,
    signingKey,
    verificationMethod
  ) as unknown as E2eeAckContent;

  return signedContent;
}

/**
 * 构建 e2ee_rekey 消息 content（结构同 e2ee_init）
 */
export function buildE2eeRekey(
  sessionId: string,
  senderDid: string,
  recipientDid: string,
  recipientKeyId: string,
  recipientPk: Uint8Array,
  rootSeed: Uint8Array,
  signingKey: Uint8Array,
  verificationMethod: string,
  expires: number = DEFAULT_EXPIRES
): E2eeInitContent {
  return buildE2eeInit(
    sessionId,
    senderDid,
    recipientDid,
    recipientKeyId,
    recipientPk,
    rootSeed,
    signingKey,
    verificationMethod,
    expires
  );
}

/**
 * 构建 e2ee_error 消息 content
 */
export function buildE2eeError(
  errorCode: string,
  options?: {
    sessionId?: string;
    failedMsgId?: string;
    failedServerSeq?: number;
    retryHint?: string;
    requiredE2eeVersion?: string;
    message?: string;
  }
): E2eeErrorContent {
  const content: E2eeErrorContent = {
    e2ee_version: E2EE_VERSION,
    error_code: errorCode,
  };

  if (options?.sessionId !== undefined) {
    content.session_id = options.sessionId;
  }
  if (options?.failedMsgId !== undefined) {
    content.failed_msg_id = options.failedMsgId;
  }
  if (options?.failedServerSeq !== undefined) {
    content.failed_server_seq = options.failedServerSeq;
  }
  if (options?.retryHint !== undefined) {
    content.retry_hint = options.retryHint;
  }
  if (options?.requiredE2eeVersion !== undefined) {
    content.required_e2ee_version = options.requiredE2eeVersion;
  }
  if (options?.message !== undefined) {
    content.message = options.message;
  }

  return content;
}

/**
 * 生成随机会话 ID
 */
export function generateSessionId(): string {
  return generateRandomHex(16);
}
