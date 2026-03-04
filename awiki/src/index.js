export { DIDRegistry, DIDResolver, DID, DIDDocument, WBAAuth } from './did/index.js';
export { IdentityManager, CredentialStore } from './identity/index.js';
export { MessageService, AWikiMessaging, Transport, HTTPTransport, WebSocketTransport, MoltxTransport } from './messaging/index.js';
export { E2EEClient, E2EEStore } from './e2ee/index.js';

import { IdentityManager } from './identity/index.js';
import { MessageService, AWikiMessaging } from './messaging/index.js';
import { E2EEClient } from './e2ee/index.js';
import { DIDRegistry } from './did/index.js';

export class AgentIdentityService {
  constructor(config = {}) {
    this.config = config;
    this.identityManager = new IdentityManager(config);
    this.messaging = new AWikiMessaging(config);
    this.e2ee = new E2EEClient(config);
    this.didRegistry = new DIDRegistry(config);
  }

  async createIdentity(name, credentialName = 'default') {
    return this.identityManager.createIdentity(name, credentialName);
  }

  loadIdentity(credentialName = 'default') {
    const credential = this.identityManager.loadIdentity(credentialName);
    this.messaging.setAuth(credential.jwt);
    return credential;
  }

  async refreshJwt(credentialName = 'default') {
    const credential = await this.identityManager.refreshJwt(credentialName);
    this.messaging.setAuth(credential.jwt);
    return credential;
  }

  listIdentities() {
    return this.identityManager.listIdentities();
  }

  deleteIdentity(credentialName = 'default') {
    return this.identityManager.deleteIdentity(credentialName);
  }

  async sendMessage(to, content, options = {}) {
    return this.messaging.sendMessage(to, content, options.type || 'text');
  }

  async checkInbox(options = {}) {
    return this.messaging.checkInbox(options);
  }

  async markAsRead(messageIds) {
    return this.messaging.markAsRead(messageIds);
  }

  async resolveDID(did) {
    return this.didRegistry.resolve(did);
  }

  async initiateE2EE(peerDid) {
    const keypair = this.e2ee.generateKeyPair();
    return this.e2ee.initiateHandshake(peerDid, keypair.privateKey, keypair.publicKey);
  }

  async processE2EE(peerDid, peerPublicKey, privateKey) {
    return this.e2ee.processHandshake(peerDid, peerPublicKey, privateKey);
  }

  async sendEncrypted(peerDid, content) {
    return this.e2ee.sendEncrypted(peerDid, content);
  }

  async receiveEncrypted(peerDid) {
    return this.e2ee.receiveEncrypted(peerDid);
  }
}

export default AgentIdentityService;
