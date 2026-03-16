/**
 * ANP Authentication Module - Authorization Header Generation
 *
 * Generates DID WBA authorization headers for RPC calls.
 *
 * @package anp/authentication
 * @version 0.6.8
 */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';

import type { DidDocument, SignCallback } from './types';

/**
 * Base64url encode (no padding) - compatible with RFC 4648
 */
function base64urlEncode(data: Uint8Array): string {
  const binary = String.fromCodePoint(...data);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64url decode - compatible with RFC 4648
 */
function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * JCS (JSON Canonicalization Scheme) - RFC 8785
 * Canonicalizes JSON data for consistent signing
 */
function jcsCanonicalize(obj: Record<string, unknown>): string {
  // Sort keys alphabetically and serialize
  const sortedKeys = Object.keys(obj).sort();
  const parts: string[] = [];

  for (const key of sortedKeys) {
    const value = obj[key];
    const serializedValue = serializeJcsValue(value);
    parts.push(`"${escapeJsonString(key)}":${serializedValue}`);
  }

  return `{${parts.join(',')}}`;
}

/**
 * Serialize a value according to JCS rules
 */
function serializeJcsValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    // Handle integers and floats
    if (Number.isInteger(value)) {
      return value.toString();
    }
    // Use exponential notation for very large/small numbers
    if (Math.abs(value) < 1e-6 || Math.abs(value) > 1e21) {
      return value.toExponential();
    }
    return value.toString();
  }

  if (typeof value === 'string') {
    return `"${escapeJsonString(value)}"`;
  }

  if (Array.isArray(value)) {
    const items = value.map(item => serializeJcsValue(item));
    return `[${items.join(',')}]`;
  }

  if (typeof value === 'object') {
    return jcsCanonicalize(value as Record<string, unknown>);
  }

  return 'null';
}

/**
 * Escape a string for JSON
 */
function escapeJsonString(str: string): string {
  return str.replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/\b/g, '\\b');
}

/**
 * Generate a 16-byte random nonce (hex encoded)
 */
function generateNonce(): string {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  return bytesToHex(randomBytes);
}

/**
 * Generate a timestamp string in ISO 8601 format (UTC)
 */
function generateTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Extract the verification method ID from DID document for authentication
 *
 * Looks for the first verification method referenced in the authentication array
 */
function getAuthenticationVerificationMethod(
  didDocument: DidDocument
): { id: string; fragment: string } {
  const authMethods = didDocument.authentication;

  if (!authMethods || authMethods.length === 0) {
    throw new Error('DID document missing authentication section');
  }

  // Get the first authentication method
  const authMethod = authMethods[0];

  // Resolve the method ID (could be a fragment like "#key-1" or full ID)
  let methodId: string;
  let fragment: string;

  if (authMethod.startsWith('#')) {
    // Fragment reference - prepend DID
    fragment = authMethod.substring(1);
    methodId = `${didDocument.id}${authMethod}`;
  } else {
    // Full ID - extract fragment
    methodId = authMethod;
    const hashIndex = authMethod.indexOf('#');
    fragment = hashIndex >= 0 ? authMethod.substring(hashIndex + 1) : 'key-1';
  }

  return { id: methodId, fragment };
}

/**
 * Build the authorization header value (DIDWba format)
 *
 * Format: DIDWba v="1.1", did="...", nonce="...", timestamp="...",
 *         verification_method="...", signature="..."
 */
function buildAuthHeader(
  did: string,
  nonce: string,
  timestamp: string,
  verificationMethod: string,
  signature: string,
  version: string = '1.1'
): string {
  return `DIDWba v="${version}", did="${did}", nonce="${nonce}", timestamp="${timestamp}", verification_method="${verificationMethod}", signature="${signature}"`;
}

/**
 * Generate DID WBA Authorization header
 *
 * Creates a signed authorization header for RPC calls using DID WBA authentication.
 *
 * The signature is computed over:
 * 1. Build data object: { nonce, timestamp, aud/service, did }
 * 2. Canonicalize using JCS (RFC 8785)
 * 3. Hash with SHA-256
 * 4. Sign with secp256k1 private key
 *
 * @param didDocument - The DID document containing verification methods
 * @param serviceDomain - Target service domain (e.g., "awiki.ai")
 * @param signCallback - Callback to sign content with private key
 * @param version - Protocol version (default: "1.1", uses "aud" field)
 * @returns Authorization header value (e.g., "DIDWba v=\"1.1\", did=\"...\", ...")
 *
 * @throws {Error} If DID document is missing authentication section
 * @throws {Error} If signCallback throws an error
 */
export async function generateAuthHeader(
  didDocument: DidDocument,
  serviceDomain: string,
  signCallback: SignCallback,
  version: string = '1.1'
): Promise<string> {
  // Validate inputs
  if (!serviceDomain || serviceDomain.trim() === '') {
    throw new Error('service_domain cannot be empty');
  }

  if (!didDocument.authentication || didDocument.authentication.length === 0) {
    throw new Error('DID document missing authentication section');
  }

  const did = didDocument.id;
  if (!did) {
    throw new Error('DID document missing id field');
  }

  // Get the verification method for authentication
  const vmInfo = getAuthenticationVerificationMethod(didDocument);

  // Generate nonce (16 bytes = 32 hex chars)
  const nonce = generateNonce();

  // Generate timestamp
  const timestamp = generateTimestamp();

  // Determine which field to use based on version
  // For version >= 1.1, use "aud" instead of "service"
  let domainField: string;
  try {
    const versionFloat = parseFloat(version);
    domainField = versionFloat >= 1.1 ? 'aud' : 'service';
  } catch {
    domainField = 'service';
  }

  // Construct the data to sign
  const dataToSign: Record<string, unknown> = {
    nonce,
    timestamp,
    [domainField]: serviceDomain,
    did,
  };

  // Canonicalize using JCS
  const canonicalJson = jcsCanonicalize(dataToSign);

  // Calculate SHA-256 hash
  const contentHash = sha256(utf8ToBytes(canonicalJson));

  // Sign the hash
  const signatureBytes = await signCallback(contentHash, vmInfo.fragment);

  // Encode signature (base64url for the header)
  const signature = base64urlEncode(signatureBytes);

  // Build and return the authorization header
  return buildAuthHeader(did, nonce, timestamp, vmInfo.fragment, signature, version);
}

/**
 * Verify a DID WBA authorization header
 *
 * @param authHeader - The authorization header value
 * @param didDocument - The DID document to verify against
 * @param verifyCallback - Callback to verify signature
 * @param serviceDomain - Service domain that should match
 * @param version - Protocol version
 * @returns Tuple of [isValid, message]
 */
export async function verifyAuthHeader(
  authHeader: string,
  didDocument: DidDocument,
  verifyCallback: (
    contentHash: Uint8Array,
    signature: Uint8Array,
    vmFragment: string
  ) => Promise<boolean>,
  serviceDomain: string,
  version: string = '1.1'
): Promise<[boolean, string]> {
  try {
    // Extract header parts using regex
    const didMatch = authHeader.match(/did="([^"]+)"/i);
    const nonceMatch = authHeader.match(/nonce="([^"]+)"/i);
    const timestampMatch = authHeader.match(/timestamp="([^"]+)"/i);
    const vmMatch = authHeader.match(/verification_method="([^"]+)"/i);
    const signatureMatch = authHeader.match(/signature="([^"]+)"/i);
    const versionMatch = authHeader.match(/v="([^"]+)"/i);

    if (!didMatch || !nonceMatch || !timestampMatch || !vmMatch || !signatureMatch) {
      return [false, 'Missing required field in auth header'];
    }

    const did = didMatch[1];
    const nonce = nonceMatch[1];
    const timestamp = timestampMatch[1];
    const verificationMethod = vmMatch[1];
    const signature = signatureMatch[1];
    const headerVersion = versionMatch ? versionMatch[1] : '1.1';

    // Verify DID match
    if (didDocument.id.toLowerCase() !== did.toLowerCase()) {
      return [false, 'DID mismatch'];
    }

    // Determine domain field based on version
    let domainField: string;
    try {
      const versionFloat = parseFloat(headerVersion);
      domainField = versionFloat >= 1.1 ? 'aud' : 'service';
    } catch {
      domainField = 'service';
    }

    // Reconstruct data to verify
    const dataToVerify: Record<string, unknown> = {
      nonce,
      timestamp,
      [domainField]: serviceDomain,
      did,
    };

    // Canonicalize and hash
    const canonicalJson = jcsCanonicalize(dataToVerify);
    const contentHash = sha256(utf8ToBytes(canonicalJson));

    // Decode signature
    const signatureBytes = base64urlDecode(signature);

    // Verify signature
    const isValid = await verifyCallback(contentHash, signatureBytes, verificationMethod);

    if (isValid) {
      return [true, 'Verification successful'];
    }
    return [false, 'Signature verification failed'];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Verification error';
    return [false, errorMessage];
  }
}

export default generateAuthHeader;
