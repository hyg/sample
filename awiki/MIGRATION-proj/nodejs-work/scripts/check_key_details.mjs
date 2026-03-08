import crypto from 'crypto';
import { readFileSync } from 'fs';

const cred = JSON.parse(readFileSync('C:/Users/hyg/.openclaw/credentials/awiki-agent-id-message/testfresh.json', 'utf-8'));

// Try using ECDH to get curve info
const key = crypto.createPrivateKey(cred.private_key_pem);

// Check asymmetricKeyTypeDetails (Node.js 17+)
console.log("Key type:", key.asymmetricKeyType);
console.log("Key details:", key.asymmetricKeyTypeDetails);

// Try getting curve from public key
const pubKey = crypto.createPublicKey(cred.private_key_pem);
console.log("\nPublic key type:", pubKey.asymmetricKeyType);
console.log("Public key details:", pubKey.asymmetricKeyTypeDetails);

// Check if we can verify with the correct curve
const { ECDH } = crypto;
const ecdh = new ECDH('secp256k1');
ecdh.setPrivateKey(Buffer.from(cred.private_key_pem));
console.log("\nECDH public key:", ecdh.getPublicKey('hex').slice(0, 10));

// Actually, let's see if the key works for signing specifically with secp256k1
// Using crypto.sign with explicit algorithm
const testData = Buffer.from('test');
const sig = crypto.sign(null, testData, {
    key: cred.private_key_pem,
    dsaEncoding: 'der'
});
console.log("\nSign works, length:", sig.length);
