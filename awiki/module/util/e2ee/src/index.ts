/**
 * E2EE 模块入口 - HPKE
 */

export {
  hpkeSeal,
  hpkeOpen,
  deriveChainKey,
  deriveEncryptionKey,
  encryptWithChainKey,
  decryptWithChainKey,
  HPKE_SUITE,
  HPKE_VERSION,
  KEM_ID,
  KDF_ID,
  AEAD_ID,
  AEAD_KEY_LENGTH,
  AEAD_NONCE_LENGTH,
  AEAD_TAG_LENGTH,
  concatBytes,
  i2osp,
  x25519,
} from './hpke.js';

export type {
  HpkeSealResult,
} from './hpke.js';

export {
  E2eeClient,
  E2eeHpkeSession,
  HpkeKeyManager,
  SUPPORTED_E2EE_VERSION,
  extractProofVerificationMethod,
  ensureSupportedE2eeVersion,
  buildE2eeErrorContent,
  buildE2eeErrorMessage,
  classifyProtocolError,
  detectMessageType,
} from './e2ee.js';

export type {
  E2eeContent,
  E2eeErrorContent,
  E2eeClientOptions,
  E2eeClientState,
  ExportedSession,
  HandshakeResponse,
  MessageProcessResponse,
  EncryptResponse,
  DecryptResponse,
  SessionState,
  E2eeMessageType,
  E2eeErrorCode,
  HpkeSuite,
  HpkeOptions,
} from './types.js';
