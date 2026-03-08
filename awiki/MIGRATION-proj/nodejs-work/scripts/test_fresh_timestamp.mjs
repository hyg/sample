import axios from 'axios';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';
import { readFileSync } from 'fs';

const cred = JSON.parse(readFileSync('C:/Users/hyg/.openclaw/credentials/awiki-agent-id-message/testfresh.json', 'utf-8'));

const crypto = await import('crypto');
const privateKeyObj = crypto.createPrivateKey(cred.private_key_pem);
const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
const privateKeyBytes = Buffer.from(Buffer.from(privateKeyJwk.d, 'base64url').toString('hex'), 'hex');

const did = cred.did;
const domain = 'awiki.ai';

// Use a timestamp from about 60 seconds ago (within 300s window)
const now = new Date(Date.now() - 60 * 1000);
now.setMilliseconds(0);
const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
const nonce = crypto.randomBytes(16).toString('hex');

console.log("Testing with fresh timestamp (60s ago):");
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

const contentHash = sha256(canonicalJson);
console.log("Content hash:", Buffer.from(contentHash).toString('hex'));

const signature = secp256k1.sign(contentHash, privateKeyBytes);

console.log("Signature r:", signature.r);
console.log("Signature s:", signature.s);

// DER encoding
function encodeDerSignature(r, s) {
    let rHex = r.toString(16).padStart(64, '0');
    let sHex = s.toString(16).padStart(64, '0');
    
    const rBytes = Buffer.from(rHex, 'hex');
    const sBytes = Buffer.from(sHex, 'hex');
    
    let rDer = rBytes;
    let sDer = sBytes;
    if (rBytes[0] & 0x80) rDer = Buffer.concat([Buffer.alloc(1), rBytes]);
    if (sBytes[0] & 0x80) sDer = Buffer.concat([Buffer.alloc(1), sBytes]);
    
    const totalLen = 2 + rDer.length + 2 + sDer.length;
    
    return Buffer.concat([
        Buffer.from([0x30, totalLen]),
        Buffer.from([0x02, rDer.length]),
        rDer,
        Buffer.from([0x02, sDer.length]),
        sDer
    ]);
}

const derSignature = encodeDerSignature(signature.r, signature.s);
const signatureDerB64 = derSignature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

console.log("DER signature:", signatureDerB64);

const authHeader = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureDerB64}"`;

console.log("\nAuth Header:", authHeader);

const response = await axios.post('https://awiki.ai/user-service/did-auth/rpc', {
    jsonrpc: '2.0',
    method: 'verify',
    params: { authorization: authHeader, domain },
    id: 1
});

console.log("\nResponse:", JSON.stringify(response.data, null, 2));
