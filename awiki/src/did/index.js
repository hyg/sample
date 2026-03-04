import { DIDResolver, DID, DIDDocument } from './core.js';
import { WBAResolver, WBAAuth, createDIDDocument } from './methods/wba.js';
import { WebResolver, KeyResolver } from './methods/web.js';
import { EthrResolver } from './methods/ethr.js';

export class DIDRegistry {
  constructor(config = {}) {
    this.resolver = new DIDResolver();
    this.auth = new WBAAuth(config);
    this.config = config;

    this.registerDefaultMethods();
  }

  registerDefaultMethods() {
    this.resolver.registerMethod('wba', new WBAResolver(this.config));
    this.resolver.registerMethod('web', new WebResolver());
    this.resolver.registerMethod('key', new KeyResolver());
    this.resolver.registerMethod('ethr', new EthrResolver(this.config));
  }

  registerMethod(name, resolver) {
    this.resolver.registerMethod(name, resolver);
  }

  async resolve(did) {
    return this.resolver.resolve(did);
  }

  async resolveService(did, serviceType) {
    return this.resolver.resolveService(did, serviceType);
  }

  createDID(method, identifier) {
    return new DID(`did:${method}:${identifier}`);
  }
}

export { DIDResolver, DID, DIDDocument, WBAAuth, createDIDDocument };
export default { DIDRegistry, DIDResolver, DID, DIDDocument, WBAAuth, createDIDDocument };
