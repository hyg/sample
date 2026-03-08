/**
 * Node.js version step-by-step debug output.
 * Uses the SAME fixed private key as Python version for comparison.
 */

import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';
import crypto from 'crypto';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('Node.js Version: Step-by-Step Debug Output');
console.log('='.repeat(80));

// Use the SAME fixed private key as Python version
const TEST_PRIVATE_KEY_HEX = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

// Generate key pair from fixed private key
console.log('\n[Step 1] Generate Key Pair from Fixed Private Key');
console.log('-'.repeat(80));

const privateKeyBytes = Buffer.from(TEST_PRIVATE_KEY_HEX, 'hex');
const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, false);

console.log(`Private Key (hex): ${TEST_PRIVATE_KEY_HEX}`);
console.log(`Public Key X: ${publicKeyBytes.slice(1, 33).toString('hex')}`);
console.log(`Public Key Y: ${publicKeyBytes.slice(33, 65).toString('hex')}`);

// Calculate fingerprint using JWK Thumbprint (RFC 7638)
const x = publicKeyBytes.slice(1, 33);
const y = publicKeyBytes.slice(33, 65);
const xB64 = x.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const yB64 = y.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const canonicalInput = `{"crv":"secp256k1","kty":"EC","x":"${xB64}","y":"${yB64}"}`;
const fingerprintBytes = sha256(Buffer.from(canonicalInput, 'ascii'));
const fingerprintB64Url = Buffer.from(fingerprintBytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

const uniqueId = `k1_${fingerprintB64Url}`;
const did = `did:wba:awiki.ai:user:${uniqueId}`;

console.log(`\nDID: ${did}`);
console.log(`key-1 kid: ${fingerprintB64Url}`);

// Fixed nonce and timestamp (same as Python)
const testNonce = '00112233445566778899aabbccddeeff';
const testTimestamp = '2026-03-07T12:00:00Z';
const version = '1.1';
const didDomain = 'awiki.ai';
const serviceUrl = 'https://awiki.ai';

console.log('\n[Step 2] Generate Auth Header Parameters');
console.log('-'.repeat(80));

const nonce = testNonce;
const timestamp = testTimestamp;
const domainField = parseFloat(version) >= 1.1 ? 'aud' : 'service';

console.log(`nonce: ${nonce}`);
console.log(`timestamp: ${timestamp}`);
console.log(`domain_field: ${domainField}`);
console.log(`service_domain: ${didDomain}`);
console.log(`did: ${did}`);

// Construct data to sign
console.log('\n[Step 3] Construct Data to Sign');
console.log('-'.repeat(80));

const authData = {
    nonce,
    timestamp,
    [domainField]: didDomain,
    did
};

console.log(`data_to_sign: ${JSON.stringify(authData, null, 2)}`);

// JCS canonicalize
console.log('\n[Step 4] JCS Canonicalization');
console.log('-'.repeat(80));

const canonicalJson = canonicalize(authData);
console.log(`canonical_json: ${canonicalJson}`);
console.log(`canonical_json (hex): ${Buffer.from(canonicalJson, 'utf-8').toString('hex')}`);

// SHA-256 hash
console.log('\n[Step 5] SHA-256 Hash');
console.log('-'.repeat(80));

const contentHash = sha256(Buffer.from(canonicalJson, 'utf-8'));
console.log(`content_hash: ${Buffer.from(contentHash).toString('hex')}`);
console.log(`content_hash length: ${contentHash.length} bytes`);

// ECDSA signature
console.log('\n[Step 6] ECDSA secp256k1 Signature');
console.log('-'.repeat(80));

const signature = secp256k1.sign(contentHash, privateKeyBytes);
console.log(`r: ${signature.r.toString()}`);
console.log(`s: ${signature.s.toString()}`);

// Convert to R||S format (64 bytes)
console.log('\n[Step 7] Convert to R||S Format');
console.log('-'.repeat(80));

const rBytes = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
const sBytes = Buffer.from(signature.s.toString(16).padStart(64, '0'), 'hex');
const rsSignature = Buffer.concat([rBytes, sBytes]);

console.log(`r_bytes: ${rBytes.toString('hex')}`);
console.log(`s_bytes: ${sBytes.toString('hex')}`);
console.log(`rs_signature: ${rsSignature.toString('hex')}`);
console.log(`rs_signature length: ${rsSignature.length} bytes`);

// Check low-S
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const sIsHigh = signature.s > CURVE_ORDER / BigInt(2);
console.log(`\ns > CURVE_ORDER/2: ${sIsHigh}`);
console.log(`low-S normalization applied: ${sIsHigh}`);

// Base64URL encode
console.log('\n[Step 8] Base64URL Encode');
console.log('-'.repeat(80));

const signatureB64Url = rsSignature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
console.log(`signature_b64url: ${signatureB64Url}`);
console.log(`signature_b64url length: ${signatureB64Url.length} chars`);

// Build Authorization header
console.log('\n[Step 9] Build Authorization Header');
console.log('-'.repeat(80));

const authHeader = `DIDWba v="${version}", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureB64Url}"`;
console.log(`auth_header: ${authHeader}`);

// Verify signature
console.log('\n[Step 10] Verify Signature');
console.log('-'.repeat(80));

try {
    const isValid = secp256k1.verify(rsSignature, contentHash, publicKeyBytes);
    console.log(`Signature verification: ${isValid ? 'PASSED ✓' : 'FAILED ✗'}`);
} catch (e) {
    console.log(`Signature verification: FAILED ✗ - ${e.message}`);
}

// Save output
const output = {
    did,
    private_key_hex: TEST_PRIVATE_KEY_HEX,
    public_key_x_hex: publicKeyBytes.slice(1, 33).toString('hex'),
    public_key_y_hex: publicKeyBytes.slice(33, 65).toString('hex'),
    nonce,
    timestamp,
    domain_field: domainField,
    service_domain: didDomain,
    data_to_sign: authData,
    canonical_json: canonicalJson,
    canonical_json_hex: Buffer.from(canonicalJson, 'utf-8').toString('hex'),
    content_hash: Buffer.from(contentHash).toString('hex'),
    r: signature.r.toString(),
    s: signature.s.toString(),
    r_bytes_hex: rBytes.toString('hex'),
    s_bytes_hex: sBytes.toString('hex'),
    rs_signature_hex: rsSignature.toString('hex'),
    signature_b64url: signatureB64Url,
    auth_header: authHeader,
    s_is_high: sIsHigh
};

const outputDir = join(__dirname, '..', 'scripts', 'tests', 'python_output');
if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
}

const outputPath = join(outputDir, 'nodejs_step_by_step.json');
writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(`\nOutput saved to: ${outputPath}`);
console.log('\n' + '='.repeat(80));

// Compare with Python output
console.log('\n[Comparison] Python vs Node.js');
console.log('-'.repeat(80));

import { readFileSync } from 'fs';

try {
    const pythonOutput = JSON.parse(readFileSync(join(outputDir, 'python_step_by_step.json'), 'utf-8'));
    
    const comparisons = [
        { field: 'canonical_json_hex', label: 'Canonical JSON' },
        { field: 'content_hash', label: 'Content Hash' },
        { field: 'rs_signature_hex', label: 'R||S Signature' },
        { field: 'signature_b64url', label: 'Signature Base64URL' },
        { field: 'auth_header', label: 'Auth Header' }
    ];
    
    comparisons.forEach(({ field, label }) => {
        const match = output[field] === pythonOutput[field];
        console.log(`${label}: ${match ? '✓ MATCH' : '✗ DIFFER'}`);
        if (!match) {
            console.log(`  Python:  ${pythonOutput[field]?.substring(0, 80)}...`);
            console.log(`  Node.js: ${output[field]?.substring(0, 80)}...`);
        }
    });
} catch (e) {
    console.log(`Could not compare with Python output: ${e.message}`);
    console.log('Run Python script first: python scripts/debug_python_step_by_step.py');
}

console.log('\n' + '='.repeat(80));
