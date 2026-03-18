/**
 * Credential store module exports.
 * 
 * This module provides credential persistence for the Skill project:
 * - Multi-credential storage with indexed directories
 * - JWT token management
 * - Identity backup and restoration
 * - Authenticator creation for RPC calls
 */

const credentialLayout = require('./credential_layout');
const credentialStore = require('./credential_store');

module.exports = {
    // From credential_layout
    ...credentialLayout,
    
    // From credential_store
    ...credentialStore,
    
    // Direct references for clarity
    credentialLayout,
    credentialStore
};
