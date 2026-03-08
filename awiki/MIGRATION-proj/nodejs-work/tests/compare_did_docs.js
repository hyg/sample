#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

function encodeBase64Url(data) {
    if (Buffer.isBuffer(data)) {
        return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    return Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Load Python results
const pythonResults = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));
const pythonDoc = pythonResults.final_did_document;

console.log("=== Python DID Document ===");
console.log("DID:", pythonDoc.id);
console.log("kid:", pythonDoc.verificationMethod[0].publicKeyJwk.kid);
console.log("JWK x:", pythonDoc.verificationMethod[0].publicKeyJwk.x);
console.log("JWK y:", pythonDoc.verificationMethod[0].publicKeyJwk.y);

// Generate Node.js version with same key
const pemLines = pythonResults.step1_keypair.private_key_pem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
const privateKeyBytes = Buffer.from(pemLines.join(''), 'base64').slice(-32);

// Get public key from private key
const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, false);

console.log("\n=== Node.js DID Document ===");

const x = publicKeyBytes.slice(1, 33);
const y = publicKeyBytes.slice(33, 65);

// Calculate kid from compressed
const point = secp256k1.Point.fromHex(publicKeyBytes);
const compressed = point.toRawBytes(true);
const kid = encodeBase64Url(sha256(compressed));

console.log("kid:", kid);
console.log("JWK x:", encodeBase64Url(x));
console.log("JWK y:", encodeBase64Url(y));

console.log("\n=== Comparison ===");
console.log("kid match:", kid === pythonDoc.verificationMethod[0].publicKeyJwk.kid);
console.log("x match:", encodeBase64Url(x) === pythonDoc.verificationMethod[0].publicKeyJwk.x);
console.log("y match:", encodeBase64Url(y) === pythonDoc.verificationMethod[0].publicKeyJwk.y);

// Build Node.js DID document
const did = `did:wba:awiki.ai:user:k1_${kid}`;
const nodeDoc = {
    '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/jws-2020/v1',
        'https://w3id.org/security/suites/secp256k1-2019/v1'
    ],
    id: did,
    verificationMethod: [{
        id: `${did}#key-1`,
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: did,
        publicKeyJwk: {
            kty: 'EC',
            crv: 'secp256k1',
            x: encodeBase64Url(x),
            y: encodeBase64Url(y),
            kid: kid
        }
    }],
    authentication: [`${did}#key-1`]
};

// Compare canonical forms
const pythonCanonical = pythonResults.step5_canonical_json;
const nodeDocToSign = JSON.parse(JSON.stringify(nodeDoc));
nodeDocToSign.proof = JSON.parse(JSON.stringify(pythonDoc.proof));
nodeDocToSign.proof.proofValue = '';

const nodeCanonical = canonicalize(nodeDocToSign);

console.log("\n=== Canonical JSON Comparison ===");
console.log("Python length:", pythonCanonical.length);
console.log("Node.js length:", nodeCanonical.length);
console.log("Match:", pythonCanonical === nodeCanonical);

if (pythonCanonical !== nodeCanonical) {
    console.log("\nPython first 300 chars:");
    console.log(pythonCanonical.substring(0, 300));
    console.log("\nNode.js first 300 chars:");
    console.log(nodeCanonical.substring(0, 300));
}
