/**
 * Utils module - common utilities.
 *
 * @module utils
 */

export { createSDKConfig } from './config.js';
export {
    saveIdentity,
    loadIdentity,
    updateJwt,
    listIdentities,
    deleteIdentity,
    getCredentialPath
} from './credential_store.js';
export {
    JsonRpcError,
    rpcCall,
    authenticatedRpcCall
} from './rpc.js';

export default {
    createSDKConfig,
    saveIdentity,
    loadIdentity,
    updateJwt,
    listIdentities,
    deleteIdentity,
    JsonRpcError,
    rpcCall,
    authenticatedRpcCall
};
