import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

const py = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));

function decodeBase64Url(str) {
    const padding = '='.repeat((4 - str.length % 4) % 4);
    return Buffer.from(str + padding, 'base64');
}

function base64urlToHex(b64) {
    return Buffer.from(b64, 'base64url').toString('hex');
}

console.log("=== Final Signature Verification Test ===\n");

// Get content hash
const contentHash = Buffer.from(py.step6_content_hash_hex, 'hex');
console.log("Content hash:", py.step6_content_hash_hex);

// Get Python signature
const pySig = decodeBase64Url(py.step9_final_signature.base64url);
console.log("Python signature:", py.step9_final_signature.base64url);

// Extract private key using crypto module (correct method)
const privateKey = crypto.createPrivateKey(py.step1_keypair.private_key_pem);
const jwk = privateKey.export({ format: 'jwk' });
const privBytes = Buffer.from(jwk.d, 'base64url');

console.log("\nPrivate key (hex):", privBytes.toString('hex'));

// Get public key
const pubX = Buffer.from(jwk.x, 'base64url');
const pubY = Buffer.from(jwk.y, 'base64url');
const pubBytes = Buffer.concat([Buffer.from([0x04]), pubX, pubY]);

console.log("Public key (hex):", pubBytes.toString('hex'));

// Sign with Node.js
const nodeSig = secp256k1.sign(contentHash, privBytes);

// Low-S normalization
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
let s = nodeSig.s;
if (s > CURVE_ORDER / BigInt(2)) {
    s = CURVE_ORDER - s;
}

const rBytes = Buffer.from(nodeSig.r.toString(16).padStart(64, '0'), 'hex');
const sBytes = Buffer.from(s.toString(16).padStart(64, '0'), 'hex');
const nodeSigCompact = Buffer.concat([rBytes, sBytes]);

console.log("\nNode.js signature:", nodeSigCompact.toString('base64url').replace(/=/g, ''));

// Verify both signatures
console.log("\n=== Verification ===");
console.log("Python signature verifies:", secp256k1.verify(pySig, contentHash, pubBytes));
console.log("Node.js signature verifies:", secp256k1.verify(nodeSigCompact, contentHash, pubBytes));

// Now test full registration flow
console.log("\n=== Testing Full Registration ===");

import canonicalize from 'canonicalize';
import axios from 'axios';

// Build DID document
const compressed = secp256k1.Point.fromHex(pubBytes).toRawBytes(true);
const kid = Buffer.from(sha256(compressed)).toString('base64url').replace(/=/g, '');
const did = `did:wba:awiki.ai:user:k1_${kid}`;

console.log("DID:", did);
console.log("kid:", kid);

const jwk_obj = {
    kty: 'EC',
    crv: 'secp256k1',
    x: Buffer.from(jwk.x, 'base64url').toString('base64url').replace(/=/g, ''),
    y: Buffer.from(jwk.y, 'base64url').toString('base64url').replace(/=/g, ''),
    kid: kid
};

const didDocument = {
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
        publicKeyJwk: jwk_obj
    }],
    authentication: [`${did}#key-1`]
};

// Create proof
const challenge = crypto.randomBytes(16).toString('hex');
const created = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const domain = 'awiki.ai';

const proof = {
    type: 'EcdsaSecp256k1Signature2019',
    verificationMethod: `${did}#key-1`,
    created: created,
    proofPurpose: 'authentication',
    domain: domain,
    challenge: challenge,
    proofValue: ''
};

const docToSign = JSON.parse(JSON.stringify(didDocument));
docToSign.proof = JSON.parse(JSON.stringify(proof));

const canonicalJson = canonicalize(docToSign);
const hash = sha256(canonicalJson);

const signature = secp256k1.sign(hash, privBytes);

// Low-S normalization
let sigS = signature.s;
if (sigS > CURVE_ORDER / BigInt(2)) {
    sigS = CURVE_ORDER - sigS;
}

const sigR = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
const sigSBytes = Buffer.from(sigS.toString(16).padStart(64, '0'), 'hex');
const sigCompact = Buffer.concat([sigR, sigSBytes]);

proof.proofValue = sigCompact.toString('base64url').replace(/=/g, '');
didDocument.proof = proof;

console.log("\nProof value:", proof.proofValue);

// Register
(async () => {
    try {
        const response = await axios.post('https://awiki.ai/user-service/did-auth/rpc', {
            jsonrpc: '2.0',
            method: 'register',
            params: {
                did_document: didDocument,
                name: 'NodeJSTest',
                is_agent: true
            },
            id: 1
        });
        
        if (response.data.error) {
            console.log("\nRegistration failed:");
            console.log("  Error:", response.data.error.message);
            if (response.data.error.data) {
                console.log("  Data:", JSON.stringify(response.data.error.data));
            }
        } else {
            console.log("\nSUCCESS! Registration completed!");
            console.log("  DID:", response.data.result.did);
            console.log("  User ID:", response.data.result.user_id);
        }
    } catch (error) {
        console.log("\nRequest failed:");
        console.log("  Error:", error.message);
        if (error.response) {
            console.log("  Status:", error.response.status);
            console.log("  Data:", error.response.data);
        }
    }
})();
