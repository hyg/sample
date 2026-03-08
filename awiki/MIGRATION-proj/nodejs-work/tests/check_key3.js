import { loadIdentity } from '../src/credential_store.js';
import { base58btc } from 'multiformats/bases/base58';

const cred = loadIdentity('nodeagent3');
if (!cred) {
    console.log('Credential not found');
    process.exit(1);
}

const key3 = cred.did_document.verificationMethod.find(m => m.id.endsWith('#key-3'));
console.log('key-3 type:', key3.type);
console.log('publicKeyMultibase:', key3.publicKeyMultibase);
console.log('Length:', key3.publicKeyMultibase.length);

// Check if it starts with 'z'
console.log('Starts with z:', key3.publicKeyMultibase.startsWith('z'));

// Decode base58btc to check raw bytes length
const rawBytes = base58btc.decode(key3.publicKeyMultibase);
console.log('Raw bytes length:', rawBytes.length);
