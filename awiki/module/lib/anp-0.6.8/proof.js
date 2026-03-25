/**
 * W3C Data Integrity Proof generation and verification.
 *
 * Node.js implementation based on Python version:
 * anp/proof/proof.py
 *
 * Implements proof generation and verification following the W3C Data Integrity
 * specification (https://www.w3.org/TR/vc-data-integrity/), adapted for ANP
 * use cases with JCS canonicalization (RFC 8785).
 */

const crypto = require('crypto');

/**
 * Proof type constants
 */
const PROOF_TYPE_SECP256K1 = "EcdsaSecp256k1Signature2019";
const PROOF_TYPE_ED25519 = "Ed25519Signature2020";

/**
 * Encode bytes as base64url without padding
 * @param {Buffer} data - Input bytes
 * @returns {string} Base64url encoded string
 */
function _b64url_encode(data) {
  return data.toString('base64url');
}

/**
 * Decode base64url string (with or without padding)
 * @param {string} str - Base64url encoded string
 * @returns {Buffer} Decoded bytes
 */
function _b64url_decode(str) {
  // Add padding if necessary
  let padded = str;
  while (padded.length % 4 !== 0) {
    padded += '=';
  }
  return Buffer.from(padded, 'base64');
}

/**
 * Canonicalize a JSON object using JCS (RFC 8785)
 * @param {Object} obj - JSON object to canonicalize
 * @returns {Buffer} Canonical byte representation
 */
function _canonicalize(obj) {
  // JCS canonicalization: sorted keys, no extra whitespace
  return Buffer.from(JSON.stringify(obj, Object.keys(obj).sort()));
}

/**
 * Compute SHA-256 hash of bytes
 * @param {Buffer} data - Input bytes
 * @returns {Buffer} SHA-256 hash
 */
function _hash_bytes(data) {
  return crypto.createHash('sha256').update(data).digest();
}

/**
 * Sign data with secp256k1 ECDSA, return R||S raw signature
 * @param {crypto.KeyObject} privateKey - EC private key
 * @param {Buffer} data - Data to sign
 * @returns {Buffer} R||S format signature (64 bytes)
 */
function _sign_secp256k1(privateKey, data) {
  // Sign with DER encoding
  const derSig = crypto.createSign('SHA256')
    .update(data)
    .sign({
      key: privateKey,
      dsaEncoding: 'der'
    });

  // Convert DER to raw R||S format
  // DER format: 0x30 [total-len] 0x02 [R-len] [R] 0x02 [S-len] [S]
  let r = derSig.slice(4, 4 + derSig[3]);
  let s = derSig.slice(6 + derSig[3]);

  // Ensure 32-byte encoding (pad with leading zeros if necessary)
  if (r.length < 32) {
    r = Buffer.concat([Buffer.alloc(32 - r.length, 0), r]);
  }
  if (s.length < 32) {
    s = Buffer.concat([Buffer.alloc(32 - s.length, 0), s]);
  }

  return Buffer.concat([r, s]);
}

/**
 * Verify secp256k1 ECDSA signature (R||S format)
 * @param {crypto.KeyObject} publicKey - EC public key
 * @param {Buffer} data - Signed data
 * @param {Buffer} signature - R||S format signature
 * @returns {boolean} True if valid
 */
function _verify_secp256k1(publicKey, data, signature) {
  try {
    // Convert R||S to DER format
    const r = signature.slice(0, 32);
    const s = signature.slice(32);

    // Remove leading zeros for DER encoding
    let rBytes = r;
    let sBytes = s;
    while (rBytes.length > 0 && rBytes[0] === 0) {
      rBytes = rBytes.slice(1);
    }
    while (sBytes.length > 0 && sBytes[0] === 0) {
      sBytes = sBytes.slice(1);
    }

    // Add 0x00 prefix if high bit is set (to indicate positive number)
    if (rBytes.length > 0 && rBytes[0] & 0x80) {
      rBytes = Buffer.concat([Buffer.alloc(1, 0), rBytes]);
    }
    if (sBytes.length > 0 && sBytes[0] & 0x80) {
      sBytes = Buffer.concat([Buffer.alloc(1, 0), sBytes]);
    }

    // Build DER signature
    const derSig = Buffer.concat([
      Buffer.from([0x30, rBytes.length + sBytes.length + 4, 0x02, rBytes.length]),
      rBytes,
      Buffer.from([0x02, sBytes.length]),
      sBytes
    ]);

    // Verify with DER encoding
    return crypto.createVerify('SHA256')
      .update(data)
      .verify({
        key: publicKey,
        dsaEncoding: 'der'
      }, derSig);
  } catch (e) {
    return false;
  }
}

/**
 * Compute the data to be signed following W3C Data Integrity
 * @param {Object} document - Document to sign (without proof field)
 * @param {Object} proofOptions - Proof options
 * @returns {Buffer} Concatenated hash bytes ready for signing
 */
function _compute_signing_input(document, proofOptions) {
  const doc_hash = _hash_bytes(_canonicalize(document));
  const options_hash = _hash_bytes(_canonicalize(proofOptions));
  return Buffer.concat([options_hash, doc_hash]);
}

/**
 * Generate a W3C Data Integrity Proof for a JSON document
 *
 * @param {Object} options - Options object
 * @param {Object} options.document - JSON document to sign
 * @param {crypto.KeyObject|crypto.PrivateKeyObject|string|Buffer} options.private_key - Private key for signing
 * @param {string} options.verification_method - Full DID URL of verification method
 * @param {string} [options.proof_purpose="assertionMethod"] - Purpose of the proof
 * @param {string} [options.proof_type] - Explicit proof type (auto-detected if null)
 * @param {string} [options.created] - ISO 8601 timestamp (current time if null)
 * @param {string} [options.domain] - Optional domain restriction
 * @param {string} [options.challenge] - Optional challenge string
 * @returns {Object} New document with proof attached
 * @throws {Error} If key type doesn't match proof_type or is unsupported
 */
function generate_w3c_proof({
  document,
  private_key,
  verification_method,
  proof_purpose = "assertionMethod",
  proof_type = null,
  created = null,
  domain = null,
  challenge = null
}) {
  // Convert PEM string to KeyObject if necessary
  let keyObject = private_key;
  if (typeof private_key === 'string') {
    // PEM string - convert to KeyObject
    keyObject = crypto.createPrivateKey(private_key);
  } else if (Buffer.isBuffer(private_key)) {
    // PEM buffer - convert to KeyObject
    keyObject = crypto.createPrivateKey(private_key);
  }

  // Auto-detect proof type from key
  if (proof_type === null) {
    // Check key type - Node.js KeyObject has asymmetricKeyType property
    const keyType = keyObject.asymmetricKeyType;
    if (keyType === 'ec' || keyType === 'EC') {
      proof_type = PROOF_TYPE_SECP256K1;
    } else if (keyType === 'ed25519' || keyType === 'Ed25519') {
      proof_type = PROOF_TYPE_ED25519;
    } else {
      throw new Error(
        `Unsupported private key type: ${keyType || 'unknown'}. ` +
        `Supported: ec (secp256k1), ed25519`
      );
    }
  }

  // Validate proof type
  if (proof_type !== PROOF_TYPE_SECP256K1 && proof_type !== PROOF_TYPE_ED25519) {
    throw new Error(`Unsupported proof type: ${proof_type}`);
  }

  // Prepare timestamp
  if (created === null) {
    created = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  // Build proof options (without proofValue)
  const proof_options = {
    type: proof_type,
    created: created,
    verificationMethod: verification_method,
    proofPurpose: proof_purpose
  };
  if (domain !== null) {
    proof_options.domain = domain;
  }
  if (challenge !== null) {
    proof_options.challenge = challenge;
  }

  // Remove existing proof from document for signing
  const doc_without_proof = {};
  for (const key of Object.keys(document)) {
    if (key !== 'proof') {
      doc_without_proof[key] = document[key];
    }
  }

  // Compute signing input
  const to_be_signed = _compute_signing_input(doc_without_proof, proof_options);

  // Sign
  let signature;
  if (proof_type === PROOF_TYPE_SECP256K1) {
    signature = _sign_secp256k1(keyObject, to_be_signed);
  } else if (proof_type === PROOF_TYPE_ED25519) {
    signature = keyObject.sign(to_be_signed);
  }

  // Encode signature as base64url
  const proof_value = _b64url_encode(signature);

  // Build complete proof object
  const proof = { ...proof_options, proofValue: proof_value };

  // Return new document with proof
  const result = JSON.parse(JSON.stringify(document));
  result.proof = proof;
  return result;
}

/**
 * Verify a W3C Data Integrity Proof on a JSON document
 *
 * @param {Object} document - Document containing a "proof" field
 * @param {crypto.KeyObject} public_key - Public key for verification
 * @param {Object} [options] - Optional verification options
 * @param {string} [options.expected_purpose] - Expected proof purpose
 * @param {string} [options.expected_domain] - Expected domain
 * @param {string} [options.expected_challenge] - Expected challenge
 * @returns {boolean} True if proof is valid
 */
function verify_w3c_proof(document, public_key, {
  expected_purpose = null,
  expected_domain = null,
  expected_challenge = null
} = {}) {
  try {
    const proof = document.proof;
    if (!proof) {
      console.error("Document has no proof field");
      return false;
    }

    // Extract proof fields
    const proof_type = proof.type;
    const proof_value = proof.proofValue;
    const proof_purpose = proof.proofPurpose;
    const verification_method = proof.verificationMethod;
    const created = proof.created;

    if (!proof_type || !proof_value || !proof_purpose || !verification_method || !created) {
      console.error("Proof is missing required fields");
      return false;
    }

    // Validate proof type
    if (proof_type !== PROOF_TYPE_SECP256K1 && proof_type !== PROOF_TYPE_ED25519) {
      console.error(`Unsupported proof type: ${proof_type}`);
      return false;
    }

    // Check optional constraints
    if (expected_purpose !== null && proof_purpose !== expected_purpose) {
      console.error(`Proof purpose mismatch: expected '${expected_purpose}', got '${proof_purpose}'`);
      return false;
    }

    if (expected_domain !== null && proof.domain !== expected_domain) {
      console.error(`Domain mismatch: expected '${expected_domain}'`);
      return false;
    }

    if (expected_challenge !== null && proof.challenge !== expected_challenge) {
      console.error(`Challenge mismatch: expected '${expected_challenge}'`);
      return false;
    }

    // Reconstruct proof options (everything except proofValue)
    const proof_options = {};
    for (const key of Object.keys(proof)) {
      if (key !== 'proofValue') {
        proof_options[key] = proof[key];
      }
    }

    // Reconstruct document without proof
    const doc_without_proof = {};
    for (const key of Object.keys(document)) {
      if (key !== 'proof') {
        doc_without_proof[key] = document[key];
      }
    }

    // Compute signing input
    const to_be_signed = _compute_signing_input(doc_without_proof, proof_options);

    // Decode signature
    const signature = _b64url_decode(proof_value);

    // Verify
    if (proof_type === PROOF_TYPE_SECP256K1) {
      return _verify_secp256k1(public_key, to_be_signed, signature);
    } else if (proof_type === PROOF_TYPE_ED25519) {
      return public_key.verify(to_be_signed, signature);
    }

    return false;
  } catch (e) {
    console.error(`Proof verification failed: ${e.message}`);
    return false;
  }
}

module.exports = {
  generate_w3c_proof,
  verify_w3c_proof,
  PROOF_TYPE_SECP256K1,
  PROOF_TYPE_ED25519
};
