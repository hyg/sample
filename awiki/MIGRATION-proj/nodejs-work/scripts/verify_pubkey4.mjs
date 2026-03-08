import { secp256k1 } from '@noble/curves/secp256k1';
import { readFileSync } from 'fs';

const cred = JSON.parse(readFileSync('C:/Users/hyg/.openclaw/credentials/awiki-agent-id-message/testfresh.json', 'utf-8'));

const crypto = await import('crypto');
const privateKeyObj = crypto.createPrivateKey(cred.private_key_pem);
const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
const privateKeyBytes = Buffer.from(Buffer.from(privateKeyJwk.d, 'base64url').toString('hex'), 'hex');

const publicKey = secp256k1.getPublicKey(privateKeyBytes, false);
const x = publicKey.slice(1, 33);
const y = publicKey.slice(33, 65);

console.log("x length:", x.length);
console.log("x is Buffer:", Buffer.isBuffer(x));

// Correct base64url encoding
const xBase64 = x.toString('base64');
console.log("x base64:", xBase64);

const xBase64Url = xBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
console.log("x base64url:", xBase64Url);

// From DID document
const jwk = cred.did_document.verificationMethod[0].publicKeyJwk;
console.log("\nDID doc x:", jwk.x);
console.log("Match:", xBase64Url === jwk.x);

// Let's also decode DID doc x and compare
const didX = Buffer.from(jwk.x, 'base64');
console.log("DID doc x decoded (hex):", didX.toString('hex'));
console.log("Computed x (hex):", x.toString('hex'));