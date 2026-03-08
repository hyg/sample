#!/usr/bin/env node

/**
 * Debug signature verification.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { secp256k1 } from '@noble/curves/secp256k1';
import { b64urlDecode, computeSigningInput } from '../src/w3c_proof.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

// Load Python test data
const pyData = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'new_python_test_vector.json'), 'utf-8'));

console.log('=== Debug Signature Verification ===\n');

// Build public key from JWK
const jwk = pyData.did_document.verificationMethod[0].publicKeyJwk;

function base64urlDecode(str) {
    const padding = '='.repeat((4 - str.length % 4) % 4);
    return Buffer.from(str + padding, 'base64');
}

const pubX = base64urlDecode(jwk.x);
const pubY = base64urlDecode(jwk.y);
const pubBytes = Buffer.concat([Buffer.from([0x04]), pubX, pubY]);

console.log('Public key (hex):', pubBytes.toString('hex'));

// Build document without proof
const docWithoutProof = {};
for (const key of Object.keys(pyData.did_document)) {
    if (key !== 'proof') {
        docWithoutProof[key] = pyData.did_document[key];
    }
}

// Compute toBeSigned
const toBeSigned = computeSigningInput(docWithoutProof, pyData.proof_options);
console.log('\nToBeSigned:', toBeSigned.toString('hex'));

// Decode Python signature
const pySigBytes = b64urlDecode(pyData.proof.proofValue);
console.log('\nPython signature:', pySigBytes.toString('hex'));

// Verify with noble-curves
const pyValid = secp256k1.verify(pySigBytes, toBeSigned, pubBytes);
console.log('\nPython signature (noble-curves):', pyValid ? 'VALID' : 'INVALID');

// Check S value
const r = pySigBytes.slice(0, 32);
const s = pySigBytes.slice(32, 64);
const sBigInt = BigInt('0x' + s.toString('hex'));
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

console.log('\nS > CURVE_ORDER/2:', sBigInt > CURVE_ORDER / BigInt(2));

// Try with normalized S
let normalizedS = s;
if (sBigInt > CURVE_ORDER / BigInt(2)) {
    const newS = CURVE_ORDER - sBigInt;
    normalizedS = Buffer.from(newS.toString(16).padStart(64, '0'), 'hex');
}

const normalizedSig = Buffer.concat([r, normalizedS]);
const normalizedValid = secp256k1.verify(normalizedSig, toBeSigned, pubBytes);
console.log('Normalized signature (noble-curves):', normalizedValid ? 'VALID' : 'INVALID');

// Also verify Node.js generated signature
console.log('\n=== Node.js Generated Signature ===');

import { generateW3cProof, verifyW3cProof } from '../src/w3c_proof.js';

// Extract private key
const privBytes = Buffer.from(pyData.private_key_hex, 'hex');

const signedDoc = generateW3cProof(docWithoutProof, privBytes, {
    verificationMethod: pyData.proof_options.verificationMethod,
    proofPurpose: pyData.proof_options.proofPurpose,
    created: pyData.proof_options.created,
    domain: pyData.proof_options.domain,
    challenge: pyData.proof_options.challenge
});

const nodeSigBytes = b64urlDecode(signedDoc.proof.proofValue);
console.log('Node.js signature:', nodeSigBytes.toString('hex'));

const nodeValid = secp256k1.verify(nodeSigBytes, toBeSigned, pubBytes);
console.log('Node.js signature (noble-curves):', nodeValid ? 'VALID' : 'INVALID');

// Verify with verifyW3cProof
const pyVerifyResult = verifyW3cProof(pyData.did_document, pubBytes);
const nodeVerifyResult = verifyW3cProof(signedDoc, pubBytes);

console.log('\nverifyW3cProof results:');
console.log('  Python proof:', pyVerifyResult);
console.log('  Node.js proof:', nodeVerifyResult);
