import crypto from 'crypto';
import { readFileSync } from 'fs';

const cred = JSON.parse(readFileSync('C:/Users/hyg/.openclaw/credentials/awiki-agent-id-message/testfresh.json', 'utf-8'));

const privateKeyObj = crypto.createPrivateKey(cred.private_key_pem);

// Get curve from private key
const privateKeyDetails = privateKeyObj.export({ type: 'pkcs8', format: 'der' });
console.log("Private key DER length:", privateKeyDetails.length);

// Look for secp256k1 OID in the key
// secp256k1 OID is 1.3.101.112 = 0x2b 0x65 0x70
const hasSecp256k1 = privateKeyDetails.some((b, i) => 
    b === 0x2b && privateKeyDetails[i+1] === 0x65 && privateKeyDetails[i+2] === 0x70
);

console.log("Contains secp256k1 OID:", hasSecp256k1);

// Also check the public key
const publicKeyObj = crypto.createPublicKey(cred.private_key_pem);
const publicKeyDer = publicKeyObj.export({ type: 'spki', format: 'der' });
console.log("Public key DER length:", publicKeyDer.length);

// Extract the curve OID from SPKI
// After algorithm identifier: 30 07 06 05 2b 65 70 (secp256k1)
const hasSecp256k1Pub = publicKeyDer.some((b, i) => 
    b === 0x2b && publicKeyDer[i+1] === 0x65 && publicKeyDer[i+2] === 0x70
);
console.log("Public key contains secp256k1 OID:", hasSecp256k1Pub);

// Check the actual curve used by crypto
console.log("\nCurve info:");
try {
    // This might show the curve
    const keyDetail = crypto.parseKey(cred.private_key_pem);
    console.log("Key detail curve:", keyDetail?.curve);
} catch(e) {
    console.log("Cannot parse curve:", e.message);
}
