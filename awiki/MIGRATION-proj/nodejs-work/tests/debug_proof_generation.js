#!/usr/bin/env node

/**
 * Debug proof generation: compare every byte with Python output.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { canonicalize, hashBytes, signSecp256k1, b64urlEncode } from '../src/w3c_proof.js';
import { createIdentity } from '../src/utils/identity.js';
import { createSDKConfig } from '../src/utils/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

console.log('='.repeat(80));
console.log('Debug Proof Generation - Byte-by-Byte Comparison');
console.log('='.repeat(80));

// Load Python test vectors
const pyVectors = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'w3c_proof_step_by_step.json'), 'utf-8'));

console.log('\n[Step 1] Document Canonical');
console.log('-'.repeat(40));

const nodeDocCanonical = canonicalize(pyVectors.input.document);
const pyDocCanonical = Buffer.from(pyVectors.step1_canonicalization.doc_canonical_hex, 'hex');

console.log(`Python length: ${pyDocCanonical.length}`);
console.log(`Node.js length: ${nodeDocCanonical.length}`);
console.log(`Match: ${nodeDocCanonical.toString('hex') === pyDocCanonical.toString('hex')}`);

if (nodeDocCanonical.toString('hex') !== pyDocCanonical.toString('hex')) {
    console.log('\nDifferences:');
    console.log('Python:', pyDocCanonical.toString('utf-8'));
    console.log('Node.js:', nodeDocCanonical.toString('utf-8'));
}

console.log('\n[Step 2] Options Canonical');
console.log('-'.repeat(40));

const nodeOptionsCanonical = canonicalize(pyVectors.input.proof_options);
const pyOptionsCanonical = Buffer.from(pyVectors.step1_canonicalization.options_canonical_hex, 'hex');

console.log(`Python: ${pyOptionsCanonical.toString('utf-8')}`);
console.log(`Node.js: ${nodeOptionsCanonical.toString('utf-8')}`);
console.log(`Match: ${nodeOptionsCanonical.toString('hex') === pyOptionsCanonical.toString('hex')}`);

console.log('\n[Step 3] Hashes');
console.log('-'.repeat(40));

const nodeDocHash = hashBytes(nodeDocCanonical);
const pyDocHash = Buffer.from(pyVectors.step2_hashing.doc_hash_hex, 'hex');

console.log(`Document hash match: ${nodeDocHash.toString('hex') === pyDocHash.toString('hex')}`);

const nodeOptionsHash = hashBytes(nodeOptionsCanonical);
const pyOptionsHash = Buffer.from(pyVectors.step2_hashing.options_hash_hex, 'hex');

console.log(`Options hash match: ${nodeOptionsHash.toString('hex') === pyOptionsHash.toString('hex')}`);

console.log('\n[Step 4] toBeSigned');
console.log('-'.repeat(40));

const nodeToBeSigned = Buffer.concat([nodeOptionsHash, nodeDocHash]);
const pyToBeSigned = Buffer.from(pyVectors.step3_signing_input.to_be_signed_hex, 'hex');

console.log(`Python: ${pyToBeSigned.toString('hex')}`);
console.log(`Node.js: ${nodeToBeSigned.toString('hex')}`);
console.log(`Match: ${nodeToBeSigned.toString('hex') === pyToBeSigned.toString('hex')}`);

console.log('\n[Step 5] Signature (using Python private key)');
console.log('-'.repeat(40));

const privateKeyBytes = Buffer.from(pyVectors.step4_signing.private_key_hex, 'hex');

// Sign with Node.js
const nodeSignature = signSecp256k1(privateKeyBytes, nodeToBeSigned);
const pySignature = Buffer.from(pyVectors.step4_signing.rs_signature_normalized_hex, 'hex');

console.log(`Python signature: ${pySignature.toString('hex')}`);
console.log(`Node.js signature: ${nodeSignature.toString('hex')}`);
console.log(`Match: ${nodeSignature.toString('hex') === pySignature.toString('hex')}`);

console.log('\nNote: Signatures will differ due to ECDSA non-determinism.');
console.log('Both should verify correctly.');

console.log('\n[Step 6] Base64URL Encoding (of Python signature)');
console.log('-'.repeat(40));

const nodeProofValue = b64urlEncode(pySignature);
const pyProofValue = pyVectors.step5_base64url.proof_value;

console.log(`Python proofValue: ${pyProofValue}`);
console.log(`Node.js proofValue: ${nodeProofValue}`);
console.log(`Match: ${nodeProofValue === pyProofValue}`);

console.log('\n' + '='.repeat(80));
console.log('Summary: All deterministic steps should match.');
console.log('='.repeat(80));

// Save debug output
const debugOutput = {
    doc_canonical_match: nodeDocCanonical.toString('hex') === pyDocCanonical.toString('hex'),
    options_canonical_match: nodeOptionsCanonical.toString('hex') === pyOptionsCanonical.toString('hex'),
    doc_hash_match: nodeDocHash.toString('hex') === pyDocHash.toString('hex'),
    options_hash_match: nodeOptionsHash.toString('hex') === pyOptionsHash.toString('hex'),
    to_be_signed_match: nodeToBeSigned.toString('hex') === pyToBeSigned.toString('hex'),
    proof_value_match: nodeProofValue === pyProofValue
};

writeFileSync(join(__dirname, 'debug_proof_comparison.json'), JSON.stringify(debugOutput, null, 2));
console.log('\nDebug output saved to debug_proof_comparison.json');
