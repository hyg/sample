import axios from 'axios';
import crypto from 'crypto';
import secp256k1 from 'secp256k1';
import { canonicalize } from 'json-canonicalize';
import { DIDDocument, DID } from '../core.js';

const canonicalizeJson = canonicalize;

function encodeBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decodeBase64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

export class WBAResolver {
  constructor(config = {}) {
    this.defaultDomain = config.defaultDomain || 'awiki.ai';
    this.userServiceUrl = config.userServiceUrl || 'https://awiki.ai';
  }

  async resolve(method, identifier) {
    const parts = identifier.split(':');
    const domain = parts[0];

    const didString = `did:${method}:${identifier}`;

    try {
      let url;
      if (parts.length > 1) {
        url = `https://${domain}/${parts.slice(1).join('/')}/did.json`;
      } else {
        url = `https://${domain}/.well-known/did.json`;
      }
      
      const response = await axios.get(url, { timeout: 10000 });
      return DIDDocument.parse(didString, response.data);
    } catch (error) {
      throw new Error(`Failed to resolve DID ${didString}: ${error.message}`);
    }
  }

  setDomain(domain) {
    this.defaultDomain = domain;
  }
}

export class WBAAuth {
  constructor(config = {}) {
    this.userServiceUrl = config.userServiceUrl || 'https://awiki.ai';
    this.moltMessageUrl = config.moltMessageUrl || 'https://awiki.ai';
    this.domain = config.domain || 'awiki.ai';
  }

  generateAuthHeader(didDocument, serviceDomain, privateKeyPem) {
    const did = didDocument.id || didDocument['@id'];
    if (!did) {
      throw new Error('DID document missing id field');
    }

    const verificationMethod = didDocument.authentication?.[0] || didDocument.verificationMethod?.[0];
    const methodFragment = verificationMethod?.id?.split('#')[1] || 'key-1';

    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    const dataToSign = {
      nonce,
      timestamp,
      service: serviceDomain,
      did
    };

    const canonicalJson = canonicalizeJson(dataToSign);
    const contentHash = crypto.createHash('sha256').update(canonicalJson).digest();

    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const signature = crypto.sign('SHA256', contentHash, privateKey);
    const signatureBase64 = encodeBase64Url(signature);

    const authHeader = `DIDWba did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="${methodFragment}", signature="${signatureBase64}"`;

    return authHeader;
  }

  verifyAuthHeader(authHeader, didDocument, serviceDomain) {
    const parts = {};
    const regex = /(\w+)="([^"]+)"/g;
    let match;
    while ((match = regex.exec(authHeader)) !== null) {
      parts[match[1]] = match[2];
    }

    const { did, nonce, timestamp, verification_method, signature } = parts;
    
    if (!did || !nonce || !timestamp || !verification_method || !signature) {
      return { valid: false, error: 'Missing required fields' };
    }

    if (did !== (didDocument.id || didDocument['@id'])) {
      return { valid: false, error: 'DID mismatch' };
    }

    const dataToVerify = {
      nonce,
      timestamp,
      service: serviceDomain,
      did
    };

    const canonicalJson = canonicalizeJson(dataToVerify);
    const contentHash = crypto.createHash('sha256').update(canonicalJson).digest();

    const verificationMethodId = `${did}#${verification_method}`;
    const vm = didDocument.verificationMethod?.find(m => m.id === verificationMethodId);
    
    if (!vm) {
      return { valid: false, error: 'Verification method not found' };
    }

    try {
      const publicKey = this.importPublicKey(vm);
      const signatureBytes = decodeBase64Url(signature);
      const valid = crypto.verify('SHA256', contentHash, publicKey, signatureBytes);
      return { valid, error: valid ? null : 'Signature verification failed' };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  importPublicKey(verificationMethod) {
    if (verificationMethod.publicKeyJwk) {
      const jwk = verificationMethod.publicKeyJwk;
      if (jwk.crv === 'secp256k1') {
        const x = decodeBase64Url(jwk.x);
        const y = decodeBase64Url(jwk.y);
        const publicKeyPem = this.encodeEcPublicKeyPem(x, y, 'secp256k1');
        return crypto.createPublicKey(publicKeyPem);
      }
    }
    throw new Error('Unsupported key format');
  }

  encodeEcPublicKeyPem(x, y, curve) {
    const header = curve === 'secp256k1' ? '04' : '04';
    const keyBytes = Buffer.concat([Buffer.from(header, 'hex'), x, y]);
    const base64Key = keyBytes.toString('base64');
    return `-----BEGIN PUBLIC KEY-----\n${base64Key}\n-----END PUBLIC KEY-----`;
  }

  async register(name, publicKey, privateKey, didDocument = null) {
    try {
      const payload = {
        did_document: didDocument,
        name
      };

      console.log('=== DID Document being sent ===');
      console.log(JSON.stringify(payload, null, 2));

      const response = await axios.post(`${this.userServiceUrl}/user-service/did-auth/rpc`, {
        jsonrpc: '2.0',
        method: 'register',
        params: payload,
        id: 1
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      const { did, jwt } = response.data.result;
      return { did, jwt };
    } catch (error) {
      console.error('Registration error:', error.response?.data || error.message);
      const msg = error.response?.data?.error?.message || error.message;
      throw new Error(`DID registration failed: ${msg}`);
    }
  }

  async refreshJwt(privateKey, did) {
    try {
      const response = await axios.post(`${this.userServiceUrl}/api/v1/dids/refresh`, {
        did,
        privateKey
      });

      return response.data.jwt;
    } catch (error) {
      const msg = error.response?.data?.error?.message || error.message;
      throw new Error(`JWT refresh failed: ${msg}`);
    }
  }

  async getChallenge(did) {
    try {
      const response = await axios.get(`${this.userServiceUrl}/api/v1/dids/challenge`, {
        params: { did }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Get challenge failed: ${error.message}`);
    }
  }

  async verify(did, signature) {
    try {
      const response = await axios.post(`${this.userServiceUrl}/api/v1/dids/verify`, {
        did,
        signature
      });
      return response.data;
    } catch (error) {
      throw new Error(`Verification failed: ${error.message}`);
    }
  }

  async rpcCall(method, params, jwt = null) {
    try {
      const headers = {};
      if (jwt) {
        headers.Authorization = `Bearer ${jwt}`;
      }

      const response = await axios.post(
        `${this.userServiceUrl}/user-service/did-auth/rpc`,
        {
          jsonrpc: '2.0',
          method,
          params,
          id: 1
        },
        { headers }
      );

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.result;
    } catch (error) {
      const msg = error.response?.data?.error?.message || error.message;
      throw new Error(`RPC call failed: ${msg}`);
    }
  }
}

export async function createDIDDocument(hostname, pathSegments = [], options = {}) {
  const { agentDescriptionUrl, domain } = options;

  const ecdh = crypto.createECDH('secp256k1');
  ecdh.generateKeys();
  
  const privateKey = ecdh.getPrivateKey();
  const publicKey = ecdh.getPublicKey();

  const publicKeyJwk = publicKeyToJwk(publicKey, 'secp256k1');

  const did = pathSegments.length > 0 
    ? `did:wba:${hostname}:${pathSegments.join(':')}`
    : `did:wba:${hostname}`;

  const doc = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/jws-2020/v1',
      'https://w3id.org/security/suites/secp256k1-2019/v1'
    ],
    id: did,
    verificationMethod: [{
      id: `${did}#key-1`,
      type: 'EcdsaSecp256k1VerificationKey2019',
      controller: did,
      publicKeyJwk
    }],
    authentication: [`${did}#key-1`]
  };

  if (agentDescriptionUrl) {
    doc.service = [{
      id: `${did}#ad`,
      type: 'AgentDescription',
      serviceEndpoint: agentDescriptionUrl
    }];
  }

  const proof = await signDIDDocument(privateKey, doc, domain || hostname);
  doc.proof = proof;

  const privateKeyPem = `-----BEGIN EC PRIVATE KEY-----\n${privateKey.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END EC PRIVATE KEY-----`;
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${publicKey.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;

  return {
    document: doc,
    keys: {
      'key-1': {
        privateKey: privateKeyPem,
        publicKey: publicKeyPem,
        type: 'secp256k1'
      }
    }
  };
}

function derToRs(der) {
  if (der[0] !== 0x30) throw new Error('Invalid DER');
  const seqLen = der[1];
  let pos = 2;
  if (der[pos] !== 0x02) throw new Error('Invalid R');
  const rLen = der[pos + 1];
  pos += 2;
  let r = der.slice(pos, pos + rLen);
  pos += rLen;
  if (der[pos] !== 0x02) throw new Error('Invalid S');
  const sLen = der[pos + 1];
  pos += 2;
  let s = der.slice(pos, pos + sLen);
  const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  let rBig = BigInt('0x' + r.toString('hex'));
  let sBig = BigInt('0x' + s.toString('hex'));
  if (sBig > CURVE_ORDER / BigInt(2)) {
    sBig = CURVE_ORDER - sBig;
  }
  const rHex = rBig.toString(16).padStart(64, '0');
  const sHex = sBig.toString(16).padStart(64, '0');
  r = Buffer.from(rHex, 'hex');
  s = Buffer.from(sHex, 'hex');
  return Buffer.concat([r, s]);
}

async function signDIDDocument(privateKey, didDocument, domain) {
  const created = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const challenge = crypto.randomBytes(16).toString('hex');
  const proof = {
    type: 'EcdsaSecp256k1Signature2019',
    verificationMethod: `${didDocument.id}#key-1`,
    created,
    proofPurpose: 'authentication',
    domain: domain || 'awiki.ai',
    challenge
  };

  const docToSign = JSON.parse(JSON.stringify(didDocument));
  docToSign.proof = { ...proof, proofValue: '' };
  
  const canonicalJson = canonicalizeJson(docToSign);
  const messageHash = crypto.createHash('sha256').update(canonicalJson).digest();

  const privateKeyBuf = new Uint8Array(privateKey);
  const sig = secp256k1.ecdsaSign(messageHash, privateKeyBuf);
  
  const rsRaw = Buffer.from(sig.signature);
  const r = rsRaw.slice(0, 32);
  const s = rsRaw.slice(32, 64);
  
  const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  let sBig = BigInt('0x' + s.toString('hex'));
  if (sBig > CURVE_ORDER / BigInt(2)) {
    sBig = CURVE_ORDER - sBig;
  }
  const sHex = sBig.toString(16).padStart(64, '0');
  const sNormalized = Buffer.from(sHex, 'hex');
  
  proof.proofValue = encodeBase64Url(Buffer.concat([r, sNormalized]));

  return proof;
}

function publicKeyToJwk(publicKeyBuffer, curve) {
  let uncompressed;
  if (publicKeyBuffer.length === 33) {
    const prefix = publicKeyBuffer[0];
    const x = publicKeyBuffer.slice(1, 33);
    const p = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
    const xBigInt = BigInt('0x' + x.toString('hex'));
    const ySquared = (xBigInt * xBigInt * xBigInt + BigInt(7)) % p;
    let y = BigInt(0);
    for (let i = 0; i < 256; i++) {
      if (y * y % p === ySquared) break;
      y += BigInt(1);
    }
    const yIsEven = y % BigInt(2) === BigInt(0);
    const expectedPrefix = yIsEven ? 2 : 3;
    if (prefix !== expectedPrefix) {
      y = p - y;
    }
    const yBytes = Buffer.alloc(32);
    const yBigIntBytes = y.toString(16).padStart(64, '0');
    Buffer.from(yBigIntBytes, 'hex').copy(yBytes.slice(32 - yBigIntBytes.length / 2));
    uncompressed = Buffer.concat([Buffer.from([0x04]), x, yBytes]);
  } else if (publicKeyBuffer.length === 65 && publicKeyBuffer[0] === 0x04) {
    uncompressed = publicKeyBuffer;
  } else {
    throw new Error('Unsupported public key format');
  }

  const x = uncompressed.slice(1, 33);
  const y = uncompressed.slice(33, 65);
  const xBase64 = encodeBase64Url(x);
  const yBase64 = encodeBase64Url(y);
  const kid = encodeBase64Url(crypto.createHash('sha256').digest(publicKeyBuffer).slice(0, 16));

  return {
    kty: 'EC',
    crv: curve === 'secp256k1' ? 'secp256k1' : 'P-256',
    x: xBase64,
    y: yBase64,
    kid
  };
}

export default { WBAResolver, WBAAuth, createDIDDocument };
