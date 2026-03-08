#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

function encodeBase64Url(data) {
    if (Buffer.isBuffer(data)) {
        return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    return Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Load Python results
const pythonResults = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));

console.log("=== Python Key Info ===");
console.log("Public key x (hex):", pythonResults.step1_keypair.public_key_x_hex);
console.log("Public key y (hex):", pythonResults.step1_keypair.public_key_y_hex);
console.log("kid:", pythonResults.step1_keypair.kid);

// Extract private key from PEM
const pemLines = pythonResults.step1_keypair.private_key_pem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
const privateKeyDer = Buffer.from(pemLines.join(''), 'base64');

console.log("\n=== Private Key DER ===");
console.log("DER length:", privateKeyDer.length);
console.log("DER (hex):", privateKeyDer.toString('hex'));

// PKCS#8 format for secp256k1:
// 30 81 87  - SEQUENCE, length 135
// 02 01 00  - INTEGER 0 (version)
// 30 05     - SEQUENCE, length 5
// 06 03 2b 65 70 - OID 1.3.132.0.10 (secp256k1)
// 04 22     - OCTET STRING, length 34
// 04 20     - Private key OCTET STRING, length 32
// [32 bytes private key]

// The actual private key is the last 32 bytes
const privateKeyBytes = privateKeyDer.slice(-32);
console.log("\n=== Extracted Private Key ===");
console.log("Private key (hex):", privateKeyBytes.toString('hex'));

// Get public key from private key
const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, false);
console.log("\n=== Derived Public Key ===");
console.log("Public key (hex):", publicKeyBytes.toString('hex'));

const x = publicKeyBytes.slice(1, 33);
const y = publicKeyBytes.slice(33, 65);

console.log("X (hex):", x.toString('hex'));
console.log("Y (hex):", y.toString('hex'));

// Calculate kid
const point = secp256k1.Point.fromHex(publicKeyBytes);
const compressed = point.toRawBytes(true);
const kid = encodeBase64Url(sha256(compressed));

console.log("\n=== Calculated kid ===");
console.log("kid:", kid);
console.log("Python kid:", pythonResults.step1_keypair.kid);
console.log("Match:", kid === pythonResults.step1_keypair.kid);

// Also try using crypto module to extract private key
console.log("\n=== Using crypto module ===");
const privateKey = crypto.createPrivateKey(pythonResults.step1_keypair.private_key_pem);
const publicKey = crypto.createPublicKey(pythonResults.step1_keypair.private_key_pem);

const pubPem = publicKey.export({ format: 'pem', type: 'spki' });
const pubPemLines = pubPem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
const pubDer = Buffer.from(pubPemLines.join(''), 'base64');
const pubKeyBytes = pubDer.slice(-65);

console.log("Public key from crypto (hex):", pubKeyBytes.toString('hex'));

const point2 = secp256k1.Point.fromHex(pubKeyBytes);
const compressed2 = point2.toRawBytes(true);
const kid2 = encodeBase64Url(sha256(compressed2));

console.log("kid from crypto:", kid2);
console.log("Match with Python:", kid2 === pythonResults.step1_keypair.kid);
