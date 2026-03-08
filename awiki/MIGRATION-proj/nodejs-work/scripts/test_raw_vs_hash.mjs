import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';
import { readFileSync } from 'fs';
import axios from 'axios';

const cred = JSON.parse(readFileSync('C:/Users/hyg/.openclaw/credentials/awiki-agent-id-message/testfresh.json', 'utf-8'));

const crypto = await import('crypto');
const privateKeyObj = crypto.createPrivateKey(cred.private_key_pem);
const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
const privateKeyBytes = Buffer.from(Buffer.from(privateKeyJwk.d, 'base64url').toString('hex'), 'hex');

const did = cred.did;
const domain = 'awiki.ai';
const nonce = 'f685f264c64d801d5f6ea4d5b3895d43';
const timestamp = '2026-03-07T18:02:16Z';

const authData = {
    nonce,
    timestamp,
    aud: domain,
    did
};

const canonicalJson = canonicalize(authData);
console.log("Canonical:", canonicalJson);

// TEST: Sign RAW canonical JSON (not pre-hashed)
console.log("\n=== Test 1: Sign RAW canonical JSON ===");
const signature1 = secp256k1.sign(Buffer.from(canonicalJson, 'utf-8'), privateKeyBytes);
console.log("r:", signature1.r);
console.log("s:", signature1.s);

const rBytes1 = Buffer.from(signature1.r.toString(16).padStart(64, '0'), 'hex');
const sBytes1 = Buffer.from(signature1.s.toString(16).padStart(64, '0'), 'hex');
const sigRs1 = Buffer.concat([rBytes1, sBytes1]);
const sigB64_1 = sigRs1.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

const authHeader1 = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${sigB64_1}"`;

console.log("Signature:", sigB64_1);

// TEST: Sign pre-hashed content
console.log("\n=== Test 2: Sign pre-hashed content ===");
const contentHash = sha256(canonicalJson);
const signature2 = secp256k1.sign(contentHash, privateKeyBytes);
console.log("r:", signature2.r);

const rBytes2 = Buffer.from(signature2.r.toString(16).padStart(64, '0'), 'hex');
const sBytes2 = Buffer.from(signature2.s.toString(16).padStart(64, '0'), 'hex');
const sigRs2 = Buffer.concat([rBytes2, sBytes2]);
const sigB64_2 = sigRs2.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

console.log("Signature:", sigB64_2);

// Test with server
console.log("\n=== Testing with server (raw canonical JSON) ===");
try {
    const response = await axios.post('https://awiki.ai/user-service/did-auth/rpc', {
        jsonrpc: '2.0',
        method: 'verify',
        params: { authorization: authHeader1, domain },
        id: 1
    }, { timeout: 10000 });
    console.log("Response:", JSON.stringify(response.data, null, 2));
} catch (e) {
    console.log("Error:", e.response?.data?.error?.message || e.message);
}
