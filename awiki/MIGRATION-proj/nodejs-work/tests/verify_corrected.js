import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

const py = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));

function decodeBase64Url(str) {
    const padding = '='.repeat((4 - str.length % 4) % 4);
    return Buffer.from(str + padding, 'base64');
}

console.log("=== Python Signature Verification (Corrected) ===\n");

const contentHash = Buffer.from(py.step6_content_hash_hex, 'hex');

// Parse DER to get R and S
const derSig = Buffer.from(py.step7_signature.der_hex, 'hex');
const rLen = derSig[3];
const rFromDer = derSig.slice(4, 4 + rLen);
const sOffset = 4 + rLen + 2;
const sLen = derSig[sOffset - 1];
const sFromDer = derSig.slice(sOffset, sOffset + sLen);

// Remove leading zeros
const rClean = rFromDer[0] === 0 ? rFromDer.slice(1) : rFromDer;
const sClean = sFromDer[0] === 0 ? sFromDer.slice(1) : sFromDer;

console.log("R from DER (cleaned):", rClean.toString('hex'));
console.log("S from DER (cleaned):", sClean.toString('hex'));

// Apply low-S normalization
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const sBigInt = BigInt(`0x${sClean.toString('hex')}`);
const normalizedS = sBigInt > CURVE_ORDER / BigInt(2) ? CURVE_ORDER - sBigInt : sBigInt;

console.log("\nS was high:", sBigInt > CURVE_ORDER / BigInt(2));
console.log("Normalized S:", normalizedS.toString(16).padStart(64, '0'));

// Create 32-byte R and S
const r32 = Buffer.from(rClean.toString('hex').padStart(64, '0'), 'hex');
const s32 = Buffer.from(normalizedS.toString(16).padStart(64, '0'), 'hex');

console.log("\nR (32 bytes):", r32.toString('hex'));
console.log("S (32 bytes):", s32.toString('hex'));

// Create compact signature
const compactSig = Buffer.concat([r32, s32]);
console.log("\nCompact signature:", compactSig.toString('base64url').replace(/=/g, ''));
console.log("Python signature:  ", py.step9_final_signature.base64url);
console.log("Match:", compactSig.toString('base64url').replace(/=/g, '') === py.step9_final_signature.base64url);

// Get public key
const privateKey = crypto.createPrivateKey(py.step1_keypair.private_key_pem);
const jwk = privateKey.export({ format: 'jwk' });
const pubX = Buffer.from(jwk.x, 'base64url');
const pubY = Buffer.from(jwk.y, 'base64url');
const pubBytes = Buffer.concat([Buffer.from([0x04]), pubX, pubY]);

// Verify
console.log("\n=== Verification ===");
console.log("Verify compact signature:", secp256k1.verify(compactSig, contentHash, pubBytes));
console.log("Verify Python base64url signature:", secp256k1.verify(decodeBase64Url(py.step9_final_signature.base64url), contentHash, pubBytes));
