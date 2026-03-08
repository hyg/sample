/**
 * Unit tests for w3c_proof module.
 * 
 * Each test compares Node.js output with Python anp.proof output.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { secp256k1 } from '@noble/curves/secp256k1';

import {
    b64urlEncode,
    b64urlDecode,
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

// Load Python test data
const pyData = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));

// Helper to extract private key bytes from PEM
function extractPrivKeyBytes(pem) {
    const pemLines = pem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
    const privDer = Buffer.from(pemLines.join(''), 'base64');
    // PKCS#8 format: find the private key octet string (04 20)
    let privOffset = -1;
    for (let i = 0; i < privDer.length - 2; i++) {
        if (privDer[i] === 0x04 && privDer[i+1] === 0x20) {
            privOffset = i + 2;
            break;
        }
    }
    return privDer.slice(privOffset, privOffset + 32);
}

// Helper to build public key from x, y coordinates
function buildPubKey(xHex, yHex) {
    const pubX = Buffer.from(xHex, 'hex');
    const pubY = Buffer.from(yHex, 'hex');
    return Buffer.concat([Buffer.from([0x04]), pubX, pubY]);
}

describe('w3c_proof module', () => {
    
    describe('b64urlEncode / b64urlDecode', () => {
        it('should encode/decode matching Python output', () => {
            const pySigHex = pyData.step9_final_signature.base64url;
            const decoded = b64urlDecode(pySigHex);
            const reencoded = b64urlEncode(decoded);
            assert.strictEqual(reencoded, pySigHex, 'Base64url round-trip should match');
        });
        
        it('should handle padding correctly', () => {
            const testData = Buffer.from('Hello, World!');
            const encoded = b64urlEncode(testData);
            const decoded = b64urlDecode(encoded);
            assert.deepStrictEqual(decoded, testData);
        });
    });
    
    describe('canonicalize (JCS)', () => {
        it('should produce same canonical JSON as Python', () => {
            const pyCanonical = pyData.step5_canonical_json;
            const docToSign = pyData.step4_doc_to_sign;
            const nodeCanonical = canonicalize(docToSign).toString('utf-8');
            assert.strictEqual(nodeCanonical, pyCanonical, 'JCS canonicalization should match Python');
        });
        
        it('should handle nested objects', () => {
            const obj = { z: 1, a: { z: 'last', a: 'first' }, m: [3, 2, 1] };
            const canonical = canonicalize(obj).toString('utf-8');
            // JCS should sort keys alphabetically at each level
            assert.ok(canonical.indexOf('"a":') < canonical.indexOf('"m":'), 'Key "a" should come before "m"');
        });
    });
    
    describe('hashBytes', () => {
        it('should produce same hash as Python', () => {
            const pyHash = pyData.step6_content_hash_hex;
            const canonicalJson = pyData.step5_canonical_json;
            const nodeHash = hashBytes(canonicalJson).toString('hex');
            assert.strictEqual(nodeHash, pyHash, 'SHA-256 hash should match Python');
        });
    });
    
    describe('computeSigningInput', () => {
        it('should compute same signing input as Python', () => {
            const proofOptions = {
                type: pyData.step3_proof_params.type,
                created: pyData.step3_proof_params.created,
                verificationMethod: pyData.step3_proof_params.verificationMethod,
                proofPurpose: pyData.step3_proof_params.proofPurpose,
                domain: pyData.step3_proof_params.domain,
                challenge: pyData.step3_proof_params.challenge
            };
            
            const docWithoutProof = {};
            for (const key of Object.keys(pyData.step4_doc_to_sign)) {
                if (key !== 'proof') {
                    docWithoutProof[key] = pyData.step4_doc_to_sign[key];
                }
            }
            
            const toBeSigned = computeSigningInput(docWithoutProof, proofOptions);
            assert.strictEqual(toBeSigned.length, 64);
            
            const optionsHash = hashBytes(canonicalize(proofOptions));
            const docHash = hashBytes(canonicalize(docWithoutProof));
            const expected = Buffer.concat([optionsHash, docHash]);
            assert.deepStrictEqual(toBeSigned, expected);
        });
    });
    
    describe('signSecp256k1 / verifySecp256k1', () => {
        it('should sign and verify correctly', () => {
            const privBytes = secp256k1.utils.randomPrivateKey();
            const pubBytes = secp256k1.getPublicKey(privBytes, false);
            const data = Buffer.from('test data');
            const signature = signSecp256k1(privBytes, data);
            assert.strictEqual(signature.length, 64);
            const isValid = verifySecp256k1(pubBytes, data, signature);
            assert.ok(isValid, 'Signature should verify');
        });
        
        it('should reject invalid signatures', () => {
            const privBytes = secp256k1.utils.randomPrivateKey();
            const pubBytes = secp256k1.getPublicKey(privBytes, false);
            const data = Buffer.from('test data');
            const signature = signSecp256k1(privBytes, data);
            const tamperedData = Buffer.from('tampered data');
            const isValid = verifySecp256k1(pubBytes, tamperedData, signature);
            assert.ok(!isValid, 'Tampered data should fail verification');
        });
    });
    
    describe('generateW3cProof', () => {
        it('should generate proof matching Python output', () => {
            const privBytes = extractPrivKeyBytes(pyData.step1_keypair.private_key_pem);
            const pubBytes = buildPubKey(pyData.step1_keypair.public_key_x_hex, pyData.step1_keypair.public_key_y_hex);
            
            const docWithoutProof = {};
            for (const key of Object.keys(pyData.step4_doc_to_sign)) {
                if (key !== 'proof') {
                    docWithoutProof[key] = pyData.step4_doc_to_sign[key];
                }
            }
            
            const signedDoc = generateW3cProof(docWithoutProof, privBytes, {
                verificationMethod: pyData.step3_proof_params.verificationMethod,
                proofPurpose: pyData.step3_proof_params.proofPurpose,
                created: pyData.step3_proof_params.created,
                domain: pyData.step3_proof_params.domain,
                challenge: pyData.step3_proof_params.challenge
            });
            
            assert.ok(signedDoc.proof, 'Proof should be present');
            assert.strictEqual(signedDoc.proof.type, 'EcdsaSecp256k1Signature2019');
            assert.strictEqual(signedDoc.proof.verificationMethod, pyData.step3_proof_params.verificationMethod);
            assert.strictEqual(signedDoc.proof.proofPurpose, pyData.step3_proof_params.proofPurpose);
            assert.strictEqual(signedDoc.proof.proofValue.length, 86);
            
            const isValid = verifyW3cProof(signedDoc, pubBytes);
            assert.ok(isValid, 'Generated proof should verify');
        });
    });
    
    describe('verifyW3cProof', () => {
        it('should verify Python-generated proof', () => {
            const pubBytes = buildPubKey(pyData.step1_keypair.public_key_x_hex, pyData.step1_keypair.public_key_y_hex);
            
            const docWithoutProof = {};
            for (const key of Object.keys(pyData.step4_doc_to_sign)) {
                if (key !== 'proof') {
                    docWithoutProof[key] = pyData.step4_doc_to_sign[key];
                }
            }
            
            const docWithProof = {
                ...docWithoutProof,
                proof: {
                    type: pyData.step3_proof_params.type,
                    created: pyData.step3_proof_params.created,
                    verificationMethod: pyData.step3_proof_params.verificationMethod,
                    proofPurpose: pyData.step3_proof_params.proofPurpose,
                    domain: pyData.step3_proof_params.domain,
                    challenge: pyData.step3_proof_params.challenge,
                    proofValue: pyData.step9_final_signature.base64url
                }
            };
            
            const isValid = verifyW3cProof(docWithProof, pubBytes);
            assert.ok(isValid, 'Python-generated proof should verify');
        });
        
        it('should reject proof with wrong purpose', () => {
            const pubBytes = buildPubKey(pyData.step1_keypair.public_key_x_hex, pyData.step1_keypair.public_key_y_hex);
            
            const docWithoutProof = {};
            for (const key of Object.keys(pyData.step4_doc_to_sign)) {
                if (key !== 'proof') {
                    docWithoutProof[key] = pyData.step4_doc_to_sign[key];
                }
            }
            
            const docWithProof = {
                ...docWithoutProof,
                proof: {
                    type: 'EcdsaSecp256k1Signature2019',
                    created: pyData.step3_proof_params.created,
                    verificationMethod: pyData.step3_proof_params.verificationMethod,
                    proofPurpose: 'assertionMethod',
                    proofValue: pyData.step9_final_signature.base64url
                }
            };
            
            const isValid = verifyW3cProof(docWithProof, pubBytes, {
                expectedPurpose: 'authentication'
            });
            assert.ok(!isValid, 'Proof with wrong purpose should fail');
        });
    });
});

console.log('\nw3c_proof unit tests completed.');
