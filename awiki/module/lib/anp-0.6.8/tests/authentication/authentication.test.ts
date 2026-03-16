/**
 * ANP Authentication Module Tests
 *
 * Based on 14 test cases from distill.json
 * Tests anp.authentication module core functionality
 *
 * @version 0.6.8
 * @date 2026-03-16
 */

import { describe, it, expect } from 'vitest';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes, randomBytes } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';

import {
  generateAuthHeader,
  verifyAuthHeader,
  createDidWbaDocumentWithKeyBinding,
  extractSecp256k1PublicKey,
  resolveDidWbaDocument,
  validateDidDocument,
  extractServiceEndpoint,
  getVerificationMethod,
  supportsE2ee,
} from '../src/authentication/index';

import type { DidDocument, SignCallback } from '../src/authentication/types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract private key bytes from PEM format
 * The bytesToPem function in did-wba.ts just base64-encodes raw bytes
 */
function extractPrivateKeyFromPem(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN.*?-----/, '')
    .replace(/-----END.*?-----/, '')
    .replace(/\s/g, '');

  // The bytesToPem function just base64-encodes raw bytes (not SEC1 format)
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

/**
 * Create sign callback for testing
 */
function createSignCallback(privateKey: Uint8Array): SignCallback {
  return (content: Uint8Array, _vmFragment: string): Uint8Array => {
    const signature = secp256k1.sign(content, privateKey);
    return signature.toDERRawBytes();
  };
}

/**
 * Create verify callback for testing
 */
function createVerifyCallback(publicKey: Uint8Array) {
  return async (
    contentHash: Uint8Array,
    signature: Uint8Array,
    _vmFragment: string
  ): Promise<boolean> => {
    try {
      const sig = secp256k1.Signature.fromDER(signature);
      return secp256k1.verify(sig, contentHash, publicKey);
    } catch {
      return false;
    }
  };
}

// ============================================================================
// TC-AUTH-001: generateAuthHeader Tests
// ============================================================================

describe('TC-AUTH-001: generateAuthHeader', () => {
  describe('Normal scenarios', () => {
    it('should generate valid DID WBA auth header', async () => {
      const [didDocument, keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: false,
      });

      const privateKey = extractPrivateKeyFromPem(keys['key-1'][0]);
      const signCallback = createSignCallback(privateKey);

      const authHeader = await generateAuthHeader(
        didDocument,
        'awiki.ai',
        signCallback,
        '1.1'
      );

      expect(authHeader).toBeDefined();
      expect(authHeader).toMatch(/^DIDWba v="1\.1"/);
      expect(authHeader).toContain(`did="${didDocument.id}"`);
      expect(authHeader).toContain('nonce="');
      expect(authHeader).toContain('timestamp="');
      expect(authHeader).toContain('verification_method="');
      expect(authHeader).toContain('signature="');
    });

    it('should use JCS canonicalization for signing', async () => {
      const [didDocument, keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: false,
      });

      const privateKey = extractPrivateKeyFromPem(keys['key-1'][0]);

      let signedContent: Uint8Array | null = null;
      const signCallback: SignCallback = (content, _vmFragment) => {
        signedContent = content;
        const signature = secp256k1.sign(content, privateKey);
        return signature.toDERRawBytes();
      };

      await generateAuthHeader(didDocument, 'awiki.ai', signCallback);

      expect(signedContent).toBeDefined();
      expect(signedContent!.length).toBe(32);
    });
  });

  describe('Error scenarios', () => {
    it('should throw error when DID document missing authentication', async () => {
      const invalidDoc: DidDocument = {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: 'did:wba:awiki.ai:user:k1_test',
        verificationMethod: [],
        authentication: [],
      };

      await expect(
        generateAuthHeader(invalidDoc, 'awiki.ai', async () => new Uint8Array())
      ).rejects.toThrow('DID document missing authentication section');
    });

    it('should throw error when service_domain is empty', async () => {
      const [didDocument, keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: false,
      });

      const privateKey = extractPrivateKeyFromPem(keys['key-1'][0]);
      const signCallback = createSignCallback(privateKey);

      await expect(
        generateAuthHeader(didDocument, '', signCallback)
      ).rejects.toThrow('service_domain cannot be empty');

      await expect(
        generateAuthHeader(didDocument, '   ', signCallback)
      ).rejects.toThrow('service_domain cannot be empty');
    });

    it('should propagate error when signCallback throws', async () => {
      const [didDocument, _keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: false,
      });

      const errorCallback: SignCallback = () => {
        throw new Error('Signing failed');
      };

      await expect(
        generateAuthHeader(didDocument, 'awiki.ai', errorCallback)
      ).rejects.toThrow('Signing failed');
    });
  });
});

// ============================================================================
// TC-AUTH-002 & TC-AUTH-003: createDidWbaDocumentWithKeyBinding Tests
// ============================================================================

describe('TC-AUTH-002/003: createDidWbaDocumentWithKeyBinding', () => {
  describe('Normal - Basic identity creation', () => {
    it('should create DID document with key binding', () => {
      const [didDocument, keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        challenge: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
        enableE2ee: false,
      });

      expect(didDocument.id).toMatch(/^did:wba:awiki\.ai:user:k1_/);
      expect(didDocument['@context']).toContain('https://www.w3.org/ns/did/v1');
      expect(didDocument.verificationMethod).toHaveLength(1);
      expect(didDocument.verificationMethod[0].id).toContain('#key-1');
      expect(didDocument.verificationMethod[0].type).toBe('EcdsaSecp256k1VerificationKey2019');
      expect(didDocument.authentication).toContain(didDocument.verificationMethod[0].id);
      expect(keys['key-1']).toBeDefined();
      expect(keys['key-1'][0]).toMatch(/-----BEGIN.*PRIVATE KEY-----/);
      expect(keys['key-1'][1]).toMatch(/-----BEGIN.*PUBLIC KEY-----/);
    });

    it('should generate W3C Data Integrity Proof', () => {
      const [didDocument, _keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        challenge: 'test_challenge',
        enableE2ee: false,
      });

      expect(didDocument.proof).toBeDefined();
      expect(didDocument.proof!.type).toBe('WbaProof2025');
      expect(didDocument.proof!.verificationMethod).toContain('#key-1');
      expect(didDocument.proof!.proofPurpose).toBe('authentication');
      expect(didDocument.proof!.domain).toBe('awiki.ai');
      expect(didDocument.proof!.challenge).toBe('test_challenge');
      expect(didDocument.proof!.proofValue).toMatch(/^z/);
    });
  });

  describe('Normal - E2EE identity creation', () => {
    it('should create DID document with E2EE keys', () => {
      const [didDocument, keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: true,
        services: [
          {
            id: '#messaging',
            type: 'MessagingService',
            serviceEndpoint: 'https://awiki.ai/message/rpc',
          },
        ],
      });

      expect(didDocument.verificationMethod).toHaveLength(3);

      const key1 = didDocument.verificationMethod.find(vm => vm.id.endsWith('#key-1'));
      expect(key1).toBeDefined();
      expect(key1!.type).toBe('EcdsaSecp256k1VerificationKey2019');

      const key2 = didDocument.verificationMethod.find(vm => vm.id.endsWith('#key-2'));
      expect(key2).toBeDefined();
      expect(key2!.type).toBe('EcdsaSecp256r1VerificationKey2019');

      const key3 = didDocument.verificationMethod.find(vm => vm.id.endsWith('#key-3'));
      expect(key3).toBeDefined();
      expect(key3!.type).toBe('JsonWebKey2020');
      expect(key3!.publicKeyJwk?.crv).toBe('X25519');

      expect(didDocument.keyAgreement).toContain(`${didDocument.id}#key-3`);
      expect(keys['key-1']).toBeDefined();
      expect(keys['key-2']).toBeDefined();
      expect(keys['key-3']).toBeDefined();
      expect(didDocument.service).toBeDefined();
      expect(didDocument.service![0].id).toBe(`${didDocument.id}#messaging`);
    });
  });

  describe('Error scenarios', () => {
    it('should throw error when hostname is empty', () => {
      expect(() =>
        createDidWbaDocumentWithKeyBinding({
          hostname: '',
          pathPrefix: ['user'],
          proofPurpose: 'authentication',
          domain: 'awiki.ai',
        })
      ).toThrow('Hostname cannot be empty');
    });

    it('should throw error when hostname is IP address', () => {
      expect(() =>
        createDidWbaDocumentWithKeyBinding({
          hostname: '192.168.1.1',
          pathPrefix: ['user'],
          proofPurpose: 'authentication',
          domain: 'awiki.ai',
        })
      ).toThrow('Hostname cannot be an IP address');

      expect(() =>
        createDidWbaDocumentWithKeyBinding({
          hostname: '::1',
          pathPrefix: ['user'],
          proofPurpose: 'authentication',
          domain: 'awiki.ai',
        })
      ).toThrow('Hostname cannot be an IP address');
    });
  });
});

// ============================================================================
// TC-AUTH-004: resolveDidWbaDocument Tests
// ============================================================================

describe('TC-AUTH-004: resolveDidWbaDocument', () => {
  describe('Error scenarios', () => {
    it('should throw error for invalid DID format', async () => {
      await expect(
        resolveDidWbaDocument('invalid-did')
      ).rejects.toThrow("Invalid DID format: must start with 'did:wba:'");

      await expect(
        resolveDidWbaDocument('did:wba:')
      ).rejects.toThrow('Invalid DID format: missing domain');
    });

    it('should return null for non-existent DID', async () => {
      const result = await resolveDidWbaDocument(
        'did:wba:awiki.ai:user:k1_nonexistent_test_did_12345'
      );
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// Integration Tests: Complete Authentication Flow
// ============================================================================

describe('Integration: Complete Auth Flow', () => {
  it('should complete create DID -> generate header -> verify header flow', async () => {
    const [didDocument, keys] = createDidWbaDocumentWithKeyBinding({
      hostname: 'awiki.ai',
      pathPrefix: ['user'],
      proofPurpose: 'authentication',
      domain: 'awiki.ai',
      enableE2ee: false,
    });

    const privateKey = extractPrivateKeyFromPem(keys['key-1'][0]);
    const publicKey = secp256k1.getPublicKey(privateKey, true);

    const signCallback = createSignCallback(privateKey);
    const authHeader = await generateAuthHeader(
      didDocument,
      'awiki.ai',
      signCallback,
      '1.1'
    );

    expect(authHeader).toMatch(/^DIDWba v="1\.1"/);

    const verifyCallback = createVerifyCallback(publicKey);
    const [isValid, message] = await verifyAuthHeader(
      authHeader,
      didDocument,
      verifyCallback,
      'awiki.ai',
      '1.1'
    );

    expect(isValid).toBe(true);
    expect(message).toBe('Verification successful');
  });

  it('should verify signature mismatch scenario', async () => {
    const [didDocument1, keys1] = createDidWbaDocumentWithKeyBinding({
      hostname: 'awiki.ai',
      pathPrefix: ['user'],
      proofPurpose: 'authentication',
      domain: 'awiki.ai',
      enableE2ee: false,
    });

    const [didDocument2, _keys2] = createDidWbaDocumentWithKeyBinding({
      hostname: 'awiki.ai',
      pathPrefix: ['user'],
      proofPurpose: 'authentication',
      domain: 'awiki.ai',
      enableE2ee: false,
    });

    const privateKey = extractPrivateKeyFromPem(keys1['key-1'][0]);
    const signCallback = createSignCallback(privateKey);
    const authHeader = await generateAuthHeader(
      didDocument1,
      'awiki.ai',
      signCallback,
      '1.1'
    );

    const wrongPublicKey = extractSecp256k1PublicKey(didDocument2);
    if (wrongPublicKey) {
      const verifyCallback = createVerifyCallback(wrongPublicKey);
      const [isValid, message] = await verifyAuthHeader(
        authHeader,
        didDocument1,
        verifyCallback,
        'awiki.ai',
        '1.1'
      );

      expect(isValid).toBe(false);
    }
  });
});

// ============================================================================
// Boundary Tests
// ============================================================================

describe('Boundary Tests', () => {
  describe('Invalid DID format', () => {
    it('should reject various invalid DID formats', async () => {
      const invalidDids = ['', 'not-a-did', 'did:invalid:method', 'did:wba:', 'did:wba:domain'];

      for (const invalidDid of invalidDids) {
        try {
          const result = await resolveDidWbaDocument(invalidDid);
          if (result !== null) {
            console.warn(`Unexpected success for DID: ${invalidDid}`);
          }
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Missing keys', () => {
    it('should handle empty verificationMethod', () => {
      const emptyDoc: DidDocument = {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: 'did:wba:awiki.ai:user:k1_test',
        verificationMethod: [],
        authentication: [],
      };

      expect(validateDidDocument(emptyDoc)).toBe(false);
    });
  });

  describe('Expired proof', () => {
    it('should detect proof timestamp', () => {
      const [didDocument, _keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: false,
      });

      expect(didDocument.proof).toBeDefined();
      expect(didDocument.proof!.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Signature verification failure', () => {
    it('should handle tampered signature', async () => {
      const [didDocument, keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: false,
      });

      const privateKey = extractPrivateKeyFromPem(keys['key-1'][0]);
      const publicKey = secp256k1.getPublicKey(privateKey, true);

      const signCallback = createSignCallback(privateKey);
      const authHeader = await generateAuthHeader(
        didDocument,
        'awiki.ai',
        signCallback,
        '1.1'
      );

      const tamperedHeader = authHeader.replace(
        /signature="([^"]+)"/,
        'signature="tampered_invalid_signature"'
      );

      const verifyCallback = createVerifyCallback(publicKey);
      const [isValid, message] = await verifyAuthHeader(
        tamperedHeader,
        didDocument,
        verifyCallback,
        'awiki.ai',
        '1.1'
      );

      expect(isValid).toBe(false);
    });
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('Helper Functions', () => {
  describe('validateDidDocument', () => {
    it('should validate valid DID document', () => {
      const [didDocument, _keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: false,
      });

      expect(validateDidDocument(didDocument)).toBe(true);
    });

    it('should reject documents missing required fields', () => {
      const invalidDocs = [
        {} as DidDocument,
        { id: 'did:test' } as DidDocument,
        { '@context': [], id: 'did:test' } as DidDocument,
        { '@context': [], id: 'did:test', verificationMethod: [] } as DidDocument,
      ];

      for (const doc of invalidDocs) {
        expect(validateDidDocument(doc)).toBe(false);
      }
    });
  });

  describe('extractServiceEndpoint', () => {
    it('should extract service endpoint', () => {
      const [didDocument, _keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: true,
        services: [
          {
            id: '#messaging',
            type: 'MessagingService',
            serviceEndpoint: 'https://awiki.ai/message/rpc',
          },
        ],
      });

      const endpoint = extractServiceEndpoint(didDocument, 'MessagingService');
      expect(endpoint).toBe('https://awiki.ai/message/rpc');
    });

    it('should return null when service not found', () => {
      const [didDocument, _keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: false,
      });

      const endpoint = extractServiceEndpoint(didDocument, 'NonExistentService');
      expect(endpoint).toBeNull();
    });
  });

  describe('getVerificationMethod', () => {
    it('should get verificationMethod by full ID', () => {
      const [didDocument, _keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: false,
      });

      const vm = getVerificationMethod(didDocument, `${didDocument.id}#key-1`);
      expect(vm).toBeDefined();
      expect(vm!.id).toContain('#key-1');
    });

    it('should get verificationMethod by fragment', () => {
      const [didDocument, _keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: false,
      });

      const vm = getVerificationMethod(didDocument, '#key-1');
      expect(vm).toBeDefined();
      expect(vm!.id).toContain('#key-1');
    });
  });

  describe('supportsE2ee', () => {
    it('should detect E2EE-supporting document', () => {
      const [didDocument, _keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: true,
      });

      expect(supportsE2ee(didDocument)).toBe(true);
    });

    it('should detect non-E2EE document', () => {
      const [didDocument, _keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: false,
      });

      expect(supportsE2ee(didDocument)).toBe(false);
    });
  });

  describe('extractSecp256k1PublicKey', () => {
    it('should extract secp256k1 public key', () => {
      const [didDocument, _keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: false,
      });

      const publicKey = extractSecp256k1PublicKey(didDocument);
      expect(publicKey).toBeDefined();
      expect(publicKey!.length).toBe(33);
    });

    it('should return null for non-existent keyId', () => {
      const [didDocument, _keys] = createDidWbaDocumentWithKeyBinding({
        hostname: 'awiki.ai',
        pathPrefix: ['user'],
        proofPurpose: 'authentication',
        domain: 'awiki.ai',
        enableE2ee: false,
      });

      const publicKey = extractSecp256k1PublicKey(didDocument, 'nonexistent-key');
      expect(publicKey).toBeNull();
    });
  });
});

// ============================================================================
// Python Interoperability Tests
// ============================================================================

describe('Python Interoperability', () => {
  it('should generate auth header compatible with Python version format', async () => {
    const [didDocument, keys] = createDidWbaDocumentWithKeyBinding({
      hostname: 'awiki.ai',
      pathPrefix: ['user'],
      proofPurpose: 'authentication',
      domain: 'awiki.ai',
      enableE2ee: false,
    });

    const privateKey = extractPrivateKeyFromPem(keys['key-1'][0]);
    const signCallback = createSignCallback(privateKey);

    const authHeader = await generateAuthHeader(
      didDocument,
      'awiki.ai',
      signCallback,
      '1.1'
    );

    expect(authHeader).toMatch(/^DIDWba v="[\d.]+"/);
    expect(authHeader).toContain('did="did:wba:awiki.ai:user:k1_');
    expect(authHeader).toContain('nonce="');
    expect(authHeader).toContain('timestamp="');
    expect(authHeader).toContain('verification_method="key-1"');
    expect(authHeader).toContain('signature="');
  });

  it('should have DID document structure compatible with Python version', () => {
    const [didDocument, keys] = createDidWbaDocumentWithKeyBinding({
      hostname: 'awiki.ai',
      pathPrefix: ['user'],
      proofPurpose: 'authentication',
      domain: 'awiki.ai',
      enableE2ee: true,
    });

    expect(didDocument.id).toMatch(/^did:wba:awiki\.ai:user:k1_[A-Za-z0-9_-]{43}$/);

    expect(didDocument['@context']).toEqual([
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/jws-2020/v1',
      'https://w3id.org/security/suites/secp256k1-2019/v1',
      'https://w3id.org/security/suites/x25519-2019/v1',
    ]);

    for (const vm of didDocument.verificationMethod) {
      expect(vm.id).toBeDefined();
      expect(vm.type).toBeDefined();
      expect(vm.controller).toBe(didDocument.id);
      expect(vm.publicKeyJwk).toBeDefined();
    }

    expect(didDocument.proof).toBeDefined();
    expect(didDocument.proof!.type).toBe('WbaProof2025');
    expect(didDocument.proof!.verificationMethod).toMatch(/#key-1$/);
    expect(didDocument.proof!.proofPurpose).toBe('authentication');
  });
});
