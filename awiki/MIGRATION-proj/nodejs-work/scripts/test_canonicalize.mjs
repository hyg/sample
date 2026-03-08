import canonicalize from 'canonicalize';

const data = {
    aud: 'https://awiki.ai',
    did: 'did:wba:awiki.ai:user:k1_test',
    nonce: '01b28cf0d72b5b203369d73ab47948c2',
    timestamp: '2026-03-07T17:36:26Z'
};

console.log('Node canonicalize:', canonicalize(data));
