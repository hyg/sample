import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

const priv = secp256k1.utils.randomPrivateKey();
const pub = secp256k1.getPublicKey(priv, false);
const msg = sha256(Buffer.from('test'));

const sig = secp256k1.sign(msg, priv);

console.log('Signature object methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(sig)));

// Try verify with compact raw bytes
const compact = sig.toCompactRawBytes();
console.log('Compact sig length:', compact.length);
console.log('Verify compact:', secp256k1.verify(compact, msg, pub));

// Try verify with DER raw bytes
const der = sig.toDERRawBytes();
console.log('DER sig length:', der.length);
console.log('Verify DER:', secp256k1.verify(der, msg, pub));

// Try with 64-byte R||S format
const r = sig.r;
const s = sig.s;
const rBytes = Buffer.from(r.toString(16).padStart(64, '0'), 'hex');
const sBytes = Buffer.from(s.toString(16).padStart(64, '0'), 'hex');
const compact64 = Buffer.concat([rBytes, sBytes]);
console.log('64-byte R||S length:', compact64.length);
console.log('Verify 64-byte:', secp256k1.verify(compact64, msg, pub));
