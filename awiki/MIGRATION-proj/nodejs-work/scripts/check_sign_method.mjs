import { secp256k1 } from '@noble/curves/secp256k1';
console.log('secp256k1 methods:', Object.keys(secp256k1).filter(k => k.includes('sign')));
