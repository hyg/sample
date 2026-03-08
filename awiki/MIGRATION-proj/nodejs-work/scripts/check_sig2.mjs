import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';

// Use same values as the failing request
const did = 'did:wba:awiki.ai:user:k1_nMbrv12oEdIWw7KL_mWkXqThKnBBf7dWRdUOF8zV250';
const nonce = 'ab587c2a460f420e33f0f188441afd26';
const timestamp = '2026-03-07T17:39:29Z';
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

// Get private key from saved credential
import { readFileSync } from 'fs';
const cred = JSON.parse(readFileSync('./.credentials/testnodefix2.json', 'utf-8'));

import { loadPrivateKeyFromPem } from './src/utils/identity.js';
const privateKeyBytes = loadPrivateKeyFromPem(cred.private_key_pem);

const signature = secp256k1.sign(contentHash, privateKeyBytes);

console.log('Signature r:', signature.r);
console.log('Signature s:', signature.s);

// R||S format encoding
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
let s = signature.s;
const normalizedS = s > CURVE_ORDER / BigInt(2) ? CURVE_ORDER - s : s;

const rBytes = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
const sBytes = Buffer.from(normalizedS.toString(16).padStart(64, '0'), 'hex');

const signatureRs = Buffer.concat([rBytes, sBytes]);
console.log('R||S signature (hex):', signatureRs.toString('hex'));
console.log('R||S length:', signatureRs.length);

const signatureB64Url = signatureRs.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
console.log('R||S base64url:', signatureB64Url);
console.log('R||S base64url length:', signatureB64Url.length);

// Compare with the failing one
const failingSig = 'MEQCID4NH66JDIUSBgzJ4DyDOe9AftcwhP5lVTEx5uB4QEB0AiA_P4WUAS1h8HrwF2oAE0gmQLUazWbxU9QJ29025cs1xA';
console.log('Failing signature length:', failingSig.length);
console.log('Is DER?:', failingSig.startsWith('ME'));
