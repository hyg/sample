import { secp256k1 } from '@noble/curves/secp256k1';
import { readFileSync } from 'fs';

const cred = JSON.parse(readFileSync('C:/Users/hyg/.openclaw/credentials/awiki-agent-id-message/testfresh.json', 'utf-8'));

const crypto = await import('crypto');
const privateKeyObj = crypto.createPrivateKey(cred.private_key_pem);
const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
const privateKeyBytes = Buffer.from(Buffer.from(privateKeyJwk.d, 'base64url').toString('hex'), 'hex');

console.log("Private key:", Buffer.from(privateKeyBytes).toString('hex'));

// Derive public key using noble-curves
const publicKey = secp256k1.getPublicKey(privateKeyBytes, false);
console.log("Public key (uncompressed):", Buffer.from(publicKey).toString('hex'));

// Get x and y
const x = publicKey.slice(1, 33);
const y = publicKey.slice(33, 65);

function encodeBase64Url(data) {
    return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const xB64 = encodeBase64Url(x);
const yB64 = encodeBase64Url(y);

console.log("\nComputed x (b64url):", xB64);
console.log("Computed y (b64url):", yB64);

// From DID document
const jwk = cred.did_document.verificationMethod[0].publicKeyJwk;
console.log("\nDID doc x:", jwk.x);
console.log("DID doc y:", jwk.y);

console.log("\nX matches:", xB64 === jwk.x);
console.log("Y matches:", yB64 === jwk.y);
