import crypto from 'crypto';
import canonicalize from 'canonicalize';
import axios from 'axios';
import { readFileSync } from 'fs';

const cred = JSON.parse(readFileSync('C:/Users/hyg/.openclaw/credentials/awiki-agent-id-message/testfresh.json', 'utf-8'));

const privateKeyObj = crypto.createPrivateKey(cred.private_key_pem);

const did = cred.did;
const domain = 'awiki.ai';
const nonce = crypto.randomBytes(16).toString('hex');
const now = new Date(Date.now() - 60 * 1000);
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

// Sign using Node.js crypto (should be compatible with Python)
const sign = crypto.createSign('SHA256');
sign.update(canonicalJson);
sign.end();
const signatureDer = sign.sign(privateKeyObj);

// Convert DER to R||S format
function derToRs(der) {
    // Parse DER structure
    // SEQUENCE: 30 XX
    //   INTEGER r: 02 YY [r bytes]
    //   INTEGER s: 02 ZZ [s bytes]
    
    let offset = 0;
    // Check SEQUENCE tag
    if (der[offset] !== 0x30) throw new Error('Not a DER SEQUENCE');
    offset++;
    
    // Skip length
    const len = der[offset];
    offset++;
    
    // Check INTEGER tag for r
    if (der[offset] !== 0x02) throw new Error('Not an INTEGER (r)');
    offset++;
    
    const rLen = der[offset];
    offset++;
    
    const rBytes = der.slice(offset, offset + rLen);
    offset += rLen;
    
    // Check INTEGER tag for s  
    if (der[offset] !== 0x02) throw new Error('Not an INTEGER (s)');
    offset++;
    
    const sLen = der[offset];
    offset++;
    
    const sBytes = der.slice(offset, offset + sLen);
    
    // Convert to fixed 32-byte big-endian
    const rBigInt = BigInt('0x' + Buffer.from(rBytes).toString('hex'));
    const sBigInt = BigInt('0x' + Buffer.from(sBytes).toString('hex'));
    
    const rPadded = Buffer.from(rBigInt.toString(16).padStart(64, '0'), 'hex');
    const sPadded = Buffer.from(sBigInt.toString(16).padStart(64, '0'), 'hex');
    
    return Buffer.concat([rPadded, sPadded]);
}

const signatureRs = derToRs(signatureDer);
const signatureB64 = signatureRs.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

console.log("\nDER signature:", signatureDer.toString('hex'));
console.log("R||S signature:", signatureRs.toString('hex'));
console.log("Base64url:", signatureB64);

const authHeader = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureB64}"`;

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
