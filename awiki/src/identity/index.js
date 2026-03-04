import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { WBAAuth, createDIDDocument } from '../did/methods/wba.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function encodeToMultibase(buffer, code) {
  const base32Chars = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = '';
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }
  
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5);
    result += base32Chars[parseInt(chunk.padEnd(5, '0'), 2)];
  }
  
  return code + result;
}

export class CredentialStore {
  constructor(options = {}) {
    this.credentialsDir = options.credentialsDir || path.join(__dirname, '../../.credentials');
    this.defaultCredential = options.defaultCredential || 'default';
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.credentialsDir)) {
      fs.mkdirSync(this.credentialsDir, { recursive: true });
    }
  }

  getCredentialPath(name) {
    return path.join(this.credentialsDir, `${name}.json`);
  }

  save(credential, name = this.defaultCredential) {
    const filepath = this.getCredentialPath(name);
    fs.writeFileSync(filepath, JSON.stringify(credential, null, 2));
    return filepath;
  }

  load(name = this.defaultCredential) {
    const filepath = this.getCredentialPath(name);
    if (!fs.existsSync(filepath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  }

  list() {
    if (!fs.existsSync(this.credentialsDir)) {
      return [];
    }
    return fs.readdirSync(this.credentialsDir)
      .filter(f => f.endsWith('.json') && !f.startsWith('e2ee_'))
      .map(f => f.replace('.json', ''));
  }

  delete(name = this.defaultCredential) {
    const filepath = this.getCredentialPath(name);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  }

  exists(name = this.defaultCredential) {
    return fs.existsSync(this.getCredentialPath(name));
  }
}

export class IdentityManager {
  constructor(config = {}) {
    this.store = new CredentialStore(config);
    this.config = config;
    this.authMethods = new Map();
    this.defaultAuthMethod = 'wba';
    
    this.registerAuthMethod('wba', config);
  }

  registerAuthMethod(name, config = {}) {
    if (name === 'wba') {
      this.authMethods.set(name, new WBAAuth(config));
    } else if (name === 'key') {
      this.authMethods.set(name, { type: 'key' });
    } else if (name === 'ethr') {
      this.authMethods.set(name, { type: 'ethr' });
    }
  }

  getAuthMethod(name = this.defaultAuthMethod) {
    const method = this.authMethods.get(name);
    if (!method) {
      throw new Error(`Unknown auth method: ${name}`);
    }
    return method;
  }

  async createIdentity(name, credentialName = 'default', method = 'wba') {
    if (method === 'key') {
      return this.createKeyIdentity(name, credentialName);
    }
    if (method === 'ethr') {
      return this.createEthrIdentity(name, credentialName);
    }
    return this.createWBAIdentity(name, credentialName);
  }

  async createWBAIdentity(name, credentialName = 'default') {
    const domain = this.config.domain || 'awiki.ai';
    
    // Generate path segments: user/name
    const pathSegments = ['user', name.toLowerCase().replace(/\s+/g, '_')];
    
    const { document, keys } = await createDIDDocument(domain, pathSegments, { domain });
    
    const key1 = keys['key-1'];
    
    const auth = this.getAuthMethod('wba');
    
    // If domain is not awiki.ai, we skip registration (user will host it manually)
    let result = { did: document.id, jwt: null };
    
    if (domain === 'awiki.ai') {
       result = await auth.register(name, key1.publicKey, key1.privateKey, document);
    } else {
       console.warn(`Domain is ${domain}, skipping automatic registration. Please upload DID document manually.`);
    }

    const e2eeSigning = this.generateKeyPair('secp256r1');
    const e2eeAgreement = this.generateX25519KeyPair();

    const credential = {
      name,
      method: 'wba',
      did: result.did,
      jwt: result.jwt,
      privateKey: key1.privateKey,
      publicKey: key1.publicKey,
      keyType: 'secp256k1',
      didDocument: document,
      e2ee_signing_private_pem: e2eeSigning.privateKey,
      e2ee_signing_public_pem: e2eeSigning.publicKey,
      e2ee_agreement_private_b64: e2eeAgreement.privateKey,
      e2ee_agreement_public_b64: e2eeAgreement.publicKey,
      createdAt: new Date().toISOString(),
      domain: domain
    };

    this.store.save(credential, credentialName);
    return credential;
  }

  createKeyIdentity(name, credentialName = 'default') {
    const keypair = this.generateKeyPair('ed25519');
    
    const publicKeyBuffer = keypair.publicKeyObj.export({ type: 'spki', format: 'der' });
    const fingerprint = crypto.createHash('sha256').digest(publicKeyBuffer);
    const did = `did:key:z${encodeToMultibase(fingerprint.slice(0, 32), '')}`;

    const credential = {
      name,
      method: 'key',
      did,
      privateKey: keypair.privateKey,
      publicKey: keypair.publicKey,
      keyType: 'ed25519',
      createdAt: new Date().toISOString()
    };

    this.store.save(credential, credentialName);
    return credential;
  }

  async createEthrIdentity(name, credentialName = 'default') {
    const { Wallet } = await import('ethers');
    const wallet = Wallet.createRandom();
    
    const did = `did:ethr:${wallet.address}`;

    const credential = {
      name,
      method: 'ethr',
      did,
      privateKey: wallet.privateKey,
      address: wallet.address,
      keyType: 'secp256k1',
      createdAt: new Date().toISOString()
    };

    this.store.save(credential, credentialName);
    return credential;
  }

  generateKeyPair(keyType = 'secp256k1') {
    if (keyType === 'ed25519') {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
      return {
        publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
        privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
        publicKeyObj: publicKey,
        privateKeyObj: privateKey
      };
    }

    if (keyType === 'secp256k1') {
      const ecdh = crypto.createECDH('secp256k1');
      ecdh.generateKeys();
      const privateKey = ecdh.getPrivateKey();
      const publicKey = ecdh.getPublicKey();
      
      return {
        publicKey: `-----BEGIN PUBLIC KEY-----\n${publicKey.toString('base64')}\n-----END PUBLIC KEY-----\n`,
        privateKey: `-----BEGIN PRIVATE KEY-----\n${privateKey.toString('base64')}\n-----END PRIVATE KEY-----\n`,
        publicKeyObj: publicKey,
        privateKeyObj: privateKey
      };
    }

    if (keyType === 'secp256r1') {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1'
      });
      return {
        publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
        privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
        publicKeyObj: publicKey,
        privateKeyObj: privateKey
      };
    }

    throw new Error(`Unsupported key type: ${keyType}`);
  }

  generateX25519KeyPair() {
    try {
      const ecdh = crypto.createECDH('x25519');
      ecdh.generateKeys();
      return {
        publicKey: ecdh.getPublicKey('base64'),
        privateKey: ecdh.getPrivateKey('base64')
      };
    } catch (e) {
      console.warn('X25519 not supported, falling back to P-256');
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1'
      });
      return {
        publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
        privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
        isP256: true
      };
    }
  }

  loadIdentity(credentialName = 'default') {
    const credential = this.store.load(credentialName);
    if (!credential) {
      throw new Error(`Credential not found: ${credentialName}`);
    }
    return credential;
  }

  async refreshJwt(credentialName = 'default') {
    const credential = this.loadIdentity(credentialName);
    if (credential.method !== 'wba') {
      throw new Error('JWT refresh only supported for wba method');
    }
    
    const auth = this.getAuthMethod('wba');
    const newJwt = await auth.refreshJwt(credential.privateKey, credential.did);
    credential.jwt = newJwt;
    this.store.save(credential, credentialName);
    return credential;
  }

  listIdentities() {
    return this.store.list();
  }

  deleteIdentity(credentialName = 'default') {
    return this.store.delete(credentialName);
  }

  setDefaultCredential(name) {
    this.store.defaultCredential = name;
  }
}

export default { CredentialStore, IdentityManager };
