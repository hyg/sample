/**
 * JSON-RPC 2.0 client helper functions.
 * 
 * Compatible with Python's rpc.py.
 * 
 * @module utils/rpc
 */

import axios from 'axios';

/**
 * JSON-RPC error response exception.
 */
export class JsonRpcError extends Error {
    /**
     * @param {number} code - Error code
     * @param {string} message - Error message
     * @param {any} [data] - Error data
     */
    constructor(code, message, data) {
        super(`JSON-RPC error ${code}: ${message}`);
        this.code = code;
        this.message = message;
        this.data = data;
        this.name = 'JsonRpcError';
    }
}

/**
 * Send a JSON-RPC 2.0 request and return the result.
 * 
 * @param {Object} client - Axios client instance
 * @param {string} endpoint - RPC endpoint path
 * @param {string} method - RPC method name
 * @param {Object} [params] - Method parameters
 * @param {number|string} [requestId=1] - Request ID
 * @returns {Promise<any>} Result value
 * @throws {JsonRpcError} When the server returns a JSON-RPC error
 */
export async function rpcCall(client, endpoint, method, params = {}, requestId = 1) {
    const payload = {
        jsonrpc: '2.0',
        method,
        params: params || {},
        id: requestId
    };
    
    const resp = await client.post(endpoint, payload);
    
    if (resp.status >= 300) {
        throw new Error(`HTTP error ${resp.status}: ${resp.statusText}`);
    }
    
    const body = resp.data;
    
    if (body.error !== null && body.error !== undefined) {
        const error = body.error;
        throw new JsonRpcError(
            error.code,
            error.message,
            error.data
        );
    }
    
    return body.result;
}

/**
 * JSON-RPC 2.0 request with automatic 401 retry.
 *
 * Uses DIDWbaAuthHeader to manage authentication headers and token caching.
 * On 401, automatically obtains new JWT via DID WBA signature and retries.
 *
 * @param {Object} client - Axios client instance
 * @param {string} endpoint - RPC endpoint path
 * @param {string} method - RPC method name
 * @param {Object} [params] - Method parameters
 * @param {number|string} [requestId=1] - Request ID
 * @param {Object} [auth] - DIDWbaAuthHeader instance
 * @param {string} [credentialName='default'] - Credential name (for persisting new JWT)
 * @param {Function} [onTokenUpdate] - Callback when token is updated
 * @returns {Promise<any>} Result value
 * @throws {JsonRpcError} When the server returns a JSON-RPC error
 */
export async function authenticatedRpcCall(
    client,
    endpoint,
    method,
    params = {},
    requestId = 1,
    { auth, credentialName = 'default', onTokenUpdate } = {}
) {
    const serverUrl = client.defaults.baseURL;
    const payload = {
        jsonrpc: '2.0',
        method,
        params: params || {},
        id: requestId
    };

    // Get authentication headers
    let authHeaders = {};
    if (auth) {
        authHeaders = auth.getAuthHeader(serverUrl);
    }

    let resp = await client.post(endpoint, payload, { headers: authHeaders });

    // 401 -> obtain new JWT via DID WBA signature -> retry
    if (resp.status === 401) {
        console.log('[401] JWT expired or invalid, obtaining new JWT...');
        
        if (auth) {
            // Clear expired token
            auth.clearToken(serverUrl);
            
            // Load identity to get private key and DID document
            const { loadIdentity } = await import('../credential_store.js');
            const identity = loadIdentity(credentialName);
            
            if (identity && identity.private_key_pem && identity.did_document) {
                try {
                    // Obtain new JWT via DID WBA signature
                    const { getJwtViaWba } = await import('./auth.js');
                    const domain = 'awiki.ai';
                    
                    // Convert PEM to private key bytes
                    const { loadPrivateKeyFromPem } = await import('../utils/identity.js');
                    const privateKeyBytes = loadPrivateKeyFromPem(identity.private_key_pem);
                    
                    const newJwt = await getJwtViaWba(
                        serverUrl,
                        identity.did_document,
                        privateKeyBytes,
                        domain
                    );

                    console.log('[401] New JWT obtained successfully');

                    // Save new JWT to credential file
                    const { updateJwt } = await import('../credential_store.js');
                    updateJwt(credentialName, newJwt);

                    // Update auth token cache
                    auth.updateToken(serverUrl, { 'Authorization': `Bearer ${newJwt}` });

                    // Retry with new JWT
                    authHeaders = { 'Authorization': `Bearer ${newJwt}` };
                    resp = await client.post(endpoint, payload, { headers: authHeaders });

                } catch (e) {
                    console.error('[401] Failed to obtain new JWT:', e.message);
                    throw new Error(`JWT refresh failed: ${e.message}`);
                }
            } else {
                throw new Error('Cannot refresh JWT: identity not found or missing required fields');
            }
        } else {
            throw new Error('401 Unauthorized but no auth provider available');
        }
    }

    if (resp.status >= 300) {
        throw new Error(`HTTP error ${resp.status}: ${resp.statusText}`);
    }

    // Success: cache new token from response headers (if server returns one)
    const authHeaderValue = resp.headers['authorization'] || resp.headers['Authorization'] || '';
    if (auth && authHeaderValue) {
        const newToken = auth.updateToken(serverUrl, { 'Authorization': authHeaderValue });
        if (newToken) {
            // Save new JWT to credential file
            if (onTokenUpdate) {
                onTokenUpdate(credentialName, newToken);
            } else {
                // Default: use credential_store.updateJwt
                const { updateJwt } = await import('../credential_store.js');
                updateJwt(credentialName, newToken);
            }
        }
    }

    const body = resp.data;

    if (body.error !== null && body.error !== undefined) {
        const error = body.error;
        throw new JsonRpcError(
            error.code,
            error.message,
            error.data
        );
    }

    return body.result;
}

export default {
    JsonRpcError,
    rpcCall,
    authenticatedRpcCall
};
