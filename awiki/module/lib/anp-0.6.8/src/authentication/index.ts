/**
 * ANP Authentication Module
 * 
 * DID WBA authentication for awiki Network Protocol.
 * 
 * This module provides:
 * - generateAuthHeader: Generate DID WBA authorization headers
 * - createDidWbaDocumentWithKeyBinding: Create key-bound DID documents
 * - resolveDidWbaDocument: Resolve DID documents from the network
 * 
 * @package anp/authentication
 * @version 0.6.8
 * 
 * @example
 * ```typescript
 * import {
 *   generateAuthHeader,
 *   createDidWbaDocumentWithKeyBinding,
 *   resolveDidWbaDocument,
 * } from '@awiki/anp-auth';
 * 
 * // Create DID identity
 * const [didDocument, keys] = createDidWbaDocumentWithKeyBinding({
 *   hostname: 'awiki.ai',
 *   pathPrefix: ['user'],
 *   proofPurpose: 'authentication',
 *   domain: 'awiki.ai',
 * });
 * 
 * // Generate auth header for RPC call
 * const authHeader = await generateAuthHeader(
 *   didDocument,
 *   'awiki.ai',
 *   (content, vmFragment) => {
 *     const signature = secp256k1.sign(content, privateKey);
 *     return signature.toDerkBytes();
 *   }
 * );
 * 
 * // Resolve peer DID document
 * const peerDocument = await resolveDidWbaDocument(
 *   'did:wba:awiki.ai:user:k1_peer...'
 * );
 * ```
 */

// Type exports
export type {
  DidContext,
  VerificationMethodType,
  CurveType,
  VerificationMethod,
  JsonWebKey,
  ServiceEntry,
  ProofType,
  ProofPurpose,
  Proof,
  DidDocument,
  KeyPairPem,
  DidKeys,
  CreateDidWbaOptions,
  SignCallback,
  DidResolutionResult,
  AuthHeader,
  E2eeProofContent,
} from './types';

// Function exports from header.ts
export {
  generateAuthHeader,
  verifyAuthHeader,
} from './header';

// Function exports from did-wba.ts
export {
  createDidWbaDocumentWithKeyBinding,
  extractSecp256k1PublicKey,
} from './did-wba';

// Function exports from resolve.ts
export {
  resolveDidWbaDocument,
  resolveDidWbaDocumentFromEndpoint,
  validateDidDocument,
  extractServiceEndpoint,
  getVerificationMethod,
  supportsE2ee,
} from './resolve';

// Constants (matching Python anp.authentication)
export const VM_KEY_AUTH = 'key-1';
export const VM_KEY_E2EE_SIGNING = 'key-2';
export const VM_KEY_E2EE_AGREEMENT = 'key-3';

// Default export
export { generateAuthHeader as default } from './header';

// Module info
export const __version__ = '0.6.8';
