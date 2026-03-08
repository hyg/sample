import canonicalize from 'canonicalize';

const data = {
    aud: 'https://awiki.ai',
    did: 'did:wba:test',
    nonce: 'abc',
    timestamp: '2026-01-01T00:00:00Z'
};

console.log('Node canonicalize:', canonicalize(data));
