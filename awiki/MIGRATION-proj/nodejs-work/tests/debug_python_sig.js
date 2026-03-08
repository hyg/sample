/**
 * Debug: Verify Python signature format.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('Debug: Python Signature Verification');
console.log('='.repeat(80));

// Load Python output
const pythonOutput = JSON.parse(readFileSync(join(__dirname, 'python_output', 'python_step_by_step.json'), 'utf-8'));

console.log('\n[1] Python Signature Data');
console.log('-'.repeat(80));
console.log(`rs_signature_hex: ${pythonOutput.rs_signature_hex}`);
console.log(`signature_b64url: ${pythonOutput.signature_b64url}`);
console.log(`content_hash: ${pythonOutput.content_hash}`);

// Decode Python signature
console.log('\n[2] Decode Python Signature');
console.log('-'.repeat(80));

const pythonRsSignature = Buffer.from(pythonOutput.rs_signature_hex, 'hex');
console.log(`R||S length: ${pythonRsSignature.length} bytes`);

const pythonSigB64Url = Buffer.from(pythonOutput.signature_b64url, 'base64');
console.log(`Decoded from Base64URL: ${pythonSigB64Url.toString('hex')}`);
console.log(`Match: ${pythonRsSignature.equals(pythonSigB64Url) ? '✓' : '✗'}`);

// Get public key
const pubX = Buffer.from(pythonOutput.public_key_x_hex, 'hex');
const pubY = Buffer.from(pythonOutput.public_key_y_hex, 'hex');
const publicKeyBytes = Buffer.concat([Buffer.from([0x04]), pubX, pubY]);

// Verify using content hash
console.log('\n[3] Verify with Content Hash');
console.log('-'.repeat(80));

const contentHash = Buffer.from(pythonOutput.content_hash, 'hex');

try {
    const isValid = secp256k1.verify(pythonRsSignature, contentHash, publicKeyBytes);
    console.log(`Verification (content hash): ${isValid ? 'PASSED ✓' : 'FAILED ✗'}`);
} catch (e) {
    console.log(`Verification (content hash): FAILED ✗ - ${e.message}`);
}

// Try double hash (maybe Python signed the hash of the hash?)
console.log('\n[4] Try Double Hash');
console.log('-'.repeat(80));

const doubleHash = sha256(contentHash);

try {
    const isValid = secp256k1.verify(pythonRsSignature, doubleHash, publicKeyBytes);
    console.log(`Verification (double hash): ${isValid ? 'PASSED ✓' : 'FAILED ✗'}`);
} catch (e) {
    console.log(`Verification (double hash): FAILED ✗ - ${e.message}`);
}

// Check if Python signature is actually DER format
console.log('\n[5] Check Signature Format');
console.log('-'.repeat(80));

// DER signatures start with 0x30
if (pythonRsSignature[0] === 0x30) {
    console.log('Signature appears to be DER format (starts with 0x30)');
} else {
    console.log('Signature is R||S format (does not start with 0x30)');
}

// Try to parse as DER
if (pythonRsSignature[0] === 0x30 && pythonRsSignature[1] === 0x44 || pythonRsSignature[1] === 0x45 || pythonRsSignature[1] === 0x46 || pythonRsSignature[1] === 0x47) {
    console.log('DER signature length indicator detected');
}

console.log('\n' + '='.repeat(80));
