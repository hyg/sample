/**
 * Regenerate E2EE keys for an existing DID identity.
 *
 * Node.js implementation based on Python version:
 * python/scripts/regenerate_e2ee_keys.py
 *
 * When a credential file is missing E2EE private keys (e2ee_signing_private_pem,
 * e2ee_agreement_private_pem), this script generates new key-2 (secp256r1) and
 * key-3 (X25519) key pairs, updates the DID document with new public keys,
 * re-signs the document with key-1, calls did-auth.update_document on the server,
 * and saves everything locally.
 *
 * [INPUT]: credential_store (load/save), ANP (_build_e2ee_entries, generate_w3c_proof),
 *          utils.auth (update_did_document, get_jwt_via_wba), utils.config (SDKConfig),
 *          logging_config
 * [OUTPUT]: Updated credential file with E2EE private keys and refreshed DID document
 * [POS]: CLI script for E2EE key recovery; one-time repair tool
 *
 * Usage:
 *   node scripts/regenerate-e2ee-keys.js --credential default
 */

const crypto = require('crypto');
const path = require('path');

// Lazy load dependencies
let _SDKConfig = null;
let _create_user_service_client = null;
let _update_did_document = null;
let _get_jwt_via_wba = null;
let _DIDIdentity = null;
let _load_private_key = null;
let _load_identity = null;
let _save_identity = null;
let _build_e2ee_entries = null;
let _generate_w3c_proof = null;
let _configure_logging = null;
let _logger = null;

/**
 * Initialize dependencies
 * @private
 */
function _initDeps() {
  if (_SDKConfig === null) {
    const configModule = require('./utils/config');
    _SDKConfig = configModule.SDKConfig;
  }
  if (_create_user_service_client === null) {
    const clientModule = require('./utils/client');
    _create_user_service_client = clientModule.create_user_service_client;
  }
  if (_update_did_document === null) {
    const authModule = require('./utils/auth');
    _update_did_document = authModule.update_did_document;
  }
  if (_get_jwt_via_wba === null) {
    const authModule = require('./utils/auth');
    _get_jwt_via_wba = authModule.get_jwt_via_wba;
  }
  if (_DIDIdentity === null) {
    const identityModule = require('./utils/identity');
    _DIDIdentity = identityModule.DIDIdentity;
  }
  if (_load_private_key === null) {
    const identityModule = require('./utils/identity');
    _load_private_key = identityModule.load_private_key;
  }
  if (_load_identity === null) {
    const credentialStore = require('./credential_store');
    _load_identity = credentialStore.load_identity;
  }
  if (_save_identity === null) {
    const credentialStore = require('./credential_store');
    _save_identity = credentialStore.save_identity;
  }
  if (_build_e2ee_entries === null) {
    const anpAuth = require('../lib/anp-0.6.8/authentication');
    _build_e2ee_entries = anpAuth._build_e2ee_entries;
  }
  if (_generate_w3c_proof === null) {
    const anpProof = require('../lib/anp-0.6.8/proof');
    _generate_w3c_proof = anpProof.generate_w3c_proof;
  }
  if (_configure_logging === null) {
    const loggingModule = require('./utils/logging');
    _configure_logging = loggingModule.configure_logging;
  }
  if (_logger === null) {
    const loggingModule = require('./utils/logging');
    _logger = loggingModule.getLogger('regenerate-e2ee-keys');
  }
}

/**
 * Regenerate E2EE keys for an existing credential.
 *
 * Steps:
 *   1. Load existing credential and verify key-1 exists
 *   2. Generate new key-2 (secp256r1) and key-3 (X25519) via ANP
 *   3. Update DID document: replace key-2/key-3 entries, update keyAgreement, re-sign
 *   4. Update the DID document on the server and refresh JWT
 *   5. Save updated credential locally
 *
 * @param {Object} options - Options object
 * @param {string} [options.credential_name="default"] - Credential name
 * @param {boolean} [options.force=false] - Force regeneration even if E2EE keys already exist
 * @returns {Promise<void>}
 */
async function regenerate_e2ee_keys({
  credential_name = "default",
  force = false
} = {}) {
  _initDeps();

  _logger.info(`Regenerating E2EE keys credential=${credential_name} force=${force}`);

  // Step 1: Load existing credential
  const data = _load_identity(credential_name);
  if (data === null) {
    console.error(`Error: Credential '${credential_name}' not found.`);
    console.error("Create an identity first: node scripts/setup-identity.js --name MyAgent");
    process.exit(1);
  }

  const did = data.did;
  console.log(`Loaded credential: ${credential_name}`);
  console.log(`  DID: ${did}`);

  // Check if E2EE keys already exist
  const has_signing = !!data.e2ee_signing_private_pem;
  const has_agreement = !!data.e2ee_agreement_private_pem;

  if (has_signing && has_agreement) {
    if (!force) {
      console.log("\n  E2EE keys already present in credential.");
      console.log("  Use --force to regenerate anyway.");
      process.exit(0);
    }
    console.log("\n  --force specified, regenerating existing E2EE keys...");
  }

  // Verify key-1 private key exists (needed for re-signing)
  const private_key_pem_raw = data.private_key_pem;
  if (!private_key_pem_raw) {
    console.error("Error: key-1 private key not found in credential. Cannot re-sign.");
    process.exit(1);
  }

  let private_key_pem = private_key_pem_raw;
  if (typeof private_key_pem_raw === 'string') {
    private_key_pem = Buffer.from(private_key_pem_raw, 'utf-8');
  }

  const private_key = _load_private_key(private_key_pem);
  console.log("  key-1 private key: OK");

  // Step 2: Generate new E2EE keys
  console.log("\nGenerating new E2EE keys...");
  const [e2ee_vms, ka_refs, e2ee_keys] = _build_e2ee_entries(did);
  const e2ee_signing_private_pem = e2ee_keys["key-2"][0];
  const e2ee_agreement_private_pem = e2ee_keys["key-3"][0];
  console.log("  key-2 (secp256r1 signing): generated");
  console.log("  key-3 (X25519 agreement): generated");

  // Step 3: Update DID document
  console.log("\nUpdating DID document...");
  let did_document = data.did_document;
  if (!did_document) {
    console.error("Error: DID document not found in credential.");
    process.exit(1);
  }

  // Deep copy to avoid modifying original
  did_document = JSON.parse(JSON.stringify(did_document));

  // Replace key-2 and key-3 in verificationMethod
  let vm_list = did_document.verificationMethod || [];
  // Remove old key-2 and key-3 entries
  vm_list = vm_list.filter(vm => {
    const vmId = vm.id || "";
    return !(vmId.endsWith("#key-2") || vmId.endsWith("#key-3"));
  });
  // Add new key-2 and key-3 entries
  vm_list.push(...e2ee_vms);
  did_document.verificationMethod = vm_list;

  // Update keyAgreement references
  did_document.keyAgreement = ka_refs;

  // Ensure x25519 context is present
  let contexts = did_document["@context"] || [];
  const x25519_ctx = "https://w3id.org/security/suites/x25519-2019/v1";
  if (!contexts.includes(x25519_ctx)) {
    contexts.push(x25519_ctx);
    did_document["@context"] = contexts;
  }

  // Remove old proof before re-signing
  delete did_document.proof;

  // Re-sign with key-1
  const config = new _SDKConfig();
  const verification_method = `${did}#key-1`;
  const challenge = crypto.randomBytes(16).toString('hex');

  did_document = _generate_w3c_proof({
    document: did_document,
    private_key: private_key,
    verification_method: verification_method,
    proof_purpose: "authentication",
    domain: config.did_domain,
    challenge: challenge
  });
  console.log("  DID document re-signed with key-1");

  // Step 4: Update DID document on server and refresh JWT
  console.log("\nUpdating DID document on server...");
  console.log(`  Server: ${config.user_service_url}`);

  // Build a DIDIdentity for registration
  let public_key_pem = data.public_key_pem || "";
  if (typeof public_key_pem === 'string') {
    public_key_pem = Buffer.from(public_key_pem, 'utf-8');
  }

  const identity = new _DIDIdentity({
    did: did,
    did_document: did_document,
    private_key_pem: private_key_pem,
    public_key_pem: public_key_pem,
    user_id: data.user_id,
    jwt_token: data.jwt_token,
    e2ee_signing_private_pem: e2ee_signing_private_pem,
    e2ee_agreement_private_pem: e2ee_agreement_private_pem
  });

  // Create HTTP client and update document
  const client = _create_user_service_client(config);

  try {
    const update_result = await _update_did_document(
      client,
      identity,
      config.did_domain
    );
    console.log(`  Update: ${update_result.message || 'OK'}`);
    identity.user_id = update_result.user_id || identity.user_id;

    // Refresh JWT (or reuse the token returned by update_document)
    let jwt_token = update_result.access_token;
    if (!jwt_token) {
      jwt_token = await _get_jwt_via_wba(client, identity, config.did_domain);
    }
    identity.jwt_token = jwt_token;
    console.log(`  JWT refreshed: ${jwt_token.substring(0, 50)}...`);
  } finally {
    // Close the client
    if (client && typeof client.close === 'function') {
      await client.close();
    }
  }

  // Step 5: Save updated credential
  const savePath = _save_identity(credential_name, {
    did: identity.did,
    unique_id: data.unique_id || identity.unique_id,
    user_id: identity.user_id,
    private_key_pem: identity.private_key_pem,
    public_key_pem: identity.public_key_pem,
    jwt_token: identity.jwt_token,
    name: data.name,
    handle: data.handle,
    did_document: identity.did_document,
    e2ee_signing_private_pem: identity.e2ee_signing_private_pem,
    e2ee_agreement_private_pem: identity.e2ee_agreement_private_pem
  });

  console.log(`\nCredential saved to: ${savePath}`);
  console.log("E2EE key regeneration complete!");
}

/**
 * CLI entry point
 */
function main() {
  _initDeps();
  _configure_logging({ console_level: null, mirror_stdio: true });

  // Parse command line arguments
  const args = process.argv.slice(2);
  let credential_name = "default";
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--credential' && i + 1 < args.length) {
      credential_name = args[i + 1];
      i++;
    } else if (args[i] === '--force') {
      force = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log("Usage: node scripts/regenerate-e2ee-keys.js [options]");
      console.log("");
      console.log("Options:");
      console.log("  --credential <name>  Credential name (default: default)");
      console.log("  --force              Force regeneration even if E2EE keys already exist");
      console.log("  --help, -h           Show this help message");
      process.exit(0);
    }
  }

  _logger.info(`regenerate_e2ee_keys CLI started credential=${credential_name} force=${force}`);

  regenerate_e2ee_keys({ credential_name, force })
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error:", error.message);
      _logger.error(`regenerate_e2ee_keys failed: ${error.message}`);
      process.exit(1);
    });
}

// Export for testing
module.exports = {
  regenerate_e2ee_keys
};

// CLI entry point
if (require.main === module) {
  main();
}
