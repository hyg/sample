#!/usr/bin/env node

/**
 * Test W3C proof generation matching Python output.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { generateW3cProof, verifyW3cProof } from '../src/w3c_proof.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

const py = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));

console.log("=== Testing W3C Proof Generation ===\n");

// Extract private key from PEM
const privateKey = crypto.createPrivateKey(py.step1_keypair.private_key_pem);
const jwk = privateKey.export({ format: 'jwk' });
const privBytes = Buffer.from(jwk.d, 'base64url');

// Get document without proof (step 4)
const docToSign = py.step4_doc_to_sign;
// Remove proof field
const { proof, ...docWithoutProof } = docToSign;

// Proof options from Python
const proofOptions = {
    verificationMethod: py.step3_proof_params.verificationMethod,
    proofPurpose: py.step3_proof_params.proofPurpose,
    created: py.step3_proof_params.created,
    domain: py.step3_proof_params.domain,
    challenge: py.step3_proof_params.challenge
};

console.log("Document ID:", docWithoutProof.id);
console.log("Proof options:", JSON.stringify(proofOptions, null, 2));

// Generate proof using Node.js
const signedDoc = generateW3cProof(docWithoutProof, privBytes, proofOptions);

console.log("\n=== Comparison ===");
console.log("Python proofValue:", py.step9_final_signature.base64url);
console.log("Node.js proofValue:", signedDoc.proof.proofValue);
console.log("Match:", signedDoc.proof.proofValue === py.step9_final_signature.base64url);

// Verify both signatures
const pubX = Buffer.from(jwk.x, 'base64url');
const pubY = Buffer.from(jwk.y, 'base64url');
const pubBytes = Buffer.concat([Buffer.from([0x04]), pubX, pubY]);

console.log("\n=== Verification ===");
console.log("Python signature valid:", verifyW3cProof({ ...docWithoutProof, proof: { ...proofOptions, proofValue: py.step9_final_signature.base64url } }, pubBytes));
console.log("Node.js signature valid:", verifyW3cProof(signedDoc, pubBytes));
