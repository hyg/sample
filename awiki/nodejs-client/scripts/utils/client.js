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
        }
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
        baseURL: config.user_service_url,
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    return client;
}

export default {
    createUserServiceClient,
    createMoltMessageClient
};
