/**
 * JSON-RPC 2.0 client helper functions.
 *
 * Compatible with Python's scripts/utils/rpc.py.
 *
 * [INPUT]: httpx.AsyncClient, endpoint path, method name, params, DIDWbaAuthHeader
 * [OUTPUT]: rpcCall() helper, authenticatedRpcCall() with 401 retry, JsonRpcError exception class
 *
 * [PROTOCOL]:
 * 1. Update this header when logic changes
 * 2. Check the folder's CLAUDE.md after updates
 */

import axios from 'axios';

/**
 * JSON-RPC error response exception.
 */
export class JsonRpcError extends Error {
    constructor(code, message, data = null) {
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
 * @param {Object} client - axios client.
 * @param {string} endpoint - RPC endpoint path (e.g., "/did-auth/rpc").
 * @param {string} method - RPC method name (e.g., "register").
 * @param {Object} params - Method parameters.
 * @param {number|string} requestId - Request ID.
 * @returns {Promise<Object>} Result value.
 * @throws {JsonRpcError} When the server returns a JSON-RPC error.
 * @throws {Error} On HTTP layer errors.
 */
export async function rpcCall(client, endpoint, method, params = {}, requestId = 1) {
    const payload = {
        jsonrpc: '2.0',
        method,
        params,
        id: requestId,
    };

    const resp = await client.post(endpoint, payload);

    if (resp.data.error) {
        const error = resp.data.error;
        throw new JsonRpcError(error.code, error.message, error.data);
    }

    return resp.data.result;
}

/**
 * JSON-RPC 2.0 request with automatic 401 retry.
 *
 * Uses DIDWbaAuthHeader to manage authentication headers and token caching.
 * On 401, automatically clears the expired token and regenerates DIDWba auth header to retry.
 *
 * Compatible with Python's authenticated_rpc_call().
 *
 * @param {Object} client - axios client (with baseURL set).
 * @param {string} endpoint - RPC endpoint path.
 * @param {string} method - RPC method name.
 * @param {Object} params - Method parameters.
 * @param {number|string} requestId - Request ID.
 * @param {Object} options - Options object.
 * @param {Object} options.auth - DIDWbaAuthHeader instance.
 * @param {string} options.credentialName - Credential name (for persisting new JWT).
 * @param {Function} options.updateJwtCallback - Callback to persist new JWT.
 * @returns {Promise<Object>} Result value.
 * @throws {JsonRpcError} When the server returns a JSON-RPC error.
 * @throws {Error} On HTTP layer errors (non-401).
 */
export async function authenticatedRpcCall(
    client,
    endpoint,
    method,
    params = {},
    requestId = 1,
    { auth, credentialName = 'default', updateJwtCallback = null } = {}
) {
    const serverUrl = client.defaults.baseURL || '';
    const payload = {
        jsonrpc: '2.0',
        method,
        params,
        id: requestId,
    };

    // Get authentication headers
    let authHeaders = auth.getAuthHeader(serverUrl);
    let resp = await client.post(endpoint, payload, { headers: authHeaders });

    // 401 -> clear expired token -> re-authenticate -> retry
    if (resp.status === 401) {
        auth.clearToken(serverUrl);
        authHeaders = auth.getAuthHeader(serverUrl, true); // force_new=True
        resp = await client.post(endpoint, payload, { headers: authHeaders });
    }

    // Throw error if still 401
    if (resp.status === 401) {
        throw new Error('Authentication failed: unable to obtain valid token');
    }

    // Success: cache new token from response headers
    // Note: axios response header keys are lowercase
    const authHeaderValue = resp.headers.get?.('authorization') || resp.headers['authorization'] || '';
    const newToken = auth.updateToken(serverUrl, { Authorization: authHeaderValue });

    // Persist new JWT to credential file
    if (newToken && updateJwtCallback) {
        await updateJwtCallback(credentialName, newToken);
    }

    // Check for JSON-RPC error
    if (resp.data.error) {
        const error = resp.data.error;
        throw new JsonRpcError(error.code, error.message, error.data);
    }

    return resp.data.result;
}

export default {
    JsonRpcError,
    rpcCall,
    authenticatedRpcCall
};
