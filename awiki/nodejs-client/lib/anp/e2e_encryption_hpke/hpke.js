/**
 * HPKE (RFC 9180) implementation matching Python version exactly.
 * 
 * Cipher suite: DHKEM-X25519/HKDF-SHA256/AES-128-GCM
 * 
 * Based on Python implementation in anp_src/anp_package/e2e_encryption_hpke/hpke.py
 */

import crypto from 'crypto';
import { x25519 } from '@noble/curves/ed25519';

// RFC 9180 constants
const KEM_ID = Buffer.from([0x00, 0x20]);  // DHKEM(X25519, HKDF-SHA256)
const KDF_ID = Buffer.from([0x00, 0x01]);  // HKDF-SHA256
const AEAD_ID = Buffer.from([0x00, 0x01]); // AES-128-GCM

const KEM_SUITE_ID = Buffer.concat([Buffer.from('KEM'), KEM_ID]);
const HPKE_SUITE_ID = Buffer.concat([Buffer.from('HPKE'), KEM_ID, KDF_ID, AEAD_ID]);

const N_SECRET = 32;  // KEM shared secret length
const N_ENC = 32;     // encapsulated key length
const N_PK = 32;      // public key length
const NK = 16;        // AES-128 key length
const NN = 12;        // GCM nonce length

/**
 * LabeledExtract(salt, label, ikm) per RFC 9180 Section 4.
 */
function labeledExtract(salt, label, ikm, suiteId) {
    const labeledIkm = Buffer.concat([
        Buffer.from('HPKE-v1'),
        suiteId,
        label,
        ikm || Buffer.alloc(0)
    ]);
    
    const hmac = crypto.createHmac('sha256', salt || Buffer.alloc(0));
    hmac.update(labeledIkm);
    return hmac.digest();
}

/**
 * LabeledExpand(prk, label, info, L) per RFC 9180 Section 4.
 */
function labeledExpand(prk, label, info, length, suiteId) {
    const labeledInfo = Buffer.concat([
        Buffer.from([length >>> 8, length & 0xff]),
        Buffer.from('HPKE-v1'),
        suiteId,
        label,
        info || Buffer.alloc(0)
    ]);
    
    // Use HMAC-SHA256 for HKDF-Expand
    const hmac = crypto.createHmac('sha256', prk);
    hmac.update(labeledInfo);
    hmac.update(Buffer.from([1]));  // T(1)
    
    const fullDigest = hmac.digest();
    return fullDigest.slice(0, length);
}

/**
 * ExtractAndExpand per RFC 9180 Section 4.1.
 */
function extractAndExpand(dh, kemContext) {
    const suiteId = KEM_SUITE_ID;
    // labeled extract: salt=b"", label="shared_secret", ikm=dh
    const prk = labeledExtract(Buffer.alloc(0), Buffer.from('shared_secret'), dh, suiteId);
    return labeledExpand(prk, Buffer.from('shared_secret'), kemContext, N_SECRET, suiteId);
}

/**
 * Encap(pkR) -> (shared_secret, enc).
 */
function encap(recipientPk) {
    // Generate ephemeral key pair
    const ekPrivate = x25519.utils.randomPrivateKey();
    const ekPublic = x25519.getPublicKey(ekPrivate);
    
    // Compute DH
    const dh = x25519.getSharedSecret(ekPrivate, recipientPk);
    
    // enc = ephemeral public key (32 bytes)
    const enc = Buffer.from(ekPublic);
    
    // pk_r = recipient public key (32 bytes)
    const pkR = Buffer.from(recipientPk);
    
    // kem_context = enc + pk_r
    const kemContext = Buffer.concat([enc, pkR]);
    
    const sharedSecret = extractAndExpand(Buffer.from(dh), kemContext);
    return { sharedSecret, enc };
}

/**
 * Decap(enc, skR) -> shared_secret.
 */
function decap(enc, recipientSk) {
    // ek_public from enc
    const ekPublic = Buffer.from(enc);
    
    // Compute DH
    const dh = x25519.getSharedSecret(recipientSk, ekPublic);
    
    // pk_r = recipient public key (32 bytes)
    const pkR = x25519.getPublicKey(recipientSk);
    
    // kem_context = enc + pk_r
    const kemContext = Buffer.concat([Buffer.from(enc), Buffer.from(pkR)]);
    
    return extractAndExpand(Buffer.from(dh), kemContext);
}

/**
 * KeyScheduleS(mode_base, shared_secret, info) -> (key, base_nonce).
 * mode_base = 0x00, psk/psk_id are empty.
 */
function keyScheduleS(sharedSecret, info) {
    const mode = Buffer.from([0x00]);
    const suiteId = HPKE_SUITE_ID;
    
    const pskIdHash = labeledExtract(Buffer.alloc(0), Buffer.from('psk_id_hash'), Buffer.alloc(0), suiteId);
    const infoHash = labeledExtract(Buffer.alloc(0), Buffer.from('info_hash'), info || Buffer.alloc(0), suiteId);
    const ksContext = Buffer.concat([mode, pskIdHash, infoHash]);
    
    const secret = labeledExtract(sharedSecret, Buffer.from('secret'), Buffer.alloc(0), suiteId);
    
    // Use HKDF-SHA256 expand for key derivation (matching Python)
    const key = labeledExpand(secret, Buffer.from('key'), ksContext, NK, suiteId);
    const baseNonce = labeledExpand(secret, Buffer.from('base_nonce'), ksContext, NN, suiteId);
    
    return { key, baseNonce };
}

/**
 * HPKE Base mode Seal.
 * 
 * @param {Buffer} recipientPk - Recipient X25519 public key (32 bytes)
 * @param {Buffer} plaintext - Plaintext to encrypt
 * @param {Buffer} [aad=Buffer.alloc(0)] - Additional authenticated data
 * @param {Buffer} [info=Buffer.alloc(0)] - Key schedule info parameter
 * @returns {{enc: Buffer, ciphertext: Buffer}} Encapsulated key and ciphertext with GCM tag
 */
export function hpkeSeal(recipientPk, plaintext, aad = Buffer.alloc(0), info = Buffer.alloc(0)) {
    const { sharedSecret, enc } = encap(recipientPk);
    const { key, baseNonce } = keyScheduleS(sharedSecret, info);
    
    // AES-128-GCM encryption
    const cipher = crypto.createCipheriv('aes-128-gcm', key, baseNonce);
    cipher.setAAD(aad);
    
    const ciphertext = Buffer.concat([
        cipher.update(plaintext),
        cipher.final(),
        cipher.getAuthTag()
    ]);
    
    return { enc, ciphertext };
}

/**
 * HPKE Base mode Open.
 * 
 * @param {Buffer} recipientSk - Recipient X25519 private key (32 bytes)
 * @param {Buffer} enc - Encapsulated key (32 bytes)
 * @param {Buffer} ciphertext - AEAD ciphertext + GCM tag
 * @param {Buffer} [aad=Buffer.alloc(0)] - Additional authenticated data
 * @param {Buffer} [info=Buffer.alloc(0)] - Key schedule info parameter
 * @returns {Buffer} Decrypted plaintext
 */
export function hpkeOpen(recipientSk, enc, ciphertext, aad = Buffer.alloc(0), info = Buffer.alloc(0)) {
    const sharedSecret = decap(enc, recipientSk);
    const { key, baseNonce } = keyScheduleS(sharedSecret, info);
    
    // Separate ciphertext and tag
    const tag = ciphertext.slice(-16);
    const ct = ciphertext.slice(0, -16);
    
    // AES-128-GCM decryption
    const decipher = crypto.createDecipheriv('aes-128-gcm', key, baseNonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    
    const plaintext = Buffer.concat([
        decipher.update(ct),
        decipher.final()
    ]);
    
    return plaintext;
}

/**
 * Generate X25519 key pair.
 * @returns {{privateKey: Buffer, publicKey: Buffer}}
 */
export function generateX25519KeyPair() {
    const privateKey = x25519.utils.randomPrivateKey();
    const publicKey = x25519.getPublicKey(privateKey);
    return { privateKey: Buffer.from(privateKey), publicKey: Buffer.from(publicKey) };
}
