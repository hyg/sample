import crypto from 'crypto';
import canonicalize from 'canonicalize';
import axios from 'axios';
import { readFileSync } from 'fs';

const cred = JSON.parse(readFileSync('C:/Users/hyg/.openclaw/credentials/awiki-agent-id-message/testfresh.json', 'utf-8'));

// Use specific EC key with secp256k1
const privateKeyObj = crypto.createPrivateKey({
    key: cred.private_key_pem,
    type: 'pkcs8',
    format: 'pem'
});

console.log("Private key type:", privateKeyObj.asymmetricKeyType);

// Check what curve this key uses
const publicKeyObj = crypto.createPublicKey(cred.private_key_pem);
console.log("Public key type:", publicKeyObj.asymmetricKeyType);

// Check details
const details = publicKeyObj.export({ type: 'spki', format: 'der' });
console.log("SPKI length:", details.length);

// Now sign with explicit secp256k1
const did = cred.did;
const domain = 'awiki.ai';
const nonce = crypto.randomBytes(16).toString('hex');
const now = new Date(Date.now() - 60 * 1000);
now.setMilliseconds(0);
const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');

const authData = { nonce, timestamp, aud: domain, did };
const canonicalJson = canonicalize(authData);

// Sign with explicit algorithm
const sign = crypto.createSign('SHA256');
sign.update(canonicalJson);
sign.end();

// Use ECDSA with secp256k1 curve
const signatureDer = sign.sign({
    key: cred.private_key_pem,
    dsaEncoding: 'der'
});

console.log("\nDER signature:", signatureDer.toString('hex'));

// Convert to R||S
function derToRs(der) {
    let offset = 0;
    if (der[offset] !== 0x30) throw new Error('Not DER');
    offset++;
    const len = der[offset]; offset++;
    
    if (der[offset] !== 0x02) throw new Error('Not r integer');
    offset++;
    const rLen = der[offset]; offset++;
    const rBytes = der.slice(offset, offset + rLen); offset += rLen;
    
    if (der[offset] !== 0x02) throw new Error('Not s integer');
    offset++;
    const sLen = der[offset]; offset++;
    const sBytes = der.slice(offset, offset + sLen);
    
    const r = BigInt('0x' + Buffer.from(rBytes).toString('hex'));
    const s = BigInt('0x' + Buffer.from(sBytes).toString('hex'));
    
    return Buffer.concat([
        Buffer.from(r.toString(16).padStart(64, '0'), 'hex'),
        Buffer.from(s.toString(16).padStart(64, '0'), 'hex')
    ]);
}

const sigRs = derToRs(signatureDer);
const sigB64 = sigRs.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

const authHeader = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${sigB64}"`;

console.log("\n--- Test with server ---");
try {
    const resp = await axios.post('https://awiki.ai/user-service/did-auth/rpc', {
        jsonrpc: '2.0', method: 'verify',
        params: { authorization: authHeader, domain }
    }, { timeout: 10000 });
    console.log("Response:", JSON.stringify(resp.data));
} catch(e) {
    console.log("Error:", e.response?.data?.error?.message || e.message);
}
