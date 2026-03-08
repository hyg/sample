import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';
import crypto from 'crypto';

const did = 'did:wba:awiki.ai:user:k1_e5YNkYz5Zvgp-ItPqMfKMEc2Vf2gbGk17nk_qljwlrI';
const nonce = '01b28cf0d72b5b203369d73ab47948c2';
const timestamp = '2026-03-07T17:36:26Z';
const serverUrl = 'https://awiki.ai';

const authData = {
    nonce,
    timestamp,
    aud: serverUrl,
    did
};

console.log('Auth data:', JSON.stringify(authData));

const canonicalJson = canonicalize(authData);
console.log('Canonical JSON:', canonicalJson);

const contentHash = sha256(canonicalJson);
console.log('Content hash (hex):', Buffer.from(contentHash).toString('hex'));
console.log('Content hash length:', contentHash.length);

// Now let's sign - noble-curves internally hashes the input
const privateKeyHex = 'your_private_key_here'; // Need to get this from credential

// Let's extract private key from the saved credential
import { readFileSync } from 'fs';
const cred = JSON.parse(readFileSync('./.credentials/testnodefix.json', 'utf-8'));
console.log('Credential loaded');

import { loadPrivateKeyFromPem } from './src/utils/identity.js';
const privateKeyBytes = loadPrivateKeyFromPem(cred.private_key_pem);
console.log('Private key bytes:', Buffer.from(privateKeyBytes).toString('hex'));

// Sign with noble-curves - it hashes internally
const signature = secp256k1.sign(contentHash, privateKeyBytes);
console.log('Signature r:', signature.r.toString(16));
console.log('Signature s:', signature.s.toString(16));

// DER encode
function encodeDerSignature(r, s) {
    function intToBytes(n) {
        let hex = n.toString(16);
        if (hex.length % 2 === 1) hex = '0' + hex;
        const bytes = Buffer.from(hex, 'hex');
        if (bytes[0] & 0x80) {
            return Buffer.concat([Buffer.from([0x00]), bytes]);
        }
        return bytes;
    }
    
    const rBytes = intToBytes(r);
    const sBytes = intToBytes(s);
    
    const rDer = Buffer.concat([Buffer.from([0x02, rBytes.length]), rBytes]);
    const sDer = Buffer.concat([Buffer.from([0x02, sBytes.length]), sBytes]);
    
    const seqLen = rDer.length + sDer.length;
    const seqDer = Buffer.concat([Buffer.from([0x30, seqLen]), rDer, sDer]);
    
    return seqDer;
}

const derSig = encodeDerSignature(signature.r, signature.s);
console.log('DER signature (hex):', derSig.toString('hex'));
console.log('DER signature (base64):', derSig.toString('base64'));
