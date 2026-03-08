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
 * On 401, automatically clears the expired token and regenerates DIDWba auth header to retry.
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
    
    // 401 -> clear expired token -> re-authenticate -> retry
    if (resp.status === 401) {
        if (auth) {
            auth.clearToken(serverUrl);
            authHeaders = auth.getAuthHeader(serverUrl, true);
            resp = await client.post(endpoint, payload, { headers: authHeaders });
        } else {
            throw new Error('401 Unauthorized but no auth provider available');
        }
    }
    
    if (resp.status >= 300) {
        throw new Error(`HTTP error ${resp.status}: ${resp.statusText}`);
    }
    
    // Success: cache new token from response headers
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
