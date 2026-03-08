/**
 * awiki-sdk: General SDK for DID identity creation, WBA authentication, JWT acquisition,
 * Handle registration, and WebSocket client.
 * 
 * Centralizes export of all public interfaces.
 * 
 * @module index
 */

// Config
export { createSDKConfig } from './utils/config.js';

// Identity
export {
    createIdentity,
    generateProof,
    generateE2eeKeys,
    encodeBase64Url,
    decodeBase64Url,
    publicKeyToJwk,
    privateKeyToPem,
    publicKeyToPem,
    loadPrivateKey
} from './utils/identity.js';

// Auth
export {
    DIDWbaAuthHeader,
    generateWbaAuthHeader,
    registerDid,
    getJwtViaWba,
    createAuthenticatedIdentity
} from './utils/auth.js';

// Client
export {
    createUserServiceClient,
    createMoltMessageClient
} from './utils/client.js';

// RPC
export {
    JsonRpcError,
    rpcCall,
    authenticatedRpcCall
} from './utils/rpc.js';

// Resolve
export { resolveToDid } from './utils/resolve.js';

// Credential Store
export {
    saveIdentity,
    loadIdentity,
    listIdentities,
    deleteIdentity,
    updateJwt,
    extractAuthCredentials,
    createAuthenticator
} from './credential_store.js';

// E2EE
export {
    HPKE_SUITE,
    PROOF_TYPE,
    DEFAULT_EXPIRES,
    DEFAULT_MAX_SKIP,
    DEFAULT_SKIP_KEY_TTL,
    SeqMode,
    SessionState,
    SeqManager,
    generateProof,
    verifyProof,
    hpkeSeal,
    hpkeOpen,
    deriveChainKeys,
    determineDirection,
    assignChainKeys,
    deriveMessageKey,
    base64UrlEncode,
    base64UrlDecode
} from './e2ee.js';

export {
    E2eeHpkeSession,
    exportSession,
    importSession
} from './e2ee_session.js';

export {
    HpkeKeyManager
} from './e2ee_key_manager.js';

// E2EE Store
export {
    saveE2eeState,
    loadE2eeState,
    deleteE2eeState
} from './e2ee_store.js';

export default {
    // Config
    createSDKConfig,
    
    // Identity
    createIdentity,
    generateProof,
    generateE2eeKeys,
    encodeBase64Url,
    decodeBase64Url,
    publicKeyToJwk,
    privateKeyToPem,
    publicKeyToPem,
    loadPrivateKey,
    
    // Auth
    DIDWbaAuthHeader,
    generateWbaAuthHeader,
    registerDid,
    getJwtViaWba,
    createAuthenticatedIdentity,
    
    // Client
    createUserServiceClient,
    createMoltMessageClient,
    
    // RPC
    JsonRpcError,
    rpcCall,
    authenticatedRpcCall,
    
    // Resolve
    resolveToDid,
    
    // Credential Store
    saveIdentity,
    loadIdentity,
    listIdentities,
    deleteIdentity,
    updateJwt,
    extractAuthCredentials,
    createAuthenticator,
    
    // E2EE
    HPKE_SUITE,
    PROOF_TYPE,
    DEFAULT_EXPIRES,
    SeqMode,
    SessionState,
    SeqManager,
    E2eeHpkeSession,
    HpkeKeyManager,
    saveE2eeState,
    loadE2eeState,
    deleteE2eeState
};
