# @awiki/anp-auth

ANP (awiki Network Protocol) Authentication Module - DID WBA authentication implementation in TypeScript.

## Installation

```bash
npm install @awiki/anp-auth
```

## Dependencies

- `@noble/curves`: Cryptographic curves (secp256k1, secp256r1, X25519)
- `@noble/hashes`: Hash functions (SHA256)

## Usage

### Create DID Identity

```typescript
import { createDidWbaDocumentWithKeyBinding } from '@awiki/anp-auth';

const [didDocument, keys] = createDidWbaDocumentWithKeyBinding({
  hostname: 'awiki.ai',
  pathPrefix: ['user'],
  proofPurpose: 'authentication',
  domain: 'awiki.ai',
  challenge: 'random_challenge_hex',
  services: [{
    id: '#messaging',
    type: 'Messaging',
    serviceEndpoint: 'https://awiki.ai/message/rpc'
  }]
});

console.log(didDocument.id); // did:wba:awiki.ai:user:k1_...
console.log(keys['key-1']);  // [privateKeyPem, publicKeyPem]
console.log(keys['key-2']);  // secp256r1 for E2EE signing
console.log(keys['key-3']);  // X25519 for E2EE key agreement
```

### Generate Authorization Header

```typescript
import { generateAuthHeader } from '@awiki/anp-auth';
import { secp256k1 } from '@noble/curves/secp256k1';

// Load private key from PEM
const privateKey = loadPrivateKey(keys['key-1'][0]);

const authHeader = await generateAuthHeader(
  didDocument,
  'awiki.ai',
  async (content, vmFragment) => {
    // Sign with secp256k1
    const signature = secp256k1.sign(content, privateKey);
    return signature.toDerkBytes();
  },
  'POST',
  '/user-service/did-auth/rpc',
  { method: 'register', params: { did_document: didDocument } }
);

// Use in HTTP request
// Authorization: DIDWba eyJkaWQiOiJkaWQ6d2JhOi4uLiJ9...
```

### Resolve DID Document

```typescript
import { resolveDidWbaDocument } from '@awiki/anp-auth';

const peerDocument = await resolveDidWbaDocument(
  'did:wba:awiki.ai:user:k1_mSDgXJ_LIWEJ_jWrxVCqdWPNuMr1EIVYV7o8yg_zp5w'
);

if (peerDocument) {
  console.log('DID resolved:', peerDocument.id);
  
  // Check E2EE support
  const { supportsE2ee } = await import('@awiki/anp-auth');
  if (supportsE2ee(peerDocument)) {
    console.log('Peer supports E2EE');
  }
}
```

## API Reference

### `createDidWbaDocumentWithKeyBinding(options)`

Creates a DID WBA document with cryptographic key bindings.

**Parameters:**
- `options.hostname` (string): Domain name for the DID
- `options.pathPrefix` (string[]): DID path prefix, e.g., `["user"]`
- `options.proofPurpose` (string): Proof purpose (default: `"authentication"`)
- `options.domain` (string): Service domain bound to the proof
- `options.challenge` (string): Proof nonce for replay prevention
- `options.services` (array): Custom service entries

**Returns:** `[DidDocument, DidKeys]` tuple

### `generateAuthHeader(didDocument, serviceDomain, signCallback, method, path, body)`

Generates DID WBA authorization header for RPC calls.

**Parameters:**
- `didDocument` (DidDocument): The DID document
- `serviceDomain` (string): Target service domain
- `signCallback` (function): Async callback to sign content
- `method` (string): HTTP method (default: `"POST"`)
- `path` (string): Request path (default: `"/"`)
- `body` (object): Request body (optional)

**Returns:** `Promise<string>` - Authorization header value

### `resolveDidWbaDocument(did)`

Resolves a DID WBA document from the network.

**Parameters:**
- `did` (string): The DID to resolve

**Returns:** `Promise<DidDocument | null>`

## Types

### DidDocument

```typescript
interface DidDocument {
  '@context': string[];
  id: string;
  verificationMethod: VerificationMethod[];
  authentication: string[];
  assertionMethod?: string[];
  keyAgreement?: string[];
  service?: ServiceEntry[];
  proof?: Proof;
}
```

### DidKeys

```typescript
interface DidKeys {
  'key-1': [privateKey: string, publicKey: string];  // secp256k1
  'key-2'?: [privateKey: string, publicKey: string]; // secp256r1
  'key-3'?: [privateKey: string, publicKey: string]; // X25519
}
```

## License

MIT
