/**
 * ANP (Agent Network Protocol) Implementation for Node.js
 * 
 * This module provides compatibility with Python anp package.
 * File paths and function names follow Python anp package conventions.
 */

// Authentication module
export * from './authentication/did_wba.js';
export * from './authentication/did_wba_authenticator.js';
export * from './authentication/did_wba_verifier.js';
export * from './authentication/verification_methods.js';

// E2EE HPKE module
export * from './e2e_encryption_hpke/hpke.js';
export * from './e2e_encryption_hpke/ratchet.js';
export * from './e2e_encryption_hpke/session.js';
export * from './e2e_encryption_hpke/key_manager.js';
export * from './e2e_encryption_hpke/message_builder.js';
export * from './e2e_encryption_hpke/message_parser.js';
export * from './e2e_encryption_hpke/seq_manager.js';
export * from './e2e_encryption_hpke/crypto.js';
export * from './e2e_encryption_hpke/key_pair.js';

// Proof module
export * from './proof/proof.js';

// Utils
export * from './utils/crypto_tool.js';

export default {
    authentication: await import('./authentication/__init__.js'),
    e2e_encryption_hpke: await import('./e2e_encryption_hpke/__init__.js'),
    proof: await import('./proof/__init__.js'),
    utils: await import('./utils/__init__.js')
};
