/**
 * HTTP client factory functions.
 * 
 * Compatible with Python's client.py.
 * 
 * @module utils/client
 */

import axios from 'axios';

/**
 * Create an HTTP client for user-service.
 *
 * @param {Object} config - SDK configuration
 * @returns {Object} Axios client instance
 */
export function createUserServiceClient(config) {
    const client = axios.create({
        baseURL: config.user_service_url,
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json'
        },
        // Don't throw on 4xx/5xx, let the caller handle it
        validateStatus: () => true
    });

    return client;
}

/**
 * Create an HTTP client for molt-message service.
 *
 * @param {Object} config - SDK configuration
 * @returns {Object} Axios client instance
 */
export function createMoltMessageClient(config) {
    const client = axios.create({
        baseURL: config.molt_message_url,
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json'
        },
        // Don't throw on 4xx/5xx, let the caller handle it
        validateStatus: () => true
    });

    return client;
}

export default {
    createUserServiceClient,
    createMoltMessageClient
};
