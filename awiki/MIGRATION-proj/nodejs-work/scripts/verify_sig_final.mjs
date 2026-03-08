import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';
import { readFileSync } from 'fs';

const cred = JSON.parse(readFileSync('./.credentials/testnodefix7.json', 'utf-8'));

// Get private key hex
const privateKeyHex = cred.privateKeyHex;
console.log('Private key hex:', privateKeyHex);
console.log('Private key length:', privateKeyHex.length / 2);

const privateKeyBytes = Buffer.from(privateKeyHex, 'hex');

// Test signing with the same parameters as the request
const did = cred.did;
const nonce = '7af3d62372ea0df07fccaceaf862dace';
const timestamp = '2026-03-07T17:50:53Z';
const serverUrl = 'https://awiki.ai';

const authData = {
    nonce,
    timestamp,
    aud: serverUrl,
    did
};

const canonicalJson = canonicalize(authData);
console.log('Canonical:', canonicalJson);

const contentHash = sha256(canonicalJson);
console.log('Content hash:', Buffer.from(contentHash).toString('hex'));

// Sign
const signature = secp256k1.sign(contentHash, privateKeyBytes);

console.log('Signature r:', signature.r);
console.log('Signature s:', signature.s);

// Try R||S encoding
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
let s = signature.s;
const normalizedS = s > CURVE_ORDER / BigInt(2) ? CURVE_ORDER - s : s;

const rBytes = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
const sBytes = Buffer.from(normalizedS.toString(16).padStart(64, '0'), 'hex');

const signatureRs = Buffer.concat([rBytes, sBytes]);
console.log('R||S length:', signatureRs.length);

function encodeBase64Url(data) {
    return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const signatureB64Url = encodeBase64Url(signatureRs);
console.log('R||S base64url:', signatureB64Url);
console.log('R||S base64url length:', signatureB64Url.length);

// Compare with the failing one
const failingSig = 'Ltge7w7vcpV8up07SVdTs1DKgNxcHEiHb9lo_F-Lo4Viia4pW619NPGlzvJXB_gMHR_Lcj9x8Sp6gwRYqVyOYg';
console.log('\nFailing signature length:', failingSig.length);
console.log('Failing signature:', failingSig);
