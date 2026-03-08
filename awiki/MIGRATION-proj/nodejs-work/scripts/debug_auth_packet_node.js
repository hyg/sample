import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';
import { readFileSync } from 'fs';

const cred = JSON.parse(readFileSync('./.credentials/testnodefix7.json', 'utf-8'));

console.log("=" * 60);
console.log("NODE.JS AUTH FLOW");
console.log("=" * 60);

const did = cred.did;
console.log(`\n1. DID: ${did}`);

// Auth data (from the request that was sent)
const nonce = '7af3d62372ea0df07fccaceaf862dace';
const timestamp = '2026-03-07T17:50:53Z';
const domain = 'https://awiki.ai';

console.log(`\n2. Auth Data:`);
const authData = {
    nonce,
    timestamp,
    aud: domain,
    did
};
console.log(JSON.stringify(authData, null, 2));

console.log(`\n3. Canonical JSON (JCS):`);
const canonicalJson = canonicalize(authData);
console.log(canonicalJson);

console.log(`\n4. SHA-256 Hash:`);
const contentHash = sha256(canonicalJson);
console.log(Buffer.from(contentHash).toString('hex'));

// Sign with the private key
const privateKeyBytes = Buffer.from(cred.private_key_hex, 'hex');
const signature = secp256k1.sign(contentHash, privateKeyBytes);

console.log(`\n5. Signature (R||S format, base64url encoded):`);
// R||S encoding
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
let s = signature.s;
const normalizedS = s > CURVE_ORDER / BigInt(2) ? CURVE_ORDER - s : s;

const rBytes = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
const sBytes = Buffer.from(normalizedS.toString(16).padStart(64, '0'), 'hex');

const signatureRs = Buffer.concat([rBytes, sBytes]);
const signatureB64Url = signatureRs.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

console.log(signatureB64Url);

console.log(`\n6. Authorization Header:`);
console.log(`DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureB64Url}"`);

console.log(`\n7. HTTP Request to /user-service/did-auth/rpc:`);
console.log(JSON.stringify({
    jsonrpc: "2.0",
    method: "verify",
    params: {
        authorization: `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureB64Url}"`,
        domain: "https://awiki.ai"
    },
    id: 1
}, null, 2));
