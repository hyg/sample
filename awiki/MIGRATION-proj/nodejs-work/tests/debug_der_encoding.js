#!/usr/bin/env node

/**
 * Debug: Compare DER encoding between Python and Node.js.
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
console.log('Debug: DER Encoding Comparison');
console.log('='.repeat(80));

// Load TestFresh credential
const credPath = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message', 'testfresh.json');
const cred = JSON.parse(readFileSync(credPath, 'utf-8'));

const privateKeyPem = cred.private_key_pem;
const did = cred.did;

// Parse private key
const privateKeyObj = crypto.createPrivateKey(privateKeyPem);
const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
const dHex = Buffer.from(privateKeyJwk.d, 'base64url').toString('hex');
const privateKeyBytes = Buffer.from(dHex, 'hex');

// Use same data as Python comparison script
const nonce = "32aa8fc14a085be56417e42d47a8a795";
const timestamp = "2026-03-07T13:38:25Z";

const authData = {
    nonce: nonce,
    timestamp: timestamp,
    aud: 'awiki.ai',
    did: did
};

const canonicalJson = canonicalize(authData);
const contentHash = sha256(Buffer.from(canonicalJson, 'utf-8'));

console.log('\n[1] Content Hash');
console.log('-'.repeat(80));
console.log(contentHash.toString('hex'));

// Sign with noble-curves
const signature = secp256k1.sign(contentHash, privateKeyBytes);

console.log('\n[2] Noble-curves Signature');
console.log('-'.repeat(80));
console.log(`r: ${signature.r.toString(16)}`);
console.log(`s: ${signature.s.toString(16)}`);

// Encode to DER
function encodeDerSignature(r, s) {
    const rBytes = Buffer.from(r.toString(16).padStart(64, '0'), 'hex');
    const sBytes = Buffer.from(s.toString(16).padStart(64, '0'), 'hex');

    let rDer = rBytes;
    let sDer = sBytes;
    if (rBytes[0] & 0x80) rDer = Buffer.concat([Buffer.alloc(1), rBytes]);
    if (sBytes[0] & 0x80) sDer = Buffer.concat([Buffer.alloc(1), sBytes]);

    const totalLen = 2 + rDer.length + 2 + sDer.length;

    return Buffer.concat([
        Buffer.from([0x30, totalLen]),
        Buffer.from([0x02, rDer.length]),
        rDer,
        Buffer.from([0x02, sDer.length]),
        sDer
    ]);
}

const derSignature = encodeDerSignature(signature.r, signature.s);
const signatureB64Url = derSignature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

console.log('\n[3] Node.js DER Signature');
console.log('-'.repeat(80));
console.log(derSignature.toString('hex'));
console.log(`Base64URL: ${signatureB64Url}`);

// Python signature from comparison script
const pythonSig = "MEUCIQDbI9ve3kfUEpJaeqfsLGQobJPkzOs7bLq0Z5dZvefmBAIgQ59-syvORUil4_SAC5CNmqvNLEgCPZlHe5cwWst2gkc";
const pythonSigBytes = Buffer.from(pythonSig, 'base64url');

console.log('\n[4] Python DER Signature');
console.log('-'.repeat(80));
console.log(pythonSigBytes.toString('hex'));
console.log(`Base64URL: ${pythonSig}`);

console.log('\n[5] Comparison');
console.log('-'.repeat(80));
console.log(`DER bytes match: ${derSignature.equals(pythonSigBytes)}`);
console.log(`Base64URL match: ${signatureB64Url === pythonSig}`);

// Decode both to check r,s values
console.log('\n[6] Decode DER to verify r,s');
console.log('-'.repeat(80));

function decodeDerSignature(der) {
    if (der[0] !== 0x30) {
        throw new Error('Invalid DER: must start with 0x30');
    }
    
    let offset = 2; // Skip 0x30 and length
    if (der[offset] !== 0x02) {
        throw new Error('Invalid DER: r must be INTEGER (0x02)');
    }
    offset++;
    
    const rLen = der[offset];
    offset++;
    const rBytes = der.slice(offset, offset + rLen);
    offset += rLen;
    
    if (der[offset] !== 0x02) {
        throw new Error('Invalid DER: s must be INTEGER (0x02)');
    }
    offset++;
    
    const sLen = der[offset];
    offset++;
    const sBytes = der.slice(offset, offset + sLen);
    
    const r = BigInt('0x' + rBytes.toString('hex'));
    const s = BigInt('0x' + sBytes.toString('hex'));
    
    return { r, s };
}

try {
    const nodejsRS = decodeDerSignature(derSignature);
    const pythonRS = decodeDerSignature(pythonSigBytes);
    
    console.log(`Node.js r: ${nodejsRS.r.toString(16)}`);
    console.log(`Python  r: ${pythonRS.r.toString(16)}`);
    console.log(`r match: ${nodejsRS.r === pythonRS.r}`);
    
    console.log(`\nNode.js s: ${nodejsRS.s.toString(16)}`);
    console.log(`Python  s: ${pythonRS.s.toString(16)}`);
    console.log(`s match: ${nodejsRS.s === pythonRS.s}`);
} catch (e) {
    console.log(`DER decode failed: ${e.message}`);
}

console.log('\n' + '='.repeat(80));
