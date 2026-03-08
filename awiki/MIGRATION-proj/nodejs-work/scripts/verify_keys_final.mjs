import { secp256k1 } from '@noble/curves/secp256k1';
import { readFileSync } from 'fs';

const cred = JSON.parse(readFileSync('C:/Users/hyg/.openclaw/credentials/awiki-agent-id-message/testfresh.json', 'utf-8'));

const crypto = await import('crypto');
const privateKeyObj = crypto.createPrivateKey(cred.private_key_pem);
const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
const privateKeyBytes = Buffer.from(Buffer.from(privateKeyJwk.d, 'base64url').toString('hex'), 'hex');

console.log("Private key from PEM:", Buffer.from(privateKeyBytes).toString('hex'));

// Derive public key with noble-curves
const publicKeyNode = secp256k1.getPublicKey(privateKeyBytes, false);
console.log("\nPublic key (noble-curves):", Buffer.from(publicKeyNode).toString('hex'));

// Get from DID document
const jwk = cred.did_document.verificationMethod[0].publicKeyJwk;
const xDoc = Buffer.from(jwk.x, 'base64');
const yDoc = Buffer.from(jwk.y, 'base64');
const publicKeyDoc = Buffer.concat([Buffer.from([0x04]), xDoc, yDoc]);
console.log("Public key (DID doc):", Buffer.from(publicKeyDoc).toString('hex'));

console.log("\nMatch:", Buffer.from(publicKeyNode).toString('hex') === Buffer.from(publicKeyDoc).toString('hex'));

// Let's also get the public key from Python's cryptography
console.log("\n--- Using Node.js crypto to verify ---");
const pubKeyNode = crypto.createPublicKey(cred.private_key_pem);
console.log("Node crypto public key:", pubKeyNode.export({type: 'spki', format: 'der'}).toString('hex').slice(0, 40) + "...");
