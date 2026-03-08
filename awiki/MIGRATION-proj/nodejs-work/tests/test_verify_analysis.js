import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

const __dirname = dirname(fileURLToPath(import.meta.url));
const verifyData = JSON.parse(readFileSync(join(__dirname, '../../scripts/tests/python_output/verify_test.json'), 'utf-8'));

console.log('=== Verify Test Analysis ===');
console.log('Public key X:', verifyData.public_key_x_hex);
console.log('Public key Y:', verifyData.public_key_y_hex);
console.log('toBeSigned:', verifyData.to_be_signed_hex);
console.log('RS signature:', verifyData.rs_signature_hex);

// Build public key
const pubX = Buffer.from(verifyData.public_key_x_hex, 'hex');
const pubY = Buffer.from(verifyData.public_key_y_hex, 'hex');
const pubBytes = Buffer.concat([Buffer.from([0x04]), pubX, pubY]);

const toBeSigned = Buffer.from(verifyData.to_be_signed_hex, 'hex');
const signature = Buffer.from(verifyData.rs_signature_hex, 'hex');

console.log('\n=== Verification Tests ===');

// Test 1: Direct verification (noble will hash toBeSigned)
const isValid1 = secp256k1.verify(signature, toBeSigned, pubBytes);
console.log('Direct verify (noble hashes toBeSigned):', isValid1);

// Test 2: Double hash verification
const doubleHash = sha256(toBeSigned);
const isValid2 = secp256k1.verify(signature, doubleHash, pubBytes);
console.log('Double hash verify:', isValid2);

// Test 3: No hash verification (not possible with noble, but let's see)
console.log('\ntoBeSigned length:', toBeSigned.length, 'bytes');
console.log('doubleHash length:', doubleHash.length, 'bytes');
