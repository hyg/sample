import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { secp256k1 } from '@noble/curves/secp256k1';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_OUTPUT_DIR = join(__dirname, '../../scripts/tests/python_output');

const py = JSON.parse(readFileSync(join(PYTHON_OUTPUT_DIR, 'did_proof_intermediate.json'), 'utf-8'));

console.log("=== Python Private Key PEM ===");
console.log(py.step1_keypair.private_key_pem);

// Method 1: Use crypto module to extract JWK
console.log("\n=== Method 1: crypto.createPrivateKey with JWK export ===");
const privateKey = crypto.createPrivateKey(py.step1_keypair.private_key_pem);
const jwk = privateKey.export({ format: 'jwk' });

console.log("JWK d (private):", jwk.d);
console.log("JWK x (public x):", jwk.x);
console.log("JWK y (public y):", jwk.y);

// Convert from base64url to hex
function base64urlToHex(b64) {
    const buf = Buffer.from(b64, 'base64url');
    return buf.toString('hex');
}

const privHex = base64urlToHex(jwk.d);
const pubXHex = base64urlToHex(jwk.x);
const pubYHex = base64urlToHex(jwk.y);

console.log("\nPrivate key (hex):", privHex);
console.log("Public X (hex):", pubXHex);
console.log("Public Y (hex):", pubYHex);

console.log("\n=== Comparison with Python values ===");
console.log("Python priv (last 32):", py.step1_keypair.private_key_pem.split('\n').filter(l => !l.startsWith('-----')).join('').slice(-44));
console.log("Python pub X:", py.step1_keypair.public_key_x_hex);
console.log("Python pub Y:", py.step1_keypair.public_key_y_hex);

console.log("\nX match:", pubXHex === py.step1_keypair.public_key_x_hex);
console.log("Y match:", pubYHex === py.step1_keypair.public_key_y_hex);

// Method 2: Parse DER manually
console.log("\n=== Method 2: Manual DER parsing ===");
const pemLines = py.step1_keypair.private_key_pem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
const der = Buffer.from(pemLines.join(''), 'base64');

console.log("DER length:", der.length);
console.log("DER (hex):", der.toString('hex'));

// PKCS#8 format for EC:
// 30 81 84 - SEQUENCE, length 132
// 02 01 00 - INTEGER 0 (version)
// 30 10    - SEQUENCE, length 16
// 06 07 ... - OID ecPublicKey
// 06 05 ... - OID secp256k1
// 04 6d    - OCTET STRING, length 109 (the ECPrivateKey)
//   30 6b  - ECPrivateKey SEQUENCE, length 107
//   02 01 01 - INTEGER 1 (version)
//   04 20 [32 bytes] - OCTET STRING, private key
//   ...

// Find the private key octet string
// Look for 04 20 pattern (OCTET STRING, length 32)
let privOffset = -1;
for (let i = 0; i < der.length - 2; i++) {
    if (der[i] === 0x04 && der[i+1] === 0x20) {
        privOffset = i + 2;
        break;
    }
}

if (privOffset > 0) {
    const privBytes = der.slice(privOffset, privOffset + 32);
    console.log("Private key from DER (hex):", privBytes.toString('hex'));
    console.log("Private key matches JWK:", privBytes.toString('hex') === privHex);
    
    // Get public key from private key
    const pubFromPriv = secp256k1.getPublicKey(privBytes, false);
    console.log("Public from priv (hex):", Buffer.from(pubFromPriv).toString('hex'));
    
    const pubXFromPriv = Buffer.from(pubFromPriv).slice(1, 33).toString('hex');
    const pubYFromPriv = Buffer.from(pubFromPriv).slice(33, 65).toString('hex');
    
    console.log("\nX from priv matches Python:", pubXFromPriv === py.step1_keypair.public_key_x_hex);
    console.log("Y from priv matches Python:", pubYFromPriv === py.step1_keypair.public_key_y_hex);
}
