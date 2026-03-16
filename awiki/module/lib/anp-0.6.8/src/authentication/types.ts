/**
 * ANP Authentication Module - Type Definitions
 * 
 * Type definitions for DID WBA authentication.
 * 
 * @package anp/authentication
 * @version 0.6.8
 */

/**
 * DID Document context
 */
export type DidContext = string | string[];

/**
 * Verification Method Type
 */
export type VerificationMethodType = 
  | 'JsonWebKey2020'
  | 'EcdsaSecp256k1VerificationKey2019'
  | 'EcdsaSecp256r1VerificationKey2019'
  | 'X25519KeyAgreementKey2020';

/**
 * Cryptographic Curve Types
 */
export type CurveType = 'secp256k1' | 'secp256r1' | 'X25519';

/**
 * Verification Method in DID Document
 */
export interface VerificationMethod {
  id: string;
  type: VerificationMethodType;
  controller: string;
  publicKeyJwk?: JsonWebKey;
  publicKeyMultibase?: string;
}

/**
 * JSON Web Key (JWK) format
 */
export interface JsonWebKey {
  kty: 'EC' | 'OKP';
  crv: CurveType;
  x: string;
  y?: string;
  d?: string;
}

/**
 * Service Entry in DID Document
 */
export interface ServiceEntry {
  id: string;
  type: string;
  serviceEndpoint: string;
}

/**
 * Proof type for DID documents and E2EE messages
 */
export type ProofType = 'WbaProof2025' | 'E2eeProof2025';

/**
 * Proof Purpose
 */
export type ProofPurpose = 'authentication' | 'assertionMethod' | 'keyAgreement';

/**
 * Proof object for DID documents
 */
export interface Proof {
  type: ProofType;
  created: string;
  verificationMethod: string;
  proofPurpose: ProofPurpose;
  proofValue: string;
  challenge?: string;
  domain?: string;
}

/**
 * DID Document structure
 */
export interface DidDocument {
  '@context': DidContext[];
  id: string;
  verificationMethod: VerificationMethod[];
  authentication: string[];
  assertionMethod?: string[];
  keyAgreement?: string[];
  service?: ServiceEntry[];
  proof?: Proof;
}

/**
 * Key pair in PEM format
 */
export type KeyPairPem = [privateKey: string, publicKey: string];

/**
 * Keys dictionary returned from createDidWbaDocumentWithKeyBinding
 */
export interface DidKeys {
  'key-1': KeyPairPem;  // secp256k1 for DID authentication
  'key-2'?: KeyPairPem; // secp256r1 for E2EE signing
  'key-3'?: KeyPairPem; // X25519 for E2EE key agreement
}

/**
 * Options for creating DID WBA document
 */
export interface CreateDidWbaOptions {
  /** Domain name for the DID */
  hostname: string;
  /** DID path prefix, e.g., ["user"] or ["agent"] */
  pathPrefix?: string[];
  /** Proof purpose (default: "authentication") */
  proofPurpose?: ProofPurpose;
  /** Service domain bound to the proof */
  domain?: string;
  /** Proof nonce for replay prevention */
  challenge?: string;
  /** Custom service entries */
  services?: ServiceEntry[];
}

/**
 * Sign callback function type
 * 
 * @param content - Content to sign (bytes)
 * @param vmFragment - Verification method fragment (e.g., "#key-1")
 * @returns DER-encoded signature (bytes)
 */
export type SignCallback = (content: Uint8Array, vmFragment: string) => Promise<Uint8Array> | Uint8Array;

/**
 * Result of DID resolution
 */
export type DidResolutionResult = DidDocument | null;

/**
 * Authentication header format
 */
export interface AuthHeader {
  scheme: 'DIDWba';
  did: string;
  signature: string;
  timestamp: number;
}

/**
 * E2EE Proof content
 */
export interface E2eeProofContent {
  e2ee_version: string;
  session_id: string;
  sender_did: string;
  recipient_did: string;
  expires: number;
  proof?: {
    type: ProofType;
    verificationMethod: string;
    created: string;
    proofValue: string;
  };
}

/**
 * Export all types
 */
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
};
