/**
 * Handle-to-DID resolution via .well-known/handle endpoint.
 * 
 * Compatible with Python's resolve.py.
 * 
 * @module utils/resolve
 */

import axios from 'axios';

/**
 * Resolve a DID or handle to a DID.
 * 
 * If identifier starts with "did:", return as-is.
 * Otherwise treat as handle and call GET /user-service/.well-known/handle/{local_part}.
 * 
 * @param {string} identifier - A DID string or a handle local-part (e.g., "alice")
 * @param {Object} [config] - SDK configuration
 * @returns {Promise<string>} The resolved DID string
 * @throws {Error} If handle is not found or status is not "active"
 */
export async function resolveToDid(identifier, config = null) {
    if (identifier.startsWith('did:')) {
        return identifier;
    }
    
    // Strip domain suffix if present (e.g., "alice.awiki.ai" -> "alice")
    if (config && config.did_domain && identifier.endsWith(`.${config.did_domain}`)) {
        identifier = identifier.slice(0, -(config.did_domain.length + 1));
    }
    
    // Use default config if not provided
    if (!config) {
        const { createSDKConfig } = await import('./config.js');
        config = createSDKConfig();
    }
    
    const url = `${config.user_service_url}/user-service/.well-known/handle/${identifier}`;
    
    const client = axios.create({
        timeout: 10000,
        headers: {
            'Accept': 'application/json'
        }
    });
    
    const resp = await client.get(url);
    
    if (resp.status === 404) {
        throw new Error(`Handle '${identifier}' not found`);
    }
    
    if (resp.status >= 300) {
        throw new Error(`HTTP error ${resp.status}: ${resp.statusText}`);
    }
    
    const data = resp.data;
    const status = data.status || '';
    
    if (status !== 'active') {
        throw new Error(`Handle '${identifier}' is not active (status: ${status})`);
    }
    
    const did = data.did || '';
    if (!did) {
        throw new Error(`Handle '${identifier}' has no DID binding`);
    }
    
    return did;
}

export default {
    resolveToDid
};
