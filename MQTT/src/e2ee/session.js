/**
 * E2EE 会话管理器
 * 
 * 实现双棘轮 (Double Ratchet) 密钥派生机制
 */

import { randomBytes } from '@noble/hashes/utils';
import {
  hpkeSeal,
  hpkeOpen,
  deriveChainKeys,
  encryptMessage,
  decryptMessage
} from './hpke-native.js';
import { didManager } from '../did/manager.js';

/**
 * 生成随机会话 ID (32 位十六进制)
 */
export function generateSessionId() {
  return Array.from(randomBytes(16))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 私聊 E2EE 会话
 */
export class PrivateSession {
  constructor(params) {
    this.sessionId = params.sessionId || generateSessionId();
    this.senderDid = params.senderDid;
    this.recipientDid = params.recipientDid;
    this.hpkeSuite = params.hpkeSuite || 'DHKEM-P256-HKDF-SHA256/HKDF-SHA256/AES-128-GCM';
    this.kemType = params.kemType || 'p256';
    
    // 会话密钥状态
    this.rootSeed = params.rootSeed || null;
    this.sendChainKey = params.sendChainKey || null;
    this.recvChainKey = params.recvChainKey || null;
    
    // 序列号
    this.sendSeq = params.sendSeq || 0n;
    this.recvSeq = params.recvSeq || 0n;
    
    // 过期时间
    this.expiresAt = params.expiresAt || (Date.now() + 86400000);
    
    // 会话状态
    this.isActive = !!(this.sendChainKey && this.recvChainKey);
    this.isInitiator = params.isInitiator ?? this.compareDids() < 0;
  }

  compareDids() {
    return this.senderDid.localeCompare(this.recipientDid);
  }

  /**
   * 初始化会话 (作为发送方)
   */
  async initAsSender(rootSeed, recipientPublicKey) {
    this.rootSeed = rootSeed;
    
    // HPKE 封装 root_seed
    const { enc, ciphertext: encryptedSeed } = await hpkeSeal({
      recipientPublicKey,
      plaintext: rootSeed,
      info: new TextEncoder().encode(this.sessionId)
    });
    
    // 派生链密钥
    const { initChainKey, respChainKey } = deriveChainKeys(rootSeed);
    
    // 根据 DID 顺序分配发送/接收链密钥
    if (this.isInitiator) {
      this.sendChainKey = initChainKey;
      this.recvChainKey = respChainKey;
    } else {
      this.sendChainKey = respChainKey;
      this.recvChainKey = initChainKey;
    }
    
    this.isActive = true;
    this.sendSeq = 0n;
    this.recvSeq = 0n;
    
    return { enc, encryptedSeed };
  }

  /**
   * 初始化会话 (作为接收方)
   */
  async initAsReceiver({ enc, encryptedSeed, senderPublicKey, senderPrivateKey, sessionId }) {
    this.sessionId = sessionId || generateSessionId();
    
    // HPKE 解封装 root_seed
    const rootSeed = await hpkeOpen({
      recipientPrivateKey: senderPrivateKey,
      enc,
      ciphertext: encryptedSeed,
      info: new TextEncoder().encode(this.sessionId)
    });
    
    this.rootSeed = rootSeed;
    
    // 派生链密钥
    const { initChainKey, respChainKey } = deriveChainKeys(rootSeed);
    
    // 根据 DID 顺序分配
    if (this.isInitiator) {
      this.sendChainKey = initChainKey;
      this.recvChainKey = respChainKey;
    } else {
      this.sendChainKey = respChainKey;
      this.recvChainKey = initChainKey;
    }
    
    this.isActive = true;
    this.sendSeq = 0n;
    this.recvSeq = 0n;
    
    return rootSeed;
  }

  /**
   * 加密消息
   */
  async encrypt(plaintext) {
    if (!this.isActive) {
      throw new Error('Session is not active');
    }
    
    const plaintextBytes = typeof plaintext === 'string' 
      ? new TextEncoder().encode(plaintext)
      : plaintext;
    
    const { ciphertext, newChainKey } = await encryptMessage(
      plaintextBytes,
      this.sendChainKey,
      this.sendSeq
    );
    
    this.sendChainKey = newChainKey;
    const seq = this.sendSeq;
    this.sendSeq += 1n;
    
    return { ciphertext, seq: Number(seq) };
  }

  /**
   * 解密消息
   */
  async decrypt(ciphertext, seq) {
    if (!this.isActive) {
      throw new Error('Session is not active');
    }
    
    // 检查重放
    if (BigInt(seq) < this.recvSeq) {
      throw new Error('Message replay detected');
    }
    
    // 跳过缺失的消息
    while (this.recvSeq < BigInt(seq)) {
      const { newChainKey } = await decryptMessage(
        new Uint8Array(), // 空密文用于跳过
        this.recvChainKey,
        this.recvSeq
      );
      this.recvChainKey = newChainKey;
      this.recvSeq += 1n;
    }
    
    const { plaintext, newChainKey } = await decryptMessage(
      ciphertext,
      this.recvChainKey,
      this.recvSeq
    );
    
    this.recvChainKey = newChainKey;
    this.recvSeq += 1n;
    
    return plaintext;
  }

  isExpired() {
    return Date.now() > this.expiresAt;
  }

  export() {
    return {
      sessionId: this.sessionId,
      senderDid: this.senderDid,
      recipientDid: this.recipientDid,
      hpkeSuite: this.hpkeSuite,
      kemType: this.kemType,
      rootSeed: this.rootSeed ? Array.from(this.rootSeed) : null,
      sendChainKey: this.sendChainKey ? Array.from(this.sendChainKey) : null,
      recvChainKey: this.recvChainKey ? Array.from(this.recvChainKey) : null,
      sendSeq: Number(this.sendSeq),
      recvSeq: Number(this.recvSeq),
      expiresAt: this.expiresAt,
      isActive: this.isActive,
      isInitiator: this.isInitiator
    };
  }

  static import(data) {
    const session = new PrivateSession({
      sessionId: data.sessionId,
      senderDid: data.senderDid,
      recipientDid: data.recipientDid,
      hpkeSuite: data.hpkeSuite,
      kemType: data.kemType,
      rootSeed: data.rootSeed ? new Uint8Array(data.rootSeed) : null,
      sendChainKey: data.sendChainKey ? new Uint8Array(data.sendChainKey) : null,
      recvChainKey: data.recvChainKey ? new Uint8Array(data.recvChainKey) : null,
      sendSeq: BigInt(data.sendSeq),
      recvSeq: BigInt(data.recvSeq),
      expiresAt: data.expiresAt,
      isInitiator: data.isInitiator
    });
    return session;
  }
}

/**
 * 群聊 E2EE 会话
 */
export class GroupSession {
  constructor(params) {
    this.groupDid = params.groupDid;
    this.epoch = params.epoch || 0;
    this.senderDid = params.senderDid;
    this.senderKeyId = params.senderKeyId || `${this.senderDid.substring(0, 8)}:${this.epoch}`;
    this.senderChainKey = params.senderChainKey || null;
    this.sendSeq = params.sendSeq || 0n;
    this.memberKeys = params.memberKeys || new Map();
    this.isActive = !!this.senderChainKey;
  }

  initAsSender() {
    this.senderChainKey = randomBytes(32);
    this.sendSeq = 0n;
    this.isActive = true;
    return this.senderChainKey;
  }

  setSenderKey(senderDid, epoch, senderKeyId, senderChainKey) {
    const key = `${senderDid}:${epoch}`;
    this.memberKeys.set(key, {
      senderDid,
      epoch,
      senderKeyId,
      senderChainKey,
      recvSeq: 0n
    });
  }

  async encrypt(plaintext) {
    if (!this.isActive) {
      throw new Error('Group session is not active');
    }
    
    const { ciphertext, newChainKey } = await encryptMessage(
      typeof plaintext === 'string' ? new TextEncoder().encode(plaintext) : plaintext,
      this.senderChainKey,
      this.sendSeq,
      new TextEncoder().encode(`group:${this.groupDid}:${this.epoch}`)
    );
    
    this.senderChainKey = newChainKey;
    const seq = this.sendSeq;
    this.sendSeq += 1n;
    
    return { ciphertext, seq: Number(seq) };
  }

  async decrypt(ciphertext, seq, senderDid, epoch) {
    const key = `${senderDid}:${epoch}`;
    const memberKey = this.memberKeys.get(key);
    
    if (!memberKey) {
      throw new Error(`Unknown sender key: ${key}`);
    }
    
    if (BigInt(seq) < memberKey.recvSeq) {
      throw new Error('Message replay detected');
    }
    
    while (memberKey.recvSeq < BigInt(seq)) {
      const { newChainKey } = await decryptMessage(
        new Uint8Array(),
        memberKey.senderChainKey,
        memberKey.recvSeq,
        new TextEncoder().encode(`group:${this.groupDid}:${this.epoch}`)
      );
      memberKey.senderChainKey = newChainKey;
      memberKey.recvSeq += 1n;
    }
    
    const { plaintext, newChainKey } = await decryptMessage(
      ciphertext,
      memberKey.senderChainKey,
      memberKey.recvSeq,
      new TextEncoder().encode(`group:${this.groupDid}:${this.epoch}`)
    );
    
    memberKey.senderChainKey = newChainKey;
    memberKey.recvSeq += 1n;
    
    return plaintext;
  }

  advanceEpoch(reason = 'key_rotation') {
    this.epoch += 1;
    this.senderKeyId = `${this.senderDid.substring(0, 8)}:${this.epoch}`;
    this.senderChainKey = randomBytes(32);
    this.sendSeq = 0n;
    return { epoch: this.epoch, senderKeyId: this.senderKeyId };
  }
}

/**
 * 会话管理器
 */
export class SessionManager {
  constructor() {
    this.privateSessions = new Map();
    this.groupSessions = new Map();
    this.didToSession = new Map();
  }

  createPrivateSession(senderDid, recipientDid, options = {}) {
    const session = new PrivateSession({
      senderDid,
      recipientDid,
      ...options
    });
    
    this.privateSessions.set(session.sessionId, session);
    
    if (!this.didToSession.has(recipientDid)) {
      this.didToSession.set(recipientDid, []);
    }
    this.didToSession.get(recipientDid).push(session.sessionId);
    
    return session;
  }

  getPrivateSession(sessionId) {
    return this.privateSessions.get(sessionId) || null;
  }

  getOrCreatePrivateSession(senderDid, recipientDid) {
    const sessions = this.didToSession.get(recipientDid) || [];
    for (const sessionId of sessions) {
      const session = this.privateSessions.get(sessionId);
      if (session && !session.isExpired()) {
        return session;
      }
    }
    
    return this.createPrivateSession(senderDid, recipientDid);
  }

  createGroupSession(groupDid, senderDid, options = {}) {
    const session = new GroupSession({
      groupDid,
      senderDid,
      ...options
    });
    
    this.groupSessions.set(groupDid, session);
    return session;
  }

  getGroupSession(groupDid) {
    return this.groupSessions.get(groupDid) || null;
  }

  deleteSession(sessionId) {
    const session = this.privateSessions.get(sessionId);
    if (session) {
      this.privateSessions.delete(sessionId);
      const sessions = this.didToSession.get(session.recipientDid) || [];
      const index = sessions.indexOf(sessionId);
      if (index > -1) {
        sessions.splice(index, 1);
      }
    }
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [sessionId, session] of this.privateSessions.entries()) {
      if (session.isExpired()) {
        this.deleteSession(sessionId);
      }
    }
  }
}

// 创建全局会话管理器实例
export const sessionManager = new SessionManager();
