import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

// Generate a test key pair
const privKey = secp256k1.utils.randomPrivateKey();
const pubKey = secp256k1.getPublicKey(privKey, false);

// Test signing
const msg = 'hello';
const hash = sha256(msg);
const sig = secp256k1.sign(hash, privKey);

console.log('Signature type:', typeof sig);
console.log('Signature r type:', typeof sig.r);
console.log('Signature s type:', typeof sig.s);
console.log('Signature r:', sig.r.toString(16).slice(0, 32));
console.log('Signature s:', sig.s.toString(16).slice(0, 32));

// Check if these are BigInt
console.log('Is BigInt:', typeof sig.r === 'bigint');
