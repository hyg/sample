import axios from 'axios';
import { DIDDocument } from '../core.js';

export class EthrResolver {
  constructor(config = {}) {
    this.defaultNetwork = config.network || 'mainnet';
    this.resolverUrl = config.resolverUrl || 'https://resolver.unstoppabledomains.com';
  }

  async resolve(method, identifier) {
    const didString = `did:ethr:${identifier}`;

    try {
      const response = await axios.get(
        `${this.resolverUrl}/1.0/identifiers/${didString}`,
        { timeout: 10000 }
      );

      return DIDDocument.parse(didString, response.data);
    } catch (error) {
      throw new Error(`Failed to resolve DID ${didString}: ${error.message}`);
    }
  }
}

export default { EthrResolver };
