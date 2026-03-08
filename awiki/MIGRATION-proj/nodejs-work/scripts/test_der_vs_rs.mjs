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
const nonce = '3ecb579c9718d45b443323d110daeb14';
const timestamp = '2026-03-07T17:43:56Z';

const authData = {
    nonce,
    timestamp,
    aud: domain,
    did
};

const canonicalJson = canonicalize(authData);
const contentHash = sha256(canonicalJson);

console.log("Testing DER encoding vs R||S encoding...\n");

const signature = secp256k1.sign(contentHash, privateKeyBytes);

// Method 1: R||S encoding (what we tried before)
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
let s = signature.s;
const normalizedS = s > CURVE_ORDER / BigInt(2) ? CURVE_ORDER - s : s;

const rBytesRs = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
const sBytesRs = Buffer.from(normalizedS.toString(16).padStart(64, '0'), 'hex');
const signatureRs = Buffer.concat([rBytesRs, sBytesRs]);
const signatureRsB64 = signatureRs.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

// Method 2: DER encoding
function encodeDerSignature(r, s) {
    let rHex = r.toString(16).padStart(64, '0');
    let sHex = s.toString(16).padStart(64, '0');
    
    // Convert hex to bytes
    const rBytes = Buffer.from(rHex, 'hex');
    const sBytes = Buffer.from(sHex, 'hex');
    
    // Add leading zero if high bit is set
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

console.log("R||S signature:", signatureRsB64);
console.log("DER signature:", signatureDerB64);

// Test R||S first
console.log("\n--- Test R||S encoding ---");
const authHeaderRs = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureRsB64}"`;

try {
    const responseRs = await axios.post('https://awiki.ai/user-service/did-auth/rpc', {
        jsonrpc: '2.0',
        method: 'verify',
        params: { authorization: authHeaderRs, domain },
        id: 1
    }, { timeout: 10000 });
    console.log("R||S Result:", JSON.stringify(responseRs.data));
} catch (e) {
    console.log("R||S Error:", e.response?.data?.error?.message || e.message);
}

// Test DER
console.log("\n--- Test DER encoding ---");
const authHeaderDer = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureDerB64}"`;

try {
    const responseDer = await axios.post('https://awiki.ai/user-service/did-auth/rpc', {
        jsonrpc: '2.0',
        method: 'verify',
        params: { authorization: authHeaderDer, domain },
        id: 1
    }, { timeout: 10000 });
    console.log("DER Result:", JSON.stringify(responseDer.data));
} catch (e) {
    console.log("DER Error:", e.response?.data?.error?.message || e.message);
}
