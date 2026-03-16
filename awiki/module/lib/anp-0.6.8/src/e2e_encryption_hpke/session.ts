/**
 * 私聊 E2EE 会话（IDLE → ACTIVE 两态）
 * 与传输层完全解耦：所有方法只接收/返回 dict，不直接发送 HTTP 请求
 */

import { SessionState as SessionStateEnum, DEFAULT_EXPIRES, SeqMode, E2eeInitContent } from "./types";
import { SeqManager } from "./seq-manager";
import { encryptAes128GcmSync, decryptAes128GcmSync } from "./crypto";
import { hpkeOpen } from "./hpke";
import { buildE2eeInit, buildE2eeMsg } from "./message-builder";
import { validateProof, ProofValidationError } from "./proof";
import {
  deriveChainKeys,
  determineDirection,
  assignChainKeys,
  deriveMessageKey,
} from "./ratchet";
import { generateSessionId } from "./message-builder";

// 重新导出 SessionState
export { SessionStateEnum as SessionState };

/**
 * 基于 HPKE 的私聊 E2EE 会话
 */
export class E2eeHpkeSession {
  public readonly localDid: string;
  public readonly peerDid: string;

  private localX25519Sk: Uint8Array;
  private signingKey: Uint8Array;
  private signingVm: string;
  private defaultExpires: number;

  private state: SessionStateEnum;
  private sessionId: string | null;
  private sendChainKey: Uint8Array | null;
  private recvChainKey: Uint8Array | null;
  private seqManager: SeqManager;
  private isInitiator: boolean | null;
  private expiresAt: number | null;
  private createdAt: number;
  private activeAt: number | null;

  /**
   * @param localDid - 本地 DID
   * @param peerDid - 对端 DID
   * @param localX25519PrivateKey - 本地 X25519 私钥（32 字节）
   * @param localX25519KeyId - 本地 keyAgreement 的 id
   * @param signingPrivateKey - 本地 secp256r1 签名私钥（32 字节）
   * @param signingVerificationMethod - 签名用的 verificationMethod id
   * @param seqMode - 序号验证策略
   * @param defaultExpires - 默认有效期（秒）
   */
  constructor(
    localDid: string,
    peerDid: string,
    localX25519PrivateKey: Uint8Array,
    _localX25519KeyId: string,
    signingPrivateKey: Uint8Array,
    signingVerificationMethod: string,
    seqMode: SeqMode = SeqMode.STRICT,
    defaultExpires: number = DEFAULT_EXPIRES
  ) {
    this.localDid = localDid;
    this.peerDid = peerDid;
    this.localX25519Sk = localX25519PrivateKey;
    this.signingKey = signingPrivateKey;
    this.signingVm = signingVerificationMethod;
    this.defaultExpires = defaultExpires;

    this.state = SessionStateEnum.IDLE;
    this.sessionId = null;
    this.sendChainKey = null;
    this.recvChainKey = null;
    this.seqManager = new SeqManager(seqMode);
    this.isInitiator = null;
    this.expiresAt = null;
    this.createdAt = Date.now() / 1000;
    this.activeAt = null;
  }

  /**
   * 获取会话状态
   */
  get stateValue(): SessionStateEnum {
    return this.state;
  }

  /**
   * 获取会话 ID
   */
  get sessionIdValue(): string | null {
    return this.sessionId;
  }

  /**
   * 获取发送序号
   */
  get sendSeq(): number {
    return this.seqManager.sendSeqValue;
  }

  /**
   * 获取接收序号
   */
  get recvSeq(): number {
    return this.seqManager.recvSeqValue;
  }

  /**
   * 获取发送链密钥（用于状态导出）
   */
  get sendChainKeyValue(): Uint8Array | null {
    return this.sendChainKey;
  }

  /**
   * 获取接收链密钥（用于状态导出）
   */
  get recvChainKeyValue(): Uint8Array | null {
    return this.recvChainKey;
  }

  /**
   * 获取是否为发起方
   */
  get isInitiatorValue(): boolean | null {
    return this.isInitiator;
  }

  /**
   * 获取过期时间
   */
  get expiresAtValue(): number | null {
    return this.expiresAt;
  }

  /**
   * 获取创建时间
   */
  get createdAtValue(): number {
    return this.createdAt;
  }

  /**
   * 获取激活时间
   */
  get activeAtValue(): number | null {
    return this.activeAt;
  }

  /**
   * 发起会话初始化
   * @param peerPk - 对端 X25519 公钥（32 字节）
   * @param peerKeyId - 对端 keyAgreement 的 id
   * @returns ("e2ee_init", content_dict)
   * @throws RuntimeError: 当前状态不是 IDLE
   */
  initiateSession(
    peerPk: Uint8Array,
    peerKeyId: string
  ): [string, E2eeInitContent] {
    if (this.state !== SessionStateEnum.IDLE) {
      throw new Error(`Cannot initiate from ${this.state} state, need IDLE`);
    }

    this.sessionId = generateSessionId();
    const rootSeed = new Uint8Array(32);
    crypto.getRandomValues(rootSeed);

    const content = buildE2eeInit(
      this.sessionId,
      this.localDid,
      this.peerDid,
      peerKeyId,
      peerPk,
      rootSeed,
      this.signingKey,
      this.signingVm,
      this.defaultExpires
    );

    this.setupChainKeys(rootSeed, content.expires);

    return ["e2ee_init", content];
  }

  /**
   * 处理收到的 e2ee_init 消息
   * @param content - e2ee_init content dict
   * @param senderSigningPk - 发送方 secp256r1 签名公钥（65 字节未压缩格式）
   * @throws RuntimeError: 当前状态不是 IDLE
   * @throws ValueError: 验证失败
   */
  processInit(content: E2eeInitContent, senderSigningPk: Uint8Array): void {
    if (this.state !== SessionStateEnum.IDLE) {
      throw new Error(`Cannot process init from ${this.state} state, need IDLE`);
    }

    // 验证版本
    if (content.e2ee_version !== "1.1") {
      throw new Error(`Unsupported e2ee_version: ${content.e2ee_version}`);
    }

    const expires = content.expires || this.defaultExpires;

    // 验证 proof
    try {
      validateProof(content as unknown as Record<string, unknown>, senderSigningPk, {
        maxPastAgeSeconds: expires,
      });
    } catch (e) {
      if (e instanceof ProofValidationError) {
        throw new Error(`e2ee_init proof verification failed: ${e.code}`);
      }
      throw e;
    }

    // 验证接收方是否为本地
    if (content.recipient_did !== this.localDid) {
      throw new Error("recipient_did does not match local DID");
    }

    // HPKE 解封装
    const encBytes = b64urlDecode(content.enc);
    const ctBytes = b64urlDecode(content.encrypted_seed);
    const aad = new TextEncoder().encode(content.session_id);
    const rootSeed = hpkeOpen(this.localX25519Sk, encBytes, ctBytes, aad);

    this.sessionId = content.session_id;
    this.setupChainKeys(rootSeed, expires);
  }

  /**
   * 加密消息
   * @param originalType - 原始消息类型（text/image/file）
   * @param plaintext - 明文内容
   * @returns ("e2ee_msg", content_dict)
   * @throws RuntimeError: 会话不在 ACTIVE 状态
   */
  encryptMessage(
    originalType: string,
    plaintext: string
  ): [string, Record<string, unknown>] {
    if (this.state !== SessionStateEnum.ACTIVE) {
      throw new Error(`Cannot encrypt from ${this.state} state, need ACTIVE`);
    }

    const seq = this.seqManager.nextSendSeq();
    const { encKey, nonce, newChainKey } = deriveMessageKey(
      this.sendChainKey!,
      seq
    );
    this.sendChainKey = newChainKey;

    const aad = new TextEncoder().encode(this.sessionId!);
    const ciphertextB64 = encryptAes128GcmSync(
      new TextEncoder().encode(plaintext),
      encKey,
      nonce,
      aad
    );

    const content = buildE2eeMsg(this.sessionId!, seq, originalType, ciphertextB64);

    return ["e2ee_msg", content as unknown as Record<string, unknown>];
  }

  /**
   * 解密消息
   * @param content - e2ee_msg content dict
   * @returns (original_type, plaintext)
   * @throws RuntimeError: 会话不在 ACTIVE 状态
   * @throws ValueError: 序号验证失败
   */
  decryptMessage(content: Record<string, unknown>): [string, string] {
    if (this.state !== SessionStateEnum.ACTIVE) {
      throw new Error(`Cannot decrypt from ${this.state} state, need ACTIVE`);
    }

    // 验证版本
    if (content.e2ee_version !== "1.1") {
      throw new Error(`Unsupported e2ee_version: ${content.e2ee_version}`);
    }

    const seq = content.seq as number;
    if (!this.seqManager.validateRecvSeq(seq)) {
      throw new Error(`Invalid seq: ${seq}`);
    }

    // 窗口模式：快进 recv_chain_key 到目标 seq
    const currentRecvSeq = this.seqManager.recvSeqValue;
    let tempChainKey = this.recvChainKey;
    for (let s = currentRecvSeq; s < seq; s++) {
      const result = deriveMessageKey(tempChainKey!, s);
      tempChainKey = result.newChainKey;
    }

    const { encKey, nonce, newChainKey } = deriveMessageKey(tempChainKey!, seq);

    const aad = new TextEncoder().encode(this.sessionId!);
    const plaintextBytes = decryptAes128GcmSync(
      content.ciphertext as string,
      encKey,
      nonce,
      aad
    );

    // 更新状态
    this.recvChainKey = newChainKey;
    this.seqManager.markSeqUsed(seq);
    this.seqManager.advanceRecvTo(seq);

    return [content.original_type as string, new TextDecoder().decode(plaintextBytes)];
  }

  /**
   * 发起会话重建（rekey）
   * @param peerPk - 对端 X25519 公钥（32 字节）
   * @param peerKeyId - 对端 keyAgreement 的 id
   * @returns ("e2ee_rekey", content_dict)
   */
  initiateRekey(
    peerPk: Uint8Array,
    peerKeyId: string
  ): [string, E2eeInitContent] {
    // 重置为 IDLE 状态
    this.state = SessionStateEnum.IDLE;
    this.seqManager.reset();
    this.sendChainKey = null;
    this.recvChainKey = null;

    this.sessionId = generateSessionId();
    const rootSeed = new Uint8Array(32);
    crypto.getRandomValues(rootSeed);

    const content = buildE2eeInit(
      this.sessionId,
      this.localDid,
      this.peerDid,
      peerKeyId,
      peerPk,
      rootSeed,
      this.signingKey,
      this.signingVm,
      this.defaultExpires
    );

    this.setupChainKeys(rootSeed, content.expires);

    return ["e2ee_rekey", content];
  }

  /**
   * 处理收到的 e2ee_rekey 消息
   * @param content - e2ee_rekey content dict
   * @param senderSigningPk - 发送方 secp256r1 签名公钥
   */
  processRekey(content: E2eeInitContent, senderSigningPk: Uint8Array): void {
    // 销毁旧状态
    this.state = SessionStateEnum.IDLE;
    this.seqManager.reset();
    this.sendChainKey = null;
    this.recvChainKey = null;

    // 复用 process_init 逻辑
    this.processInit(content, senderSigningPk);
  }

  /**
   * 检查会话是否已过期
   */
  isExpired(): boolean {
    if (this.expiresAt === null) {
      return false;
    }
    return Date.now() / 1000 > this.expiresAt;
  }

  /**
   * 获取可序列化的会话信息
   */
  getSessionInfo(): Record<string, unknown> {
    return {
      session_id: this.sessionId,
      local_did: this.localDid,
      peer_did: this.peerDid,
      state: this.state,
      is_initiator: this.isInitiator,
      expires_at: this.expiresAt,
      created_at: this.createdAt,
      active_at: this.activeAt,
    };
  }

  /**
   * 从 root_seed 派生链密钥并激活会话
   */
  private setupChainKeys(rootSeed: Uint8Array, expires: number): void {
    const { initChainKey, respChainKey } = deriveChainKeys(rootSeed);
    this.isInitiator = determineDirection(this.localDid, this.peerDid);
    const { sendChainKey, recvChainKey } = assignChainKeys(
      initChainKey,
      respChainKey,
      this.isInitiator
    );

    this.sendChainKey = sendChainKey;
    this.recvChainKey = recvChainKey;
    this.activeAt = Date.now() / 1000;
    this.expiresAt = this.activeAt + expires;
    this.state = SessionStateEnum.ACTIVE;
  }
}

/**
 * Base64URL 解码
 */
function b64urlDecode(s: string): Uint8Array {
  const padding = "=".repeat((-s.length) % 4);
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/") + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
