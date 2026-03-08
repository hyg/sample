import { secp256k1 } from '@noble/curves/secp256k1';
import { readFileSync } from 'fs';
import crypto from 'crypto';

const cred = JSON.parse(readFileSync('./.credentials/testnodefix5.json', 'utf-8'));

// Parse the PEM to extract private key
const privateKeyObj = crypto.createPrivateKey(cred.private_key_pem);
const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
const privateKeyBytes = Buffer.from(Buffer.from(privateKeyJwk.d, 'base64url').toString('hex'), 'hex');

console.log('Private key bytes:', Buffer.from(privateKeyBytes).toString('hex'));

// Get public key from private key
const publicKey = secp256k1.getPublicKey(privateKeyBytes, false);
console.log('Public key:', Buffer.from(publicKey).toString('hex'));

// Extract x and y
const x = publicKey.slice(1, 33);
const y = publicKey.slice(33, 65);

function encodeBase64Url(data) {
    return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

console.log('x (b64url):', encodeBase64Url(x));
console.log('y (b64url):', encodeBase64Url(y));

// Check with DID document
const jwk = cred.did_document.verificationMethod[0].publicKeyJwk;
console.log('\nDID document x:', jwk.x);
console.log('DID document y:', jwk.y);

console.log('\nMatch?:', encodeBase64Url(x) === jwk.x && encodeBase64Url(y) === jwk.y);
