import { DIDDocument } from '../core.js';

export class WebResolver {
  async resolve(method, identifier) {
    const didString = `did:web:${identifier}`;
    const domain = identifier.replace(/\//g, ':');

    try {
      const response = await fetch(`https://${domain}/.well-known/did.json`, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const doc = await response.json();
      return DIDDocument.parse(didString, doc);
    } catch (error) {
      throw new Error(`Failed to resolve DID ${didString}: ${error.message}`);
    }
  }
}

export class KeyResolver {
  async resolve(method, identifier) {
    const didString = `did:key:${identifier}`;

    const doc = new DIDDocument();
    doc.id = didString;

    const multicodec = identifier.startsWith('z') ? this.decodeMultibase(identifier) : null;

    doc.verificationMethod = [{
      id: didString + '#key-1',
      type: 'JsonWebKey2020',
      controller: didString,
      publicKeyJwk: this.extractJWK(identifier)
    }];

    doc.authentication = [didString + '#key-1'];

    return doc;
  }

  decodeMultibase(multibase) {
    const base32Chars = 'abcdefghijklmnopqrstuvwxyz234567';
    const prefix = multibase.charAt(0);
    const data = multibase.slice(1);

    let bits = '';
    for (const char of data.toLowerCase()) {
      const val = base32Chars.indexOf(char);
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, '0');
    }

    return bits;
  }

  extractJWK(key) {
    return {
      kty: 'OKP',
      crv: 'Ed25519',
      x: key
    };
  }
}

export default { WebResolver, KeyResolver };
