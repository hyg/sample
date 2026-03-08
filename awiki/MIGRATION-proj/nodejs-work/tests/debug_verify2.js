/**
 * Debug signature verification - check toBeSigned format.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

const signData = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'sign_test.json'), 'utf-8'));
const verifyData = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'verify_test.json'), 'utf-8'));

console.log('=== Debug toBeSigned Format ===\n');

// Python's toBeSigned is the CONCATENATED HASHES (64 bytes)
console.log('Python toBeSigned (from sign_test.json):', signData.to_be_signed_hex);
console.log('Python toBeSigned length:', signData.to_be_signed_hex.length / 2, 'bytes');

// The signature was created by signing this 64-byte hash
const toBeSigned = Buffer.from(signData.to_be_signed_hex, 'hex');

// Verify with the public key from verify_test.json
const pubX = Buffer.from(verifyData.public_key_x_hex, 'hex');
const pubY = Buffer.from(verifyData.public_key_y_hex, 'hex');
const pubBytes = Buffer.concat([Buffer.from([0x04]), pubX, pubY]);

const signature = Buffer.from(signData.rs_signature_normalized_hex, 'hex');

console.log('\nVerifying signature...');

// noble-curves expects the message to be hashed internally if needed
// But our toBeSigned is already a hash, so we need to pass it directly
try {
    const isValid = secp256k1.verify(signature, toBeSigned, pubBytes);
    console.log('noble-curves verification (raw hash):', isValid ? 'VALID' : 'INVALID');
} catch (e) {
    console.log('noble-curves verification error:', e.message);
}

// Try double-hashing (noble might expect raw message, not pre-hashed)
const doubleHash = sha256(toBeSigned);
console.log('\nDouble hash:', Buffer.from(doubleHash).toString('hex'));

try {
    const isValid = secp256k1.verify(signature, doubleHash, pubBytes);
    console.log('noble-curves verification (double hash):', isValid ? 'VALID' : 'INVALID');
} catch (e) {
    console.log('noble-curves verification error:', e.message);
}

// The issue might be that noble-curves hashes the message internally
// Let's check the sign_test.json to see what was actually signed
console.log('\n=== Checking sign_test.json ===');
console.log('Private key:', signData.private_key_hex);
console.log('to_be_signed:', signData.to_be_signed_hex);
console.log('RS signature:', signData.rs_signature_hex);
console.log('RS signature normalized:', signData.rs_signature_normalized_hex);
