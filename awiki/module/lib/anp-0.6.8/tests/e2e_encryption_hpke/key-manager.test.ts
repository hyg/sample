/**
 * HpkeKeyManager 类单元测�? * 测试多会话密钥管理功�? */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HpkeKeyManager,
  E2eeHpkeSession,
  SessionState,
  generateX25519KeyPair,
} from '../../src/e2e_encryption_hpke/index';
import { p256 } from '@noble/curves/nist.js';

describe('HpkeKeyManager', () => {
  const LOCAL_DID = 'did:wba:awiki.ai:user:k1_local';
  
  function generateTestKeys() {
    const x25519KeyPair = generateX25519KeyPair();
    const signingKeyPair = p256.utils.randomSecretKey();
    return {
      localX25519Sk: x25519KeyPair.privateKey,
      signingKey: signingKeyPair.privateKey,
    };
  }

  function createTestSession(
    localDid: string,
    peerDid: string
  ): E2eeHpkeSession {
    const keys = generateTestKeys();
    const peerKeys = generateX25519KeyPair();
    
    const session = new E2eeHpkeSession(
      localDid,
      peerDid,
      keys.localX25519Sk,
      `${localDid}#key-3`,
      keys.signingKey,
      `${localDid}#key-2`
    );
    
    // 激活会�?    session.initiateSession(peerKeys.publicKey, `${peerDid}#key-3`);
    
    return session;
  }

  describe('构造函�?, () => {
    it('应该创建空的密钥管理�?, () => {
      const manager = new HpkeKeyManager();
      
      expect(manager.getActiveSession(LOCAL_DID, 'peer')).toBeNull();
      expect(manager.getSessionById('session1')).toBeNull();
      expect(manager.getSessionCount()).toBe(0);
    });
  });

  describe('registerSession', () => {
    it('应该注册会话到管理器', () => {
      const manager = new HpkeKeyManager();
      const session = createTestSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1');
      
      manager.registerSession(session);
      
      expect(manager.getSessionCount()).toBe(1);
      expect(manager.getActiveSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1')).toBe(session);
    });

    it('应该替换同一 DID 对的旧会�?, () => {
      const manager = new HpkeKeyManager();
      const session1 = createTestSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1');
      const session2 = createTestSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1');
      
      manager.registerSession(session1);
      expect(manager.getSessionCount()).toBe(1);
      
      manager.registerSession(session2);
      expect(manager.getSessionCount()).toBe(1);
      expect(manager.getActiveSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1')).toBe(session2);
    });

    it('应该维护 session_id 索引', () => {
      const manager = new HpkeKeyManager();
      const session = createTestSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1');
      
      manager.registerSession(session);
      
      const sessionId = session.sessionIdValue;
      expect(sessionId).toBeDefined();
      expect(manager.getSessionById(sessionId!)).toBe(session);
    });
  });

  describe('getActiveSession', () => {
    it('应该返回活跃的会�?, () => {
      const manager = new HpkeKeyManager();
      const session = createTestSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1');
      
      manager.registerSession(session);
      
      const retrieved = manager.getActiveSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1');
      expect(retrieved).toBe(session);
    });

    it('应该返回 null 对于不存在的会话', () => {
      const manager = new HpkeKeyManager();
      
      expect(manager.getActiveSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_unknown')).toBeNull();
    });

    it('应该返回 null 对于过期的会�?, () => {
      const manager = new HpkeKeyManager();
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();
      
      // 创建 1 秒过期的会话
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        'did:wba:awiki.ai:user:k1_peer1',
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`,
        undefined,
        1 // 1 秒过�?      );
      
      session.initiateSession(peerKeys.publicKey, 'did:wba:awiki.ai:user:k1_peer1#key-3');
      manager.registerSession(session);
      
      // 等待过期
      const waitMs = 1100;
      const start = Date.now();
      while (Date.now() - start < waitMs) {
        // 等待
      }
      
      expect(manager.getActiveSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1')).toBeNull();
    });
  });

  describe('getSessionById', () => {
    it('应该通过 session_id 返回会话', () => {
      const manager = new HpkeKeyManager();
      const session = createTestSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1');
      
      manager.registerSession(session);
      
      const sessionId = session.sessionIdValue;
      const retrieved = manager.getSessionById(sessionId!);
      expect(retrieved).toBe(session);
    });

    it('应该返回 null 对于不存在的 session_id', () => {
      const manager = new HpkeKeyManager();
      
      expect(manager.getSessionById('non_existent_session')).toBeNull();
    });
  });

  describe('removeSession', () => {
    it('应该移除指定的会�?, () => {
      const manager = new HpkeKeyManager();
      const session = createTestSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1');
      
      manager.registerSession(session);
      expect(manager.getSessionCount()).toBe(1);
      
      manager.removeSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1');
      expect(manager.getSessionCount()).toBe(0);
      expect(manager.getActiveSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1')).toBeNull();
    });

    it('应该同时移除两个索引', () => {
      const manager = new HpkeKeyManager();
      const session = createTestSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1');
      
      manager.registerSession(session);
      const sessionId = session.sessionIdValue;
      
      manager.removeSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1');
      
      expect(manager.getSessionById(sessionId!)).toBeNull();
    });
  });

  describe('cleanupExpired', () => {
    it('应该清理所有过期会�?, () => {
      const manager = new HpkeKeyManager();
      
      // 创建两个会话，一个快速过�?      const session1 = createTestSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1');
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();
      const session2 = new E2eeHpkeSession(
        LOCAL_DID,
        'did:wba:awiki.ai:user:k1_peer2',
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`,
        undefined,
        1 // 1 秒过�?      );
      session2.initiateSession(peerKeys.publicKey, 'did:wba:awiki.ai:user:k1_peer2#key-3');
      
      manager.registerSession(session1);
      manager.registerSession(session2);
      expect(manager.getSessionCount()).toBe(2);
      
      // 等待 session2 过期
      const waitMs = 1100;
      const start = Date.now();
      while (Date.now() - start < waitMs) {
        // 等待
      }
      
      manager.cleanupExpired();
      expect(manager.getSessionCount()).toBe(1);
      expect(manager.getActiveSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1')).toBe(session1);
    });
  });

  describe('getAllActiveSessions', () => {
    it('应该返回所有活跃会�?, () => {
      const manager = new HpkeKeyManager();
      
      const session1 = createTestSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1');
      const session2 = createTestSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer2');
      const session3 = createTestSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer3');
      
      manager.registerSession(session1);
      manager.registerSession(session2);
      manager.registerSession(session3);
      
      const sessions = manager.getAllActiveSessions();
      expect(sessions).toHaveLength(3);
      expect(sessions).toContain(session1);
      expect(sessions).toContain(session2);
      expect(sessions).toContain(session3);
    });
  });

  describe('clear', () => {
    it('应该清空所有会�?, () => {
      const manager = new HpkeKeyManager();
      
      manager.registerSession(createTestSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer1'));
      manager.registerSession(createTestSession(LOCAL_DID, 'did:wba:awiki.ai:user:k1_peer2'));
      
      expect(manager.getSessionCount()).toBe(2);
      
      manager.clear();
      
      expect(manager.getSessionCount()).toBe(0);
      expect(manager.getAllActiveSessions()).toHaveLength(0);
    });
  });

  describe('多会话管�?, () => {
    it('应该正确管理多个不同对等方的会话', () => {
      const manager = new HpkeKeyManager();
      
      const peers = [
        'did:wba:awiki.ai:user:k1_peer1',
        'did:wba:awiki.ai:user:k1_peer2',
        'did:wba:awiki.ai:user:k1_peer3',
        'did:wba:awiki.ai:user:k1_peer4',
        'did:wba:awiki.ai:user:k1_peer5',
      ];
      
      const sessions = new Map<string, E2eeHpkeSession>();
      
      // 创建并注�?5 个会�?      for (const peer of peers) {
        const session = createTestSession(LOCAL_DID, peer);
        manager.registerSession(session);
        sessions.set(peer, session);
      }
      
      expect(manager.getSessionCount()).toBe(5);
      
      // 验证所有会话都可检�?      for (const peer of peers) {
        expect(manager.getActiveSession(LOCAL_DID, peer)).toBe(sessions.get(peer));
      }
      
      // 加密消息测试
      for (const peer of peers) {
        const session = manager.getActiveSession(LOCAL_DID, peer);
        const [msgType, content] = session!.encryptMessage('text', `Message to ${peer}`);
        expect(msgType).toBe('e2ee_msg');
        expect(content.original_type).toBe('text');
      }
    });
  });
});
