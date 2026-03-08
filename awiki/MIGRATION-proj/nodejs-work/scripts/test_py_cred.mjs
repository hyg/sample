import { loadIdentity } from './src/credential_store.js';
import { generateWbaAuthHeader } from './src/utils/auth.js';
import { createSDKConfig } from './src/utils/config.js';

const cred = loadIdentity('testfresh');  // This is Python-created
console.log('Loaded credential DID:', cred.did);
console.log('Has private_key_hex:', !!cred.private_key_hex);

const config = createSDKConfig();
const privateKey = cred.private_key_hex 
    ? Buffer.from(cred.private_key_hex, 'hex') 
    : cred.private_key_pem;
const authHeader = generateWbaAuthHeader(cred.did_document, config.did_domain, privateKey);
console.log('Auth header:', authHeader);
