/**
 * 多会话密钥管理器
 */

import { E2eeHpkeSession } from "./session";

/**
 * 管理多个私聊和群聊 E2EE 会话
 */
export class HpkeKeyManager {
  // 私聊：按 DID 对索引
  private sessionsByDidPair: Map<string, E2eeHpkeSession>;
  // 私聊：按 session_id 索引
  private sessionsBySessionId: Map<string, E2eeHpkeSession>;

  constructor() {
    this.sessionsByDidPair = new Map();
    this.sessionsBySessionId = new Map();
  }

  /**
   * 生成 DID 对键
   */
  private static didPairKey(localDid: string, peerDid: string): string {
    return `${localDid}|${peerDid}`;
  }

  /**
   * 获取指定 DID 对的活跃会话
   * @param localDid - 本地 DID
   * @param peerDid - 对端 DID
   * @returns 活跃会话，不存在或已过期则返回 null
   */
  getActiveSession(
    localDid: string,
    peerDid: string
  ): E2eeHpkeSession | null {
    const key = HpkeKeyManager.didPairKey(localDid, peerDid);
    const session = this.sessionsByDidPair.get(key);
    if (session && !session.isExpired()) {
      return session;
    }
    return null;
  }

  /**
   * 按 session_id 获取会话
   * @param sessionId - 会话 ID
   * @returns 会话，不存在或已过期则返回 null
   */
  getSessionById(sessionId: string): E2eeHpkeSession | null {
    const session = this.sessionsBySessionId.get(sessionId);
    if (session && !session.isExpired()) {
      return session;
    }
    return null;
  }

  /**
   * 注册会话到管理器
   * @param session - E2EE 会话
   */
  registerSession(session: E2eeHpkeSession): void {
    const key = HpkeKeyManager.didPairKey(session.localDid, session.peerDid);
    
    // 移除旧会话
    const old = this.sessionsByDidPair.get(key);
    if (old && old.sessionIdValue) {
      this.sessionsBySessionId.delete(old.sessionIdValue);
    }
    
    this.sessionsByDidPair.set(key, session);
    if (session.sessionIdValue) {
      this.sessionsBySessionId.set(session.sessionIdValue, session);
    }
  }

  /**
   * 移除指定 DID 对的会话
   * @param localDid - 本地 DID
   * @param peerDid - 对端 DID
   */
  removeSession(localDid: string, peerDid: string): void {
    const key = HpkeKeyManager.didPairKey(localDid, peerDid);
    const session = this.sessionsByDidPair.get(key);
    this.sessionsByDidPair.delete(key);
    if (session && session.sessionIdValue) {
      this.sessionsBySessionId.delete(session.sessionIdValue);
    }
  }

  /**
   * 清理所有过期的私聊会话
   */
  cleanupExpired(): void {
    const expiredPairs: string[] = [];
    
    for (const [key, session] of this.sessionsByDidPair.entries()) {
      if (session.isExpired()) {
        expiredPairs.push(key);
      }
    }
    
    for (const key of expiredPairs) {
      const session = this.sessionsByDidPair.get(key);
      this.sessionsByDidPair.delete(key);
      if (session && session.sessionIdValue) {
        this.sessionsBySessionId.delete(session.sessionIdValue);
      }
    }
  }

  /**
   * 获取所有活跃会话
   */
  getAllActiveSessions(): E2eeHpkeSession[] {
    const sessions: E2eeHpkeSession[] = [];
    for (const session of this.sessionsByDidPair.values()) {
      if (!session.isExpired()) {
        sessions.push(session);
      }
    }
    return sessions;
  }

  /**
   * 获取会话数量
   */
  getSessionCount(): number {
    return this.sessionsByDidPair.size;
  }

  /**
   * 清空所有会话
   */
  clear(): void {
    this.sessionsByDidPair.clear();
    this.sessionsBySessionId.clear();
  }
}
