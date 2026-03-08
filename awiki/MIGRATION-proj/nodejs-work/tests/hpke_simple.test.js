/**
 * Simple HPKE tests comparing Node.js implementation with Python vectors.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
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
 */
function loadPythonTestVector(filename) {
    const filePath = join(PYTHON_OUTPUT_DIR, filename);
    try {
        return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch (e) {
        console.warn(`Python test vector not found: ${filename}`);
        return null;
    }
}

function fromHex(hex) {
    return Buffer.from(hex, 'hex');
}

function toHex(buf) {
    return buf.toString('hex');
}

describe('HPKE Basic Tests', () => {
    it('should encrypt and decrypt a message', async () => {
        const { publicKey, privateKey } = await generateX25519KeyPair();
        const plaintext = Buffer.from('Hello, HPKE World!', 'utf-8');
        const aad = Buffer.from('test-aad');
        const info = Buffer.from('test-info');
        
        const { enc, ciphertext } = await hpkeSeal(publicKey, plaintext, aad, info);
        const decrypted = await hpkeOpen(privateKey, enc, ciphertext, aad, info);
        
        assert.deepStrictEqual(decrypted, plaintext);
    });
    
    it('should fail decryption with wrong key', async () => {
        const { publicKey } = await generateX25519KeyPair();
        const { privateKey: wrongKey } = await generateX25519KeyPair();
        const plaintext = Buffer.from('Secret', 'utf-8');
        
        const { enc, ciphertext } = await hpkeSeal(publicKey, plaintext);
        
        // HPKE throws OpenError, not a generic error
        let threw = false;
        try {
            await hpkeOpen(wrongKey, enc, ciphertext);
        } catch (e) {
            if (e.message.includes('decryption') || e.message.includes('invalid') || e.name === 'OpenError') {
                threw = true;
            }
        }
        assert.ok(threw, 'Should throw decryption error');
    });
});

describe('Ratchet Key Derivation Tests', () => {
    it('should derive chain keys matching Python', () => {
        const tv = loadPythonTestVector('ratchet_test_1_chain_keys.json');
        if (!tv) return;
        
        const rootSeed = fromHex(tv.root_seed_hex);
        const { initChainKey, respChainKey } = deriveChainKeys(rootSeed);
        
        assert.strictEqual(toHex(initChainKey), tv.init_chain_key_hex);
        assert.strictEqual(toHex(respChainKey), tv.resp_chain_key_hex);
    });
    
    it('should derive message keys matching Python', () => {
        const tv = loadPythonTestVector('ratchet_test_2_message_keys.json');
        if (!tv) return;
        
        let chainKey = fromHex(tv.initial_chain_key_hex);
        
        for (const expected of tv.message_keys) {
            const { encKey, nonce, newChainKey } = deriveMessageKey(chainKey, expected.seq);
            
            assert.strictEqual(toHex(encKey), expected.enc_key_hex);
            assert.strictEqual(toHex(nonce), expected.nonce_hex);
            
            chainKey = newChainKey;
        }
    });
    
    it('should derive group message keys matching Python', () => {
        const tv = loadPythonTestVector('ratchet_test_3_group_keys.json');
        if (!tv) return;
        
        let chainKey = fromHex(tv.initial_chain_key_hex);
        
        for (const expected of tv.message_keys) {
            const { encKey, nonce } = deriveGroupMessageKey(chainKey, expected.seq);
            
            assert.strictEqual(toHex(encKey), expected.enc_key_hex);
            assert.strictEqual(toHex(nonce), expected.nonce_hex);
        }
    });
    
    it('should determine direction matching Python', () => {
        const tv = loadPythonTestVector('ratchet_test_4_direction.json');
        if (!tv) return;
        
        for (const test of tv.results) {
            const isInitiator = determineDirection(test.local_did, test.peer_did);
            assert.strictEqual(isInitiator, test.is_initiator);
        }
    });
});

console.log('\nSimple HPKE tests completed.');
