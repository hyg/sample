#!/usr/bin/env node

/**
 * Debug: Generate and compare auth header with Python version.
 */

import { loadIdentity } from '../src/credential_store.js';
import canonicalize from 'canonicalize';
import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import crypto from 'crypto';

console.log('='.repeat(80));
console.log('Node.js Auth Header Debug');
console.log('='.repeat(80));

// Load identity
const cred = loadIdentity('nodeagentjwt2');
if (!cred) {
    console.log('Credential not found');
    process.exit(1);
}

console.log(`\nLocal DID: ${cred.did}`);

// Parse private key from PEM
const pemLines = cred.private_key_pem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
const der = Buffer.from(pemLines.join(''), 'base64');

// PKCS#8 format: find the private key octet string
let privOffset = -1;
for (let i = 0; i < der.length - 2; i++) {
    if (der[i] === 0x04 && der[i + 1] === 0x20) {
        privOffset = i + 2;
        break;
    }
}

const rawPrivateKey = der.slice(privOffset, privOffset + 32);
console.log(`Private key (hex): ${rawPrivateKey.toString('hex').substring(0, 32)}...`);

// Generate auth data (matching Python v1.1)
const nonce = 'test-nonce-12345678';
const timestamp = '2026-03-07T10:00:00Z';
const serviceDomain = 'awiki.ai';
const did = cred.did;

const authData = {
    nonce,
    timestamp,
    aud: serviceDomain,
    did
};

console.log('\nAuth data (v1.1 with aud field):');
console.log(JSON.stringify(authData, null, 2));

// Canonicalize
const canonicalJson = canonicalize(authData);
console.log('\nCanonical JSON:');
console.log(canonicalJson);

// Hash
const contentHash = sha256(canonicalJson);
console.log('\nContent hash:');
console.log(Buffer.from(contentHash).toString('hex'));

// Sign
const signature = secp256k1.sign(contentHash, rawPrivateKey);
console.log('\nSignature R:', signature.r.toString(16));
console.log('Signature S:', signature.s.toString(16));

// Check low-S
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
console.log('\nS > CURVE_ORDER/2:', signature.s > CURVE_ORDER / BigInt(2));

// Encode to DER (without low-S normalization, matching Python)
const rBytes = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
const sBytes = Buffer.from(signature.s.toString(16).padStart(64, '0'), 'hex');

let rDer = rBytes;
let sDer = sBytes;
if (rBytes[0] & 0x80) rDer = Buffer.concat([Buffer.alloc(1), rBytes]);
if (sBytes[0] & 0x80) sDer = Buffer.concat([Buffer.alloc(1), sBytes]);

const totalLen = 2 + rDer.length + 2 + sDer.length;
const derSignature = Buffer.concat([
    Buffer.from([0x30, totalLen]),
    Buffer.from([0x02, rDer.length]),
    rDer,
    Buffer.from([0x02, sDer.length]),
    sDer
]);

console.log('\nDER signature:', derSignature.toString('hex'));
console.log('DER signature length:', derSignature.length, 'bytes');

// Encode as base64url
const signatureB64Url = derSignature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
console.log('\nSignature (base64url):', signatureB64Url);
console.log('Signature length:', signatureB64Url.length, 'chars');

// Build header
const authHeader = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureB64Url}"`;
console.log('\nAuthorization Header:');
console.log(authHeader);

console.log('\n' + '='.repeat(80));
