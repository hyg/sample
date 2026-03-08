import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

const py = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));

function decodeBase64Url(str) {
    const padding = '='.repeat((4 - str.length % 4) % 4);
    return Buffer.from(str + padding, 'base64');
}

const contentHash = Buffer.from(py.step6_content_hash_hex, 'hex');
const pySig = decodeBase64Url(py.step9_final_signature.base64url);

// Get public key from Python
const xBytes = Buffer.from(py.step1_keypair.public_key_x_hex, 'hex');
const yBytes = Buffer.from(py.step1_keypair.public_key_y_hex, 'hex');

console.log("=== Public Key Analysis ===");
console.log("X (hex):", py.step1_keypair.public_key_x_hex);
console.log("Y (hex):", py.step1_keypair.public_key_y_hex);

// Method 1: Concatenate 0x04 || x || y
const pubBytes1 = Buffer.concat([Buffer.from([0x04]), xBytes, yBytes]);
console.log("\nMethod 1 (0x04 || x || y):", pubBytes1.toString('hex'));

// Method 2: Use secp256k1.Point
const point = secp256k1.Point.fromHex(pubBytes1);
const pubBytes2 = point.toRawBytes(false);
console.log("Method 2 (Point.toRawBytes):", pubBytes2.toString('hex'));

console.log("\nMethod 1 == Method 2:", pubBytes1.toString('hex') === pubBytes2.toString('hex'));

// Method 3: Get from private key
const pemLines = py.step1_keypair.private_key_pem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
const privDer = Buffer.from(pemLines.join(''), 'base64');
const privBytes = privDer.slice(-32);

const pubFromPriv = secp256k1.getPublicKey(privBytes, false);
console.log("Method 3 (from private):", Buffer.from(pubFromPriv).toString('hex'));

console.log("\n=== Verification with different public keys ===");
console.log("Verify with Method 1:", secp256k1.verify(pySig, contentHash, pubBytes1));
console.log("Verify with Method 2:", secp256k1.verify(pySig, contentHash, pubBytes2));
console.log("Verify with Method 3:", secp256k1.verify(pySig, contentHash, pubFromPriv));

// Check if points are equal
console.log("\n=== Point Equality ===");
const p1 = secp256k1.Point.fromHex(pubBytes1);
const p2 = secp256k1.Point.fromHex(pubBytes2);
const p3 = secp256k1.Point.fromHex(pubFromPriv);

console.log("p1.equals(p2):", p1.equals(p2));
console.log("p1.equals(p3):", p1.equals(p3));
console.log("p2.equals(p3):", p2.equals(p3));

// Try verifying with Point objects
console.log("\n=== Verification with Point objects ===");
console.log("Verify with p1:", secp256k1.verify(pySig, contentHash, p1));
console.log("Verify with p2:", secp256k1.verify(pySig, contentHash, p2));
console.log("Verify with p3:", secp256k1.verify(pySig, contentHash, p3));
