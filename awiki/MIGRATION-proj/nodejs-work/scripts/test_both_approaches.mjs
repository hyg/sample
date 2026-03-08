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
const nonce = crypto.randomBytes(16).toString('hex');

// Fresh timestamp
const now = new Date(Date.now() - 120 * 1000); // 2 minutes ago
now.setMilliseconds(0);
const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');

console.log("Nonce:", nonce);
console.log("Timestamp:", timestamp);

const authData = {
    nonce,
    timestamp,
    aud: domain,
    did
};

const canonicalJson = canonicalize(authData);
console.log("Canonical:", canonicalJson);

// Test 1: Sign RAW canonical JSON
console.log("\n=== Test 1: Sign RAW canonical JSON ===");
const sig1 = secp256k1.sign(Buffer.from(canonicalJson, 'utf-8'), privateKeyBytes);
const sigB64_1 = Buffer.concat([
    Buffer.from(sig1.r.toString(16).padStart(64, '0'), 'hex'),
    Buffer.from(sig1.s.toString(16).padStart(64, '0'), 'hex')
]).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

console.log("Signature:", sigB64_1);

// Test 2: Sign pre-hashed
console.log("\n=== Test 2: Sign pre-hashed ===");
const contentHash = sha256(canonicalJson);
const sig2 = secp256k1.sign(contentHash, privateKeyBytes);
const sigB64_2 = Buffer.concat([
    Buffer.from(sig2.r.toString(16).padStart(64, '0'), 'hex'),
    Buffer.from(sig2.s.toString(16).padStart(64, '0'), 'hex')
]).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

console.log("Signature:", sigB64_2);

// Test with server
async function testSig(sigB64, label) {
    const authHeader = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${sigB64}"`;
    
    try {
        const response = await axios.post('https://awiki.ai/user-service/did-auth/rpc', {
            jsonrpc: '2.0',
            method: 'verify',
            params: { authorization: authHeader, domain },
        }, { timeout: 10000 });
        console.log(`\n${label} Response:`, JSON.stringify(response.data));
    } catch (e) {
        console.log(`\n${label} Error:`, e.response?.data?.error?.message || e.message);
    }
}

await testSig(sigB64_1, "RAW canonical");
await testSig(sigB64_2, "Pre-hashed");
