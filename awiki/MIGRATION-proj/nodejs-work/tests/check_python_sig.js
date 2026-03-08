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

console.log("=== Python Signature Analysis ===");
console.log("Signature (hex):", pySig.toString('hex'));

const r = pySig.slice(0, 32);
const s = pySig.slice(32, 64);

console.log("\nR (hex):", r.toString('hex'));
console.log("S (hex):", s.toString('hex'));

const sBigInt = BigInt(`0x${s.toString('hex')}`);
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

console.log("\nS (BigInt):", sBigInt.toString());
console.log("CURVE_ORDER/2:", (CURVE_ORDER / BigInt(2)).toString());
console.log("S > CURVE_ORDER/2:", sBigInt > CURVE_ORDER / BigInt(2));

// Get public key
const xBytes = Buffer.from(py.step1_keypair.public_key_x_hex, 'hex');
const yBytes = Buffer.from(py.step1_keypair.public_key_y_hex, 'hex');
const pubBytes = Buffer.concat([Buffer.from([0x04]), xBytes, yBytes]);

console.log("\n=== Verification Tests ===");

// Test 1: Verify original signature
console.log("Verify original (R||S 64 bytes):", secp256k1.verify(pySig, contentHash, pubBytes));

// Test 2: Normalize S if needed
let normalizedS = s;
if (sBigInt > CURVE_ORDER / BigInt(2)) {
    const newS = CURVE_ORDER - sBigInt;
    normalizedS = Buffer.from(newS.toString(16).padStart(64, '0'), 'hex');
    console.log("S was high, normalized");
}

const normalizedSig = Buffer.concat([r, normalizedS]);
console.log("Verify normalized:", secp256k1.verify(normalizedSig, contentHash, pubBytes));

// Test 3: Use toCompactRawBytes format
const sigObj = {
    r: BigInt(`0x${r.toString('hex')}`),
    s: BigInt(`0x${s.toString('hex')}`),
    toCompactRawBytes: function() {
        const rBytes = Buffer.from(this.r.toString(16).padStart(64, '0'), 'hex');
        const sBytes = Buffer.from(this.s.toString(16).padStart(64, '0'), 'hex');
        return Buffer.concat([rBytes, sBytes]);
    }
};

const compact = sigObj.toCompactRawBytes();
console.log("Verify via toCompactRawBytes:", secp256k1.verify(compact, contentHash, pubBytes));

// Test 4: Check if signature has high-S
console.log("\n=== High-S Check ===");
console.log("Original S is high:", sBigInt > CURVE_ORDER / BigInt(2));

// If S is high, normalize it
if (sBigInt > CURVE_ORDER / BigInt(2)) {
    const newS = CURVE_ORDER - sBigInt;
    const newSBytes = Buffer.from(newS.toString(16).padStart(64, '0'), 'hex');
    const newSig = Buffer.concat([r, newSBytes]);
    console.log("Normalized S (hex):", newSBytes.toString('hex'));
    console.log("Verify normalized signature:", secp256k1.verify(newSig, contentHash, pubBytes));
}
