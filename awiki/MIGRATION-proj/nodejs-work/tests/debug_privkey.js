#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

const py = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));

console.log("=== Private Key Analysis ===\n");

const pem = py.step1_keypair.private_key_pem;
console.log("PEM:");
console.log(pem);

const pemLines = pem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
const der = Buffer.from(pemLines.join(''), 'base64');

console.log("\nDER length:", der.length);
console.log("DER (hex):", der.toString('hex'));

// Parse DER structure
console.log("\n=== DER Structure ===");
console.log("Byte 0 (tag):", der[0].toString(16), "- should be 0x30 (SEQUENCE)");
console.log("Byte 1-2 (length):", der[1].toString(16), der[2]?.toString(16));

// Try using crypto module to extract private key
console.log("\n=== Using crypto.createPrivateKey ===");
try {
    const privateKey = crypto.createPrivateKey(pem);
    console.log("Successfully created private key");
    
    // Export as JWK to get the components
    const jwk = privateKey.export({ format: 'jwk' });
    console.log("JWK d (private):", jwk.d);
    console.log("JWK x (public x):", jwk.x);
    console.log("JWK y (public y):");
    
    // Convert d to bytes
    const dBytes = Buffer.from(jwk.d, 'base64url');
    console.log("\nPrivate key bytes (from JWK d):", dBytes.toString('hex'));
    console.log("Private key length:", dBytes.length);
    
    // Get public key from JWK
    const xBytes = Buffer.from(jwk.x, 'base64url');
    const yBytes = Buffer.from(jwk.y, 'base64url');
    const pubBytes = Buffer.concat([Buffer.from([0x04]), xBytes, yBytes]);
    console.log("\nPublic key bytes:", pubBytes.toString('hex'));
    
    // Verify against Python's values
    console.log("\n=== Comparison with Python ===");
    console.log("Python x:", py.step1_keypair.public_key_x_hex);
    console.log("Node.js x:", xBytes.toString('hex'));
    console.log("X match:", xBytes.toString('hex') === py.step1_keypair.public_key_x_hex);
    
    console.log("\nPython y:", py.step1_keypair.public_key_y_hex);
    console.log("Node.js y:", yBytes.toString('hex'));
    console.log("Y match:", yBytes.toString('hex') === py.step1_keypair.public_key_y_hex);
    
    // Now test signing
    console.log("\n=== Signing Test ===");
    const contentHash = Buffer.from(py.step6_content_hash_hex, 'hex');
    console.log("Content hash:", py.step6_content_hash_hex);
    
    const signature = secp256k1.sign(contentHash, dBytes);
    
    // Low-S normalization
    const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    let s = signature.s;
    if (s > CURVE_ORDER / BigInt(2)) {
        s = CURVE_ORDER - s;
    }
    
    const rBytes = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
    const sBytes = Buffer.from(s.toString(16).padStart(64, '0'), 'hex');
    const sigCompact = Buffer.concat([rBytes, sBytes]);
    
    console.log("Node.js signature:", sigCompact.toString('base64url').replace(/=/g, ''));
    console.log("Python signature:", py.step9_final_signature.base64url);
    
    // Verify
    const valid = secp256k1.verify(sigCompact, contentHash, pubBytes);
    console.log("\nNode.js signature verification:", valid ? "VALID ✓" : "INVALID ✗");
    
    // Also verify Python signature
    function decodeBase64Url(str) {
        const padding = '='.repeat((4 - str.length % 4) % 4);
        return Buffer.from(str + padding, 'base64');
    }
    
    const pySig = decodeBase64Url(py.step9_final_signature.base64url);
    const pyValid = secp256k1.verify(pySig, contentHash, pubBytes);
    console.log("Python signature verification:", pyValid ? "VALID ✓" : "INVALID ✗");
    
} catch (e) {
    console.log("Error:", e.message);
}
