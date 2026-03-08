import { ECDSA } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';
import { readFileSync } from 'fs';
import { loadPrivateKeyFromPem } from './src/utils/identity.js';

const cred = JSON.parse(readFileSync('./.credentials/testnodefix3.json', 'utf-8'));
const privateKeyBytes = loadPrivateKeyFromPem(cred.private_key_pem);

// Use same values as request
const did = cred.did;
const nonce = 'b8da080bbae4a9c96e6213534303b761';
const timestamp = '2026-03-07T17:42:11Z';
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

// Sign using ECDSA class with prehashed option
const signature = ECDSA.sign(contentHash, privateKeyBytes, {
    lowS: true,
    extraEntropy: null
});

console.log('Signature r:', signature.r);
console.log('Signature s:', signature.s);

// R||S format
const rBytes = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
const sBytes = Buffer.from(signature.s.toString(16).padStart(64, '0'), 'hex');

const signatureRs = Buffer.concat([rBytes, sBytes]);
console.log('R||S length:', signatureRs.length);

function encodeBase64Url(data) {
    return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const signatureB64Url = encodeBase64Url(signatureRs);
console.log('R||S base64url:', signatureB64Url);
