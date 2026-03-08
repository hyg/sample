/**
 * Debug signature verification.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { secp256k1 } from '@noble/curves/secp256k1';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

const testData = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'verify_test.json'), 'utf-8'));

console.log('=== Debug Signature Verification ===\n');

// Build public key from x, y coordinates
const pubX = Buffer.from(testData.public_key_x_hex, 'hex');
const pubY = Buffer.from(testData.public_key_y_hex, 'hex');
const pubBytes = Buffer.concat([Buffer.from([0x04]), pubX, pubY]);

console.log('Public key (hex):', pubBytes.toString('hex'));
console.log('Public key length:', pubBytes.length, 'bytes');

const toBeSigned = Buffer.from(testData.to_be_signed_hex, 'hex');
console.log('\nToBeSigned:', toBeSigned.toString('hex'));

const signature = Buffer.from(testData.rs_signature_hex, 'hex');
console.log('\nSignature (R||S):', signature.toString('hex'));
console.log('Signature length:', signature.length, 'bytes');

// Extract R and S
const r = signature.slice(0, 32);
const s = signature.slice(32, 64);
console.log('\nR:', r.toString('hex'));
console.log('S:', s.toString('hex'));

// Check low-S
const sBigInt = BigInt('0x' + s.toString('hex'));
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
console.log('\nS > CURVE_ORDER/2:', sBigInt > CURVE_ORDER / BigInt(2));

// Verify with noble-curves
try {
    const isValid = secp256k1.verify(signature, toBeSigned, pubBytes);
    console.log('\nnoble-curves verification:', isValid ? 'VALID' : 'INVALID');
} catch (e) {
    console.log('\nnoble-curves verification error:', e.message);
}

// Try with DER signature
const derSig = Buffer.from(testData.der_signature_hex, 'hex');
console.log('\nDER signature:', derSig.toString('hex'));

// noble-curves doesn't support DER directly, need to convert
// Let's just use the R||S format
