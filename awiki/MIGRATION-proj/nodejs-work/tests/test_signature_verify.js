#!/usr/bin/env node

import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

function decodeBase64Url(str) {
    const padding = '='.repeat((4 - str.length % 4) % 4);
    return Buffer.from(str + padding, 'base64');
}

// Load Python results
const pythonResults = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));

console.log("=== Testing Signature Verification with secp256k1 ===\n");

// Get the hash from Python
const contentHash = Buffer.from(pythonResults.step6_content_hash_hex, 'hex');
const pythonSignature = decodeBase64Url(pythonResults.step9_final_signature.base64url);

console.log("Content hash:", pythonResults.step6_content_hash_hex);
console.log("Python signature:", pythonResults.step9_final_signature.base64url);

// Get Python's public key from x and y coordinates
const xBytes = Buffer.from(pythonResults.step1_keypair.public_key_x_hex, 'hex');
const yBytes = Buffer.from(pythonResults.step1_keypair.public_key_y_hex, 'hex');
const publicKeyBytes = Buffer.concat([Buffer.from([0x04]), xBytes, yBytes]);

console.log("\nPublic key (uncompressed):", publicKeyBytes.toString('hex'));

// Verify Python's signature using secp256k1
const pythonValid = secp256k1.verify(pythonSignature, contentHash, publicKeyBytes);
console.log("\nPython signature verification (secp256k1):", pythonValid ? "VALID ✓" : "INVALID ✗");

// Now test Node.js signature
console.log("\n=== Testing Node.js Signature ===");

// Get private key from PEM
const pemLines = pythonResults.step1_keypair.private_key_pem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
const privateKeyDer = Buffer.from(pemLines.join(''), 'base64');
// PKCS#8: the private key bytes are at a specific offset
// For secp256k1, it's after the OCTET STRING header (04 20)
const privateKeyBytes = privateKeyDer.slice(-32);

console.log("Private key:", privateKeyBytes.toString('hex'));

// Sign with Node.js
const nodeSignature = secp256k1.sign(contentHash, privateKeyBytes);

// Low-S normalization
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
let s = nodeSignature.s;
if (s > CURVE_ORDER / BigInt(2)) {
    s = CURVE_ORDER - s;
}

const rBytes = Buffer.from(nodeSignature.r.toString(16).padStart(64, '0'), 'hex');
const sBytes = Buffer.from(s.toString(16).padStart(64, '0'), 'hex');
const nodeSignatureCompact = Buffer.concat([rBytes, sBytes]);

console.log("Node.js signature:", nodeSignatureCompact.toString('base64url').replace(/=/g, ''));

// Verify Node.js signature
const nodeValid = secp256k1.verify(nodeSignatureCompact, contentHash, publicKeyBytes);
console.log("Node.js signature verification (secp256k1):", nodeValid ? "VALID ✓" : "INVALID ✗");

// Compare signatures
console.log("\n=== Signature Comparison ===");
console.log("Python signature:", pythonSignature.toString('hex'));
console.log("Node.js signature:", nodeSignatureCompact.toString('hex'));
console.log("Signatures match:", pythonSignature.toString('hex') === nodeSignatureCompact.toString('hex'));
console.log("(Note: Signatures will differ due to random k, but both should verify)");
