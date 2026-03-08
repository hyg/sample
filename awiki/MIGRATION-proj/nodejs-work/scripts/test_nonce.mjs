import axios from 'axios';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';
import { readFileSync } from 'fs';

// Load Python-created identity
const cred = JSON.parse(readFileSync('C:/Users/hyg/.openclaw/credentials/awiki-agent-id-message/testfresh.json', 'utf-8'));

console.log("=" * 60);
console.log("TEST: Python identity with different nonce lengths");
console.log("=" * 60);

const crypto = await import('crypto');
const privateKeyObj = crypto.createPrivateKey(cred.private_key_pem);
const privateKeyJwk = privateKeyObj.export({ format: 'jwk' });
const privateKeyBytes = Buffer.from(Buffer.from(privateKeyJwk.d, 'base64url').toString('hex'), 'hex');

const did = cred.did;
const domain = 'awiki.ai';

async function testNonce(nonce, desc) {
    const now = new Date();
    now.setMilliseconds(0);
    const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    
    const authData = {
        nonce,
        timestamp,
        aud: domain,
        did
    };
    
    const canonicalJson = canonicalize(authData);
    const contentHash = sha256(canonicalJson);
    
    const signature = secp256k1.sign(contentHash, privateKeyBytes);
    
    const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    let s = signature.s;
    const normalizedS = s > CURVE_ORDER / BigInt(2) ? CURVE_ORDER - s : s;
    
    const rBytes = Buffer.from(signature.r.toString(16).padStart(64, '0'), 'hex');
    const sBytes = Buffer.from(normalizedS.toString(16).padStart(64, '0'), 'hex');
    
    const signatureRs = Buffer.concat([rBytes, sBytes]);
    const signatureB64Url = signatureRs.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    const authHeader = `DIDWba v="1.1", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="key-1", signature="${signatureB64Url}"`;
    
    try {
        const response = await axios.post('https://awiki.ai/user-service/did-auth/rpc', {
            jsonrpc: '2.0',
            method: 'verify',
            params: {
                authorization: authHeader,
                domain: domain
            },
            id: 1
        }, { timeout: 10000 });
        
        console.log(`\n${desc}:`);
        console.log(`  Nonce length: ${nonce.length}`);
        console.log(`  Response: ${JSON.stringify(response.data)}`);
    } catch (e) {
        console.log(`\n${desc}:`);
        console.log(`  Nonce length: ${nonce.length}`);
        console.log(`  Error: ${e.response?.data?.error?.message || e.message}`);
    }
}

// Test different nonce lengths
await testNonce('3ecb579c9718d45b443323d110daeb14', 'Python format (32 hex chars)');
await testNonce(crypto.randomBytes(16).toString('hex'), 'Node.js random (32 hex chars)');
await testNonce('abc123', 'Short nonce');
