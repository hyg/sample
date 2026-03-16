/**
 * E2eeHpkeSession 类单元测�? * 测试会话管理、加密、解密等核心功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  E2eeHpkeSession,
  SessionState,
  SeqMode,
  generateX25519KeyPair,
} from '../../src/e2e_encryption_hpke/index';
import { p256 } from '@noble/curves/nist.js';

describe('E2eeHpkeSession', () => {
  // 测试�?DID
  const LOCAL_DID = 'did:wba:awiki.ai:user:k1_local_user';
  const PEER_DID = 'did:wba:awiki.ai:user:k1_peer_user';

  // 生成测试密钥
  function generateTestKeys() {
    const x25519KeyPair = generateX25519KeyPair();
    const signingKeyPair = p256.utils.randomSecretKey();
    return {
      localX25519Sk: x25519KeyPair.privateKey,
      localX25519Pk: x25519KeyPair.publicKey,
      signingKey: signingKeyPair.privateKey,
      signingPk: signingKeyPair.publicKey,
    };
  }

  describe('构造函�?, () => {
    it('应该创建 IDLE 状态的会话', () => {
      const keys = generateTestKeys();
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      expect(session.stateValue).toBe(SessionState.IDLE);
      expect(session.sessionIdValue).toBeNull();
      expect(session.sendSeq).toBe(0);
      expect(session.recvSeq).toBe(0);
    });

    it('应该使用默认 STRICT 序号模式', () => {
      const keys = generateTestKeys();
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      expect(session.stateValue).toBe(SessionState.IDLE);
    });

    it('应该接受自定义序号模�?, () => {
      const keys = generateTestKeys();
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`,
        SeqMode.WINDOW
      );

      expect(session.stateValue).toBe(SessionState.IDLE);
    });
  });

  describe('initiateSession', () => {
    it('应该�?IDLE 状态发起会话并生成 e2ee_init 消息', () => {
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      const [msgType, content] = session.initiateSession(
        peerKeys.publicKey,
        `${PEER_DID}#key-3`
      );

      expect(msgType).toBe('e2ee_init');
      expect(content.e2ee_version).toBe('1.1');
      expect(content.session_id).toBeDefined();
      expect(content.session_id).toHaveLength(32); // 16 字节 hex = 32 字符
      expect(content.sender_did).toBe(LOCAL_DID);
      expect(content.recipient_did).toBe(PEER_DID);
      expect(content.recipient_key_id).toBe(`${PEER_DID}#key-3`);
      expect(content.enc).toBeDefined();
      expect(content.encrypted_seed).toBeDefined();
      expect(content.expires).toBe(86400);
      expect(content.proof).toBeDefined();
      expect(content.proof.type).toBe('EcdsaSecp256r1Signature2019');
      expect(session.stateValue).toBe(SessionState.ACTIVE);
    });

    it('应该使用自定义有效期', () => {
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`,
        SeqMode.STRICT,
        3600 // 1 小时
      );

      const [msgType, content] = session.initiateSession(
        peerKeys.publicKey,
        `${PEER_DID}#key-3`
      );

      expect(content.expires).toBe(3600);
    });

    it('在非 IDLE 状态应该抛出错�?, () => {
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      // 第一次发起会�?      session.initiateSession(peerKeys.publicKey, `${PEER_DID}#key-3`);

      // 第二次发起应该失�?      expect(() => {
        session.initiateSession(peerKeys.publicKey, `${PEER_DID}#key-3`);
      }).toThrow('Cannot initiate from active state, need IDLE');
    });
  });

  describe('processInit', () => {
    it('应该处理收到�?e2ee_init 消息并激活会�?, () => {
      // 生成双方密钥
      const initiatorKeys = generateTestKeys();
      const receiverKeys = generateTestKeys();
      const peerX25519Keys = generateX25519KeyPair();

      // 发起方创建会�?      const initiatorSession = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        initiatorKeys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        initiatorKeys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      // 生成 e2ee_init 消息
      const [msgType, initContent] = initiatorSession.initiateSession(
        peerX25519Keys.publicKey,
        `${PEER_DID}#key-3`
      );

      // 接收方创建会�?      const receiverSession = new E2eeHpkeSession(
        PEER_DID,
        LOCAL_DID,
        receiverKeys.localX25519Sk,
        `${PEER_DID}#key-3`,
        receiverKeys.signingKey,
        `${PEER_DID}#key-2`
      );

      // 接收方处�?e2ee_init（使用发起方的签名公钥验证）
      receiverSession.processInit(initContent, initiatorKeys.signingPk);

      expect(receiverSession.stateValue).toBe(SessionState.ACTIVE);
      expect(receiverSession.sessionIdValue).toBe(initContent.session_id);
    });

    it('应该拒绝不支持的 E2EE 版本', () => {
      const keys = generateTestKeys();
      const session = new E2eeHpkeSession(
        PEER_DID,
        LOCAL_DID,
        keys.localX25519Sk,
        `${PEER_DID}#key-3`,
        keys.signingKey,
        `${PEER_DID}#key-2`
      );

      const invalidContent = {
        e2ee_version: '1.0',
        session_id: 'test_session',
        sender_did: LOCAL_DID,
        recipient_did: PEER_DID,
        recipient_key_id: `${LOCAL_DID}#key-3`,
        enc: 'dGVzdA',
        encrypted_seed: 'dGVzdA',
        expires: 86400,
        proof: { type: 'EcdsaSecp256r1Signature2019', created: new Date().toISOString(), verification_method: 'test' }
      };

      expect(() => {
        session.processInit(invalidContent as any, keys.signingPk);
      }).toThrow('Unsupported e2ee_version: 1.0');
    });

    it('应该拒绝 recipient_did 不匹配的消息', () => {
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      const [msgType, initContent] = session.initiateSession(
        peerKeys.publicKey,
        `${PEER_DID}#key-3`
      );

      // 修改 recipient_did
      (initContent as any).recipient_did = 'did:wba:awiki.ai:user:k1_wrong_user';

      const receiverSession = new E2eeHpkeSession(
        PEER_DID,
        LOCAL_DID,
        keys.localX25519Sk,
        `${PEER_DID}#key-3`,
        keys.signingKey,
        `${PEER_DID}#key-2`
      );

      expect(() => {
        receiverSession.processInit(initContent, keys.signingPk);
      }).toThrow('recipient_did does not match local DID');
    });

    it('应该拒绝无效签名的消�?, () => {
      const initiatorKeys = generateTestKeys();
      const receiverKeys = generateTestKeys();
      const peerX25519Keys = generateX25519KeyPair();

      const initiatorSession = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        initiatorKeys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        initiatorKeys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      const [msgType, initContent] = initiatorSession.initiateSession(
        peerX25519Keys.publicKey,
        `${PEER_DID}#key-3`
      );

      const receiverSession = new E2eeHpkeSession(
        PEER_DID,
        LOCAL_DID,
        receiverKeys.localX25519Sk,
        `${PEER_DID}#key-3`,
        receiverKeys.signingKey,
        `${PEER_DID}#key-2`
      );

      // 使用错误的公钥验证应该失�?      expect(() => {
        receiverSession.processInit(initContent, receiverKeys.signingPk);
      }).toThrow('e2ee_init proof verification failed: invalid_signature');
    });

    it('在非 IDLE 状态应该抛出错�?, () => {
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      // 先激活会�?      session.initiateSession(peerKeys.publicKey, `${PEER_DID}#key-3`);

      // 再次处理 init 应该失败
      expect(() => {
        session.processInit({} as any, keys.signingPk);
      }).toThrow('Cannot process init from active state, need IDLE');
    });
  });

  describe('encryptMessage', () => {
    it('应该加密消息并返�?e2ee_msg 内容', () => {
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      // 激活会�?      session.initiateSession(peerKeys.publicKey, `${PEER_DID}#key-3`);

      // 加密消息
      const [msgType, content] = session.encryptMessage('text', 'Hello, secret world!');

      expect(msgType).toBe('e2ee_msg');
      expect(content.e2ee_version).toBe('1.1');
      expect(content.session_id).toBeDefined();
      expect(content.seq).toBe(0);
      expect(content.original_type).toBe('text');
      expect(content.ciphertext).toBeDefined();
      expect(session.sendSeq).toBe(1);
    });

    it('应该递增序号', () => {
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      session.initiateSession(peerKeys.publicKey, `${PEER_DID}#key-3`);

      // 加密多条消息
      session.encryptMessage('text', 'Message 1');
      session.encryptMessage('text', 'Message 2');
      session.encryptMessage('text', 'Message 3');

      expect(session.sendSeq).toBe(3);
    });

    it('在非 ACTIVE 状态应该抛出错�?, () => {
      const keys = generateTestKeys();
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      expect(() => {
        session.encryptMessage('text', 'Hello');
      }).toThrow('Cannot encrypt from idle state, need ACTIVE');
    });
  });

  describe('decryptMessage', () => {
    it('应该解密消息并返回明�?, () => {
      // 创建双方会话
      const initiatorKeys = generateTestKeys();
      const receiverKeys = generateTestKeys();
      const peerX25519Keys = generateX25519KeyPair();

      // 发起�?      const initiatorSession = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        initiatorKeys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        initiatorKeys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      const [msgType, initContent] = initiatorSession.initiateSession(
        peerX25519Keys.publicKey,
        `${PEER_DID}#key-3`
      );

      // 接收�?      const receiverSession = new E2eeHpkeSession(
        PEER_DID,
        LOCAL_DID,
        receiverKeys.localX25519Sk,
        `${PEER_DID}#key-3`,
        receiverKeys.signingKey,
        `${PEER_DID}#key-2`
      );

      receiverSession.processInit(initContent, initiatorKeys.signingPk);

      // 发起方加�?      const [encryptType, encryptedContent] = initiatorSession.encryptMessage(
        'text',
        'Hello, secret world!'
      );

      // 接收方解�?      const [originalType, plaintext] = receiverSession.decryptMessage(encryptedContent);

      expect(originalType).toBe('text');
      expect(plaintext).toBe('Hello, secret world!');
      expect(receiverSession.recvSeq).toBe(1);
    });

    it('应该拒绝重复序号（防重放�?, () => {
      const initiatorKeys = generateTestKeys();
      const receiverKeys = generateTestKeys();
      const peerX25519Keys = generateX25519KeyPair();

      const initiatorSession = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        initiatorKeys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        initiatorKeys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      const [msgType, initContent] = initiatorSession.initiateSession(
        peerX25519Keys.publicKey,
        `${PEER_DID}#key-3`
      );

      const receiverSession = new E2eeHpkeSession(
        PEER_DID,
        LOCAL_DID,
        receiverKeys.localX25519Sk,
        `${PEER_DID}#key-3`,
        receiverKeys.signingKey,
        `${PEER_DID}#key-2`
      );

      receiverSession.processInit(initContent, initiatorKeys.signingPk);

      // 加密并解密第一条消�?      const [encryptType, encryptedContent] = initiatorSession.encryptMessage(
        'text',
        'Message 1'
      );
      receiverSession.decryptMessage(encryptedContent);

      // 再次尝试解密相同的消息应该失�?      expect(() => {
        receiverSession.decryptMessage(encryptedContent);
      }).toThrow('Invalid seq: 0');
    });

    it('在非 ACTIVE 状态应该抛出错�?, () => {
      const keys = generateTestKeys();
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      expect(() => {
        session.decryptMessage({ seq: 0, ciphertext: 'test' });
      }).toThrow('Cannot decrypt from idle state, need ACTIVE');
    });
  });

  describe('isExpired', () => {
    it('应该检测会话是否过�?, () => {
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`,
        SeqMode.STRICT,
        1 // 1 秒过�?      );

      session.initiateSession(peerKeys.publicKey, `${PEER_DID}#key-3`);

      // 刚创建时不应过期
      expect(session.isExpired()).toBe(false);
    });
  });

  describe('getSessionInfo', () => {
    it('应该返回可序列化的会话信�?, () => {
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      session.initiateSession(peerKeys.publicKey, `${PEER_DID}#key-3`);

      const info = session.getSessionInfo();

      expect(info.session_id).toBeDefined();
      expect(info.local_did).toBe(LOCAL_DID);
      expect(info.peer_did).toBe(PEER_DID);
      expect(info.state).toBe(SessionState.ACTIVE);
      expect(info.is_initiator).toBeDefined();
      expect(info.expires_at).toBeDefined();
      expect(info.created_at).toBeDefined();
      expect(info.active_at).toBeDefined();
    });
  });

  describe('initiateRekey', () => {
    it('应该发起密钥轮换', () => {
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();
      const newPeerKeys = generateX25519KeyPair();
      const session = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        keys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        keys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      // 先建立会�?      session.initiateSession(peerKeys.publicKey, `${PEER_DID}#key-3`);
      const oldSessionId = session.sessionIdValue;

      // 发起 rekey
      const [msgType, content] = session.initiateRekey(
        newPeerKeys.publicKey,
        `${PEER_DID}#key-3-new`
      );

      expect(msgType).toBe('e2ee_rekey');
      expect(content.session_id).not.toBe(oldSessionId);
      expect(session.stateValue).toBe(SessionState.ACTIVE);
      expect(session.sendSeq).toBe(0); // 序号重置
    });
  });

  describe('processRekey', () => {
    it('应该处理密钥轮换消息', () => {
      const initiatorKeys = generateTestKeys();
      const receiverKeys = generateTestKeys();
      const peerX25519Keys = generateX25519KeyPair();
      const newPeerX25519Keys = generateX25519KeyPair();

      // 建立初始会话
      const initiatorSession = new E2eeHpkeSession(
        LOCAL_DID,
        PEER_DID,
        initiatorKeys.localX25519Sk,
        `${LOCAL_DID}#key-3`,
        initiatorKeys.signingKey,
        `${LOCAL_DID}#key-2`
      );

      const [msgType, initContent] = initiatorSession.initiateSession(
        peerX25519Keys.publicKey,
        `${PEER_DID}#key-3`
      );

      const receiverSession = new E2eeHpkeSession(
        PEER_DID,
        LOCAL_DID,
        receiverKeys.localX25519Sk,
        `${PEER_DID}#key-3`,
        receiverKeys.signingKey,
        `${PEER_DID}#key-2`
      );

      receiverSession.processInit(initContent, initiatorKeys.signingPk);

      // 发起方发�?rekey
      const [rekeyType, rekeyContent] = initiatorSession.initiateRekey(
        newPeerX25519Keys.publicKey,
        `${PEER_DID}#key-3-new`
      );

      // 接收方处�?rekey
      receiverSession.processRekey(rekeyContent, initiatorKeys.signingPk);

      expect(receiverSession.stateValue).toBe(SessionState.ACTIVE);
      expect(receiverSession.sendSeq).toBe(0);
    });
  });
});
