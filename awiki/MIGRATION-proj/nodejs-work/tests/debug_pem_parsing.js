#!/usr/bin/env node

/**
 * Debug: Parse PEM private key and verify signature format.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('Debug: PEM Private Key Parsing');
console.log('='.repeat(80));

// Load PythonAgent credential
const credPath = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message', 'pythonagent.json');
const credData = JSON.parse(readFileSync(credPath, 'utf-8'));

const privateKeyPem = credData.private_key_pem;
const did = credData.did;

console.log('\n[1] PEM Private Key');
console.log('-'.repeat(80));
console.log(privateKeyPem);

// Method 1: Manual parsing (current method)
console.log('\n[2] Method 1: Manual Parsing');
console.log('-'.repeat(80));

const pemLines1 = privateKeyPem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
const der1 = Buffer.from(pemLines1.join(''), 'base64');

console.log(`DER length: ${der1.length} bytes`);
console.log(`DER (first 20 bytes): ${der1.slice(0, 20).toString('hex')}`);

// Find private key offset
let privOffset1 = -1;
for (let i = 0; i < der1.length - 2; i++) {
    if (der1[i] === 0x04 && der1[i + 1] === 0x20) {
        privOffset1 = i + 2;
        break;
    }
}

console.log(`Private key offset: ${privOffset1}`);

if (privOffset1 !== -1) {
    const privateKeyBytes1 = der1.slice(privOffset1, privOffset1 + 32);
    console.log(`Private key (hex): ${privateKeyBytes1.toString('hex')}`);
    
    // Get public key
    const publicKeyBytes1 = secp256k1.getPublicKey(privateKeyBytes1, false);
    console.log(`Public key X: ${publicKeyBytes1.slice(1, 33).toString('hex')}`);
    console.log(`Public key Y: ${publicKeyBytes1.slice(33, 65).toString('hex')}`);
}

// Method 2: Using crypto.createPrivateKey
console.log('\n[3] Method 2: crypto.createPrivateKey');
console.log('-'.repeat(80));

try {
    const privateKeyObj = crypto.createPrivateKey(privateKeyPem);
    const privateKeyBytes2 = privateKeyObj.export({ format: 'jwk' });
    
    console.log(`Private key (JWK d): ${privateKeyBytes2.d}`);
    
    // Convert from base64url to hex
    const dHex = Buffer.from(privateKeyBytes2.d, 'base64url').toString('hex');
    console.log(`Private key (hex): ${dHex}`);
    
    // Get public key
    const publicKeyBytes2 = secp256k1.getPublicKey(Buffer.from(dHex, 'hex'), false);
    console.log(`Public key X: ${publicKeyBytes2.slice(1, 33).toString('hex')}`);
    console.log(`Public key Y: ${publicKeyBytes2.slice(33, 65).toString('hex')}`);
} catch (error) {
    console.log(`Failed: ${error.message}`);
}

// Compare with PythonAgent DID
console.log('\n[4] PythonAgent DID');
console.log('-'.repeat(80));
console.log(`DID: ${did}`);

// Calculate expected fingerprint from public key
if (privOffset1 !== -1) {
    const privateKeyBytes1 = der1.slice(privOffset1, privOffset1 + 32);
    const publicKeyBytes1 = secp256k1.getPublicKey(privateKeyBytes1, false);
    
    const x = publicKeyBytes1.slice(1, 33);
    const y = publicKeyBytes1.slice(33, 65);
    const xB64 = x.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const yB64 = y.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const jwkCanonical = `{"crv":"secp256k1","kty":"EC","x":"${xB64}","y":"${yB64}"}`;
    const fingerprintBytes = sha256(Buffer.from(jwkCanonical, 'ascii'));
    const fingerprintB64Url = fingerprintBytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    const expectedDid = `did:wba:awiki.ai:user:k1_${fingerprintB64Url}`;
    console.log(`Expected DID: ${expectedDid}`);
    console.log(`DID match: ${expectedDid === did ? '✓' : '✗'}`);
}

console.log('\n' + '='.repeat(80));
