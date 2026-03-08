/**
 * DID/Handle resolution.
 *
 * Compatible with Python's resolve.py.
 */

import axios from 'axios';

/**
 * Resolve a DID or handle to full DID.
 * @param {string} identifier - DID or handle
 * @param {Object} config - SDK config
 * @returns {Promise<string>} Full DID
 */
export async function resolveToDid(identifier, config) {
    if (identifier.startsWith('did:')) {
        return identifier;
    }
    
    // It's a handle, resolve it
    const response = await axios.post(`${config.user_service_url}/user-service/handle/rpc`, {
        jsonrpc: '2.0',
        method: 'lookup',
        params: { handle: identifier },
        id: 1
    });
    
    if (response.data.error) {
        throw new Error(response.data.error.message);
    }
    
    return response.data.result.did;
}

export default {
    resolveToDid
};
