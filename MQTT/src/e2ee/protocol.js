/**
 * E2EE 协议处理器
 * 
 * 处理 E2EE 握手和消息的构建/解析
 * 不依赖具体传输层，通过回调发送消息
 */

import { randomBytes } from '@noble/hashes/utils';
import {
  hpkeSeal,
  hpkeOpen,
  deriveChainKeys,
  HPKE,
  Mode,
  AEAD,
  KDF
} from './hpke-rfc9180.js';
import { PrivateSession, generateSessionId } from './session.js';

export const MessageType = {
  E2EE_INIT: 'e2ee_init',
  E2EE_MSG: 'e2ee_msg',
  E2EE_RESPONSE: 'e2ee_response',
  TEXT: 'text'
};

export class E2EEProtocol {
  constructor(options = {}) {
    this.senderDid = options.senderDid;
    this.senderPrivateKey = options.senderPrivateKey;
    this.sessionManager = options.sessionManager;
    this.onSend = options.onSend || (() => {});
    this.onSessionCreated = options.onSessionCreated || (() => {});
    this.onMessage = options.onMessage || (() => {});
  }

  setIdentity(did, identity) {
    this.senderDid = did;
    this.senderPrivateKey = identity.privateKey;
  }

  async buildInit(recipientDid, recipientPublicKey, kemType = 'x25519') {
    const sessionId = generateSessionId();
    const rootSeed = randomBytes(32);

    let publicKeyBytes;
    if (typeof recipientPublicKey === 'string') {
      publicKeyBytes = new Uint8Array(Buffer.from(recipientPublicKey, 'hex'));
    } else {
      publicKeyBytes = new Uint8Array(recipientPublicKey);
    }
    
    if (publicKeyBytes.length === 33) {
      publicKeyBytes = publicKeyBytes.slice(1);
    }
    
    if (publicKeyBytes.length !== 32) {
      throw new Error(`Invalid X25519 public key length: ${publicKeyBytes.length}`);
    }

    const { enc, ciphertext: encryptedSeed } = await hpkeSeal({
      recipientPublicKey: publicKeyBytes,
      plaintext: rootSeed,
      info: new TextEncoder().encode(sessionId)
    });

    const { initChainKey, respChainKey } = deriveChainKeys(rootSeed);

    const session = this.sessionManager.createPrivateSession(this.senderDid, recipientDid, {
      sessionId,
      rootSeed,
      kemType,
      initChainKey,
      respChainKey
    });

    session.isInitiator = true;
    session.isActive = true;
    session.sendSeq = 0n;
    session.recvSeq = 0n;

    const content = {
      session_id: sessionId,
      hpke_suite: kemType === 'x25519'
        ? 'DHKEM-X25519-HKDF-SHA256/HKDF-SHA256/AES-128-GCM'
        : 'DHKEM-P256-HKDF-SHA256/HKDF-SHA256/AES-128-GCM',
      sender_did: this.senderDid,
      recipient_did: recipientDid,
      enc: Buffer.from(enc).toString('base64'),
      encrypted_seed: Buffer.from(encryptedSeed).toString('base64'),
      expires: 86400
    };

    return {
      type: MessageType.E2EE_INIT,
      content,
      session,
      sessionId
    };
  }

  async handleInit(content) {
    const { session_id, enc, encrypted_seed, sender_did } = content;
    
    if (!this.senderPrivateKey) {
      throw new Error('Identity not set');
    }
    
    const rootSeed = await hpkeOpen({
      recipientPrivateKey: this.senderPrivateKey,
      enc: new Uint8Array(Buffer.from(enc, 'base64')),
      ciphertext: new Uint8Array(Buffer.from(encrypted_seed, 'base64')),
      info: new TextEncoder().encode(session_id)
    });

    const { initChainKey, respChainKey } = deriveChainKeys(rootSeed);

    // 始终创建新 session（响应方视角）
    // 注意：即使 session_id 相同，senderDid 和 recipientDid 的顺序与发起方相反
    const newSession = this.sessionManager.createPrivateSession(sender_did, this.senderDid, {
      sessionId: session_id,
      rootSeed,
      initChainKey,
      respChainKey
    });

    newSession.isActive = true;
    newSession.sendSeq = 0n;
    newSession.recvSeq = 0n;

    return { session: newSession, session_id, isNew: true };
  }

  async buildMessage(sessionId, plaintext) {
    const session = this.sessionManager.getPrivateSession(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session not found or not active: ${sessionId}`);
    }
    
    const { initChainKey, respChainKey } = deriveChainKeys(session.rootSeed);
    const senderIsInitiator = session.senderDid === this.senderDid;
    const sendChainKey = senderIsInitiator ? initChainKey : respChainKey;

    const { ciphertext, seq } = await session.encrypt(plaintext, sendChainKey);

    return {
      type: MessageType.E2EE_MSG,
      content: {
        session_id: sessionId,
        seq,
        sender_did: this.senderDid,
        ciphertext: Buffer.from(ciphertext).toString('base64')
      }
    };
  }

  async handleMessage(content) {
    const { session_id, seq, ciphertext, sender_did } = content;
    const session = this.sessionManager.getPrivateSession(session_id);

    if (!session || !session.isActive) {
      throw new Error(`Session not found or not active: ${session_id}`);
    }
    
    const { initChainKey, respChainKey } = deriveChainKeys(session.rootSeed);
    const senderIsInitiator = session.senderDid === sender_did;
    const recvChainKey = senderIsInitiator ? initChainKey : respChainKey;

    const plaintext = await session.decrypt(
      new Uint8Array(Buffer.from(ciphertext, 'base64')),
      seq,
      recvChainKey
    );

    return {
      plaintext: new TextDecoder().decode(plaintext),
      seq,
      session_id,
      sender_did
    };
  }

  buildResponse(sessionId, accepted, reason = null) {
    return {
      type: MessageType.E2EE_RESPONSE,
      content: {
        session_id: sessionId,
        accepted,
        reason
      },
      sender_did: this.senderDid
    };
  }

  async sendInit(recipientDid, recipientPublicKey, kemType = 'x25519') {
    const { type, content, session, sessionId } = await this.buildInit(
      recipientDid,
      recipientPublicKey,
      kemType
    );

    await this.onSend({
      type,
      content,
      recipient_did: recipientDid
    });

    return { session, sessionId };
  }

  async sendMessage(sessionId, plaintext) {
    const { type, content } = await this.buildMessage(sessionId, plaintext);
    const session = this.sessionManager.getPrivateSession(sessionId);

    await this.onSend({
      type,
      content,
      recipient_did: session.recipientDid
    });
  }

  async processIncomingMessage(message) {
    const { type, content, sender_did } = message;

    switch (type) {
      case MessageType.E2EE_INIT:
        return await this.processInit(content, sender_did);

      case MessageType.E2EE_MSG:
        return await this.processMessage(content);

      case MessageType.E2EE_RESPONSE:
        return await this.processResponse(content);

      case MessageType.TEXT:
        return { event: 'text', text: content?.text, sender_did: content?.sender_did || sender_did };

      default:
        console.log(`[Protocol] 未知消息类型: ${type}`);
        return null;
    }
  }

  async processInit(content, sender_did) {
    const { session_id, session, isNew } = await this.handleInit(content);

    if (isNew) {
      const response = this.buildResponse(session_id, true);

      await this.onSend({
        ...response,
        recipient_did: sender_did
      });
    }

    return {
      event: isNew ? 'session_created' : 'session_existing',
      session,
      session_id,
      sender_did,
      isNew
    };
  }

  async processMessage(content) {
    const result = await this.handleMessage(content);

    return {
      event: 'message',
      ...result
    };
  }

  async processResponse(content) {
    const { session_id, accepted, reason } = content;

    return {
      event: accepted ? 'session_accepted' : 'session_rejected',
      session_id,
      reason
    };
  }
}

export default E2EEProtocol;
