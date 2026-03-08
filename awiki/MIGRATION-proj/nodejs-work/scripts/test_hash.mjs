import canonicalize from 'canonicalize';
import { sha256 } from '@noble/hashes/sha256';

const did = 'did:wba:awiki.ai:user:k1_YyAuYBpZnBFunOHFBOBLmh1WL8kxOe8nvmlWc1MKaXw';
const nonce = 'ec216a9c04a953a49a059a95aedacaca';
const timestamp = '2026-03-07T17:43:56Z';
const domain = 'awiki.ai';

const authData = {
    aud: domain,
    did: did,
    nonce: nonce,
    timestamp: timestamp
};

const canonicalJson = canonicalize(authData);
console.log('Node canonical:', canonicalJson);

const contentHash = sha256(canonicalJson);
console.log('Node content hash:', Buffer.from(contentHash).toString('hex'));
console.log('Node content hash length:', contentHash.length);
