#!/usr/bin/env node

import crypto from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

function encodeBase64Url(data) {
    if (Buffer.isBuffer(data)) {
        return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    return Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const keyPair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    publicKeyEncoding: { format: 'pem', type: 'spki' }
});

console.log('Public Key PEM:');
console.log(keyPair.publicKey);

// Extract bytes from PEM
const pemLines = keyPair.publicKey.split('\n').filter(l => !l.startsWith('-----') && l.trim());
const publicKeyBytes = Buffer.from(pemLines.join(''), 'base64');
console.log('\nPublic Key bytes length:', publicKeyBytes.length);

// SPKI format for EC has header, actual key is at the end
const actualKeyBytes = publicKeyBytes.slice(-65);
console.log('Actual key bytes (last 65):', actualKeyBytes.toString('hex'));
console.log('Starts with 0x04:', actualKeyBytes[0] === 0x04);

// Get x and y coordinates for JWK
const xBytes = actualKeyBytes.slice(1, 33);
const yBytes = actualKeyBytes.slice(33, 65);

console.log('\nJWK x (base64url):', encodeBase64Url(xBytes));
console.log('JWK y (base64url):', encodeBase64Url(yBytes));

// Get compressed for kid
const point = secp256k1.Point.fromHex(actualKeyBytes);
const compressed = point.toRawBytes(true);
const compressedBuffer = Buffer.from(compressed);
console.log('\nCompressed (33 bytes):', compressedBuffer.toString('hex'));

// kid = base64url(sha256(compressed))
const kid = encodeBase64Url(sha256(compressed));
console.log('kid (base64url of sha256):', kid);

// Build DID
const did = `did:wba:awiki.ai:user:k1_${kid}`;
console.log('\nDID:', did);
