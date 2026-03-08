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

console.log("=" * 60);
console.log("NODE.JS getJwtViaWba TRACE");
console.log("=" * 60);

// Step 1: Canonical JSON
const canonicalJson = canonicalize(authData);
console.log("\n1. Canonical JSON:");
console.log(`   ${canonicalJson}`);

// Step 2: SHA256 hash
const contentHash = sha256(canonicalJson);
console.log("\n2. SHA256(content_hash):");
console.log(`   hex: ${Buffer.from(contentHash).toString('hex')}`);
console.log(`   len: ${contentHash.length}`);

// Step 3: Sign with noble-curves (will hash internally again!)
const signature = secp256k1.sign(contentHash, privateKeyBytes);
console.log("\n3. Signature from noble-curves:");
console.log(`   r: ${signature.r}`);
console.log(`   s: ${signature.s}`);

// Step 4: R||S format encoding
const rBytes = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
const sBytes = Buffer.from(signature.s.toString(16).padStart(64, '0'), 'hex');
const signatureRs = Buffer.concat([rBytes, sBytes]);

console.log("\n4. R||S format:");
console.log(`   hex: ${signatureRs.toString('hex')}`);
console.log(`   len: ${signatureRs.length}`);

// Step 5: base64url encode
function encodeBase64Url(data) {
    return data.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
const signatureB64Url = encodeBase64Url(signatureRs);

console.log("\n5. Base64url encoded:");
console.log(`   ${signatureB64Url}`);

// Final auth header
const authHeader = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureB64Url}"`;

console.log("\n6. Authorization Header:");
console.log(`   ${authHeader}`);

console.log("\n" + "=" * 60);
console.log("COMPARISON");
console.log("=" * 60);

console.log("\nPython signature: 46jZfr2VH4eu9_1ewyzKWfvSBJI3uHOFwkKQGh0vHOE-SJKaTCnnllokUGxRNzNFb8UQvxJNL70Rwvxbsx551w");
console.log(`Node.js signature: ${signatureB64Url}`);
console.log(`Match: ${signatureB64Url === '46jZfr2VH4eu9_1ewyzKWfvSBJI3uHOFwkKQGh0vHOE-SJKaTCnnllokUGxRNzNFb8UQvxJNL70Rwvxbsx551w'}`);

// Now test if this works with the server
console.log("\n" + "=" * 60);
console.log("TESTING WITH SERVER");
console.log("=" * 60);

try {
    const response = await axios.post('https://awiki.ai/user-service/did-auth/rpc', {
        jsonrpc: '2.0',
        method: 'verify',
        params: { authorization: authHeader, domain },
        id: 1
    }, { timeout: 10000 });
    console.log("\nResponse:", JSON.stringify(response.data, null, 2));
} catch (e) {
    console.log("\nError:", e.response?.data?.error?.message || e.message);
}
