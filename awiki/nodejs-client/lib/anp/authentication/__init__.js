/**
 * Authentication Module
 * 
 * Compatible with Python anp.authentication module.
 */

export { DIDWbaAuthenticator } from './did_wba_authenticator.js';
export { DIDWbaVerifier } from './did_wba_verifier.js';
export { buildVerificationMethod, getVerificationMethodType } from './verification_methods.js';

// Re-export from did_wba.js
export { 
    createDidWbaDocumentWithKeyBinding as create_did_wba_document_with_key_binding,
    createDidWbaDocument as create_did_wba_document,
    generateAuthHeader as generate_auth_header,
    resolveDidWbaDocument as resolve_did_wba_document
} from './did_wba.js';

export default {
    DIDWbaAuthenticator,
    DIDWbaVerifier,
    createDidWbaDocumentWithKeyBinding: await import('./did_wba.js').then(m => m.createDidWbaDocumentWithKeyBinding),
    generateAuthHeader: await import('./did_wba.js').then(m => m.generateAuthHeader),
    resolveDidWbaDocument: await import('./did_wba.js').then(m => m.resolveDidWbaDocument)
};
