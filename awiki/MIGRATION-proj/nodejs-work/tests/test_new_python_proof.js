#!/usr/bin/env node

/**
 * Test Node.js proof generation against new Python version.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateW3cProof, verifyW3cProof, canonicalize, hashBytes, computeSigningInput } from '../src/w3c_proof.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

// Load Python test data
const pyData = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'new_python_test_vector.json'), 'utf-8'));

console.log('=== Testing Node.js Proof Generation vs New Python Version ===\n');

// Extract private key bytes from hex
const privBytes = Buffer.from(pyData.private_key_hex, 'hex');

// Build public key from JWK
const jwk = pyData.did_document.verificationMethod[0].publicKeyJwk;
const pubX = Buffer.from(jwk.x, 'base64url');
const pubY = Buffer.from(jwk.y, 'base64url');
const pubBytes = Buffer.concat([Buffer.from([0x04]), pubX, pubY]);

// Build document without proof
const docWithoutProof = {};
for (const key of Object.keys(pyData.did_document)) {
    if (key !== 'proof') {
        docWithoutProof[key] = pyData.did_document[key];
    }
}

// Generate proof with same parameters as Python
const signedDoc = generateW3cProof(docWithoutProof, privBytes, {
    verificationMethod: pyData.proof_options.verificationMethod,
    proofPurpose: pyData.proof_options.proofPurpose,
    created: pyData.proof_options.created,
    domain: pyData.proof_options.domain,
    challenge: pyData.proof_options.challenge
});

console.log('Python proofValue:', pyData.proof.proofValue);
console.log('Node.js proofValue:', signedDoc.proof.proofValue);
console.log('Match:', signedDoc.proof.proofValue === pyData.proof.proofValue);

// Verify toBeSigned
const nodeToBeSigned = computeSigningInput(docWithoutProof, pyData.proof_options);
console.log('\nPython toBeSigned:', pyData.to_be_signed_hex);
console.log('Node.js toBeSigned:', nodeToBeSigned.toString('hex'));
console.log('Match:', nodeToBeSigned.toString('hex') === pyData.to_be_signed_hex);

// Verify signatures
console.log('\n=== Signature Verification ===');
const pythonValid = verifyW3cProof(pyData.did_document, pubBytes);
console.log('Python proof valid:', pythonValid);

const nodeValid = verifyW3cProof(signedDoc, pubBytes);
console.log('Node.js proof valid:', nodeValid);

// Summary
console.log('\n=== Summary ===');
if (signedDoc.proof.proofValue === pyData.proof.proofValue &&
    nodeToBeSigned.toString('hex') === pyData.to_be_signed_hex &&
    pythonValid && nodeValid) {
    console.log('SUCCESS: Node.js proof generation matches Python!');
} else {
    console.log('MISMATCH: Node.js proof generation differs from Python');
    if (signedDoc.proof.proofValue !== pyData.proof.proofValue) {
        console.log('  - Signature values differ');
    }
    if (nodeToBeSigned.toString('hex') !== pyData.to_be_signed_hex) {
        console.log('  - toBeSigned values differ');
    }
    if (!pythonValid) {
        console.log('  - Python proof verification failed');
    }
    if (!nodeValid) {
        console.log('  - Node.js proof verification failed');
    }
}
