/**
 * DID WBA Authentication module.
 *
 * Node.js implementation based on Python version:
 * anp/authentication/did_wba.py
 */

const crypto = require('crypto');

/**
 * Verification method fragment constants
 */
const VM_KEY_AUTH = "key-1";           // secp256k1, for DID authentication
const VM_KEY_E2EE_SIGNING = "key-2";   // secp256r1, for E2EE message signing
const VM_KEY_E2EE_AGREEMENT = "key-3"; // X25519, for E2EE key agreement

/**
 * Encode bytes to base64url without padding
 * @param {Buffer} data - Input bytes
 * @returns {string} Base64url encoded string
 */
function _encode_base64url(data) {
  return data.toString('base64url');
}

/**
 * Convert secp256r1 (P-256) public key to JWK format
 * @param {crypto.KeyObject} publicKey - EC public key
 * @returns {Object} JWK object
 */
function _secp256r1_public_key_to_jwk(publicKey) {
  // Export public key in uncompressed SEC1 format (0x04 || x || y)
  // Node.js KeyObject export method
  const der = publicKey.export({ type: 'spki', format: 'der' });
  
  // Parse DER to extract x and y coordinates
  // DER format for EC public key:
  // 0x30 [seq-len] 0x30 [seq-len] [OID] 0x03 [bitstr-len] 0x00 [point]
  // Point format: 0x04 || x (32 bytes) || y (32 bytes)
  
  // Find the bit string containing the point
  let offset = 0;
  
  // Skip outer SEQUENCE
  if (der[offset] !== 0x30) throw new Error('Invalid DER: expected SEQUENCE');
  offset += 2; // Skip tag and length
  
  // Skip inner SEQUENCE (algorithm identifier)
  if (der[offset] !== 0x30) throw new Error('Invalid DER: expected SEQUENCE');
  const algSeqLen = der[offset + 1];
  offset += 2 + algSeqLen;
  
  // Skip BIT STRING tag and unused bits byte
  if (der[offset] !== 0x03) throw new Error('Invalid DER: expected BIT STRING');
  const bitStrLen = der[offset + 1];
  offset += 2;
  const unusedBits = der[offset];
  offset += 1;
  
  // Skip uncompressed point indicator (0x04)
  if (der[offset] !== 0x04) throw new Error('Invalid EC point format');
  offset += 1;
  
  // Extract x and y coordinates (32 bytes each for P-256)
  const x = der.slice(offset, offset + 32);
  const y = der.slice(offset + 32, offset + 64);
  
  return {
    kty: "EC",
    crv: "P-256",
    x: _encode_base64url(x),
    y: _encode_base64url(y)
  };
}

/**
 * Convert secp256k1 public key to JWK format
 * @param {crypto.KeyObject} publicKey - EC public key
 * @returns {Object} JWK object
 */
function _public_key_to_jwk(publicKey) {
  // Export public key in uncompressed SEC1 format
  const der = publicKey.export({ type: 'spki', format: 'der' });
  
  // Parse DER to extract x and y coordinates
  let offset = 0;
  
  // Skip outer SEQUENCE
  if (der[offset] !== 0x30) throw new Error('Invalid DER: expected SEQUENCE');
  offset += 2;
  
  // Skip inner SEQUENCE (algorithm identifier)
  if (der[offset] !== 0x30) throw new Error('Invalid DER: expected SEQUENCE');
  const algSeqLen = der[offset + 1];
  offset += 2 + algSeqLen;
  
  // Skip BIT STRING tag and unused bits byte
  if (der[offset] !== 0x03) throw new Error('Invalid DER: expected BIT STRING');
  const bitStrLen = der[offset + 1];
  offset += 2;
  const unusedBits = der[offset];
  offset += 1;
  
  // Skip uncompressed point indicator (0x04)
  if (der[offset] !== 0x04) throw new Error('Invalid EC point format');
  offset += 1;
  
  // Extract x and y coordinates (32 bytes each for secp256k1)
  const x = der.slice(offset, offset + 32);
  const y = der.slice(offset + 32, offset + 64);
  
  // Compute kid as SHA-256 of compressed point
  const compressedPoint = publicKey.export({ type: 'spki', format: 'der' });
  const kid = _encode_base64url(crypto.createHash('sha256').update(compressedPoint).digest());
  
  return {
    kty: "EC",
    crv: "secp256k1",
    x: _encode_base64url(x),
    y: _encode_base64url(y),
    kid: kid
  };
}

/**
 * Build E2EE verification method entries (secp256r1 + X25519)
 *
 * @param {string} did - The DID identifier string
 * @returns {[Array, Array, Object]} Tuple containing:
 *   - vm_entries: list of two verificationMethod dicts (#key-2, #key-3)
 *   - ka_refs: list of keyAgreement references (["#key-3"])
 *   - keys_dict: {"key-2": [priv_pem, pub_pem], "key-3": [priv_pem, pub_pem]}
 */
function _build_e2ee_entries(did) {
  // Generate secp256r1 key pair - return KeyObject for JWK conversion
  const secp256r1_keyPair = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1'
  });
  
  // Generate X25519 key pair - return KeyObject
  const x25519_keyPair = crypto.generateKeyPairSync('x25519');
  
  // Export keys to PEM format
  const secp256r1_private_pem = secp256r1_keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const secp256r1_public_pem = secp256r1_keyPair.publicKey.export({ type: 'spki', format: 'pem' });
  const x25519_private_pem = x25519_keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const x25519_public_pem = x25519_keyPair.publicKey.export({ type: 'spki', format: 'pem' });
  
  // Build verification method entries
  const vm_key2 = {
    id: `${did}#${VM_KEY_E2EE_SIGNING}`,
    type: "EcdsaSecp256r1VerificationKey2019",
    controller: did,
    publicKeyJwk: _secp256r1_public_key_to_jwk(secp256r1_keyPair.publicKey)
  };
  
  // For X25519, use publicKeyMultibase (base58 encoded)
  const x25519_pub_der = x25519_keyPair.publicKey.export({ type: 'spki', format: 'der' });
  // Extract the actual key bytes from DER (skip the header)
  // DER format: 0x30 [len] 0x30 [len] [OID] 0x03 [len] 0x00 [key]
  let x25519_offset = 0;
  if (x25519_pub_der[x25519_offset] === 0x30) {
    x25519_offset += 2;
    if (x25519_pub_der[x25519_offset] === 0x30) {
      const algLen = x25519_pub_der[x25519_offset + 1];
      x25519_offset += 2 + algLen;
    }
  }
  if (x25519_pub_der[x25519_offset] === 0x03) {
    x25519_offset += 2; // Skip tag and length (including unused bits byte)
  }
  const x25519_key_bytes = x25519_pub_der.slice(x25519_offset);
  
  // Encode as base58 (multibase base58btc)
  const x25519_multibase = _base58_encode(x25519_key_bytes);
  
  const vm_key3 = {
    id: `${did}#${VM_KEY_E2EE_AGREEMENT}`,
    type: "X25519KeyAgreementKey2019",
    controller: did,
    publicKeyMultibase: x25519_multibase
  };
  
  const vm_entries = [vm_key2, vm_key3];
  const ka_refs = [`${did}#${VM_KEY_E2EE_AGREEMENT}`];
  
  const keys_dict = {
    "key-2": [Buffer.from(secp256r1_private_pem), Buffer.from(secp256r1_public_pem)],
    "key-3": [Buffer.from(x25519_private_pem), Buffer.from(x25519_public_pem)]
  };
  
  return [vm_entries, ka_refs, keys_dict];
}

/**
 * Base58 encode (simple implementation for multibase)
 * @param {Buffer} data - Input bytes
 * @returns {string} Base58 encoded string with 'z' prefix (base58btc)
 */
function _base58_encode(data) {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const BASE = BigInt(58);
  
  let source = BigInt('0x' + data.toString('hex'));
  if (source === 0n) {
    return 'z1';
  }
  
  let digits = '';
  while (source > 0n) {
    const remainder = source % BASE;
    digits = ALPHABET[Number(remainder)] + digits;
    source = source / BASE;
  }
  
  // Add 'z' prefix for base58btc
  return 'z' + digits;
}

/**
 * Generate DID WBA authentication header
 *
 * @param {Object} didDocument - DID document
 * @param {string} serviceDomain - Service domain
 * @param {Function} signCallback - Signature callback (content: bytes, vm_fragment: str) -> bytes
 * @param {string} [version="1.1"] - Protocol version
 * @returns {string} DIDWba authentication header string
 */
function generate_auth_header(didDocument, serviceDomain, signCallback, version = "1.1") {
  // Validate authentication field
  if (!didDocument.authentication || didDocument.authentication.length === 0) {
    throw new Error('DID document is missing authentication methods.');
  }
  
  // Validate service_domain
  if (!serviceDomain || serviceDomain === '') {
    throw new Error('Invalid signature format: Invalid R|S signature fo');
  }
  
  // Generate timestamp and nonce
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // Build token
  const token = {
    v: version,
    did: didDocument.id,
    domain: serviceDomain,
    timestamp: timestamp,
    nonce: nonce
  };
  
  const tokenStr = JSON.stringify(token);
  
  // Call signature callback
  const signature = signCallback(Buffer.from(tokenStr), 'key-1');
  
  // Encode as base64url
  const base64Token = Buffer.from(tokenStr).toString('base64url');
  const base64Sig = signature.toString('base64url');
  
  return `DIDWba v="${version}", did="${didDocument.id}", token="${base64Token}.${base64Sig}"`;
}

/**
 * Create DID WBA document with key binding
 *
 * @param {string} hostname - Hostname (e.g., "awiki.ai")
 * @param {string[]} pathPrefix - Path prefix array (e.g., ["user"])
 * @param {string} proofPurpose - Proof purpose (e.g., "authentication")
 * @param {string} domain - Domain for proof
 * @param {string} challenge - Challenge string (hex format)
 * @param {Object[] | null} services - Optional service list
 * @returns {[Object, Object]} [didDocument, keys] - DID document and key pairs
 */
function create_did_wba_document(hostname, pathPrefix, proofPurpose, domain, challenge, services = null) {
  const { generate_w3c_proof } = require('./proof');
  
  // Generate three key pairs
  // key-1: secp256k1 for DID authentication
  const keyPair1 = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  
  // key-2: secp256r1 (P-256) for E2EE signing
  const keyPair2 = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  
  // key-3: X25519 for E2EE key agreement
  const keyPair3 = crypto.generateKeyPairSync('x25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  
  // Generate key ID from key-1 public key fingerprint
  const fp = crypto.createHash('sha256')
    .update(keyPair1.publicKey.export({ type: 'spki', format: 'der' }))
    .digest('base64url');
  const key_id = `k1_${fp}`;
  
  // Build DID
  const did_base = `did:wba:${hostname}`;
  const path_segments = [...(pathPrefix || ['user']), key_id];
  const did = `${did_base}:${path_segments.join(':')}`;
  
  // Build verification methods
  const vm_entry1 = {
    id: `${did}#key-1`,
    type: 'EcdsaSecp256k1VerificationKey2019',
    controller: did,
    publicKeyJwk: _public_key_to_jwk(keyPair1.publicKey)
  };
  
  const vm_entry2 = {
    id: `${did}#key-2`,
    type: 'EcdsaSecp256r1VerificationKey2019',
    controller: did,
    publicKeyJwk: _secp256r1_public_key_to_jwk(keyPair2.publicKey)
  };
  
  // X25519 with multibase
  const x25519_pub_der = keyPair3.publicKey.export({ type: 'spki', format: 'der' });
  let x25519_offset = 0;
  if (x25519_pub_der[x25519_offset] === 0x30) {
    x25519_offset += 2;
    if (x25519_pub_der[x25519_offset] === 0x30) {
      const algLen = x25519_pub_der[x25519_offset + 1];
      x25519_offset += 2 + algLen;
    }
  }
  if (x25519_pub_der[x25519_offset] === 0x03) {
    x25519_offset += 2;
  }
  const x25519_key_bytes = x25519_pub_der.slice(x25519_offset);
  const x25519_multibase = _base58_encode(x25519_key_bytes);
  
  const vm_entry3 = {
    id: `${did}#key-3`,
    type: 'X25519KeyAgreementKey2020',
    controller: did,
    publicKeyMultibase: x25519_multibase
  };
  
  // Build DID document
  const did_document = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/jws-2020/v1',
      'https://w3id.org/security/suites/secp256k1-2019/v1',
      'https://w3id.org/security/suites/x25519-2019/v1'
    ],
    id: did,
    verificationMethod: [vm_entry1, vm_entry2, vm_entry3],
    authentication: [`${did}#key-1`],
    keyAgreement: [`${did}#key-3`]
  };
  
  // Add services if provided
  if (services) {
    did_document.service = services;
  }
  
  // Remove proof before signing
  delete did_document.proof;
  
  // Sign with key-1
  const verification_method = `${did}#key-1`;
  const signed_document = generate_w3c_proof({
    document: did_document,
    private_key: keyPair1.privateKey,
    verification_method: verification_method,
    proof_purpose: proofPurpose,
    domain: domain,
    challenge: challenge
  });
  
  // Build keys dictionary
  const keys = {
    'key-1': [Buffer.from(keyPair1.privateKey), Buffer.from(keyPair1.publicKey)],
    'key-2': [Buffer.from(keyPair2.privateKey), Buffer.from(keyPair2.publicKey)],
    'key-3': [Buffer.from(keyPair3.privateKey), Buffer.from(keyPair3.publicKey)]
  };
  
  return [signed_document, keys];
}

module.exports = {
  generate_auth_header,
  create_did_wba_document,
  _build_e2ee_entries,
  VM_KEY_AUTH,
  VM_KEY_E2EE_SIGNING,
  VM_KEY_E2EE_AGREEMENT
};
