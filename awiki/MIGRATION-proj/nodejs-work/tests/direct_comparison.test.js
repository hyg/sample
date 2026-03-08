/**
 * Direct comparison test: Node.js vs Python W3C proof generation.
 * Uses the SAME test vectors from Python to ensure byte-for-byte match.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
    b64urlEncode,
    canonicalize,
    hashBytes,
    signSecp256k1,
    verifySecp256k1,
    computeSigningInput,
    generateW3cProof,
    verifyW3cProof
} from '../src/w3c_proof.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

console.log('='.repeat(80));
console.log('Node.js vs Python W3C Proof - Byte-for-Byte Comparison');
console.log('='.repeat(80));

// Load Python test vectors
const pyVectors = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'w3c_proof_step_by_step.json'), 'utf-8'));

console.log('\n[Step 1] JCS Canonicalization Comparison');
console.log('-'.repeat(40));

// Test document canonicalization
const nodeDocCanonical = canonicalize(pyVectors.input.document);
const pyDocCanonical = Buffer.from(pyVectors.step1_canonicalization.doc_canonical_hex, 'hex');

console.log(`Python canonical length: ${pyDocCanonical.length} bytes`);
console.log(`Node.js canonical length: ${nodeDocCanonical.length} bytes`);
console.log(`Match: ${nodeDocCanonical.toString('hex') === pyDocCanonical.toString('hex') ? 'YES ✓' : 'NO ✗'}`);

if (nodeDocCanonical.toString('hex') !== pyDocCanonical.toString('hex')) {
    console.log('\nPython canonical:');
    console.log(pyDocCanonical.toString('utf-8'));
    console.log('\nNode.js canonical:');
    console.log(nodeDocCanonical.toString('utf-8'));
}

// Test options canonicalization
const nodeOptionsCanonical = canonicalize(pyVectors.input.proof_options);
const pyOptionsCanonical = Buffer.from(pyVectors.step1_canonicalization.options_canonical_hex, 'hex');

console.log(`\nOptions canonical match: ${nodeOptionsCanonical.toString('hex') === pyOptionsCanonical.toString('hex') ? 'YES ✓' : 'NO ✗'}`);

console.log('\n[Step 2] SHA-256 Hash Comparison');
console.log('-'.repeat(40));

const nodeDocHash = hashBytes(nodeDocCanonical);
const pyDocHash = Buffer.from(pyVectors.step2_hashing.doc_hash_hex, 'hex');

console.log(`Document hash match: ${nodeDocHash.toString('hex') === pyDocHash.toString('hex') ? 'YES ✓' : 'NO ✗'}`);

const nodeOptionsHash = hashBytes(nodeOptionsCanonical);
const pyOptionsHash = Buffer.from(pyVectors.step2_hashing.options_hash_hex, 'hex');

console.log(`Options hash match: ${nodeOptionsHash.toString('hex') === pyOptionsHash.toString('hex') ? 'YES ✓' : 'NO ✗'}`);

console.log('\n[Step 3] Signing Input Comparison');
console.log('-'.repeat(40));

const nodeToBeSigned = computeSigningInput(pyVectors.input.document, pyVectors.input.proof_options);
const pyToBeSigned = Buffer.from(pyVectors.step3_signing_input.to_be_signed_hex, 'hex');

console.log(`toBeSigned match: ${nodeToBeSigned.toString('hex') === pyToBeSigned.toString('hex') ? 'YES ✓' : 'NO ✗'}`);
console.log(`toBeSigned length: ${nodeToBeSigned.length} bytes (expected ${pyToBeSigned.length})`);

console.log('\n[Step 4] ECDSA Signature Comparison');
console.log('-'.repeat(40));

// Use the SAME private key as Python
const privateKeyBytes = Buffer.from(pyVectors.step4_signing.private_key_hex, 'hex');

// Sign with Node.js
const nodeSignature = signSecp256k1(privateKeyBytes, nodeToBeSigned);
const pySignature = Buffer.from(pyVectors.step4_signing.rs_signature_normalized_hex, 'hex');

console.log(`Python signature: ${pySignature.toString('hex')}`);
console.log(`Node.js signature: ${nodeSignature.toString('hex')}`);
console.log(`Signature match: ${nodeSignature.toString('hex') === pySignature.toString('hex') ? 'YES ✓' : 'NO ✗'}`);

// Note: ECDSA signatures are non-deterministic (different k values)
// So signatures will differ, but both should verify
console.log('\nNote: ECDSA signatures are non-deterministic, so they will differ.');
console.log('What matters is that both signatures verify correctly.');

console.log('\n[Step 5] Base64URL Encoding Comparison');
console.log('-'.repeat(40));

// Test with Python's signature
const nodeProofValue = b64urlEncode(pySignature);
const pyProofValue = pyVectors.step5_base64url.proof_value;

console.log(`Python proofValue: ${pyProofValue}`);
console.log(`Node.js proofValue: ${nodeProofValue}`);
console.log(`proofValue match: ${nodeProofValue === pyProofValue ? 'YES ✓' : 'NO ✗'}`);
console.log(`proofValue length: ${nodeProofValue.length} chars (expected ${pyProofValue.length})`);

console.log('\n[Step 6] Complete Proof Generation Comparison');
console.log('-'.repeat(40));

// Generate proof with Node.js using fixed values
const nodeProofDoc = generateW3cProof(pyVectors.input.document, privateKeyBytes, {
    verificationMethod: pyVectors.input.proof_options.verificationMethod,
    proofPurpose: pyVectors.input.proof_options.proofPurpose,
    created: pyVectors.input.proof_options.created,
    domain: pyVectors.input.proof_options.domain,
    challenge: pyVectors.input.proof_options.challenge
});

console.log(`Node.js proofValue: ${nodeProofDoc.proof.proofValue}`);
console.log(`Python proofValue: ${pyVectors.step6_complete_proof.proof.proofValue}`);

// Note: Signatures will differ due to non-determinism
console.log('\nNote: proofValue will differ due to ECDSA non-determinism.');

console.log('\n[Step 7] Verification Comparison');
console.log('-'.repeat(40));

// Verify Python's proof with Node.js
const pyPublicKeyHex = pyVectors.step4_signing.public_key_x_hex + pyVectors.step4_signing.public_key_y_hex;
const pyPublicKey = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(pyVectors.step4_signing.public_key_x_hex, 'hex'),
    Buffer.from(pyVectors.step4_signing.public_key_y_hex, 'hex')
]);

// Verify Python's signature with Node.js
const pySigVerify = verifySecp256k1(pyPublicKey, nodeToBeSigned, pySignature);
console.log(`Python signature verification (Node.js): ${pySigVerify ? 'VALID ✓' : 'INVALID ✗'}`);

// Verify Node.js's generated proof
const nodeProofVerify = verifyW3cProof(nodeProofDoc, pyPublicKey);
console.log(`Node.js proof verification: ${nodeProofVerify ? 'VALID ✓' : 'INVALID ✗'}`);

// Verify Python's proof (from step_by_step)
const pyProofVerify = verifyW3cProof({
    ...pyVectors.input.document,
    proof: pyVectors.step6_complete_proof.proof
}, pyPublicKey);
console.log(`Python proof verification (Node.js): ${pyProofVerify ? 'VALID ✓' : 'INVALID ✗'}`);

console.log('\n' + '='.repeat(80));
console.log('Summary');
console.log('='.repeat(80));

const allMatch = 
    nodeDocCanonical.toString('hex') === pyDocCanonical.toString('hex') &&
    nodeOptionsCanonical.toString('hex') === pyOptionsCanonical.toString('hex') &&
    nodeDocHash.toString('hex') === pyDocHash.toString('hex') &&
    nodeOptionsHash.toString('hex') === pyOptionsHash.toString('hex') &&
    nodeToBeSigned.toString('hex') === pyToBeSigned.toString('hex') &&
    nodeProofValue === pyProofValue &&
    pySigVerify &&
    nodeProofVerify &&
    pyProofVerify;

if (allMatch) {
    console.log('✓ ALL DETERMINISTIC STEPS MATCH!');
    console.log('✓ Node.js implementation is byte-for-byte compatible with Python!');
    console.log('✓ If Python can register with awiki.ai, Node.js should also work!');
} else {
    console.log('✗ Some steps do not match. Check the output above.');
}

console.log('='.repeat(80));
