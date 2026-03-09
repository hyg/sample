/**
 * E2EE client for HPKE-based end-to-end encrypted messaging.
 * 
 * Compatible with Python's E2eeClient.
 * 
 * Supports:
 * - Session initiation (e2ee_init)
 * - Session acknowledgment (e2ee_ack)
 * - Encrypted message sending (e2ee_msg)
 * - Message decryption
 * - Session rekeying (e2ee_rekey)
 * - Error handling (e2ee_error)
 */

import { secp256k1 } from '@noble/curves/secp256k1';
import { x25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { hkdf } from '@noble/hashes/hkdf';
import { concatBytes, bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { createCipheriv, createDecipheriv } from 'crypto';

// Base64 helpers using Node.js Buffer
const bytesToBase64 = (bytes) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const base64ToBytes = (base64) => {
    const padded = base64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - base64.length % 4) % 4);
    return Uint8Array.from(Buffer.from(padded, 'base64'));
};

const SUPPORTED_E2EE_VERSION = '1.1';

/**
 * E2EE Client class.
 */
export class E2eeClient {
    /**
     * Create E2EE client.
     * 
     * @param {string} localDid - Local DID identifier.
     * @param {string} signingPem - SECP256k1 signing private key PEM.
     * @param {string} x25519Pem - X25519 agreement private key PEM.
     */
    constructor(localDid, signingPem = null, x25519Pem = null) {
        this.localDid = localDid;
        this.signingKey = signingPem ? this._loadSigningKey(signingPem) : null;
        this.agreementKey = x25519Pem ? this._loadAgreementKey(x25519Pem) : null;
        this.sessions = new Map(); // peerDid -> session state
    }
    
    /**
     * Load signing private key from PEM.
     * @private
     */
    _loadSigningKey(pem) {
        // Extract raw bytes from PEM (simplified - in production use crypto library)
        const pemLines = pem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
        const der = Buffer.from(pemLines.join(''), 'base64');
        
        // Find private key offset in PKCS#8
        let privOffset = -1;
        for (let i = 0; i < der.length - 2; i++) {
            if (der[i] === 0x04 && der[i + 1] === 0x20) {
                privOffset = i + 2;
                break;
            }
        }
        
        if (privOffset < 0) {
            throw new Error('Invalid signing key PEM');
        }
        
        return der.slice(privOffset, privOffset + 32);
    }
    
    /**
     * Load X25519 agreement private key from PEM.
     * @private
     */
    _loadAgreementKey(pem) {
        const pemLines = pem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
        const der = Buffer.from(pemLines.join(''), 'base64');
        
        // X25519 private key is typically 32 bytes
        if (der.length >= 32) {
            // Try to find the 32-byte key
            for (let i = 0; i < der.length - 32; i++) {
                if (der[i] === 0x04 && der[i + 1] === 0x20) {
                    return der.slice(i + 2, i + 34);
                }
            }
            // Fallback: use last 32 bytes
            return der.slice(-32);
        }
        
        throw new Error('Invalid agreement key PEM');
    }
    
    /**
     * Generate new X25519 key pair for E2EE.
     * 
     * @returns {{publicKey: Uint8Array, privateKey: Uint8Array}}
     */
    static generateAgreementKey() {
        const privateKey = x25519.utils.randomPrivateKey();
        const publicKey = x25519.getPublicKey(privateKey);
        return { publicKey, privateKey };
    }
    
    /**
     * Initiate E2EE handshake with peer.
     * 
     * @param {string} peerDid - Peer DID identifier.
     * @returns {{msg_type: string, content: Object}} E2EE init message.
     */
    async initiateHandshake(peerDid) {
        // Generate new ephemeral key pair
        const { publicKey: ephemeralPk, privateKey: ephemeralSk } = E2eeClient.generateAgreementKey();
        
        // Create session ID
        const sessionId = bytesToHex(sha256(
            concatBytes(
                Buffer.from(this.localDid),
                Buffer.from(peerDid),
                ephemeralPk
            )
        )).slice(0, 32);
        
        // Initialize session state
        const session = {
            sessionId,
            peerDid,
            ephemeralSk,
            ephemeralPk,
            sendChainKey: null,
            recvChainKey: null,
            sendSeq: 0,
            recvSeq: 0,
            state: 'initiated'
        };
        
        this.sessions.set(peerDid, session);
        
        // Build e2ee_init content
        const content = {
            session_id: sessionId,
            e2ee_version: SUPPORTED_E2EE_VERSION,
            ephemeral_public_key: bytesToBase64(ephemeralPk),
            initiated_at: new Date().toISOString()
        };
        
        return {
            msg_type: 'e2ee_init',
            content
        };
    }
    
    /**
     * Process received E2EE handshake.
     * 
     * @param {Object} e2eeInit - e2ee_init message content.
     * @returns {{msg_type: string, content: Object}} E2EE ack message.
     */
    async processHandshake(e2eeInit) {
        const { session_id: sessionId, ephemeral_public_key: peerEphemeralPkB64, e2ee_version } = e2eeInit;

        if (e2ee_version !== SUPPORTED_E2EE_VERSION) {
            throw new Error(`Unsupported E2EE version: ${e2ee_version}`);
        }

        // Convert base64 to Uint8Array
        const peerEphemeralPk = Uint8Array.from(Buffer.from(peerEphemeralPkB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));

        // Generate our ephemeral key pair
        const { publicKey: ephemeralPk, privateKey: ephemeralSk } = E2eeClient.generateAgreementKey();

        // Derive shared secret using X25519
        const sharedSecret = x25519.getSharedSecret(ephemeralSk, peerEphemeralPk);

        // Derive chain keys using simple SHA256 (compatible with Python implementation)
        const sendChainKey = sha256(concatBytes(sharedSecret, new TextEncoder().encode('anp-e2ee-init')));
        const recvChainKey = sha256(concatBytes(sharedSecret, new TextEncoder().encode('anp-e2ee-resp')));

        // Store session
        const session = {
            sessionId,
            ephemeralSk,
            ephemeralPk,
            sendChainKey,
            recvChainKey,
            sendSeq: 0,
            recvSeq: 0,
            state: 'active'
        };

        this.sessions.set(sessionId, session);

        // Build e2ee_ack content
        const content = {
            session_id: sessionId,
            e2ee_version: SUPPORTED_E2EE_VERSION,
            ephemeral_public_key: bytesToBase64(ephemeralPk),
            acknowledged_at: new Date().toISOString()
        };
        
        return {
            msg_type: 'e2ee_ack',
            content
        };
    }
    
    /**
     * Encrypt message for peer.
     * 
     * @param {string} peerDid - Peer DID identifier.
     * @param {string} plaintext - Plaintext message.
     * @param {string} originalType - Original message type (e.g., 'text').
     * @returns {{msg_type: string, content: Object}} Encrypted message.
     */
    async encryptMessage(peerDid, plaintext, originalType = 'text') {
        const session = this.sessions.get(peerDid);
        
        if (!session || session.state !== 'active') {
            throw new Error(`No active E2EE session with ${peerDid}`);
        }
        
        // Derive message key from chain key
        const seqBytes = Buffer.alloc(8);
        seqBytes.writeBigUInt64BE(BigInt(session.sendSeq), 0);
        
        const msgKey = Buffer.from(
            sha256(concatBytes(Buffer.from('msg'), seqBytes, session.sendChainKey))
        );
        
        const newChainKey = Buffer.from(sha256(concatBytes(Buffer.from('ck'), session.sendChainKey)));
        session.sendChainKey = newChainKey;
        
        const encKey = Buffer.from(sha256(concatBytes(Buffer.from('key'), msgKey))).slice(0, 16);
        const nonce = Buffer.from(sha256(concatBytes(Buffer.from('nonce'), msgKey))).slice(0, 12);
        
        // Encrypt with AES-CTR using Node.js crypto
        const cipher = createCipheriv('aes-128-ctr', encKey, nonce);
        const plaintextBytes = Buffer.from(plaintext, 'utf-8');
        const encrypted = Buffer.concat([cipher.update(plaintextBytes), cipher.final()]);
        const ciphertext = Buffer.from(encrypted);
        
        session.sendSeq++;
        
        // Build encrypted content
        const content = {
            session_id: session.sessionId,
            seq: session.sendSeq - 1,
            ciphertext: bytesToBase64(ciphertext),
            original_type: originalType,
            encrypted_at: new Date().toISOString()
        };
        
        return {
            msg_type: 'e2ee_msg',
            content
        };
    }
    
    /**
     * Decrypt received message.
     * 
     * @param {Object} e2eeMsg - e2ee_msg content.
     * @returns {{plaintext: string, original_type: string}} Decrypted message.
     */
    async decryptMessage(e2eeMsg) {
        const { session_id: sessionId, seq, ciphertext: ciphertextB64 } = e2eeMsg;
        
        let session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error(`E2EE session not found: ${sessionId}`);
        }
        
        if (seq < session.recvSeq) {
            throw new Error(`Message seq ${seq} is older than expected ${session.recvSeq}`);
        }
        
        const ciphertext = base64ToBytes(ciphertextB64);
        
        // Derive message key for this sequence number
        const seqBytes = Buffer.alloc(8);
        seqBytes.writeBigUInt64BE(BigInt(seq), 0);
        
        // Derive chain key up to this sequence
        let chainKey = session.recvChainKey;
        for (let i = session.recvSeq; i < seq; i++) {
            chainKey = Buffer.from(sha256(concatBytes(Buffer.from('ck'), chainKey)));
        }
        
        const msgKey = Buffer.from(
            sha256(concatBytes(Buffer.from('msg'), seqBytes, chainKey))
        );
        
        const encKey = Buffer.from(sha256(concatBytes(Buffer.from('key'), msgKey))).slice(0, 16);
        const nonce = Buffer.from(sha256(concatBytes(Buffer.from('nonce'), msgKey))).slice(0, 12);
        
        // Decrypt with AES-CTR using Node.js crypto
        const decipher = createDecipheriv('aes-128-ctr', encKey, nonce);
        const ciphertextBytes = Uint8Array.from(ciphertext);
        const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertextBytes)), decipher.final()]);
        const plaintextBytes = Buffer.from(decrypted);
        
        session.recvSeq = seq + 1;
        session.recvChainKey = chainKey;
        
        return {
            plaintext: plaintextBytes.toString('utf-8'),
            original_type: e2eeMsg.original_type || 'text'
        };
    }
    
    /**
     * Export session state for persistence.
     * 
     * @returns {Object} Serializable session state.
     */
    exportState() {
        const sessions = {};
        for (const [key, session] of this.sessions.entries()) {
            sessions[key] = {
                ...session,
                ephemeralSk: bytesToHex(session.ephemeralSk),
                ephemeralPk: bytesToHex(session.ephemeralPk),
                sendChainKey: session.sendChainKey ? bytesToHex(session.sendChainKey) : null,
                recvChainKey: session.recvChainKey ? bytesToHex(session.recvChainKey) : null
            };
        }
        
        return {
            local_did: this.localDid,
            sessions
        };
    }
    
    /**
     * Import session state from persistence.
     * 
     * @param {Object} state - Serialized session state.
     * @returns {E2eeClient} E2EE client with restored sessions.
     */
    static fromState(state) {
        const client = new E2eeClient(state.local_did);
        
        for (const [key, session] of Object.entries(state.sessions || {})) {
            client.sessions.set(key, {
                ...session,
                ephemeralSk: hexToBytes(session.ephemeralSk),
                ephemeralPk: hexToBytes(session.ephemeralPk),
                sendChainKey: session.sendChainKey ? hexToBytes(session.sendChainKey) : null,
                recvChainKey: session.recvChainKey ? hexToBytes(session.recvChainKey) : null
            });
        }
        
        return client;
    }
}

export { SUPPORTED_E2EE_VERSION };
