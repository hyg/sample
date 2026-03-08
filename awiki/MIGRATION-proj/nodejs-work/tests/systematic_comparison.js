#!/usr/bin/env node

/**
 * Systematic comparison of Python and Node.js DID proof generation.
 * For deterministic steps: use same input, compare output
 * For random steps: compare format/structure only
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import canonicalize from 'canonicalize';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

function encodeBase64Url(data) {
    if (Buffer.isBuffer(data)) {
        return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    return Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decodeBase64Url(str) {
    const padding = '='.repeat((4 - str.length % 4) % 4);
    return Buffer.from(str + padding, 'base64');
}

// Load Python intermediate results
const py = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));

console.log("=".repeat(70));
console.log("Systematic Python vs Node.js DID Proof Comparison");
console.log("=".repeat(70));

let allPassed = true;

function test(name, passed, details = '') {
    const status = passed ? '✓ PASS' : '✗ FAIL';
    console.log(`\n[${status}] ${name}`);
    if (details) console.log(`  ${details}`);
    if (!passed) allPassed = false;
    return passed;
}

// ============================================================
// Step 1: Key Pair Generation (RANDOM - compare format only)
// ============================================================
console.log("\n" + "=".repeat(70));
console.log("Step 1: Key Pair Generation (RANDOM - format comparison only)");
console.log("=".repeat(70));

// Python values
const pyPrivKeyHex = py.step1_keypair.public_key_x_hex;
const pyPubKeyX = py.step1_keypair.public_key_x_hex;
const pyPubKeyY = py.step1_keypair.public_key_y_hex;
const pyKid = py.step1_keypair.kid;

test("Python key format", 
    pyPubKeyX.length === 64 && pyPubKeyY.length === 64,
    `X: ${pyPubKeyX.length} hex chars, Y: ${pyPubKeyY.length} hex chars`);

test("Python kid format", 
    pyKid.length === 43, // base64url of SHA256 (32 bytes) = 43 chars
    `kid length: ${pyKid.length} chars`);

// Generate Node.js key
const keyPair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    publicKeyEncoding: { format: 'pem', type: 'spki' }
});

// Extract public key bytes from PEM
const pubPemLines = keyPair.publicKey.split('\n').filter(l => !l.startsWith('-----') && l.trim());
const pubDer = Buffer.from(pubPemLines.join(''), 'base64');
const nodePubBytes = pubDer.slice(-65); // Last 65 bytes

test("Node.js key format", 
    nodePubBytes.length === 65 && nodePubBytes[0] === 0x04,
    `Public key: ${nodePubBytes.length} bytes, starts with 0x04: ${nodePubBytes[0] === 0x04}`);

// ============================================================
// Step 2-4: DID Document Structure (DETERMINISTIC)
// ============================================================
console.log("\n" + "=".repeat(70));
console.log("Step 2-4: DID Document Structure (DETERMINISTIC)");
console.log("=".repeat(70));

// Use Python's exact values for deterministic comparison
const xBytes = Buffer.from(pyPubKeyX, 'hex');
const yBytes = Buffer.from(pyPubKeyY, 'hex');
const publicKeyBytes = Buffer.concat([Buffer.from([0x04]), xBytes, yBytes]);

// Calculate kid from compressed public key
const point = secp256k1.Point.fromHex(publicKeyBytes);
const compressed = point.toRawBytes(true);
const nodeKid = encodeBase64Url(sha256(compressed));

test("kid calculation", 
    nodeKid === pyKid,
    `Python: ${pyKid}\nNode.js:  ${nodeKid}`);

// Build JWK
const nodeJwkX = encodeBase64Url(xBytes);
const nodeJwkY = encodeBase64Url(yBytes);

test("JWK x encoding", 
    nodeJwkX === py.step2_did_document.document.verificationMethod[0].publicKeyJwk.x,
    `Python: ${py.step2_did_document.document.verificationMethod[0].publicKeyJwk.x}\nNode.js:  ${nodeJwkX}`);

test("JWK y encoding", 
    nodeJwkY === py.step2_did_document.document.verificationMethod[0].publicKeyJwk.y,
    `Python: ${py.step2_did_document.document.verificationMethod[0].publicKeyJwk.y}\nNode.js:  ${nodeJwkY}`);

// ============================================================
// Step 5: JCS Canonicalization (DETERMINISTIC)
// ============================================================
console.log("\n" + "=".repeat(70));
console.log("Step 5: JCS Canonicalization (DETERMINISTIC)");
console.log("=".repeat(70));

const docToSign = py.step4_doc_to_sign;
const nodeCanonical = canonicalize(docToSign);
const pyCanonical = py.step5_canonical_json;

test("Canonical JSON length", 
    nodeCanonical.length === pyCanonical.length,
    `Python: ${pyCanonical.length} bytes\nNode.js:  ${nodeCanonical.length} bytes`);

test("Canonical JSON exact match", 
    nodeCanonical === pyCanonical,
    nodeCanonical === pyCanonical ? 'Match!' : `First diff at position ${findFirstDiff(nodeCanonical, pyCanonical)}`);

// ============================================================
// Step 6: SHA-256 Hash (DETERMINISTIC)
// ============================================================
console.log("\n" + "=".repeat(70));
console.log("Step 6: SHA-256 Hash (DETERMINISTIC)");
console.log("=".repeat(70));

const nodeHash = sha256(nodeCanonical);
const pyHash = py.step6_content_hash_hex;

test("SHA-256 hash", 
    Buffer.from(nodeHash).toString('hex') === pyHash,
    `Python:  ${pyHash}\nNode.js:  ${Buffer.from(nodeHash).toString('hex')}`);

// ============================================================
// Step 7-8: ECDSA Signing (RANDOM - verify with public key)
// ============================================================
console.log("\n" + "=".repeat(70));
console.log("Step 7-8: ECDSA Signing (RANDOM - verify format)");
console.log("=".repeat(70));

// Decode Python signature
const pySig = decodeBase64Url(py.step9_final_signature.base64url);
const pyR = pySig.slice(0, 32);
const pyS = pySig.slice(32, 64);

test("Python signature format", 
    pySig.length === 64,
    `Signature length: ${pySig.length} bytes (expected 64)`);

// Verify Python signature using secp256k1
const pyValid = secp256k1.verify(pySig, nodeHash, publicKeyBytes);
test("Python signature verifies", 
    pyValid,
    pyValid ? 'Signature is valid' : 'Signature verification FAILED');

// Sign with Node.js using Python's private key
const pemLines = py.step1_keypair.private_key_pem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
const privDer = Buffer.from(pemLines.join(''), 'base64');
const privKeyBytes = privDer.slice(-32);

const nodeSig = secp256k1.sign(nodeHash, privKeyBytes);

// Low-S normalization
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
let s = nodeSig.s;
if (s > CURVE_ORDER / BigInt(2)) {
    s = CURVE_ORDER - s;
}

const rBytes = Buffer.from(nodeSig.r.toString(16).padStart(64, '0'), 'hex');
const sBytes = Buffer.from(s.toString(16).padStart(64, '0'), 'hex');
const nodeSigCompact = Buffer.concat([rBytes, sBytes]);

test("Node.js signature format", 
    nodeSigCompact.length === 64,
    `Signature length: ${nodeSigCompact.length} bytes (expected 64)`);

// Verify Node.js signature
const nodeValid = secp256k1.verify(nodeSigCompact, nodeHash, publicKeyBytes);
test("Node.js signature verifies", 
    nodeValid,
    nodeValid ? 'Signature is valid' : 'Signature verification FAILED');

// ============================================================
// Summary
// ============================================================
console.log("\n" + "=".repeat(70));
if (allPassed) {
    console.log("SUCCESS: All deterministic steps match!");
    console.log("The DID proof generation is compatible.");
} else {
    console.log("FAILURE: Some steps don't match.");
    console.log("Check the failed tests above.");
}
console.log("=".repeat(70));

function findFirstDiff(a, b) {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        if (a[i] !== b[i]) return i;
    }
    return len;
}
