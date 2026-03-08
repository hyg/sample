import { ECDSA } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
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

const authData = {
    nonce,
    timestamp,
    aud: domain,
    did
};

// Same as Python
import canonicalize from 'canonicalize';
const canonicalJson = canonicalize(authData);
const contentHash = sha256(canonicalJson);

console.log("Content hash (hex):", Buffer.from(contentHash).toString('hex'));

// Try ECDSA.sign with options
console.log("\n--- Testing ECDSA.sign options ---");

// Default (with internal hash)
const sig1 = ECDSA.sign(contentHash, privateKeyBytes, { lowS: true });
console.log("Default sign r:", sig1.r);
console.log("Default sign s:", sig1.s);

// Try with prehashed: undefined (should hash internally)
const sig2 = ECDSA.sign(contentHash, privateKeyBytes, { lowS: true, hash: undefined });
console.log("\nhash: undefined r:", sig2.r);

// Try with hash: false (no additional hash)
try {
    const sig3 = ECDSA.sign(contentHash, privateKeyBytes, { lowS: true, hash: false });
    console.log("hash: false r:", sig3.r);
} catch(e) {
    console.log("hash: false error:", e.message);
}

// Try with prehash: sha256
const sig4 = ECDSA.sign(contentHash, privateKeyBytes, { lowS: true, prehash: sha256 });
console.log("\nprehash: sha256 r:", sig4.r);

// Let's also try signing a simple message
const simpleMsg = Buffer.from('hello');
const sig5 = ECDSA.sign(simpleMsg, privateKeyBytes, { lowS: true });
console.log("\nSimple message sign r:", sig5.r);

// Now let's see what Python gets when it signs
// Python: content_hash is already SHA256(32 bytes), cryptography signs it (hashes again internally)
// The resulting signature should be the same as noble-curves with default settings

// DER encode both and compare
function encodeDer(r, s) {
    const rBytes = Buffer.from(r.toString(16).padStart(64, '0'), 'hex');
    const sBytes = Buffer.from(s.toString(16).padStart(64, '0'), 'hex');
    
    let rDer = rBytes;
    let sDer = sBytes;
    if (rBytes[0] & 0x80) rDer = Buffer.concat([Buffer.alloc(1), rBytes]);
    if (sBytes[0] & 0x80) sDer = Buffer.concat([Buffer.alloc(1), sBytes]);
    
    const totalLen = 2 + rDer.length + 2 + sDer.length;
    return Buffer.concat([
        Buffer.from([0x30, totalLen]),
        Buffer.from([0x02, rDer.length]), rDer,
        Buffer.from([0x02, sDer.length]), sDer
    ]);
}

const der1 = encodeDer(sig1.r, sig1.s);
const der4 = encodeDer(sig4.r, sig4.s);

console.log("\nDefault DER:", der1.toString('hex'));
console.log("prehash DER:", der4.toString('hex'));

// Expected from Python (for same inputs): 3045022100f74cd4975c79adfc62372c2a1cea292b079519c8ea892f5563a8875e361fad3602205b9f289876f09db6de64af340cff575b9d8b47e2fd471cb36d56e831d45f0e9b
console.log("\nExpected Python: 3045022100f74cd4975c79adfc62372c2a1cea292b079519c8ea892f5563a8875e361fad3602205b9f289876f09db6de64af340cff575b9d8b47e2fd471cb36d56e831d45f0e9b");
