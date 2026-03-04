import secp256k1 from 'secp256k1';
import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { randomBytes, createHash, createSign, createVerify } = crypto;

function generatePrivateKey() {
  let privateKey;
  do {
    privateKey = new Uint8Array(randomBytes(32));
  } while (!secp256k1.privateKeyVerify(privateKey));
  return privateKey;
}

function publicKeyToJWK(publicKeyBuffer) {
  const x = publicKeyBuffer.slice(1, 33);
  const y = publicKeyBuffer.slice(33, 65);
  
  return {
    kty: 'EC',
    crv: 'secp256k1',
    x: Buffer.from(x).toString('base64url'),
    y: Buffer.from(y).toString('base64url')
  };
}

function publicKeyToHex(publicKeyBuffer) {
  return '04' + Buffer.from(publicKeyBuffer).toString('hex');
}

function computeFingerprint(publicKeyBuffer) {
  const sha256 = createHash('sha256');
  sha256.update(publicKeyBuffer);
  const hash = sha256.digest();
  return hash.slice(0, 20).toString('hex');
}

function encodeBase32(buffer) {
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
  
  while (result.length % 8 !== 0) {
    result += '=';
  }
  
  return result.replace(/=+$/, '');
}

function createDIDDocument(did, publicKey, challenge, domain, services = []) {
  const jwk = publicKeyToJWK(publicKey);
  const verificationMethodId = `${did}#key-1`;
  
  const doc = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/secp256k1-2019/v1'
    ],
    id: did,
    verificationMethod: [{
      id: verificationMethodId,
      type: 'EcdsaSecp256k1VerificationKey2019',
      controller: did,
      publicKeyJwk: jwk,
      publicKeyHex: publicKeyToHex(publicKey)
    }],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId],
    service: services.length > 0 ? services : [{
      id: `${did}#service-1`,
      type: 'Messaging',
      serviceEndpoint: `https://${domain}/message/${did}`
    }]
  };

  const proofData = JSON.stringify({
    '@context': 'https://w3id.org/security/v1',
    type: 'EcdsaSecp256k1Signature2019',
    created: new Date().toISOString(),
    domain: domain,
    nonce: challenge,
    proofPurpose: 'authentication',
    verificationMethod: verificationMethodId
  });

  return { doc, proofData };
}

function sign(proofData, privateKeyHex) {
  const privateKey = Buffer.from(privateKeyHex, 'hex');
  const msgHash = createHash('sha256').update(proofData).digest();
  const msgHashUint8 = new Uint8Array(msgHash);
  const privateKeyUint8 = new Uint8Array(privateKey);
  
  const { signature } = secp256k1.ecdsaSign(msgHashUint8, privateKeyUint8);
  return Buffer.from(signature).toString('base64url');
}

export async function createWBAIdentity(name, domain = 'awiki.ai', credentialName = 'default', options = {}) {
  const privateKey = generatePrivateKey();
  const publicKey = secp256k1.publicKeyCreate(privateKey);
  
  const fingerprint = computeFingerprint(publicKey);
  const uniqueId = `k1_${fingerprint}`;
  const did = `did:wba:${domain}:user:${uniqueId}`;
  
  const challenge = randomBytes(16).toString('hex');
  
  const services = options.services || [];
  
  const { doc, proofData } = createDIDDocument(did, publicKey, challenge, domain, services);
  
  const proofSignature = sign(proofData, Buffer.from(privateKey).toString('hex'));
  
  doc.proof = {
    '@context': 'https://w3id.org/security/v1',
    type: 'EcdsaSecp256k1Signature2019',
    created: new Date().toISOString(),
    domain: domain,
    nonce: challenge,
    proofPurpose: 'authentication',
    verificationMethod: `${did}#key-1`,
    proofValue: proofSignature
  };
  
  console.log('=== DID Document ===');
  console.log(JSON.stringify(doc, null, 2));
  
  try {
    console.log('\n=== Registering DID ===');
    const registerResponse = await axios.post(`https://${domain}/api/v1/dids/register`, {
      name,
      did_document: doc
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Register response:', JSON.stringify(registerResponse.data, null, 2));
    
    const { did: registeredDid, jwt } = registerResponse.data;
    
    console.log('\n=== Verifying and getting JWT ===');
    const verifyResponse = await axios.post(`https://${domain}/api/v1/dids/verify`, {
      did: registeredDid,
      privateKey: Buffer.from(privateKey).toString('hex')
    });
    
    console.log('Verify response:', JSON.stringify(verifyResponse.data, null, 2));
    
    const finalJwt = verifyResponse.data.access_token || jwt;
    
    const credentialsDir = path.join(__dirname, '../../.credentials');
    if (!fs.existsSync(credentialsDir)) {
      fs.mkdirSync(credentialsDir, { recursive: true });
    }
    
    const credential = {
      name,
      method: 'wba',
      did: registeredDid,
      uniqueId,
      jwt: finalJwt,
      privateKey: Buffer.from(privateKey).toString('hex'),
      publicKey: Buffer.from(publicKey).toString('hex'),
      publicKeyJwk: publicKeyToJWK(publicKey),
      createdAt: new Date().toISOString(),
      domain
    };
    
    const credPath = path.join(credentialsDir, `${credentialName}.json`);
    fs.writeFileSync(credPath, JSON.stringify(credential, null, 2));
    
    console.log(`\n=== SUCCESS ===`);
    console.log(`Credential saved to: ${credPath}`);
    console.log(`DID: ${registeredDid}`);
    console.log(`Profile URL: https://${domain}/${uniqueId}`);
    
    return credential;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

export default { createWBAIdentity };
