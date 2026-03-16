/**
 * Proof 签名证明单元测试
 * 测试 generateProof / validateProof / verifyProof 函数
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateProof,
  validateProof,
  verifyProof,
  ProofValidationError,
  DEFAULT_MAX_FUTURE_SKEW_SECONDS,
  DEFAULT_MAX_PAST_AGE_SECONDS,
} from '../../src/e2e_encryption_hpke/index';
import { p256 } from '@noble/curves/nist.js';

describe('Proof 签名证明', () => {
  function generateSigningKeys() {
    const keyPair = p256.utils.randomSecretKey();
    return {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
    };
  }

  describe('generateProof', () => {
    it('应该生成包含证明字段的内�?, () => {
      const keys = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
        sender_did: 'did:wba:awiki.ai:user:k1_test',
        recipient_did: 'did:wba:awiki.ai:user:k1_peer',
        expires: 86400,
      };

      const signedContent = generateProof(
        content,
        keys.privateKey,
        'did:wba:awiki.ai:user:k1_test#key-2'
      );

      expect(signedContent.proof).toBeDefined();
      expect(signedContent.proof.type).toBe('EcdsaSecp256r1Signature2019');
      expect(signedContent.proof.verification_method).toBe('did:wba:awiki.ai:user:k1_test#key-2');
      expect(signedContent.proof.created).toBeDefined();
      expect(signedContent.proof.proof_value).toBeDefined();
    });

    it('应该使用自定义创建时�?, () => {
      const keys = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
      };
      const createdTime = '2026-03-16T10:00:00Z';

      const signedContent = generateProof(
        content,
        keys.privateKey,
        'did:wba:awiki.ai:user:k1_test#key-2',
        createdTime
      );

      expect(signedContent.proof.created).toBe(createdTime);
    });

    it('应该保留原始内容字段', () => {
      const keys = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
        custom_field: 'custom_value',
        nested: { key: 'value' },
      };

      const signedContent = generateProof(
        content,
        keys.privateKey,
        'did:wba:awiki.ai:user:k1_test#key-2'
      );

      expect(signedContent.e2ee_version).toBe('1.1');
      expect(signedContent.session_id).toBe('test_session');
      expect(signedContent.custom_field).toBe('custom_value');
      expect(signedContent.nested).toEqual({ key: 'value' });
    });

    it('应该为不同内容生成不同签�?, () => {
      const keys = generateSigningKeys();
      const content1 = { e2ee_version: '1.1', session_id: 'session1' };
      const content2 = { e2ee_version: '1.1', session_id: 'session2' };

      const signed1 = generateProof(content1, keys.privateKey, 'did:test#key-2');
      const signed2 = generateProof(content2, keys.privateKey, 'did:test#key-2');

      expect(signed1.proof.proof_value).not.toBe(signed2.proof.proof_value);
    });

    it('应该为不同密钥生成不同签�?, () => {
      const keys1 = generateSigningKeys();
      const keys2 = generateSigningKeys();
      const content = { e2ee_version: '1.1', session_id: 'test_session' };

      const signed1 = generateProof(content, keys1.privateKey, 'did:test#key-2');
      const signed2 = generateProof(content, keys2.privateKey, 'did:test#key-2');

      expect(signed1.proof.proof_value).not.toBe(signed2.proof.proof_value);
    });
  });

  describe('validateProof', () => {
    it('应该验证有效的证�?, () => {
      const keys = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
        sender_did: 'did:wba:awiki.ai:user:k1_test',
      };

      const signedContent = generateProof(
        content,
        keys.privateKey,
        'did:wba:awiki.ai:user:k1_test#key-2'
      );

      expect(() => {
        validateProof(signedContent, keys.publicKey);
      }).not.toThrow();
    });

    it('应该拒绝缺失 proof 字段的内�?, () => {
      const keys = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
      };

      expect(() => {
        validateProof(content, keys.publicKey);
      }).toThrow(ProofValidationError);
      expect(() => {
        validateProof(content, keys.publicKey);
      }).toThrow('proof_missing');
    });

    it('应该拒绝缺失 proof_value 的证�?, () => {
      const keys = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
        proof: {
          type: 'EcdsaSecp256r1Signature2019',
          created: new Date().toISOString(),
          verification_method: 'did:test#key-2',
        },
      };

      expect(() => {
        validateProof(content, keys.publicKey);
      }).toThrow(ProofValidationError);
      expect(() => {
        validateProof(content, keys.publicKey);
      }).toThrow('proof_value_missing');
    });

    it('应该拒绝无效的证明类�?, () => {
      const keys = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
        proof: {
          type: 'InvalidProofType',
          created: new Date().toISOString(),
          verification_method: 'did:test#key-2',
          proof_value: 'dGVzdA',
        },
      };

      expect(() => {
        validateProof(content, keys.publicKey);
      }).toThrow(ProofValidationError);
      expect(() => {
        validateProof(content, keys.publicKey);
      }).toThrow('proof_type_invalid');
    });

    it('应该拒绝无效签名', () => {
      const keys1 = generateSigningKeys();
      const keys2 = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
      };

      const signedContent = generateProof(
        content,
        keys1.privateKey,
        'did:test#key-2'
      );

      // 使用错误的公钥验�?      expect(() => {
        validateProof(signedContent, keys2.publicKey);
      }).toThrow(ProofValidationError);
      expect(() => {
        validateProof(signedContent, keys2.publicKey);
      }).toThrow('invalid_signature');
    });

    it('应该拒绝过期的证�?, () => {
      const keys = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
      };

      // 创建很久以前的证�?      const oldTime = new Date(Date.now() - 2 * 86400 * 1000).toISOString(); // 2 天前
      const signedContent = generateProof(
        content,
        keys.privateKey,
        'did:test#key-2',
        oldTime
      );

      expect(() => {
        validateProof(signedContent, keys.publicKey, { maxPastAgeSeconds: 86400 });
      }).toThrow(ProofValidationError);
      expect(() => {
        validateProof(signedContent, keys.publicKey, { maxPastAgeSeconds: 86400 });
      }).toThrow('proof_expired');
    });

    it('应该拒绝来自未来的证�?, () => {
      const keys = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
      };

      // 创建未来的证�?      const futureTime = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 分钟�?      const signedContent = generateProof(
        content,
        keys.privateKey,
        'did:test#key-2',
        futureTime
      );

      expect(() => {
        validateProof(signedContent, keys.publicKey, { maxFutureSkewSeconds: 60 });
      }).toThrow(ProofValidationError);
      expect(() => {
        validateProof(signedContent, keys.publicKey, { maxFutureSkewSeconds: 60 });
      }).toThrow('proof_from_future');
    });

    it('应该允许小的时间偏差', () => {
      const keys = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
      };

      // 创建稍微未来的证明（在允许偏差内�?      const slightlyFutureTime = new Date(Date.now() + 30 * 1000).toISOString(); // 30 秒后
      const signedContent = generateProof(
        content,
        keys.privateKey,
        'did:test#key-2',
        slightlyFutureTime
      );

      // 默认允许 300 秒偏�?      expect(() => {
        validateProof(signedContent, keys.publicKey);
      }).not.toThrow();
    });

    it('应该禁用过期检查当 maxPastAgeSeconds �?null', () => {
      const keys = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
      };

      // 创建旧的证明
      const oldTime = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
      const signedContent = generateProof(
        content,
        keys.privateKey,
        'did:test#key-2',
        oldTime
      );

      // 禁用过期检�?      expect(() => {
        validateProof(signedContent, keys.publicKey, { maxPastAgeSeconds: null });
      }).not.toThrow();
    });
  });

  describe('verifyProof', () => {
    it('应该返回 true 对于有效证明', () => {
      const keys = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
      };

      const signedContent = generateProof(
        content,
        keys.privateKey,
        'did:test#key-2'
      );

      expect(verifyProof(signedContent, keys.publicKey)).toBe(true);
    });

    it('应该返回 false 对于无效证明', () => {
      const keys1 = generateSigningKeys();
      const keys2 = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
      };

      const signedContent = generateProof(
        content,
        keys1.privateKey,
        'did:test#key-2'
      );

      expect(verifyProof(signedContent, keys2.publicKey)).toBe(false);
    });

    it('应该返回 false 对于缺失证明', () => {
      const keys = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'test_session',
      };

      expect(verifyProof(content, keys.publicKey)).toBe(false);
    });
  });

  describe('ProofValidationError', () => {
    it('应该包含错误代码', () => {
      const error = new ProofValidationError('test_code', 'Test message');
      
      expect(error.code).toBe('test_code');
      expect(error.message).toBe('Test message');
      expect(error.name).toBe('ProofValidationError');
    });
  });

  describe('常量', () => {
    it('应该有合理的默认�?, () => {
      expect(DEFAULT_MAX_FUTURE_SKEW_SECONDS).toBe(300); // 5 分钟
      expect(DEFAULT_MAX_PAST_AGE_SECONDS).toBe(86400); // 24 小时
    });
  });

  describe('E2EE 场景测试', () => {
    it('应该验证 e2ee_init 消息证明', () => {
      const keys = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'session_abc123',
        sender_did: 'did:wba:awiki.ai:user:k1_sender',
        recipient_did: 'did:wba:awiki.ai:user:k1_receiver',
        recipient_key_id: 'did:wba:awiki.ai:user:k1_receiver#key-3',
        enc: 'dGVzdA',
        encrypted_seed: 'dGVzdA',
        expires: 86400,
      };

      const signedContent = generateProof(
        content,
        keys.privateKey,
        'did:wba:awiki.ai:user:k1_sender#key-2'
      );

      expect(() => {
        validateProof(signedContent, keys.publicKey);
      }).not.toThrow();
    });

    it('应该验证 e2ee_ack 消息证明', () => {
      const keys = generateSigningKeys();
      const content = {
        e2ee_version: '1.1',
        session_id: 'session_abc123',
        sender_did: 'did:wba:awiki.ai:user:k1_receiver',
        recipient_did: 'did:wba:awiki.ai:user:k1_sender',
        expires: 86400,
      };

      const signedContent = generateProof(
        content,
        keys.privateKey,
        'did:wba:awiki.ai:user:k1_receiver#key-2'
      );

      expect(() => {
        validateProof(signedContent, keys.publicKey);
      }).not.toThrow();
    });
  });
});
