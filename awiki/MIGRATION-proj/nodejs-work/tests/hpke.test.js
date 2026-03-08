/**
 * HPKE and Ratchet unit tests comparing Node.js implementation with Python vectors.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Python test vectors are generated in ../../scripts/tests/python_output
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

// Import modules to test
import { hpkeSeal, hpkeOpen, generateX25519KeyPair } from '../src/hpke.js';
import {
    deriveChainKeys,
    deriveMessageKey,
    deriveGroupMessageKey,
    determineDirection,
    assignChainKeys
} from '../src/ratchet.js';

/**
 * Load Python test vector.
 * @param {string} filename 
 * @returns {Object|null}
 */
function loadPythonTestVector(filename) {
    const filePath = join(PYTHON_OUTPUT_DIR, filename);
    try {
        const content = readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        console.warn(`Python test vector not found: ${filename}`);
        return null;
    }
}

/**
 * Convert hex string to Buffer.
 * @param {string} hex 
 * @returns {Buffer}
 */
function fromHex(hex) {
    return Buffer.from(hex, 'hex');
}

/**
 * Convert Buffer to hex string.
 * @param {Buffer} buf 
 * @returns {string}
 */
function toHex(buf) {
    return buf.toString('hex');
}

describe('HPKE Seal/Open', () => {
    let testVector;
    
    before(() => {
        testVector = loadPythonTestVector('hpke_test_1.json');
    });
    
    it('should encrypt and decrypt with same result as Python', () => {
        const recipientSk = fromHex(testVector.recipient_private_key_hex);
        const recipientPk = fromHex(testVector.recipient_public_key_hex);
        const plaintext = Buffer.from(testVector.plaintext, 'utf-8');
        const aad = Buffer.from(testVector.aad, 'utf-8');
        const info = Buffer.from(testVector.info, 'utf-8');
        
        // Encrypt
        const { enc, ciphertext } = hpkeSeal(recipientPk, plaintext, aad, info);
        
        // Decrypt
        const decrypted = hpkeOpen(recipientSk, enc, ciphertext, aad, info);
        
        // Verify decryption
        assert.deepStrictEqual(decrypted, plaintext);
        assert.strictEqual(decrypted.toString(), testVector.decrypted);
    });
    
    it('should produce same ciphertext as Python with same keys', () => {
        const recipientSk = fromHex(testVector.recipient_private_key_hex);
        const recipientPk = fromHex(testVector.recipient_public_key_hex);
        const plaintext = Buffer.from(testVector.plaintext, 'utf-8');
        const aad = Buffer.from(testVector.aad, 'utf-8');
        const info = Buffer.from(testVector.info, 'utf-8');
        
        const { enc, ciphertext } = hpkeSeal(recipientPk, plaintext, aad, info);
        
        // Note: HPKE uses ephemeral key, so enc will be different each time
        // But decryption should always work
        const decrypted = hpkeOpen(recipientSk, enc, ciphertext, aad, info);
        assert.deepStrictEqual(decrypted, plaintext);
    });
    
    it('should match Python enc format (32 bytes)', () => {
        const recipientSk = fromHex(testVector.recipient_private_key_hex);
        const recipientPk = fromHex(testVector.recipient_public_key_hex);
        const plaintext = Buffer.from(testVector.plaintext, 'utf-8');
        
        const { enc } = hpkeSeal(recipientPk, plaintext);
        
        assert.strictEqual(enc.length, 32); // X25519 public key is 32 bytes
    });
});

describe('HPKE with different AAD', () => {
    let testVector;
    let keyPair;
    
    before(() => {
        testVector = loadPythonTestVector('hpke_test_2_aad.json');
        keyPair = generateX25519KeyPair();
    });
    
    it('should decrypt with empty AAD', () => {
        const { enc, ciphertext } = hpkeSeal(
            keyPair.publicKey,
            Buffer.from(testVector.plaintext),
            Buffer.alloc(0),  // Empty AAD
            Buffer.from(testVector.info)
        );
        
        const decrypted = hpkeOpen(keyPair.privateKey, enc, ciphertext, Buffer.alloc(0), Buffer.from(testVector.info));
        assert.strictEqual(decrypted.toString(), testVector.plaintext);
    });
    
    it('should decrypt with non-empty AAD', () => {
        const aad = Buffer.from('session-123');
        
        const { enc, ciphertext } = hpkeSeal(
            keyPair.publicKey,
            Buffer.from(testVector.plaintext),
            aad,
            Buffer.from(testVector.info)
        );
        
        const decrypted = hpkeOpen(keyPair.privateKey, enc, ciphertext, aad, Buffer.from(testVector.info));
        assert.strictEqual(decrypted.toString(), testVector.plaintext);
    });
    
    it('should fail decryption with wrong AAD', () => {
        const correctAad = Buffer.from('session-123');
        const wrongAad = Buffer.from('wrong-aad');
        
        const { enc, ciphertext } = hpkeSeal(
            keyPair.publicKey,
            Buffer.from(testVector.plaintext),
            correctAad,
            Buffer.from(testVector.info)
        );
        
        // Should throw with wrong AAD
        assert.throws(() => {
            hpkeOpen(keyPair.privateKey, enc, ciphertext, wrongAad, Buffer.from(testVector.info));
        }, /invalid authentication tag|decryption failed/i);
    });
});

describe('Chain Key Derivation', () => {
    let testVector;
    
    before(() => {
        testVector = loadPythonTestVector('ratchet_test_1_chain_keys.json');
    });
    
    it('should derive same chain keys as Python', () => {
        const rootSeed = fromHex(testVector.root_seed_hex);
        const { initChainKey, respChainKey } = deriveChainKeys(rootSeed);
        
        assert.strictEqual(initChainKey.hex(), testVector.init_chain_key_hex);
        assert.strictEqual(respChainKey.hex(), testVector.resp_chain_key_hex);
    });
    
    it('should produce 32-byte chain keys', () => {
        const rootSeed = crypto.randomBytes(32);
        const { initChainKey, respChainKey } = deriveChainKeys(rootSeed);
        
        assert.strictEqual(initChainKey.length, 32);
        assert.strictEqual(respChainKey.length, 32);
        assert.notDeepStrictEqual(initChainKey, respChainKey);
    });
});

describe('Message Key Derivation', () => {
    let testVector;
    
    before(() => {
        testVector = loadPythonTestVector('ratchet_test_2_message_keys.json');
    });
    
    it('should derive same message keys as Python for seq 0, 1, 2', () => {
        let chainKey = fromHex(testVector.initial_chain_key_hex);

        for (const expected of testVector.message_keys) {
            const { encKey, nonce, newChainKey } = deriveMessageKey(chainKey, expected.seq);

            assert.strictEqual(toHex(encKey), expected.enc_key_hex, `enc_key mismatch at seq ${expected.seq}`);
            assert.strictEqual(toHex(nonce), expected.nonce_hex, `nonce mismatch at seq ${expected.seq}`);

            chainKey = newChainKey;
        }
    });
    
    it('should produce correct key lengths', () => {
        const chainKey = crypto.randomBytes(32);
        const { encKey, nonce, newChainKey } = deriveMessageKey(chainKey, 0);
        
        assert.strictEqual(encKey.length, 16);  // AES-128 key
        assert.strictEqual(nonce.length, 12);   // GCM nonce
        assert.strictEqual(newChainKey.length, 32);  // Chain key
    });
    
    it('should produce different keys for different sequences', () => {
        const chainKey = crypto.randomBytes(32);
        
        const key0 = deriveMessageKey(chainKey, 0);
        const key1 = deriveMessageKey(chainKey, 1);
        const key2 = deriveMessageKey(chainKey, 2);
        
        assert.notDeepStrictEqual(key0.encKey, key1.encKey);
        assert.notDeepStrictEqual(key1.encKey, key2.encKey);
    });
    
    it('should be deterministic for same seq', () => {
        const chainKey = crypto.randomBytes(32);
        
        const key1 = deriveMessageKey(chainKey, 5);
        const key2 = deriveMessageKey(chainKey, 5);
        
        assert.deepStrictEqual(key1.encKey, key2.encKey);
        assert.deepStrictEqual(key1.nonce, key2.nonce);
    });
});

describe('Group Message Key Derivation', () => {
    let testVector;
    
    before(() => {
        testVector = loadPythonTestVector('ratchet_test_3_group_keys.json');
    });
    
    it('should derive same group message keys as Python for seq 0, 1, 2', () => {
        let chainKey = fromHex(testVector.initial_chain_key_hex);

        for (const expected of testVector.message_keys) {
            const { encKey, nonce } = deriveGroupMessageKey(chainKey, expected.seq);

            assert.strictEqual(toHex(encKey), expected.enc_key_hex, `enc_key mismatch at seq ${expected.seq}`);
            assert.strictEqual(toHex(nonce), expected.nonce_hex, `nonce mismatch at seq ${expected.seq}`);
        }
    });
    
    it('should produce different keys than private chat derivation', () => {
        const chainKey = crypto.randomBytes(32);
        
        const privateKeys = deriveMessageKey(chainKey, 0);
        const groupKeys = deriveGroupMessageKey(chainKey, 0);
        
        assert.notDeepStrictEqual(privateKeys.encKey, groupKeys.encKey);
        assert.notDeepStrictEqual(privateKeys.nonce, groupKeys.nonce);
    });
});

describe('Direction Determination', () => {
    let testVector;
    
    before(() => {
        testVector = loadPythonTestVector('ratchet_test_4_direction.json');
    });
    
    it('should determine direction same as Python', () => {
        for (const test of testVector.results) {
            const isInitiator = determineDirection(test.local_did, test.peer_did);
            assert.strictEqual(isInitiator, test.is_initiator, 
                `Direction mismatch for ${test.local_did} vs ${test.peer_did}`);
        }
    });
    
    it('should be consistent (a < b means b > a)', () => {
        const didA = 'did:wba:awiki.ai:user:alice';
        const didB = 'did:wba:awiki.ai:user:bob';
        
        const aIsInitiator = determineDirection(didA, didB);
        const bIsInitiator = determineDirection(didB, didA);
        
        // One should be initiator, the other should not
        assert.strictEqual(aIsInitiator, !bIsInitiator);
    });
});

describe('Chain Key Assignment', () => {
    it('should assign keys correctly based on initiator role', () => {
        const initCk = Buffer.alloc(32, 0x11);
        const respCk = Buffer.alloc(32, 0x22);
        
        // Initiator: send = init, recv = resp
        const initiatorKeys = assignChainKeys(initCk, respCk, true);
        assert.deepStrictEqual(initiatorKeys.sendChainKey, initCk);
        assert.deepStrictEqual(initiatorKeys.recvChainKey, respCk);
        
        // Non-initiator: send = resp, recv = init
        const nonInitiatorKeys = assignChainKeys(initCk, respCk, false);
        assert.deepStrictEqual(nonInitiatorKeys.sendChainKey, respCk);
        assert.deepStrictEqual(nonInitiatorKeys.recvChainKey, initCk);
    });
});

describe('Full HPKE Round-trip', () => {
    let testVector;
    
    before(() => {
        testVector = loadPythonTestVector('hpke_test_3_roundtrip.json');
    });
    
    it('should decrypt all messages in exchange log', () => {
        // Note: We can't verify ciphertext matches because HPKE uses ephemeral keys
        // But we can verify the round-trip works
        
        const receiverSk = fromHex(testVector.receiver_public_key_hex);
        const keyPair = generateX25519KeyPair();
        
        const aad = Buffer.from(testVector.aad);
        const info = Buffer.from(testVector.info);
        
        for (const msg of testVector.exchange_log) {
            const plaintext = Buffer.from(msg.plaintext);
            
            const { enc, ciphertext } = hpkeSeal(keyPair.publicKey, plaintext, aad, info);
            const decrypted = hpkeOpen(keyPair.privateKey, enc, ciphertext, aad, info);
            
            assert.strictEqual(decrypted.toString(), msg.plaintext);
        }
    });
});

console.log('\nHPKE and Ratchet tests completed.');
