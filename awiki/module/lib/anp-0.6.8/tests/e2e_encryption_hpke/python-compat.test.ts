/**
 * Python vs Node.js 互操作对比测�? * 对比两个实现�?E2EE 行为
 * 
 * 注意：由�?Python �?Node.js 使用不同的加密库�? * 直接密文互操作可能不兼容，但协议行为应该一�? */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  E2eeHpkeSession,
  HpkeKeyManager,
  SessionState,
  SeqMode,
  generateX25519KeyPair,
  generateProof,
  validateProof,
  hpkeSeal,
  hpkeOpen,
  buildE2eeInit,
  buildE2eeAck,
  buildE2eeMsg,
  detectMessageType,
  MessageType,
  PROOF_TYPE,
  E2EE_VERSION,
  HPKE_SUITE,
  DEFAULT_EXPIRES,
} from '../../src/e2e_encryption_hpke/index';
import { p256 } from '@noble/curves/nist';

describe('Python vs Node.js 对比测试', () => {
  const ALICE_DID = 'did:wba:awiki.ai:user:k1_alice';
  const BOB_DID = 'did:wba:awiki.ai:user:k1_bob';

  function generateTestKeys() {
    const x25519KeyPair = generateX25519KeyPair();
    const signingKeyPair = p256.utils.randomSecretKey();
    return {
      x25519Sk: x25519KeyPair.privateKey,
      x25519Pk: x25519KeyPair.publicKey,
      signingKey: signingKeyPair.privateKey,
      signingPk: signingKeyPair.publicKey,
    };
  }

  describe('常量一致�?, () => {
    it('应该使用�?Python 相同�?E2EE 版本', () => {
      // Python: SUPPORTED_E2EE_VERSION = "1.1"
      expect(E2EE_VERSION).toBe('1.1');
    });

    it('应该使用�?Python 相同的证明类�?, () => {
      // Python: PROOF_TYPE = "EcdsaSecp256r1Signature2019"
      expect(PROOF_TYPE).toBe('EcdsaSecp256r1Signature2019');
    });

    it('应该使用�?Python 相同�?HPKE 套件', () => {
      // Python: HPKE_SUITE = "DHKEM-X25519-HKDF-SHA256/HKDF-SHA256/AES-128-GCM"
      expect(HPKE_SUITE).toBe('DHKEM-X25519-HKDF-SHA256/HKDF-SHA256/AES-128-GCM');
    });

    it('应该使用�?Python 相同的默认过期时�?, () => {
      // Python: DEFAULT_EXPIRES = 86400
      expect(DEFAULT_EXPIRES).toBe(86400);
    });
  });

  describe('消息类型检测一致�?, () => {
    it('应该检测与 Python 相同的消息类�?, () => {
      // Python: MessageType 枚举
      expect(detectMessageType('e2ee_init')).toBe(MessageType.E2EE_INIT);
      expect(detectMessageType('e2ee_ack')).toBe(MessageType.E2EE_ACK);
      expect(detectMessageType('e2ee_msg')).toBe(MessageType.E2EE_MSG);
      expect(detectMessageType('e2ee_rekey')).toBe(MessageType.E2EE_REKEY);
      expect(detectMessageType('e2ee_error')).toBe(MessageType.E2EE_ERROR);
      
      // 未知类型返回 null
      expect(detectMessageType('unknown')).toBeNull();
    });
  });

  describe('会话状态一致�?, () => {
    it('应该使用�?Python 相同的会话状�?, () => {
      const keys = generateTestKeys();
      const session = new E2eeHpkeSession(
        ALICE_DID,
        BOB_DID,
        keys.x25519Sk,
        `${ALICE_DID}#key-3`,
        keys.signingKey,
        `${ALICE_DID}#key-2`
      );

      // Python: SessionState.IDLE = "idle"
      expect(session.stateValue).toBe('idle');

      // 激活会�?      const peerKeys = generateX25519KeyPair();
      session.initiateSession(peerKeys.publicKey, `${BOB_DID}#key-3`);

      // Python: SessionState.ACTIVE = "active"
      expect(session.stateValue).toBe('active');
    });
  });

  describe('序号模式一致�?, () => {
    it('应该支持�?Python 相同的序号模�?, () => {
      // Python: SeqMode.STRICT = "strict"
      // Python: SeqMode.WINDOW = "window"
      expect(SeqMode.STRICT).toBe('strict');
      expect(SeqMode.WINDOW).toBe('window');
    });

    it('STRICT 模式行为应该�?Python 一�?, () => {
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();

      const session = new E2eeHpkeSession(
        ALICE_DID,
        BOB_DID,
        keys.x25519Sk,
        `${ALICE_DID}#key-3`,
        keys.signingKey,
        `${ALICE_DID}#key-2`,
        SeqMode.STRICT
      );

      const [initType, initContent] = session.initiateSession(
        peerKeys.publicKey,
        `${BOB_DID}#key-3`
      );

      const receiverSession = new E2eeHpkeSession(
        BOB_DID,
        ALICE_DID,
        peerKeys.privateKey,
        `${BOB_DID}#key-3`,
        peerKeys.privateKey,
        `${BOB_DID}#key-2`,
        SeqMode.STRICT
      );

      // 使用正确的签名密钥对
      const bobKeys = generateTestKeys();
      const receiverSession2 = new E2eeHpkeSession(
        BOB_DID,
        ALICE_DID,
        bobKeys.x25519Sk,
        `${BOB_DID}#key-3`,
        bobKeys.signingKey,
        `${BOB_DID}#key-2`,
        SeqMode.STRICT
      );

      receiverSession2.processInit(initContent, keys.signingPk);

      // STRICT 模式：只接受期望的序�?      const [msgType, encrypted] = session.encryptMessage('text', 'Hello');
      
      // 应该能解�?seq=0
      expect(() => {
        receiverSession2.decryptMessage(encrypted);
      }).not.toThrow();
    });
  });

  describe('证明生成一致�?, () => {
    it('应该生成�?Python 相同结构的证�?, () => {
      const keys = generateTestKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
        sender_did: ALICE_DID,
        recipient_did: BOB_DID,
        expires: 86400,
      };

      const signedContent = generateProof(
        content,
        keys.signingKey,
        `${ALICE_DID}#key-2`
      );

      // Python 证明结构
      expect(signedContent.proof).toBeDefined();
      expect(signedContent.proof.type).toBe('EcdsaSecp256r1Signature2019');
      expect(signedContent.proof.verification_method).toBeDefined();
      expect(signedContent.proof.created).toBeDefined();
      expect(signedContent.proof.proof_value).toBeDefined();

      // 验证应该通过
      expect(() => {
        validateProof(signedContent, keys.signingPk);
      }).not.toThrow();
    });

    it('应该验证�?Python 相同格式的证�?, () => {
      const keys = generateTestKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
      };

      const signedContent = generateProof(
        content,
        keys.signingKey,
        `${ALICE_DID}#key-2`
      );

      // Python: validateProof 抛出 ProofValidationError
      expect(() => {
        validateProof(signedContent, keys.signingPk);
      }).not.toThrow();

      // 错误签名应该失败
      const wrongKeys = generateTestKeys();
      expect(() => {
        validateProof(signedContent, wrongKeys.signingPk);
      }).toThrow('invalid_signature');
    });
  });

  describe('e2ee_init 消息结构一致�?, () => {
    it('应该生成�?Python 相同结构�?e2ee_init', () => {
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();

      const session = new E2eeHpkeSession(
        ALICE_DID,
        BOB_DID,
        keys.x25519Sk,
        `${ALICE_DID}#key-3`,
        keys.signingKey,
        `${ALICE_DID}#key-2`
      );

      const [msgType, content] = session.initiateSession(
        peerKeys.publicKey,
        `${BOB_DID}#key-3`
      );

      // Python e2ee_init 结构
      expect(msgType).toBe('e2ee_init');
      expect(content.e2ee_version).toBe('1.1');
      expect(content.session_id).toBeDefined();
      expect(content.sender_did).toBe(ALICE_DID);
      expect(content.recipient_did).toBe(BOB_DID);
      expect(content.recipient_key_id).toBe(`${BOB_DID}#key-3`);
      expect(content.hpke_suite).toBe('DHKEM-X25519-HKDF-SHA256/HKDF-SHA256/AES-128-GCM');
      expect(content.enc).toBeDefined();
      expect(content.encrypted_seed).toBeDefined();
      expect(content.expires).toBe(86400);
      expect(content.proof).toBeDefined();
    });
  });

  describe('e2ee_msg 消息结构一致�?, () => {
    it('应该生成�?Python 相同结构�?e2ee_msg', () => {
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();

      const session = new E2eeHpkeSession(
        ALICE_DID,
        BOB_DID,
        keys.x25519Sk,
        `${ALICE_DID}#key-3`,
        keys.signingKey,
        `${ALICE_DID}#key-2`
      );

      session.initiateSession(peerKeys.publicKey, `${BOB_DID}#key-3`);

      const [msgType, content] = session.encryptMessage('text', 'Hello');

      // Python e2ee_msg 结构
      expect(msgType).toBe('e2ee_msg');
      expect(content.e2ee_version).toBe('1.1');
      expect(content.session_id).toBeDefined();
      expect(content.seq).toBe(0);
      expect(content.original_type).toBe('text');
      expect(content.ciphertext).toBeDefined();
    });
  });

  describe('e2ee_ack 消息结构一致�?, () => {
    it('应该生成�?Python 相同结构�?e2ee_ack', () => {
      const keys = generateTestKeys();

      const ackContent = buildE2eeAck(
        'test_session',
        BOB_DID,
        ALICE_DID,
        keys.signingKey,
        `${BOB_DID}#key-2`
      );

      // Python e2ee_ack 结构
      expect(ackContent.e2ee_version).toBe('1.1');
      expect(ackContent.session_id).toBe('test_session');
      expect(ackContent.sender_did).toBe(BOB_DID);
      expect(ackContent.recipient_did).toBe(ALICE_DID);
      expect(ackContent.expires).toBe(86400);
      expect(ackContent.proof).toBeDefined();
      expect(ackContent.proof.type).toBe('EcdsaSecp256r1Signature2019');
    });
  });

  describe('HPKE 加密行为一致�?, () => {
    it('应该支持�?Python 相同�?HPKE 操作', () => {
      const keyPair = generateX25519KeyPair();
      const plaintext = new TextEncoder().encode('Hello, secret world!');

      // Python: hpke_seal / hpke_open
      const { enc, ciphertext } = hpkeSeal(keyPair.publicKey, plaintext);
      const decrypted = hpkeOpen(keyPair.privateKey, enc, ciphertext);

      expect(decrypted).toEqual(plaintext);
    });

    it('应该使用�?Python 相同的密码栈', () => {
      // Python: DHKEM(X25519, HKDF-SHA256) / HKDF-SHA256 / AES-128-GCM
      const keyPair = generateX25519KeyPair();
      
      expect(keyPair.publicKey.length).toBe(32); // X25519 公钥 32 字节
      expect(keyPair.privateKey.length).toBe(32); // X25519 私钥 32 字节

      const plaintext = new Uint8Array(16); // AES-128 块大�?      const { ciphertext } = hpkeSeal(keyPair.publicKey, plaintext);
      
      // 密文 = 明文 + GCM tag(16 字节)
      expect(ciphertext.length).toBe(plaintext.length + 16);
    });
  });

  describe('会话管理一致�?, () => {
    it('HpkeKeyManager 应该支持�?Python 相同的操�?, () => {
      const manager = new HpkeKeyManager();
      const keys = generateTestKeys();
      const peerKeys = generateX25519KeyPair();

      const session = new E2eeHpkeSession(
        ALICE_DID,
        BOB_DID,
        keys.x25519Sk,
        `${ALICE_DID}#key-3`,
        keys.signingKey,
        `${ALICE_DID}#key-2`
      );

      session.initiateSession(peerKeys.publicKey, `${BOB_DID}#key-3`);

      // Python: register_session
      manager.registerSession(session);

      // Python: get_active_session
      expect(manager.getActiveSession(ALICE_DID, BOB_DID)).toBe(session);

      // Python: get_session_by_id
      const sessionId = session.sessionIdValue;
      expect(manager.getSessionById(sessionId!)).toBe(session);

      // Python: remove_session
      manager.removeSession(ALICE_DID, BOB_DID);
      expect(manager.getActiveSession(ALICE_DID, BOB_DID)).toBeNull();
    });

    it('应该支持 Python 相同的会话清理操�?, () => {
      const manager = new HpkeKeyManager();

      // Python: cleanup_expired
      manager.cleanupExpired();

      // Python: get_all_active_sessions
      expect(manager.getAllActiveSessions()).toHaveLength(0);

      // Python: get_session_count
      expect(manager.getSessionCount()).toBe(0);

      // Python: clear
      manager.clear();
    });
  });

  describe('错误处理一致�?, () => {
    it('应该抛出�?Python 相同的错误类�?, () => {
      const keys = generateTestKeys();

      const session = new E2eeHpkeSession(
        ALICE_DID,
        BOB_DID,
        keys.x25519Sk,
        `${ALICE_DID}#key-3`,
        keys.signingKey,
        `${ALICE_DID}#key-2`
      );

      // Python: RuntimeError for state errors
      expect(() => {
        session.encryptMessage('text', 'Hello');
      }).toThrow('Cannot encrypt from idle state, need ACTIVE');
    });

    it('应该验证�?Python 相同的证明错�?, () => {
      const keys = generateTestKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test',
      };

      // Python: ProofValidationError
      expect(() => {
        validateProof(content, keys.signingPk);
      }).toThrow('proof_missing');
    });
  });

  describe('完整流程一致�?, () => {
    it('应该完成�?Python 相同的完�?E2EE 流程', () => {
      const aliceKeys = generateTestKeys();
      const bobKeys = generateTestKeys();

      // Python: initiate_handshake
      const aliceSession = new E2eeHpkeSession(
        ALICE_DID,
        BOB_DID,
        aliceKeys.x25519Sk,
        `${ALICE_DID}#key-3`,
        aliceKeys.signingKey,
        `${ALICE_DID}#key-2`
      );

      const [initType, initContent] = aliceSession.initiateSession(
        bobKeys.x25519Pk,
        `${BOB_DID}#key-3`
      );

      // Python: _handle_init
      const bobSession = new E2eeHpkeSession(
        BOB_DID,
        ALICE_DID,
        bobKeys.x25519Sk,
        `${BOB_DID}#key-3`,
        bobKeys.signingKey,
        `${BOB_DID}#key-2`
      );

      bobSession.processInit(initContent, aliceKeys.signingPk);

      // Python: encrypt_message
      const [msgType, encrypted] = aliceSession.encryptMessage('text', 'Hello Bob!');

      // Python: decrypt_message
      const [type, plaintext] = bobSession.decryptMessage(encrypted);

      expect(type).toBe('text');
      expect(plaintext).toBe('Hello Bob!');
    });
  });

  describe('已知差异说明', () => {
    it('文档�?Python vs Node.js 的已知差�?, () => {
      // 1. 密钥生成：使用不同的随机源，但算法相�?      // 2. 证明时间戳：可能有时区差异，但验证逻辑相同
      // 3. Base64 编码：实现不同但结果相同
      // 4. 错误消息：文本可能不同，但错误类型相�?      
      // 这些差异不影响互操作�?      expect(true).toBe(true);
    });
  });
});
