/**
 * Credential persistence: indexed multi-credential storage.
 * 
 * Node.js implementation based on Python version:
 * python/scripts/credential_store.py
 * 
 * [INPUT]: DIDIdentity object, SDKConfig
 * [OUTPUT]: save_identity(), load_identity(), list_identities(), delete_identity()
 * [POS]: Core credential management module
 */

const fs = require('fs');
const path = require('path');
const { SDKConfig } = require('./utils/config');

/**
 * Get the index file path
 * @param {SDKConfig} config - SDK configuration
 * @returns {string} Path to index.json
 */
function getIndexPath(config) {
  const resolved = config || SDKConfig.load();
  return path.join(resolved.credentials_dir, 'index.json');
}

/**
 * Get credential directory path
 * @param {SDKConfig} config - SDK configuration
 * @param {string} credentialName - Credential name
 * @returns {string} Path to credential directory
 */
function getCredentialDir(config, credentialName) {
  const resolved = config || SDKConfig.load();
  return path.join(resolved.credentials_dir, credentialName);
}

/**
 * Load identity from credential storage
 * 
 * @param {string} credentialName - Credential name
 * @param {SDKConfig} config - SDK configuration
 * @returns {Object|null} Identity data or null if not found
 */
function load_identity(credentialName, config) {
  try {
    const resolved = config || SDKConfig.load();
    const credentialDir = getCredentialDir(resolved, credentialName);
    const identityPath = path.join(credentialDir, 'identity.json');
    
    if (!fs.existsSync(identityPath)) {
      return null;
    }
    
    const identity = JSON.parse(fs.readFileSync(identityPath, 'utf-8'));
    return identity;
  } catch (error) {
    return null;
  }
}

/**
 * Save identity to credential storage
 * 
 * @param {string} credentialName - Credential name
 * @param {Object} identity - Identity data
 * @param {SDKConfig} config - SDK configuration
 */
function save_identity(credentialName, identity, config) {
  try {
    const resolved = config || SDKConfig.load();
    const credentialDir = getCredentialDir(resolved, credentialName);
    
    // Ensure directory exists with secure permissions
    if (!fs.existsSync(credentialDir)) {
      fs.mkdirSync(credentialDir, { recursive: true, mode: 0o700 });
    }
    
    const identityPath = path.join(credentialDir, 'identity.json');
    
    // Write identity with secure permissions
    fs.writeFileSync(identityPath, JSON.stringify(identity, null, 2), { mode: 0o600 });
  } catch (error) {
    throw error;
  }
}

/**
 * List all identities
 * 
 * @param {SDKConfig} config - SDK configuration
 * @returns {Array} List of identity names
 */
function list_identities(config) {
  try {
    const resolved = config || SDKConfig.load();
    const indexPath = getIndexPath(resolved);
    
    if (!fs.existsSync(indexPath)) {
      return [];
    }
    
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    return Object.keys(index.credentials || {});
  } catch (error) {
    return [];
  }
}

/**
 * Delete identity from credential storage
 * 
 * @param {string} credentialName - Credential name
 * @param {SDKConfig} config - SDK configuration
 * @returns {boolean} True if deleted successfully
 */
function delete_identity(credentialName, config) {
  try {
    const resolved = config || SDKConfig.load();
    const credentialDir = getCredentialDir(resolved, credentialName);
    
    if (fs.existsSync(credentialDir)) {
      fs.rmSync(credentialDir, { recursive: true, force: true });
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

module.exports = {
  load_identity,
  save_identity,
  list_identities,
  delete_identity,
  getIndexPath,
  getCredentialDir
};
