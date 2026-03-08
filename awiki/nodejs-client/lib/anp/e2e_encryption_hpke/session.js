/**
 * Private chat E2EE session (IDLE → ACTIVE two-state).
 * 
 * Completely decoupled from transport layer: all methods only receive/return dict.
 * 
 * @module e2ee_session
 */

import crypto from 'crypto';
import { x25519 } from '@noble/curves/ed25519';

import {
    hpkeSeal,
    hpkeOpen,
    deriveChainKeys,
    determineDirection,
    assignChainKeys,
    deriveMessageKey,
    generateProof,
    verifyProof,
    SeqManager,
    SessionState,
    DEFAULT_EXPIRES,
    base64UrlEncode,
    base64UrlDecode
} from './e2ee.js';

/**
 * Generate random hex string.
 * @param {number} length - Length in bytes
 * @returns {string}
 */
function generateRandomHex(length) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Build e2ee_init message content.
 * @param {Object} options
 * @returns {Object}
 */
function buildE2eeInit({
    sessionId,
    senderDid,
    recipientDid,
    recipientKeyId,
    recipientPk,
    rootSeed,
    signingKey,
    verificationMethod,
    expires = DEFAULT_EXPIRES
}) {
    const aad = Buffer.from(sessionId, 'utf-8');
    const { enc, ciphertext } = hpkeSeal(recipientPk, rootSeed, aad);
    
    const content = {
        session_id: sessionId,
        hpke_suite: 'DHKEM-X25519-HKDF-SHA256/HKDF-SHA256/AES-128-GCM',
        sender_did: senderDid,
        recipient_did: recipientDid,
        recipient_key_id: recipientKeyId,
        enc: base64UrlEncode(enc),
        encrypted_seed: base64UrlEncode(ciphertext),
        expires
    };
    
    return generateProof(content, signingKey, verificationMethod);
}

/**
 * Build e2ee_msg content.
 * @param {string} sessionId 
 * @param {number} seq 
 * @param {string} originalType 
 * @param {string} ciphertextB64 
 * @returns {Object}
 */
function buildE2eeMsg(sessionId, seq, originalType, ciphertextB64) {
    return {
        session_id: sessionId,
        seq,
        original_type: originalType,
        ciphertext: ciphertextB64
    };
}

/**
 * E2EE HPKE Session for private chat.
 */
export class E2eeHpkeSession {
    /**
     * @param {Object} options
     * @param {string} options.localDid
     * @param {string} options.peerDid
     * @param {Buffer} options.localX25519PrivateKey - 32 bytes
     * @param {string} options.localX25519KeyId
     * @param {Buffer} options.signingPrivateKey - secp256r1 private key (32 bytes)
     * @param {string} options.signingVerificationMethod
     * @param {string} [options.seqMode='strict']
     * @param {number} [options.defaultExpires=86400]
     */
    constructor({
        localDid,
        peerDid,
        localX25519PrivateKey,
        localX25519KeyId,
        signingPrivateKey,
        signingVerificationMethod,
        seqMode = 'strict',
        defaultExpires = DEFAULT_EXPIRES
    }) {
        this.localDid = localDid;
        this.peerDid = peerDid;
        this.localX25519Sk = localX25519PrivateKey;
        this.localX25519KeyId = localX25519KeyId;
        this.signingKey = signingPrivateKey;
        this.signingVm = signingVerificationMethod;
        this.defaultExpires = defaultExpires;
        
        this.state = SessionState.IDLE;
        this.sessionId = null;
        this.sendChainKey = null;
        this.recvChainKey = null;
        this.seqManager = new SeqManager({ mode: seqMode });
        this.isInitiator = null;
        this.expiresAt = null;
        this.createdAt = Date.now() / 1000;
        this.activeAt = null;
    }
    
    /**
     * Initiate session (sender side).
     * @param {Buffer} peerPk - Peer X25519 public key (32 bytes)
     * @param {string} peerKeyId - Peer key agreement ID
     * @returns {[string, Object]} ["e2ee_init", content]
     */
    initiateSession(peerPk, peerKeyId) {
        if (this.state !== SessionState.IDLE) {
            throw new Error(`Cannot initiate from ${this.state} state, need IDLE`);
        }
        
        this.sessionId = generateRandomHex(16);
        const rootSeed = crypto.randomBytes(32);
        
        const content = buildE2eeInit({
            sessionId: this.sessionId,
            senderDid: this.localDid,
            recipientDid: this.peerDid,
            recipientKeyId: peerKeyId,
            recipientPk: peerPk,
            rootSeed,
            signingKey: this.signingKey,
            verificationMethod: this.signingVm,
            expires: this.defaultExpires
        });
        
        this.setupChainKeys(rootSeed, content.expires || this.defaultExpires);
        
        return ['e2ee_init', content];
    }
    
    /**
     * Process received e2ee_init message.
     * @param {Object} content - e2ee_init content dict
     * @param {Buffer} senderSigningPk - Sender secp256r1 public key (65 bytes)
     */
    processInit(content, senderSigningPk) {
        if (this.state !== SessionState.IDLE) {
            throw new Error(`Cannot process init from ${this.state} state, need IDLE`);
        }
        
        // Verify proof
        if (!verifyProof(content, senderSigningPk)) {
            throw new Error('e2ee_init proof verification failed');
        }
        
        // Verify recipient is local
        if (content.recipient_did !== this.localDid) {
            throw new Error('recipient_did does not match local DID');
        }
        
        // HPKE open
        const encBytes = base64UrlDecode(content.enc);
        const ctBytes = base64UrlDecode(content.encrypted_seed);
        const aad = Buffer.from(content.session_id, 'utf-8');
        
        const rootSeed = hpkeOpen(encBytes, ctBytes, this.localX25519Sk, aad);
        
        this.sessionId = content.session_id;
        const expires = content.expires || this.defaultExpires;
        this.setupChainKeys(rootSeed, expires);
    }
    
    /**
     * Encrypt message.
     * @param {string} originalType 
     * @param {string} plaintext 
     * @returns {[string, Object]} ["e2ee_msg", content]
     */
    encryptMessage(originalType, plaintext) {
        if (this.state !== SessionState.ACTIVE) {
            throw new Error(`Cannot encrypt from ${this.state} state, need ACTIVE`);
        }
        
        const seq = this.seqManager.nextSendSeq();
        const { encKey, nonce, newChainKey } = deriveMessageKey(this.sendChainKey, seq);
        this.sendChainKey = newChainKey;
        
        // AES-128-GCM encryption
        const cipher = crypto.createCipheriv('aes-128-gcm', encKey, nonce);
        const ciphertext = Buffer.concat([
            cipher.update(Buffer.from(plaintext, 'utf-8')),
            cipher.final(),
            cipher.getAuthTag()
        ]);
        
        const ciphertextB64 = base64UrlEncode(ciphertext);
        const content = buildE2eeMsg(this.sessionId, seq, originalType, ciphertextB64);
        
        return ['e2ee_msg', content];
    }
    
    /**
     * Decrypt message.
     * @param {Object} content - e2ee_msg content dict
     * @returns {[string, string]} [originalType, plaintext]
     */
    decryptMessage(content) {
        if (this.state !== SessionState.ACTIVE) {
            throw new Error(`Cannot decrypt from ${this.state} state, need ACTIVE`);
        }
        
        const seq = content.seq;
        if (!this.seqManager.validateRecvSeq(seq)) {
            throw new Error(`Invalid seq: ${seq}`);
        }
        
        // Window mode: fast-forward recv_chain_key to target seq
        let tempChainKey = this.recvChainKey;
        const currentRecvSeq = this.seqManager.recvSeq;
        for (let s = currentRecvSeq; s < seq; s++) {
            const { newChainKey } = deriveMessageKey(tempChainKey, s);
            tempChainKey = newChainKey;
        }
        
        const { encKey, nonce, newChainKey } = deriveMessageKey(tempChainKey, seq);
        
        // Decrypt
        const ciphertext = base64UrlDecode(content.ciphertext);
        const ct = ciphertext.slice(0, ciphertext.length - 16);
        const tag = ciphertext.slice(ciphertext.length - 16);
        
        const decipher = crypto.createDecipheriv('aes-128-gcm', encKey, nonce);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([
            decipher.update(ct),
            decipher.final()
        ]).toString('utf-8');
        
        // Update state
        this.recvChainKey = newChainKey;
        this.seqManager.markSeqUsed(seq);
        this.seqManager.advanceRecvTo(seq);
        
        return [content.original_type, plaintext];
    }
    
    /**
     * Check if session is expired.
     * @returns {boolean}
     */
    isExpired() {
        if (this.expiresAt === null) {
            return false;
        }
        return Date.now() / 1000 > this.expiresAt;
    }
    
    /**
     * Get serializable session info.
     * @returns {Object}
     */
    getSessionInfo() {
        return {
            session_id: this.sessionId,
            local_did: this.localDid,
            peer_did: this.peerDid,
            state: this.state,
            is_initiator: this.isInitiator,
            expires_at: this.expiresAt,
            created_at: this.createdAt,
            active_at: this.activeAt
        };
    }
    
    /**
     * Setup chain keys from root seed.
     * @private
     */
    setupChainKeys(rootSeed, expires) {
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
        this.state = SessionState.ACTIVE;
    }
}

/**
 * Export session state for persistence.
 * @param {E2eeHpkeSession} session 
 * @returns {Object|null}
 */
export function exportSession(session) {
    if (session.state !== SessionState.ACTIVE) {
        return null;
    }
    
    return {
        session_id: session.sessionId,
        local_did: session.localDid,
        peer_did: session.peerDid,
        is_initiator: session.isInitiator,
        send_chain_key: session.sendChainKey ? base64UrlEncode(session.sendChainKey) : null,
        recv_chain_key: session.recvChainKey ? base64UrlEncode(session.recvChainKey) : null,
        send_seq: session.seqManager.sendSeq,
        recv_seq: session.seqManager.recvSeq,
        expires_at: session.expiresAt,
        created_at: session.createdAt,
        active_at: session.activeAt
    };
}

/**
 * Import session state from persistence.
 * @param {Object} data 
 * @returns {E2eeHpkeSession|null}
 */
export function importSession(data) {
    if (data.expires_at && Date.now() / 1000 > data.expires_at) {
        return null; // Expired
    }
    
    // Create dummy session (keys will be loaded from credential)
    const session = new E2eeHpkeSession({
        localDid: data.local_did,
        peerDid: data.peer_did,
        localX25519PrivateKey: Buffer.alloc(32),
        localX25519KeyId: '',
        signingPrivateKey: Buffer.alloc(32),
        signingVerificationMethod: ''
    });
    
    session.sessionId = data.session_id;
    session.state = SessionState.ACTIVE;
    session.isInitiator = data.is_initiator;
    session.sendChainKey = data.send_chain_key ? base64UrlDecode(data.send_chain_key) : null;
    session.recvChainKey = data.recv_chain_key ? base64UrlDecode(data.recv_chain_key) : null;
    session.seqManager.sendSeq = data.send_seq;
    session.seqManager.recvSeq = data.recv_seq;
    session.expiresAt = data.expires_at;
    session.createdAt = data.created_at;
    session.activeAt = data.active_at;
    
    return session;
}

export default {
    E2eeHpkeSession,
    SessionState,
    exportSession,
    importSession
};
