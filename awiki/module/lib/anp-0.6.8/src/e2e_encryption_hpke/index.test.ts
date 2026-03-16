/**
 * e2e_encryption_hpke 模块测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  E2eeHpkeSession,
  SessionState,
  HpkeKeyManager,
  generateX25519KeyPair,
  extractX25519PublicKeyFromDidDocument,
  extractSigningPublicKeyFromDidDocument,
  generateProof,
  validateProof,
  detectMessageType,
  MessageType,
  p256,
} from './index';

describe('e2e_encryption_hpke', () => {
  describe('generateX25519KeyPair', () => {
    it('should generate valid X25519 key pair', () => {
      const { privateKey, publicKey } = generateX25519KeyPair();
      expect(privateKey).toHaveLength(32);
      expect(publicKey).toHaveLength(32);
    });
  });

  describe('HpkeKeyManager', () => {
    it('should manage sessions correctly', () => {
      const manager = new HpkeKeyManager();
      expect(manager.getActiveSession('did1', 'did2')).toBeNull();
      expect(manager.getSessionById('session1')).toBeNull();
    });
  });

  describe('detectMessageType', () => {
    it('should detect valid message types', () => {
      expect(detectMessageType('e2ee_init')).toBe(MessageType.E2EE_INIT);
      expect(detectMessageType('e2ee_ack')).toBe(MessageType.E2EE_ACK);
      expect(detectMessageType('e2ee_msg')).toBe(MessageType.E2EE_MSG);
      expect(detectMessageType('e2ee_rekey')).toBe(MessageType.E2EE_REKEY);
      expect(detectMessageType('e2ee_error')).toBe(MessageType.E2EE_ERROR);
    });

    it('should return null for unknown types', () => {
      expect(detectMessageType('unknown')).toBeNull();
      expect(detectMessageType('text')).toBeNull();
    });
  });

  describe('generateProof and validateProof', () => {
    it('should generate and validate proof correctly', () => {
      // 生成密钥对
      const { privateKey: signingKey, publicKey: signingPk } = p256.utils.randomPrivateKey();

      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
        sender_did: 'did:wba:awiki.ai:user:k1_test',
        recipient_did: 'did:wba:awiki.ai:user:k1_peer',
        expires: 86400,
      };

      // 生成证明
      const signedContent = generateProof(
        content,
        signingKey,
        'did:wba:awiki.ai:user:k1_test#key-2'
      );

      expect(signedContent.proof).toBeDefined();
      expect(signedContent.proof.proof_value).toBeDefined();

      // 验证证明
      expect(() => validateProof(signedContent, signingPk)).not.toThrow();
    });

    it('should throw error for invalid signature', () => {
      const { privateKey: signingKey1 } = p256.utils.randomPrivateKey();
      const { publicKey: signingPk2 } = p256.utils.randomPrivateKey();

      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
      };

      const signedContent = generateProof(
        content,
        signingKey1,
        'did:wba:awiki.ai:user:k1_test#key-2'
      );

      // 使用错误的公钥验证应该失败
      expect(() => validateProof(signedContent, signingPk2)).toThrow('invalid_signature');
    });
  });

  describe('E2eeHpkeSession', () => {
    it('should create session in IDLE state', () => {
      const { privateKey: localX25519Sk } = generateX25519KeyPair();
      const { privateKey: signingKey } = p256.utils.randomPrivateKey();

      const session = new E2eeHpkeSession(
        'did:wba:awiki.ai:user:k1_local',
        'did:wba:awiki.ai:user:k1_peer',
        localX25519Sk,
        'did:wba:awiki.ai:user:k1_local#key-3',
        signingKey,
        'did:wba:awiki.ai:user:k1_local#key-2'
      );

      expect(session.stateValue).toBe(SessionState.IDLE);
      expect(session.sessionIdValue).toBeNull();
    });

    it('should initiate session and generate e2ee_init content', () => {
      const { privateKey: localX25519Sk, publicKey: localX25519Pk } = generateX25519KeyPair();
      const { privateKey: signingKey } = p256.utils.randomPrivateKey();
      const { publicKey: peerX25519Pk } = generateX25519KeyPair();

      const session = new E2eeHpkeSession(
        'did:wba:awiki.ai:user:k1_local',
        'did:wba:awiki.ai:user:k1_peer',
        localX25519Sk,
        'did:wba:awiki.ai:user:k1_local#key-3',
        signingKey,
        'did:wba:awiki.ai:user:k1_local#key-2'
      );

      const [msgType, content] = session.initiateSession(peerX25519Pk, 'did:wba:awiki.ai:user:k1_peer#key-3');

      expect(msgType).toBe('e2ee_init');
      expect(content.e2ee_version).toBe('1.1');
      expect(content.session_id).toBeDefined();
      expect(content.sender_did).toBe('did:wba:awiki.ai:user:k1_local');
      expect(content.recipient_did).toBe('did:wba:awiki.ai:user:k1_peer');
      expect(content.proof).toBeDefined();
      expect(session.stateValue).toBe(SessionState.ACTIVE);
    });
  });

  describe('E2EE session full flow', () => {
    it('should complete full encrypt/decrypt cycle', () => {
      // 创建发起方
      const { privateKey: initiatorX25519Sk, publicKey: initiatorX25519Pk } = generateX25519KeyPair();
      const { privateKey: initiatorSigningKey, publicKey: initiatorSigningPk } = p256.utils.randomPrivateKey();

      // 创建接收方
      const { privateKey: receiverX25519Sk, publicKey: receiverX25519Pk } = generateX25519KeyPair();
      const { privateKey: receiverSigningKey, publicKey: receiverSigningPk } = p256.utils.randomPrivateKey();

      // 发起方创建会话
      const initiatorSession = new E2eeHpkeSession(
        'did:wba:awiki.ai:user:k1_initiator',
        'did:wba:awiki.ai:user:k1_receiver',
        initiatorX25519Sk,
        'did:wba:awiki.ai:user:k1_initiator#key-3',
        initiatorSigningKey,
        'did:wba:awiki.ai:user:k1_initiator#key-2'
      );

      // 发起会话
      const [msgType, initContent] = initiatorSession.initiateSession(
        receiverX25519Pk,
        'did:wba:awiki.ai:user:k1_receiver#key-3'
      );

      expect(msgType).toBe('e2ee_init');

      // 接收方处理 e2ee_init
      const receiverSession = new E2eeHpkeSession(
        'did:wba:awiki.ai:user:k1_receiver',
        'did:wba:awiki.ai:user:k1_initiator',
        receiverX25519Sk,
        'did:wba:awiki.ai:user:k1_receiver#key-3',
        receiverSigningKey,
        'did:wba:awiki.ai:user:k1_receiver#key-2'
      );

      receiverSession.processInit(initContent, initiatorSigningPk);
      expect(receiverSession.stateValue).toBe(SessionState.ACTIVE);

      // 发起方加密消息
      const [encryptType, encryptedContent] = initiatorSession.encryptMessage(
        'text',
        'Hello, secret world!'
      );

      expect(encryptType).toBe('e2ee_msg');
      expect(encryptedContent.ciphertext).toBeDefined();

      // 接收方解密消息
      const [originalType, plaintext] = receiverSession.decryptMessage(encryptedContent);

      expect(originalType).toBe('text');
      expect(plaintext).toBe('Hello, secret world!');
    });
  });
});
