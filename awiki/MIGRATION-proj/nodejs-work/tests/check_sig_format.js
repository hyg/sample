import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

const py = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));

function decodeBase64Url(str) {
    const padding = '='.repeat((4 - str.length % 4) % 4);
    return Buffer.from(str + padding, 'base64');
}

console.log("=== Python Signature Format Analysis ===\n");

const contentHash = Buffer.from(py.step6_content_hash_hex, 'hex');
const pySigB64 = py.step9_final_signature.base64url;
const pySig = decodeBase64Url(pySigB64);

console.log("Signature (base64url):", pySigB64);
console.log("Signature (hex):", pySig.toString('hex'));
console.log("Signature length:", pySig.length, "bytes");

// Check if it's DER format (starts with 0x30)
if (pySig[0] === 0x30) {
    console.log("\nSignature appears to be DER format");
    
    // Parse DER
    // 30 [len] 02 [r_len] [r] 02 [s_len] [s]
    if (pySig[2] === 0x02) {
        const rLen = pySig[3];
        const r = pySig.slice(4, 4 + rLen);
        const sOffset = 4 + rLen + 2;
        const sLen = pySig[sOffset - 1];
        const s = pySig.slice(sOffset, sOffset + sLen);
        
        console.log("R length:", rLen, "bytes");
        console.log("S length:", sLen, "bytes");
        console.log("R (hex):", r.toString('hex'));
        console.log("S (hex):", s.toString('hex'));
        
        // Normalize to 64 bytes
        const r32 = r.length === 32 ? r : Buffer.concat([Buffer.alloc(32 - r.length), r]);
        const s32 = s.length === 32 ? s : Buffer.concat([Buffer.alloc(32 - s.length), s]);
        const compact = Buffer.concat([r32, s32]);
        
        // Get public key
        const privateKey = crypto.createPrivateKey(py.step1_keypair.private_key_pem);
        const jwk = privateKey.export({ format: 'jwk' });
        const pubX = Buffer.from(jwk.x, 'base64url');
        const pubY = Buffer.from(jwk.y, 'base64url');
        const pubBytes = Buffer.concat([Buffer.from([0x04]), pubX, pubY]);
        
        console.log("\nVerify DER signature:", secp256k1.verify(pySig, contentHash, pubBytes));
        console.log("Verify compact signature:", secp256k1.verify(compact, contentHash, pubBytes));
    }
} else if (pySig.length === 64) {
    console.log("\nSignature appears to be R||S format (64 bytes)");
    
    const r = pySig.slice(0, 32);
    const s = pySig.slice(32, 64);
    
    console.log("R (hex):", r.toString('hex'));
    console.log("S (hex):", s.toString('hex'));
    
    // Get public key
    const privateKey = crypto.createPrivateKey(py.step1_keypair.private_key_pem);
    const jwk = privateKey.export({ format: 'jwk' });
    const pubX = Buffer.from(jwk.x, 'base64url');
    const pubY = Buffer.from(jwk.y, 'base64url');
    const pubBytes = Buffer.concat([Buffer.from([0x04]), pubX, pubY]);
    
    console.log("\nVerify R||S signature:", secp256k1.verify(pySig, contentHash, pubBytes));
}

// Check Python's DER signature from step 7
console.log("\n=== Python's DER Signature from Step 7 ===");
console.log("DER (hex):", py.step7_signature.der_hex);

const derSig = Buffer.from(py.step7_signature.der_hex, 'hex');
console.log("DER length:", derSig.length, "bytes");

// Verify DER signature
const privateKey = crypto.createPrivateKey(py.step1_keypair.private_key_pem);
const jwk = privateKey.export({ format: 'jwk' });
const pubX = Buffer.from(jwk.x, 'base64url');
const pubY = Buffer.from(jwk.y, 'base64url');
const pubBytes = Buffer.concat([Buffer.from([0x04]), pubX, pubY]);

console.log("Verify Python DER signature:", secp256k1.verify(derSig, contentHash, pubBytes));
