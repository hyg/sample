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
const nonce = 'f685f264c64d801d5f6ea4d5b3895d43';
const timestamp = '2026-03-07T18:02:16Z';

// Same as Python
const authData = {
    nonce,
    timestamp,
    aud: domain,
    did
};

const canonicalJson = canonicalize(authData);
console.log("Node canonical:", canonicalJson);

// First hash
const contentHash = sha256(canonicalJson);
console.log("Node content hash:", Buffer.from(contentHash).toString('hex'));

// Now noble-curves will hash again internally when signing
const signature = secp256k1.sign(contentHash, privateKeyBytes);

console.log("Node signature r:", signature.r);
console.log("Node signature s:", signature.s);

// DER encode
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
console.log("Node DER signature:", derSignature.toString('hex'));

// Now let's try NOT pre-hashing - pass the canonical JSON directly
console.log("\n--- Testing without pre-hashing ---");
const signature2 = secp256k1.sign(Buffer.from(canonicalJson, 'utf-8'), privateKeyBytes);
const derSignature2 = encodeDerSignature(signature2.r, signature2.s);
console.log("Node DER signature (no pre-hash):", derSignature2.toString('hex'));

// Expected from Python: 3045022100f74cd4975c79adfc62372c2a1cea292b079519c8ea892f5563a8875e361fad3602205b9f289876f09db6de64af340cff575b9d8b47e2fd471cb36d56e831d45f0e9b
console.log("\nExpected from Python: 3045022100f74cd4975c79adfc62372c2a1cea292b079519c8ea892f5563a8875e361fad3602205b9f289876f09db6de64af340cff575b9d8b47e2fd471cb36d56e831d45f0e9b");
