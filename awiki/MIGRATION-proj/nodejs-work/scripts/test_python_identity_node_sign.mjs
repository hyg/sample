import axios from 'axios';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';
import { readFileSync } from 'fs';

// Load Python-created identity
const cred = JSON.parse(readFileSync('C:/Users/hyg/.openclaw/credentials/awiki-agent-id-message/testfresh.json', 'utf-8'));

console.log("=" * 60);
console.log("TEST: Using Python-created identity with Node.js signing");
console.log("=" * 60);

// Get private key from PEM
const crypto = await import('crypto');

const privateKeyObj = crypto.createPrivateKey(cred.private_key_pem);
const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
const privateKeyBytes = Buffer.from(Buffer.from(privateKeyJwk.d, 'base64url').toString('hex'), 'hex');

console.log("\nPrivate key loaded from Python PEM");

const did = cred.did;
const nonce = 'testnonce12345678';
const timestamp = '2026-03-07T18:00:00Z';
const domain = 'awiki.ai';

const authData = {
    nonce,
    timestamp,
    aud: domain,
    did
};

const canonicalJson = canonicalize(authData);
console.log("Canonical JSON:", canonicalJson);

const contentHash = sha256(canonicalJson);
console.log("Content hash:", Buffer.from(contentHash).toString('hex'));

// Sign
const signature = secp256k1.sign(contentHash, privateKeyBytes);

// R||S encoding
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
let s = signature.s;
const normalizedS = s > CURVE_ORDER / BigInt(2) ? CURVE_ORDER - s : s;

const rBytes = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
const sBytes = Buffer.from(normalizedS.toString(16).padStart(64, '0'), 'hex');

const signatureRs = Buffer.concat([rBytes, sBytes]);
const signatureB64Url = signatureRs.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

console.log("Signature:", signatureB64Url);

const authHeader = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureB64Url}"`;

console.log("\nAuthorization Header:", authHeader);

// Send request
console.log("\nSending verify request...");
const response = await axios.post('https://awiki.ai/user-service/did-auth/rpc', {
    jsonrpc: '2.0',
    method: 'verify',
    params: {
        authorization: authHeader,
        domain: domain
    },
    id: 1
});

console.log("\nResponse:", JSON.stringify(response.data, null, 2));
