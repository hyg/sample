import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

const py = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));

console.log("=== Public Key Verification ===\n");

// Method 1: From JWK export
const privateKey = crypto.createPrivateKey(py.step1_keypair.private_key_pem);
const jwk = privateKey.export({ format: 'jwk' });

const pubX = Buffer.from(jwk.x, 'base64url');
const pubY = Buffer.from(jwk.y, 'base64url');
const pubFromJwk = Buffer.concat([Buffer.from([0x04]), pubX, pubY]);

console.log("Method 1 (JWK export):");
console.log("  X:", jwk.x);
console.log("  Y:", jwk.y);
console.log("  Public (hex):", pubFromJwk.toString('hex'));

// Method 2: From Python's hex values
const pubXPy = Buffer.from(py.step1_keypair.public_key_x_hex, 'hex');
const pubYPy = Buffer.from(py.step1_keypair.public_key_y_hex, 'hex');
const pubFromPy = Buffer.concat([Buffer.from([0x04]), pubXPy, pubYPy]);

console.log("\nMethod 2 (Python hex values):");
console.log("  X:", py.step1_keypair.public_key_x_hex);
console.log("  Y:", py.step1_keypair.public_key_y_hex);
console.log("  Public (hex):", pubFromPy.toString('hex'));

console.log("\nMethod 1 == Method 2:", pubFromJwk.toString('hex') === pubFromPy.toString('hex'));

// Method 3: From private key bytes
const privBytes = Buffer.from(jwk.d, 'base64url');
const pubFromPriv = secp256k1.getPublicKey(privBytes, false);

console.log("\nMethod 3 (from private key):");
console.log("  Private:", privBytes.toString('hex'));
console.log("  Public (hex):", Buffer.from(pubFromPriv).toString('hex'));

// Verify all three give same point
const p1 = secp256k1.Point.fromHex(pubFromJwk);
const p2 = secp256k1.Point.fromHex(pubFromPy);
const p3 = secp256k1.Point.fromHex(pubFromPriv);

console.log("\n=== Point Equality ===");
console.log("p1.equals(p2):", p1.equals(p2));
console.log("p1.equals(p3):", p1.equals(p3));
console.log("p2.equals(p3):", p2.equals(p3));

// Now test signature verification with each
const contentHash = Buffer.from(py.step6_content_hash_hex, 'hex');
const pySig = Buffer.from(py.step9_final_signature.base64url, 'base64url');

console.log("\n=== Signature Verification ===");
console.log("With pubFromJwk:", secp256k1.verify(pySig, contentHash, pubFromJwk));
console.log("With pubFromPy:", secp256k1.verify(pySig, contentHash, pubFromPy));
console.log("With pubFromPriv:", secp256k1.verify(pySig, contentHash, pubFromPriv));

// Try with Point objects
console.log("\nWith p1 (Point):", secp256k1.verify(pySig, contentHash, p1.toRawBytes(false)));
console.log("With p2 (Point):", secp256k1.verify(pySig, contentHash, p2.toRawBytes(false)));
console.log("With p3 (Point):", secp256k1.verify(pySig, contentHash, p3.toRawBytes(false)));

// Calculate kid from each
const compressed1 = p1.toRawBytes(true);
const compressed2 = p2.toRawBytes(true);
const compressed3 = p3.toRawBytes(true);

const kid1 = Buffer.from(sha256(compressed1)).toString('base64url').replace(/=/g, '');
const kid2 = Buffer.from(sha256(compressed2)).toString('base64url').replace(/=/g, '');
const kid3 = Buffer.from(sha256(compressed3)).toString('base64url').replace(/=/g, '');

console.log("\n=== kid Calculation ===");
console.log("kid from p1:", kid1);
console.log("kid from p2:", kid2);
console.log("kid from p3:", kid3);
console.log("Python kid:", py.step1_keypair.kid);
