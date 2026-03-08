import secp256k1 from 'secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';
import axios from 'axios';
import { readFileSync } from 'fs';

const cred = JSON.parse(readFileSync('C:/Users/hyg/.openclaw/credentials/awiki-agent-id-message/testfresh.json', 'utf-8'));

const crypto = await import('crypto');
const privateKeyObj = crypto.createPrivateKey(cred.private_key_pem);
const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
const privateKeyBytes = Buffer.from(Buffer.from(privateKeyJwk.d, 'base64url').toString('hex'), 'hex');

const did = cred.did;
const domain = 'awiki.ai';
const nonce = crypto.randomBytes(16).toString('hex');

const now = new Date(Date.now() - 60 * 1000);
now.setMilliseconds(0);
const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');

const authData = { nonce, timestamp, aud: domain, did };
const canonicalJson = canonicalize(authData);

// FIRST hash (like we already do)
const contentHash = sha256(canonicalJson);
// SECOND hash (like Python cryptography does internally)
const doubleHash = sha256(contentHash);

console.log("First hash:", Buffer.from(contentHash).toString('hex'));
console.log("Double hash:", Buffer.from(doubleHash).toString('hex'));

// Sign the DOUBLE-HASHED content (matching Python behavior)
const sig = secp256k1.ecdsaSign(doubleHash, privateKeyBytes);

const sigRs = Buffer.from(sig.signature);
const sigB64 = sigRs.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

console.log("Signature:", sigB64);

const authHeader = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${sigB64}"`;

console.log("\n--- Testing with server ---");
try {
    const response = await axios.post('https://awiki.ai/user-service/did-auth/rpc', {
        jsonrpc: '2.0',
        method: 'verify',
        params: { authorization: authHeader, domain },
    }, { timeout: 10000 });
    console.log("Response:", JSON.stringify(response.data));
} catch (e) {
    console.log("Error:", e.response?.data?.error?.message || e.message);
}
