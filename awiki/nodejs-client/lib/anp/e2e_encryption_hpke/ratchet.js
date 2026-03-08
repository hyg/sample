/**
 * Chain ratchet key derivation (private chat + group chat).
 * 
 * Matching Python implementation in anp_src/anp_package/e2e_encryption_hpke/ratchet.py
 * 
 * Private chat:
 *   root_seed → HKDFExpand → init_chain_key / resp_chain_key
 *   Direction determined by DID lexicographic order.
 * 
 * Group chat:
 *   sender_chain_key + seq → gmsg/gck derivation.
 */

import crypto from 'crypto';

/**
 * Derive two directional initial chain keys from root_seed.
 * 
 * @param {Buffer} rootSeed - 32-byte random seed
 * @returns {{initChainKey: Buffer, respChainKey: Buffer}}
 */
export function deriveChainKeys(rootSeed) {
    // init_chain_key = HKDFExpand(root_seed, "anp-e2ee-init", 32)
    const initHkdf = crypto.createHmac('sha256', rootSeed);
    initHkdf.update(Buffer.from('anp-e2ee-init'));
    const initChainKey = initHkdf.digest();
    
    // resp_chain_key = HKDFExpand(root_seed, "anp-e2ee-resp", 32)
    const respHkdf = crypto.createHmac('sha256', rootSeed);
    respHkdf.update(Buffer.from('anp-e2ee-resp'));
    const respChainKey = respHkdf.digest();
    
    return { initChainKey, respChainKey };
}

/**
 * Determine if local party is initiator (DID UTF-8 byte order smaller).
 * 
 * @param {string} localDid - Local DID
 * @param {string} peerDid - Peer DID
 * @returns {boolean} True if local is initiator
 */
export function determineDirection(localDid, peerDid) {
    const localBytes = Buffer.from(localDid, 'utf-8');
    const peerBytes = Buffer.from(peerDid, 'utf-8');
    
    // Lexicographic comparison
    return localBytes.compare(peerBytes) < 0;
}

/**
 * Assign send/recv chain keys based on role.
 * 
 * @param {Buffer} initChainKey - Initiator direction chain key
 * @param {Buffer} respChainKey - Responder direction chain key
 * @param {boolean} isInitiator - Is local party initiator
 * @returns {{sendChainKey: Buffer, recvChainKey: Buffer}}
 */
export function assignChainKeys(initChainKey, respChainKey, isInitiator) {
    if (isInitiator) {
        return { sendChainKey: initChainKey, recvChainKey: respChainKey };
    } else {
        return { sendChainKey: respChainKey, recvChainKey: initChainKey };
    }
}

/**
 * Derive message key for private chat.
 * 
 * @param {Buffer} chainKey - Current chain key
 * @param {bigint|number} seq - Message sequence number
 * @returns {{encKey: Buffer, nonce: Buffer, newChainKey: Buffer}}
 */
export function deriveMessageKey(chainKey, seq) {
    const seqBytes = Buffer.alloc(8);
    if (typeof seq === 'bigint') {
        seqBytes.writeBigUInt64BE(seq);
    } else {
        seqBytes.writeUInt32BE(0, 0);
        seqBytes.writeUInt32BE(seq, 4);
    }
    
    // msg_key = HMAC-SHA256(chain_key, "msg" + seq_bytes)
    const msgHmac = crypto.createHmac('sha256', chainKey);
    msgHmac.update(Buffer.concat([Buffer.from('msg'), seqBytes]));
    const msgKey = msgHmac.digest();
    
    // new_chain_key = HMAC-SHA256(chain_key, "ck")
    const ckHmac = crypto.createHmac('sha256', chainKey);
    ckHmac.update(Buffer.from('ck'));
    const newChainKey = ckHmac.digest();
    
    // enc_key = HMAC-SHA256(msg_key, "key")[:16]
    const keyHmac = crypto.createHmac('sha256', msgKey);
    keyHmac.update(Buffer.from('key'));
    const encKey = keyHmac.digest().slice(0, 16);
    
    // nonce = HMAC-SHA256(msg_key, "nonce")[:12]
    const nonceHmac = crypto.createHmac('sha256', msgKey);
    nonceHmac.update(Buffer.from('nonce'));
    const nonce = nonceHmac.digest().slice(0, 12);
    
    return { encKey, nonce, newChainKey };
}

/**
 * Derive group message key.
 * 
 * @param {Buffer} senderChainKey - Sender chain key
 * @param {bigint|number} seq - Message sequence number
 * @returns {{encKey: Buffer, nonce: Buffer, newChainKey: Buffer}}
 */
export function deriveGroupMessageKey(senderChainKey, seq) {
    // Same as private chat but with different labels
    const seqBytes = Buffer.alloc(8);
    if (typeof seq === 'bigint') {
        seqBytes.writeBigUInt64BE(seq);
    } else {
        seqBytes.writeUInt32BE(0, 0);
        seqBytes.writeUInt32BE(seq, 4);
    }
    
    // gmsg_key = HMAC-SHA256(sender_chain_key, "gmsg" + seq_bytes)
    const gmsgHmac = crypto.createHmac('sha256', senderChainKey);
    gmsgHmac.update(Buffer.concat([Buffer.from('gmsg'), seqBytes]));
    const gmsgKey = gmsgHmac.digest();
    
    // gck = HMAC-SHA256(sender_chain_key, "gck")
    const gckHmac = crypto.createHmac('sha256', senderChainKey);
    gckHmac.update(Buffer.from('gck'));
    const newChainKey = gckHmac.digest();
    
    // enc_key = HMAC-SHA256(gmsg_key, "key")[:16]
    const keyHmac = crypto.createHmac('sha256', gmsgKey);
    keyHmac.update(Buffer.from('key'));
    const encKey = keyHmac.digest().slice(0, 16);
    
    // nonce = HMAC-SHA256(gmsg_key, "nonce")[:12]
    const nonceHmac = crypto.createHmac('sha256', gmsgKey);
    nonceHmac.update(Buffer.from('nonce'));
    const nonce = nonceHmac.digest().slice(0, 12);
    
    return { encKey, nonce, newChainKey };
}
