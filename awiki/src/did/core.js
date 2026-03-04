export class DIDDocument {
  constructor(data = {}) {
    this.id = data.id || null;
    this.verificationMethod = data.verificationMethod || [];
    this.authentication = data.authentication || [];
    this.service = data.service || [];
  }

  static parse(didString, doc) {
    const result = new DIDDocument(doc);
    result.id = didString;
    return result;
  }
}

export class DIDResolver {
  constructor() {
    this.methods = new Map();
  }

  registerMethod(name, resolver) {
    this.methods.set(name, resolver);
  }

  async resolve(did) {
    const match = did.match(/^did:([^:]+):(.+)$/);
    if (!match) {
      throw new Error(`Invalid DID format: ${did}`);
    }

    const [, method, identifier] = match;
    const resolver = this.methods.get(method);

    if (!resolver) {
      throw new Error(`Unsupported DID method: ${method}. Supported: ${[...this.methods.keys()].join(', ')}`);
    }

    return resolver.resolve(method, identifier);
  }

  async resolveService(did, serviceType) {
    const doc = await this.resolve(did);
    return doc.service.find(s => s.type === serviceType);
  }
}

export class DID {
  constructor(didString, document = null) {
    this.didString = didString;
    this.document = document;
    this.method = null;
    this.identifier = null;

    if (didString) {
      const match = didString.match(/^did:([^:]+):(.+)$/);
      if (match) {
        this.method = match[1];
        this.identifier = match[2];
      }
    }
  }

  get domain() {
    if (this.method === 'wba') {
      const parts = this.identifier.split(':');
      return parts[0];
    }
    return null;
  }

  get shortId() {
    if (!this.identifier) return '';
    const parts = this.identifier.split(':');
    return parts[parts.length - 1];
  }

  static parse(didString) {
    return new DID(didString);
  }
}

export default { DIDResolver, DIDDocument, DID };
