/**
 * Node.js version step-by-step debug output.
 * Uses the SAME DID document and private key as Python version.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('Node.js Version: Step-by-Step Debug Output (Using Python DID Document)');
console.log('='.repeat(80));

// Load Python output to get the same private key and DID
const pythonOutputPath = join(__dirname, 'python_output', 'python_step_by_step.json');
const pythonOutput = JSON.parse(readFileSync(pythonOutputPath, 'utf-8'));

console.log('\n[Step 0] Load Python Output');
console.log('-'.repeat(80));
console.log(`DID: ${pythonOutput.did}`);
console.log(`Private Key (hex): ${pythonOutput.private_key_hex}`);

// Use the SAME private key as Python
const TEST_PRIVATE_KEY_HEX = pythonOutput.private_key_hex;
const privateKeyBytes = Buffer.from(TEST_PRIVATE_KEY_HEX, 'hex');
const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, false);

console.log('\n[Step 1] Generate Key Pair from Fixed Private Key');
console.log('-'.repeat(80));
console.log(`Private Key (hex): ${TEST_PRIVATE_KEY_HEX}`);
console.log(`Public Key X: ${Buffer.from(publicKeyBytes.slice(1, 33)).toString('hex')}`);
console.log(`Public Key Y: ${Buffer.from(publicKeyBytes.slice(33, 65)).toString('hex')}`);

// Verify public key matches Python
const pythonPubX = pythonOutput.public_key_x_hex;
const pythonPubY = pythonOutput.public_key_y_hex;
const pubXMatch = Buffer.from(publicKeyBytes.slice(1, 33)).toString('hex') === pythonPubX;
const pubYMatch = Buffer.from(publicKeyBytes.slice(33, 65)).toString('hex') === pythonPubY;
console.log(`\nPublic Key X matches Python: ${pubXMatch ? '✓' : '✗'}`);
console.log(`Public Key Y matches Python: ${pubYMatch ? '✓' : '✗'}`);

// Calculate kid using compressed public key hash (matching Python)
const compressed = secp256k1.Point.fromHex(publicKeyBytes).toRawBytes(true);
const kidBytes = sha256(compressed);
const kid = Buffer.from(kidBytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

// Calculate unique_id using JWK Thumbprint (RFC 7638) - matching Python
const x = publicKeyBytes.slice(1, 33);
const y = publicKeyBytes.slice(33, 65);
const xB64 = Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const yB64 = Buffer.from(y).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const jwkCanonical = `{"crv":"secp256k1","kty":"EC","x":"${xB64}","y":"${yB64}"}`;
const fingerprintBytes = sha256(Buffer.from(jwkCanonical, 'ascii'));
const fingerprintB64Url = Buffer.from(fingerprintBytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

const uniqueId = `k1_${fingerprintB64Url}`;
const did = `did:wba:awiki.ai:user:${uniqueId}`;

console.log(`\nDID: ${did}`);
console.log(`key-1 kid: ${kid}`);
console.log(`DID matches Python: ${did === pythonOutput.did ? '✓' : '✗'}`);

// Use the SAME nonce and timestamp as Python
const testNonce = pythonOutput.nonce;
const testTimestamp = pythonOutput.timestamp;
const version = '1.1';
const didDomain = pythonOutput.service_domain;
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

// Compare with Python
const canonicalMatch = canonicalJson === pythonOutput.canonical_json;
console.log(`Canonical JSON matches Python: ${canonicalMatch ? '✓' : '✗'}`);

// SHA-256 hash
console.log('\n[Step 5] SHA-256 Hash');
console.log('-'.repeat(80));

const contentHash = sha256(Buffer.from(canonicalJson, 'utf-8'));
console.log(`content_hash: ${Buffer.from(contentHash).toString('hex')}`);
console.log(`content_hash length: ${contentHash.length} bytes`);

// Compare with Python
const hashMatch = Buffer.from(contentHash).toString('hex') === pythonOutput.content_hash;
console.log(`Content hash matches Python: ${hashMatch ? '✓' : '✗'}`);

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

// Compare with Python
const rsMatch = rsSignature.toString('hex') === pythonOutput.rs_signature_hex;
console.log(`R||S signature matches Python: ${rsMatch ? '✓' : '✗'}`);

// Check low-S
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const sIsHigh = signature.s > CURVE_ORDER / BigInt(2);
console.log(`\ns > CURVE_ORDER/2: ${sIsHigh}`);
console.log(`Python s_is_high: ${pythonOutput.s_is_high}`);
console.log(`s_is_high matches Python: ${sIsHigh === pythonOutput.s_is_high ? '✓' : '✗'}`);

// Base64URL encode
console.log('\n[Step 8] Base64URL Encode');
console.log('-'.repeat(80));

const signatureB64Url = rsSignature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
console.log(`signature_b64url: ${signatureB64Url}`);
console.log(`signature_b64url length: ${signatureB64Url.length} chars`);

// Compare with Python
const sigMatch = signatureB64Url === pythonOutput.signature_b64url;
console.log(`Signature Base64URL matches Python: ${sigMatch ? '✓' : '✗'}`);

// Build Authorization header
console.log('\n[Step 9] Build Authorization Header');
console.log('-'.repeat(80));

const authHeader = `DIDWba v="${version}", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureB64Url}"`;
console.log(`auth_header: ${authHeader}`);

// Compare with Python
const headerMatch = authHeader === pythonOutput.auth_header;
console.log(`Auth header matches Python: ${headerMatch ? '✓' : '✗'}`);

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

const outputDir = join(__dirname, 'python_output');
const outputPath = join(outputDir, 'nodejs_step_by_step_from_python.json');

import { writeFileSync, mkdirSync, existsSync } from 'fs';

if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
}

writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(`\nOutput saved to: ${outputPath}`);

// Final comparison summary
console.log('\n' + '='.repeat(80));
console.log('[Final Comparison Summary]');
console.log('='.repeat(80));

const comparisons = [
    { field: 'canonical_json', label: 'Canonical JSON', hex: true },
    { field: 'content_hash', label: 'Content Hash', hex: true },
    { field: 'rs_signature_hex', label: 'R||S Signature', hex: true },
    { field: 'signature_b64url', label: 'Signature Base64URL', hex: false },
    { field: 'auth_header', label: 'Auth Header', hex: false }
];

let allMatch = true;
comparisons.forEach(({ field, label, hex }) => {
    const match = output[field] === pythonOutput[field];
    const status = match ? '✓ MATCH' : '✗ DIFFER';
    console.log(`${label}: ${status}`);
    if (!match) {
        allMatch = false;
        const pythonVal = hex ? pythonOutput[field]?.substring(0, 60) + '...' : pythonOutput[field]?.substring(0, 60) + '...';
        const nodeVal = hex ? output[field]?.substring(0, 60) + '...' : output[field]?.substring(0, 60) + '...';
        console.log(`  Python:  ${pythonVal}`);
        console.log(`  Node.js: ${nodeVal}`);
    }
});

console.log('\n' + '='.repeat(80));
if (allMatch) {
    console.log('✓ ALL STEPS MATCH! Node.js implementation is byte-for-byte identical to Python.');
} else {
    console.log('✗ SOME STEPS DIFFER. Check the differences above.');
}
console.log('='.repeat(80));
