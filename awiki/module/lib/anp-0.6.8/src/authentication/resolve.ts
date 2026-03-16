/**
 * ANP Authentication Module - DID Document Resolution
 * 
 * Resolves DID WBA documents from the network.
 * 
 * @package anp/authentication
 * @version 0.6.8
 */

import type { DidDocument, DidResolutionResult } from './types';

/**
 * Parse DID to extract components
 * 
 * DID format: did:wba:{domain}:{path_segments}
 * Example: did:wba:awiki.ai:user:k1_abc123
 */
function parseDid(did: string): {
  method: string;
  domain: string;
  pathSegments: string[];
  isValid: boolean;
} {
  if (!did || !did.startsWith('did:wba:')) {
    return { method: '', domain: '', pathSegments: [], isValid: false };
  }
  
  // Split: did:wba:domain:path:...
  const parts = did.split(':', 4);
  if (parts.length < 4) {
    return { method: 'wba', domain: '', pathSegments: [], isValid: false };
  }
  
  // Decode the domain (may be URL-encoded if contains port)
  const domain = decodeURIComponent(parts[2]);
  const pathSegments = parts[3] ? parts[3].split(':') : [];
  
  return {
    method: 'wba',
    domain,
    pathSegments,
    isValid: domain.length > 0,
  };
}

/**
 * Resolve DID WBA document from Web DID asynchronously
 * 
 * Fetches the DID document from:
 * - https://{domain}/{path_segments}/did.json (if path segments exist)
 * - https://{domain}/.well-known/did.json (if no path segments)
 * 
 * @param did - The DID to resolve (e.g., "did:wba:awiki.ai:user:k1_abc123")
 * @param verifyProof - If true, verify the proof signature (not implemented in this version)
 * @returns The resolved DID document, or null if not found
 * 
 * @throws {ValueError} If DID format is invalid
 * @throws {Error} If HTTP request fails
 * 
 * @example
 * ```typescript
 * import { resolveDidWbaDocument } from '@awiki/anp-auth';
 * 
 * const didDocument = await resolveDidWbaDocument(
 *   'did:wba:awiki.ai:user:k1_mSDgXJ_LIWEJ_jWrxVCqdWPNuMr1EIVYV7o8yg_zp5w'
 * );
 * 
 * if (didDocument) {
 *   console.log('DID resolved:', didDocument.id);
 * } else {
 *   console.log('DID not found');
 * }
 * ```
 */
export async function resolveDidWbaDocument(
  did: string,
  verifyProof: boolean = false
): Promise<DidResolutionResult> {
  console.info(`Resolving DID document for: ${did}`);
  
  // Validate DID format
  if (!did.startsWith('did:wba:')) {
    throw new Error("Invalid DID format: must start with 'did:wba:'");
  }
  
  // Extract domain and path from DID
  const parsed = parseDid(did);
  if (!parsed.isValid) {
    throw new Error('Invalid DID format: missing domain');
  }
  
  const { domain, pathSegments } = parsed;
  
  // Build the URL
  let url = `https://${domain}`;
  if (pathSegments && pathSegments.length > 0) {
    url += '/' + pathSegments.join('/') + '/did.json';
  } else {
    url += '/.well-known/did.json';
  }
  
  console.debug(`Requesting DID document from URL: ${url}`);
  
  try {
    // Create HTTP request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`Failed to resolve DID document: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const didDocument = await response.json() as DidDocument;
    
    // Verify document ID matches
    if (didDocument.id !== did) {
      throw new Error(
        `DID document ID mismatch. Expected: ${did}, Got: ${didDocument.id}`
      );
    }
    
    console.info(`Successfully resolved DID document for: ${did}`);
    
    // Optionally verify W3C proof if present and verifyProof is true
    if (verifyProof && didDocument.proof) {
      const proof = didDocument.proof;
      const vmId = proof.verificationMethod;
      
      if (!vmId) {
        console.warn('Proof missing verificationMethod field');
        return null;
      }
      
      const methodDict = findVerificationMethod(didDocument, vmId);
      if (!methodDict) {
        console.warn(`Verification method not found: ${vmId}`);
        return null;
      }
      
      // Note: Full proof verification requires cryptographic operations
      // This is a simplified version - in production, implement full verification
      console.info('DID document proof verification skipped (not implemented)');
    }
    
    return didDocument;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error(`Failed to resolve DID document: Request timeout`);
      } else {
        console.error(`Failed to resolve DID document: ${error.message}`);
      }
    }
    return null;
  }
}

/**
 * Find verification method in DID document by ID
 * Searches in both verificationMethod and authentication arrays
 */
function findVerificationMethod(
  didDocument: DidDocument,
  verificationMethodId: string
): DidDocument['verificationMethod'][0] | null {
  // Search in verificationMethod array
  for (const method of didDocument.verificationMethod || []) {
    if (method.id === verificationMethodId) {
      return method;
    }
  }
  
  // Search in authentication array
  for (const auth of didDocument.authentication || []) {
    if (typeof auth === 'string') {
      if (auth === verificationMethodId) {
        // If it's a reference, look up in verificationMethod
        for (const method of didDocument.verificationMethod || []) {
          if (method.id === verificationMethodId) {
            return method;
          }
        }
      }
    } else if (typeof auth === 'object' && auth.id === verificationMethodId) {
      return auth;
    }
  }
  
  return null;
}

/**
 * Resolve DID WBA document with custom endpoint
 * 
 * @param did - The DID to resolve
 * @param endpoint - Custom resolution endpoint URL
 * @returns The resolved DID document, or null if not found
 */
export async function resolveDidWbaDocumentFromEndpoint(
  did: string,
  endpoint: string
): Promise<DidResolutionResult> {
  try {
    const url = endpoint.includes('{did}')
      ? endpoint.replace('{did}', encodeURIComponent(did))
      : `${endpoint}/${encodeURIComponent(did)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const didDocument = await response.json() as DidDocument;
      
      if (didDocument && didDocument.id === did) {
        return didDocument;
      }
    }
  } catch (error) {
    console.warn(`Error resolving DID from custom endpoint:`, error);
  }
  
  return null;
}

/**
 * Validate DID document structure
 * 
 * @param didDocument - The DID document to validate
 * @returns True if valid, false otherwise
 */
export function validateDidDocument(didDocument: DidDocument): boolean {
  // Check required fields
  if (!didDocument.id || !didDocument['@context']) {
    return false;
  }
  
  // Check verification methods
  if (!Array.isArray(didDocument.verificationMethod)) {
    return false;
  }
  
  // Check authentication array
  if (!Array.isArray(didDocument.authentication) || didDocument.authentication.length === 0) {
    return false;
  }
  
  // Validate each verification method
  for (const vm of didDocument.verificationMethod) {
    if (!vm.id || !vm.type || !vm.controller) {
      return false;
    }
    
    // Check for public key
    if (!vm.publicKeyJwk && !vm.publicKeyMultibase) {
      return false;
    }
  }
  
  return true;
}

/**
 * Extract service endpoint from DID document
 * 
 * @param didDocument - The DID document
 * @param serviceType - The type of service to find
 * @returns The service endpoint URL, or null if not found
 */
export function extractServiceEndpoint(
  didDocument: DidDocument,
  serviceType: string
): string | null {
  if (!didDocument.service) {
    return null;
  }
  
  const service = didDocument.service.find(s => s.type === serviceType);
  return service ? service.serviceEndpoint : null;
}

/**
 * Get verification method by ID
 * 
 * @param didDocument - The DID document
 * @param keyId - The verification method ID (can be fragment like "#key-1")
 * @returns The verification method, or null if not found
 */
export function getVerificationMethod(
  didDocument: DidDocument,
  keyId: string
): DidDocument['verificationMethod'][0] | null {
  // Handle fragment references
  const fullId = keyId.startsWith('#') ? `${didDocument.id}${keyId}` : keyId;
  
  return findVerificationMethod(didDocument, fullId);
}

/**
 * Check if DID document supports E2EE
 * 
 * @param didDocument - The DID document
 * @returns True if E2EE keys (key-2, key-3) are present
 */
export function supportsE2ee(didDocument: DidDocument): boolean {
  const hasSigningKey = didDocument.verificationMethod.some(
    vm => vm.id.endsWith('#key-2') && 
    (vm.publicKeyJwk?.crv === 'P-256' || vm.publicKeyJwk?.crv === 'secp256r1')
  );
  
  const hasAgreementKey = didDocument.verificationMethod.some(
    vm => vm.id.endsWith('#key-3') && 
    (vm.publicKeyJwk?.crv === 'X25519' || vm.type === 'JsonWebKey2020' && vm.publicKeyJwk?.crv === 'X25519')
  );
  
  return hasSigningKey && hasAgreementKey;
}

export default resolveDidWbaDocument;
