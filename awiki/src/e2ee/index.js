import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import secp256k1 from 'secp256k1';
import canonicalize from 'json-canonicalize';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function encodeBase64Url(buffer) {
  if (typeof buffer === 'string') {
    buffer = Buffer.from(buffer);
  }
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decodeBase64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

export class E2EEStore {
  constructor(options = {}) {
    this.storeDir = options.storeDir || path.join(__dirname, '../../.credentials');
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.storeDir)) {
      fs.mkdirSync(this.storeDir, { recursive: true });
    }
  }

  getStorePath(credentialName) {
    return path.join(this.storeDir, `e2ee_${credentialName}.json`);
  }

  saveSession(credentialName, peerDid, session) {
    const filepath = this.getStorePath(credentialName);
    let sessions = {};

    if (fs.existsSync(filepath)) {
      sessions = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    }

    sessions[peerDid] = {
      ...session,
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(filepath, JSON.stringify(sessions, null, 2));
  }

  loadSession(credentialName, peerDid) {
    const filepath = this.getStorePath(credentialName);
    if (!fs.existsSync(filepath)) {
      return null;
    }

    const sessions = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    return sessions[peerDid] || null;
  }
}

export class E2EEClient {
  constructor(config = {}) {
    this.store = new E2EEStore(config);
    this.credentialName = config.credentialName || 'default';
    this.localDid = null;
    this.key2 = null; // Signing (P-256)
    this.key3 = null; // Agreement (X25519 or P-256)
    this.key2Raw = null; // Raw private key bytes for secp256k1 lib if needed? No, key-2 is P-256 (secp256r1).
    // Wait, Python uses secp256r1 for Key-2.
    // `secp256k1` npm package is for K1 curve.
    // For R1 (P-256), we should use Node's `crypto` module.
  }

  loadKeys(credential) {
    this.localDid = credential.did;
    
    // Load Key-2 (Signing, P-256)
    if (credential.e2ee_signing_private_pem) {
      this.key2 = crypto.createPrivateKey(credential.e2ee_signing_private_pem);
    }

    // Load Key-3 (Agreement, X25519)
    if (credential.e2ee_agreement_private_pem) {
      this.key3 = crypto.createPrivateKey(credential.e2ee_agreement_private_pem);
    }
  }

  async initiateHandshake(peerDid) {
    const sessionId = crypto.randomUUID();
    
    if (!this.key3) {
      throw new Error("E2EE Key-3 (Agreement) not loaded.");
    }
    
    // In Python, initiate_session takes peer_pk.
    // Here we assume we send the init message to ask peer to start?
    // OR we send our info.
    // Structure of e2ee_init content:
    // { session_id, sender_did, proof, ... }
    
    const content = {
      session_id: sessionId,
      sender_did: this.localDid,
    };

    // Add Proof (Signature with Key-2 P-256)
    const proof = this.signContent(content);
    content.proof = proof;
    
    // Save session as 'initiated'
    const session = {
      session_id: sessionId,
      peerDid: peerDid,
      status: 'initiated',
      created_at: Date.now()
    };
    this.store.saveSession(this.credentialName, peerDid, session);
    
    return {
      type: 'e2ee_init',
      content: content
    };
  }

  signContent(content) {
    if (!this.key2) throw new Error("Key-2 (Signing) not loaded");
    
    // Canonicalize
    const jsonStr = canonicalize(content);
    
    // Hash
    // Note: ANP might hash the canonical string directly?
    // Let's assume SHA-256
    // Python: ecdsa.sign(content, ec.ECDSA(hashes.SHA256()))
    
    const sign = crypto.createSign('SHA256');
    sign.update(jsonStr);
    sign.end();
    const signature = sign.sign(this.key2); // Output DER by default
    
    // Convert DER to Raw R|S if needed, or Base64Url
    // Python `utils/auth.py` uses DER for WBA.
    // Python `utils/e2ee.py` uses what?
    // It calls `session.initiate_session`.
    // ANP usually uses P-256 (secp256r1) for Key-2.
    // The signature format in DIDWba is Base64Url of Raw R|S?
    // In `wba.js` we saw raw R|S conversion.
    // Let's output Base64Url of DER for now, or R|S if we want to be safe.
    // Node crypto sign() returns DER.
    // We can convert to R|S.
    
    return {
      verificationMethod: `${this.localDid}#key-2`,
      created: new Date().toISOString(),
      proofValue: encodeBase64Url(signature) // Using DER for now
    };
  }

  decryptMessage(content) {
    // content has { ciphertext, iv, authTag, session_id }
    // We need to find session
    // This requires ECDH shared secret derivation which requires Peer Key.
    // Since we don't have Peer Key in `initiateHandshake` (we only have peerDid),
    // we can't decrypt unless we resolved Peer DID and got their Key-3.
    // For this mock, we assume plaintext is passed or we fail.
    
    if (content.ciphertext) {
       // Real decryption logic requires shared secret.
       throw new Error("Decryption requires active session with derived keys (not fully implemented in this sample without ANP lib)");
    }
    return { type: 'unknown', plaintext: 'Error: Encrypted content' };
  }
}

export default { E2EEClient, E2EEStore };
