/**
 * Test HPKE seal/open functions directly.
 */

import { hpkeSeal, hpkeOpen, generateX25519KeyPair } from '../src/hpke.js';
import { deriveChainKeys, determineDirection, assignChainKeys, deriveMessageKey } from '../src/ratchet.js';
import crypto from 'crypto';

console.log('='.repeat(80));
console.log('HPKE and Ratchet Test');
console.log('='.repeat(80));

// Generate key pairs
const aliceKeys = generateX25519KeyPair();
const bobKeys = generateX25519KeyPair();

console.log('\n[1] HPKE Seal/Open Test');
console.log('-'.repeat(40));

const plaintext = Buffer.from('This is a secret message for E2EE testing!');
const aad = Buffer.from('test-session-id');
const info = Buffer.alloc(0);

// Alice encrypts to Bob
console.log('Alice encrypts to Bob...');
const { enc, ciphertext } = hpkeSeal(bobKeys.publicKey, plaintext, aad, info);

console.log(`enc length: ${enc.length} bytes (expected 32)`);
console.log(`ciphertext length: ${ciphertext.length} bytes (expected ${plaintext.length + 16})`);

// Bob decrypts
console.log('Bob decrypts...');
const decrypted = hpkeOpen(bobKeys.privateKey, enc, ciphertext, aad, info);

console.log(`Decrypted: ${decrypted.toString('utf-8')}`);
console.log(`Match: ${decrypted.toString('utf-8') === plaintext.toString('utf-8') ? 'YES ✓' : 'NO ✗'}`);

console.log('\n[2] Ratchet Key Derivation Test');
console.log('-'.repeat(40));

const rootSeed = crypto.randomBytes(32);
const { initChainKey, respChainKey } = deriveChainKeys(rootSeed);

console.log(`initChainKey: ${initChainKey.toString('hex').substring(0, 32)}...`);
console.log(`respChainKey: ${respChainKey.toString('hex').substring(0, 32)}...`);

console.log('\n[3] Direction Determination Test');
console.log('-'.repeat(40));

const localDid = 'did:wba:awiki.ai:user:k1_alice';
const peerDid = 'did:wba:awiki.ai:user:k1_bob';

const isInitiator = determineDirection(localDid, peerDid);
console.log(`Local DID: ${localDid}`);
console.log(`Peer DID: ${peerDid}`);
console.log(`Is initiator: ${isInitiator}`);

const { sendChainKey, recvChainKey } = assignChainKeys(initChainKey, respChainKey, isInitiator);
console.log(`sendChainKey: ${sendChainKey.toString('hex').substring(0, 32)}...`);
console.log(`recvChainKey: ${recvChainKey.toString('hex').substring(0, 32)}...`);

console.log('\n[4] Message Key Derivation Test');
console.log('-'.repeat(40));

const { encKey, nonce, newChainKey } = deriveMessageKey(sendChainKey, 0);

console.log(`encKey (16 bytes): ${encKey.toString('hex')}`);
console.log(`nonce (12 bytes): ${nonce.toString('hex')}`);
console.log(`newChainKey: ${newChainKey.toString('hex').substring(0, 32)}...`);

console.log('\n' + '='.repeat(80));
console.log('All tests completed!');
console.log('='.repeat(80));
