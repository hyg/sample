import { readFileSync } from 'fs';
import crypto from 'crypto';

const cred = JSON.parse(readFileSync('C:/Users/hyg/.openclaw/credentials/awiki-agent-id-message/testfresh.json', 'utf-8'));

const pk = crypto.createPrivateKey(cred.private_key_pem);
const jwk = pk.export({format: 'jwk'});
console.log('d from JWK:', jwk.d);

const dBytes = Buffer.from(jwk.d, 'base64url');
console.log('d bytes (hex):', dBytes.toString('hex'));
