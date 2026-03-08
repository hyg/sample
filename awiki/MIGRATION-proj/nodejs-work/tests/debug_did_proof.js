#!/usr/bin/env node

/**
 * Debug DID proof generation by comparing with Python intermediate results.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import canonicalize from 'canonicalize';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Python output is in ../../scripts/tests/python_output
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

function encodeBase64Url(data) {
    if (Buffer.isBuffer(data)) {
        return data.toString('base64url').replace(/=/g, '');
    }
    return Buffer.from(data).toString('base64url').replace(/=/g, '');
}

console.log("=".repeat(70));
console.log("DID Proof Generation - Node.js Debug");
console.log("=".repeat(70));

// Load Python intermediate results
const pythonResults = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));

console.log("\n[Step 1] Generate secp256k1 key pair");
console.log("  Using Python's key for comparison...");
const privateKeyPem = pythonResults.step1_keypair.private_key_pem;
const privateKey = crypto.createPrivateKey(privateKeyPem);
const publicKey = crypto.createPublicKey(privateKeyPem);

console.log("  Expected kid:", pythonResults.step1_keypair.kid);

console.log("\n[Step 2] Build DID document");
const didDocument = pythonResults.step2_did_document.document;
console.log("  DID:", pythonResults.step2_did_document.did);

console.log("\n[Step 3] Create proof structure");
const proofParams = pythonResults.step3_proof_params;
console.log("  challenge:", proofParams.challenge);
console.log("  created:", proofParams.created);
console.log("  domain:", proofParams.domain);

console.log("\n[Step 4] Create document to sign");
const docToSign = pythonResults.step4_doc_to_sign;

console.log("\n[Step 5] JCS Canonicalize");
const nodeCanonical = canonicalize(docToSign);
const pythonCanonical = pythonResults.step5_canonical_json;

console.log("  Node.js canonical length:", nodeCanonical.length);
console.log("  Python canonical length:", pythonCanonical.length);
console.log("  Match:", nodeCanonical === pythonCanonical);

if (nodeCanonical !== pythonCanonical) {
    console.log("\n  !!! CANONICAL MISMATCH !!!");
    console.log("  Node.js first 200 chars:", nodeCanonical.substring(0, 200));
    console.log("  Python first 200 chars:", pythonCanonical.substring(0, 200));
}

console.log("\n[Step 6] Calculate SHA-256 hash");
const nodeHash = sha256(nodeCanonical);
const pythonHash = pythonResults.step6_content_hash_hex;

console.log("  Node.js hash:", Buffer.from(nodeHash).toString('hex'));
console.log("  Python hash:", pythonHash);
console.log("  Match:", Buffer.from(nodeHash).toString('hex') === pythonHash);

console.log("\n[Step 7] Sign with secp256k1");

// Extract private key bytes from PEM
const pemLines = privateKeyPem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
const privateKeyBytes = Buffer.from(pemLines.join(''), 'base64');
// PKCS#8 format: last 32 bytes are the actual key
const keyBytes = privateKeyBytes.slice(-32);

console.log("  Private key bytes (hex):", keyBytes.toString('hex'));

const nodeSignature = secp256k1.sign(nodeHash, keyBytes);

const r = nodeSignature.r;
let s = nodeSignature.s;

console.log("  Node.js R:", r.toString(16).padStart(64, '0'));
console.log("  Node.js S:", s.toString(16).padStart(64, '0'));
console.log("  Python R:", pythonResults.step7_signature.r_hex);
console.log("  Python S (normalized):", pythonResults.step7_signature.s_normalized_hex);

console.log("\n[Step 8] Low-S normalization");
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const normalizedS = s > CURVE_ORDER / BigInt(2) ? CURVE_ORDER - s : s;

console.log("  Original S:", s.toString());
console.log("  CURVE_ORDER/2:", (CURVE_ORDER / BigInt(2)).toString());
console.log("  Normalized S:", normalizedS.toString());
console.log("  Was normalized:", s > CURVE_ORDER / BigInt(2));
console.log("  Python was normalized:", pythonResults.step8_low_s_normalization.was_normalized);

const rBytes = Buffer.from(r.toString(16).padStart(64, '0'), 'hex');
const sBytes = Buffer.from(normalizedS.toString(16).padStart(64, '0'), 'hex');
const signatureRs = Buffer.concat([rBytes, sBytes]);
const signatureB64Url = encodeBase64Url(signatureRs);

console.log("\n[Step 9] Final signature");
console.log("  Node.js signature (base64url):", signatureB64Url);
console.log("  Python signature (base64url):", pythonResults.step9_final_signature.base64url);
console.log("  Match:", signatureB64Url === pythonResults.step9_final_signature.base64url);

console.log("\n" + "=".repeat(70));
if (nodeCanonical === pythonCanonical && 
    Buffer.from(nodeHash).toString('hex') === pythonHash && 
    signatureB64Url === pythonResults.step9_final_signature.base64url) {
    console.log("SUCCESS: All steps match Python output!");
} else {
    console.log("MISMATCH: Some steps don't match Python output");
}
console.log("=".repeat(70));
