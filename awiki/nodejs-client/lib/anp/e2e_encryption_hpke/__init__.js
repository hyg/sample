/**
 * E2EE HPKE Module
 * 
 * Compatible with Python anp.e2e_encryption_hpke module.
 */

// Core HPKE functions
export { hpkeSeal, hpkeOpen, generateX25519KeyPair } from './hpke.js';

// Ratchet functions
export { deriveChainKeys, determineDirection, assignChainKeys, deriveMessageKey, deriveGroupMessageKey } from './ratchet.js';

// Session management
export { E2eeHpkeSession, SessionState, exportSession, importSession } from './session.js';

// Key management
export { HpkeKeyManager } from './key_manager.js';

// Message handling
export { buildE2eeInit, buildE2eeMsg, buildE2eeRekey } from './message_builder.js';
export { parseE2eeInit, parseE2eeMsg, parseE2eeRekey, detectMessageType, MessageType } from './message_parser.js';

// Sequence management
export { SeqManager, SeqMode } from './seq_manager.js';

// Crypto utilities
export { encryptAes128Gcm, decryptAes128Gcm } from './crypto.js';

// Key pair utilities
export { generateX25519KeyPair as generate_x25519_key_pair } from './key_pair.js';

// Constants
export const SUPPORTED_E2EE_VERSION = '1.1';
export const HPKE_SUITE = 'DHKEM-X25519-HKDF-SHA256/HKDF-SHA256/AES-128-GCM';

export default {
    hpkeSeal,
    hpkeOpen,
    deriveChainKeys,
    determineDirection,
    assignChainKeys,
    deriveMessageKey,
    E2eeHpkeSession,
    SessionState,
    HpkeKeyManager,
    SeqManager,
    SeqMode,
    SUPPORTED_E2EE_VERSION
};
