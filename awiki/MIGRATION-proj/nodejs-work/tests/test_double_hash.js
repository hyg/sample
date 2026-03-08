import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testData = JSON.parse(readFileSync(join(__dirname, '../../scripts/tests/python_output/sign_test.json'), 'utf-8'));

console.log('Private key (hex):', testData.private_key_hex);

const privKey = Buffer.from(testData.private_key_hex, 'hex');
const toBeSigned = Buffer.from(testData.to_be_signed_hex, 'hex');

console.log('toBeSigned length:', toBeSigned.length, 'bytes');

// noble-curves always hashes, so we need to work around it
// Option: hash the toBeSigned first, then sign
const doubleHash = sha256(toBeSigned);
console.log('doubleHash:', Buffer.from(doubleHash).toString('hex'));

const sig = secp256k1.sign(doubleHash, privKey);
console.log('Signature r:', sig.r.toString(16));
console.log('Signature s:', sig.s.toString(16));

// Now verify
const pubKey = secp256k1.getPublicKey(privKey, false);
const isValid = secp256k1.verify(sig, doubleHash, pubKey);
console.log('Verification (doubleHash):', isValid);

// Try verifying with original toBeSigned (should fail)
const isValid2 = secp256k1.verify(sig, toBeSigned, pubKey);
console.log('Verification (toBeSigned):', isValid2);
