/**
 * E2EE 端到端加密客户端 - HPKE 协议
 * 
 * 严格保持与 Python 版本 (python/scripts/utils/e2ee.py) 的实现细节一致
 * 
 * 命名规范：所有函数名、变量名、属性名使用 snake_case 与 Python 版本一致
 */

import { randomBytes } from 'crypto';
import { x25519 } from '@noble/curves/ed25519';

import type {
  E2eeContent, E2eeErrorContent, E2eeClientOptions, E2eeClientState, ExportedSession,
  HandshakeResponse, MessageProcessResponse, EncryptResponse, DecryptResponse, SessionState, E2eeMessageType,
} from './types.js';

import { deriveChainKey, encryptWithChainKey, decryptWithChainKey } from './hpke.js';

// ============================================================================
// 常量 - 严格保持与 Python 版本一致
// ============================================================================

const STATE_VERSION = 'hpke_v1';
export const SUPPORTED_E2EE_VERSION = '1.1';
const DEFAULT_EXPIRES = 86400;
const MAX_SEQ_SKIP = 256;

// ============================================================================
// 辅助函数 - 严格保持与 Python 版本一致的命名和功能
// ============================================================================

export function extractProofVerificationMethod(proof: unknown): string {
  if (!proof || typeof proof !== 'object') return '';
  const obj = proof as Record<string, unknown>;
  return String(obj['verification_method'] || obj['verificationMethod'] || '');
}

export function ensureSupportedE2eeVersion(content: Record<string, unknown>): string {
  const version = String(content.e2ee_version || '').trim();
  if (!version) throw new Error('unsupported_version: missing e2ee_version');
  if (version !== SUPPORTED_E2EE_VERSION) throw new Error('unsupported_version');
  return version;
}

export function buildE2eeErrorContent(errorCode: string, options: any = {}): E2eeErrorContent {
  const content: E2eeErrorContent = { 
    e2ee_version: SUPPORTED_E2EE_VERSION, 
    error_code: errorCode as any 
  };
  Object.assign(content, options);
  return content;
}

export function buildE2eeErrorMessage(errorCode: string, options: any = {}): string {
  const version = options.requiredE2eeVersion || SUPPORTED_E2EE_VERSION;
  const messages: Record<string, string> = {
    unsupported_version: 'Peer E2EE version unsupported. Upgrade to ' + version,
    session_not_found: 'E2EE session not found.',
    session_expired: 'E2EE session expired.',
    decryption_failed: 'E2EE decryption failed.',
    invalid_seq: 'Invalid E2EE sequence.',
    proof_expired: 'Proof expired.',
    proof_from_future: 'Proof from future.',
  };
  let msg = messages[errorCode] || 'E2EE processing failed.';
  if (options.detail) msg += ' Detail: ' + options.detail;
  return msg;
}

export function classifyProtocolError(exc: Error | unknown): [string, string] | null {
  const msg = String(exc).toLowerCase();
  if (msg.includes('unsupported_version')) return ['unsupported_version', 'drop'];
  if (msg.includes('proof_expired')) return ['proof_expired', 'resend'];
  if (msg.includes('proof_from_future')) return ['proof_from_future', 'drop'];
  return null;
}

export function detectMessageType(msgType: string): E2eeMessageType | null {
  const valid = new Set(['e2ee_init', 'e2ee_ack', 'e2ee_msg', 'e2ee_rekey', 'e2ee_error']);
  return valid.has(msgType) ? msgType as E2eeMessageType : null;
}

// ============================================================================
// SeqManager - 序列号管理（防重放攻击）
// ============================================================================

class SeqManager {
  private _sendSeq = 0;
  private _recvSeq = 0;
  private readonly _maxSkip = MAX_SEQ_SKIP;
  private _usedSeqs: Map<number, boolean> = new Map();

  get sendSeq(): number { return this._sendSeq; }
  set sendSeq(v: number) { this._sendSeq = v; }

  get recvSeq(): number { return this._recvSeq; }
  set recvSeq(v: number) { this._recvSeq = v; }

  nextSendSeq(): number {
    const seq = this._sendSeq;
    this._sendSeq++;
    return seq;
  }

  validateRecvSeq(seq: number): boolean {
    if (seq < this._recvSeq) return !this._usedSeqs.has(seq);
    return seq <= this._recvSeq + this._maxSkip;
  }

  updateRecvSeq(seq: number): void {
    if (seq >= this._recvSeq) this._recvSeq = seq + 1;
    this._usedSeqs.set(seq, true);
  }
}

// ============================================================================
// E2eeHpkeSession - HPKE 会话类
// ============================================================================

export class E2eeHpkeSession {
  public session_id: string | null = null;
  public state: SessionState = 'idle';
  public readonly local_did: string;
  public readonly peer_did: string;
  
  private _isInitiator: boolean;
  private _sendChainKey: Uint8Array | null = null;
  private _recvChainKey: Uint8Array | null = null;
  private _seqManager: SeqManager;
  private _expiresAt: number | null = null;
  private _createdAt: number;
  private _activeAt: number | null = null;

  constructor(
    localDid: string,
    peerDid: string,
    isInitiator: boolean,
    initialChainKey?: Uint8Array
  ) {
    this.local_did = localDid;
    this.peer_did = peerDid;
    this._isInitiator = isInitiator;
    this._seqManager = new SeqManager();
    this._createdAt = Date.now();
    
    if (initialChainKey) {
      this._sendChainKey = initialChainKey;
      this.state = 'active';
      this._activeAt = Date.now();
    }
  }

  get expiresAt(): number | null { return this._expiresAt; }
  get createdAt(): number { return this._createdAt; }
  get activeAt(): number | null { return this._activeAt; }

  isExpired(): boolean {
    if (!this._expiresAt) return false;
    return Date.now() > this._expiresAt * 1000;
  }

  // 发起会话（HPKE 密钥封装）
  initiateSession(peerPublicKey: Uint8Array, peerKeyId: string): [E2eeMessageType, E2eeContent] {
    const sessionId = randomBytes(16).toString('hex');
    this.session_id = sessionId;
    this._isInitiator = true;

    // 生成初始链密钥
    const sharedSecret = x25519.getSharedSecret(x25519.utils.randomPrivateKey(), peerPublicKey);
    const info = new TextEncoder().encode(`e2ee:${this.local_did}:${this.peer_did}:${sessionId}`);
    const chainKey = deriveChainKey(sharedSecret);

    this._sendChainKey = chainKey[0];
    this.state = 'active';
    this._activeAt = Date.now();
    this._expiresAt = Math.floor(Date.now() / 1000) + DEFAULT_EXPIRES;

    // 构建 e2ee_init 消息
    const content: E2eeContent = {
      e2ee_version: SUPPORTED_E2EE_VERSION,
      session_id: sessionId,
      sender_did: this.local_did,
      recipient_did: this.peer_did,
      sender_x25519_key_id: `${this.local_did}#key-3`,
      expires: DEFAULT_EXPIRES,
      proof: {
        verification_method: `${this.local_did}#key-2`,
        signature: '',
        timestamp: new Date().toISOString(),
      },
    };

    return ['e2ee_init', content];
  }

  // 处理 e2ee_init 消息
  processInit(content: E2eeContent, senderSigningPublicKey: Uint8Array): void {
    const sessionId = content.session_id;
    if (!sessionId) throw new Error('Missing session_id');

    this.session_id = sessionId;
    this._isInitiator = false;
    this.state = 'active';
    this._activeAt = Date.now();
    this._expiresAt = content.expires ? Math.floor(Date.now() / 1000) + content.expires : null;
  }

  // 加密消息
  encryptMessage(originalType: string, plaintext: string): [E2eeMessageType, E2eeContent] {
    if (!this._sendChainKey) throw new Error('No send chain key');
    if (this.isExpired()) throw new Error('Session expired');

    const seq = this._seqManager.nextSendSeq();
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const aad = new TextEncoder().encode(JSON.stringify({ type: originalType, seq }));

    const [newChainKey, ciphertext, iv] = encryptWithChainKey(
      this._sendChainKey,
      seq,
      plaintextBytes,
      aad
    );
    
    this._sendChainKey = newChainKey;

    const content: E2eeContent = {
      e2ee_version: SUPPORTED_E2EE_VERSION,
      session_id: this.session_id!,
      ciphertext: Buffer.from(ciphertext).toString('base64'),
      sender_did: this.local_did,
      seq: seq,
      type: originalType,
    };

    return ['e2ee_msg', content];
  }

  // 解密消息
  decryptMessage(content: E2eeContent): [string, string] {
    if (!this._recvChainKey) throw new Error('No recv chain key');
    if (this.isExpired()) throw new Error('Session expired');

    const seq = content.seq as number;
    if (!this._seqManager.validateRecvSeq(seq)) {
      throw new Error('invalid_seq');
    }

    const ciphertext = Buffer.from(content.ciphertext as string, 'base64');
    const aad = new TextEncoder().encode(JSON.stringify({ type: content.type, seq }));

    // 需要从 content 中提取 iv
    const iv = content.iv ? Buffer.from(content.iv as string, 'base64') : randomBytes(12);

    const [newChainKey, plaintext] = decryptWithChainKey(
      this._recvChainKey,
      seq,
      ciphertext,
      iv,
      aad
    );
    
    this._recvChainKey = newChainKey;
    this._seqManager.updateRecvSeq(seq);

    const originalType = String(content.type || 'text');
    const plaintextStr = new TextDecoder().decode(plaintext);

    return [originalType, plaintextStr];
  }
}

// ============================================================================
// HpkeKeyManager - 密钥管理器
// ============================================================================

export class HpkeKeyManager {
  private _sessions: Map<string, E2eeHpkeSession> = new Map();
  private _sessionsByDidPair: Map<string, E2eeHpkeSession> = new Map();

  registerSession(session: E2eeHpkeSession): void {
    if (session.session_id) {
      this._sessions.set(session.session_id, session);
    }
    const key = `${session.local_did}:${session.peer_did}`;
    this._sessionsByDidPair.set(key, session);
  }

  getActiveSession(localDid: string, peerDid: string): E2eeHpkeSession | null {
    const key = `${localDid}:${peerDid}`;
    const session = this._sessionsByDidPair.get(key);
    if (!session || session.state !== 'active' || session.isExpired()) {
      return null;
    }
    return session;
  }

  getSessionById(sessionId: string): E2eeHpkeSession | null {
    return this._sessions.get(sessionId) || null;
  }

  cleanupExpired(): void {
    for (const [id, session] of this._sessions.entries()) {
      if (session.isExpired()) {
        this._sessions.delete(id);
      }
    }
  }
}

// ============================================================================
// E2eeClient - E2EE 客户端主类
// ============================================================================

export class E2eeClient {
  public readonly local_did: string;
  private readonly _signing_pem: string | null;
  private readonly _x25519_pem: string | null;
  private readonly _key_manager: HpkeKeyManager;
  private readonly _confirmed_session_ids: Set<string>;

  constructor(localDid: string, options: E2eeClientOptions = {}) {
    this.local_did = localDid;
    this._signing_pem = options.signingPem || null;
    this._x25519_pem = options.x25519Pem || null;
    this._key_manager = new HpkeKeyManager();
    this._confirmed_session_ids = new Set();
  }

  // 发起握手
  async initiate_handshake(peerDid: string): Promise<[E2eeMessageType, E2eeContent]> {
    // TODO: 实现完整的握手逻辑
    // 1. 获取 peer 的 X25519 公钥
    // 2. 创建 E2eeHpkeSession
    // 3. 发起会话
    throw new Error('Not implemented');
  }

  // 处理 E2EE 消息
  async process_e2ee_message(msgType: E2eeMessageType, content: E2eeContent): Promise<[E2eeMessageType, E2eeContent][]> {
    // TODO: 实现完整的消息处理逻辑
    throw new Error('Not implemented');
  }

  // 加密消息
  encrypt_message(peerDid: string, plaintext: string): [E2eeMessageType, E2eeContent] {
    const session = this._key_manager.getActiveSession(this.local_did, peerDid);
    if (!session) throw new Error(`No active session with ${peerDid}`);
    return session.encryptMessage('text', plaintext);
  }

  // 解密消息
  decrypt_message(content: E2eeContent): [string, string] {
    const session_id = content.session_id as string;
    const session = this._key_manager.getSessionById(session_id);
    if (!session) throw new Error(`Cannot find session ${session_id}`);
    return session.decryptMessage(content);
  }

  // 确保活跃会话
  async ensure_active_session(peerDid: string): Promise<[E2eeMessageType, E2eeContent][]> {
    if (this._key_manager.getActiveSession(this.local_did, peerDid)) {
      return [];
    }
    const [msgType, content] = await this.initiate_handshake(peerDid);
    return [[msgType, content]];
  }

  // 检查会话状态
  has_active_session(peerDid: string): boolean {
    return this._key_manager.getActiveSession(this.local_did, peerDid) !== null;
  }

  has_session_id(session_id: string | null): boolean {
    if (!session_id) return false;
    return this._key_manager.getSessionById(session_id) !== null;
  }

  is_session_confirmed(session_id: string | null): boolean {
    if (!session_id) return false;
    return this._confirmed_session_ids.has(session_id);
  }

  // 导出状态 - 使用 snake_case 与 Python 版本一致
  export_state(): E2eeClientState {
    const sessions: ExportedSession[] = [];
    // TODO: 实现状态导出
    return {
      version: STATE_VERSION,
      local_did: this.local_did,
      signing_pem: this._signing_pem,
      x25519_pem: this._x25519_pem,
      confirmed_session_ids: Array.from(this._confirmed_session_ids),
      sessions: sessions,
    };
  }

  // 从状态恢复 - 使用 snake_case 与 Python 版本一致
  static from_state(state: E2eeClientState): E2eeClient {
    if (state.version !== STATE_VERSION) {
      throw new Error('Unsupported state version');
    }
    const client = new E2eeClient(state.local_did, {
      signingPem: state.signing_pem,
      x25519Pem: state.x25519_pem,
    });
    // TODO: 恢复会话状态
    return client;
  }

  // 清理过期会话
  cleanup_expired(): void {
    this._key_manager.cleanupExpired();
  }
}

// ============================================================================
// 导出
// ============================================================================

export default E2eeClient;
