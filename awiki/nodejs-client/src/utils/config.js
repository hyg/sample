/**
 * SDK configuration.
 *
 * Centralized management of service URLs, domain, and credentials directory.
 *
 * Environment variables:
 * - E2E_USER_SERVICE_URL: User service URL (default: https://awiki.ai)
 * - E2E_MOLT_MESSAGE_URL: Message service URL (default: https://awiki.ai)
 * - E2E_DID_DOMAIN: DID domain (default: awiki.ai)
 * - E2E_CREDENTIALS_DIR: Credentials directory (default: system credentials dir)
 *
 * @module utils/config
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Get system credentials directory (same as Python version).
 * @returns {string} System credentials directory path
 */
function getSystemCredentialsDir() {
    const homeDir = process.env.USERPROFILE || process.env.HOME || process.env.HOMEPATH;
    return path.join(
        homeDir,
        '.openclaw',
        'credentials',
        'awiki-agent-id-message'
    );
}

/**
 * @typedef {Object} SDKConfig
 * @property {string} user_service_url - User service URL
 * @property {string} molt_message_url - Message service URL
 * @property {string} did_domain - DID domain
 * @property {string} credentials_dir - Credentials directory path
 */

/**
 * Create SDK configuration from environment variables.
 *
 * @returns {SDKConfig} Configuration object
 */
export function createSDKConfig() {
    const user_service_url = process.env.E2E_USER_SERVICE_URL || 'https://awiki.ai';
    const molt_message_url = process.env.E2E_MOLT_MESSAGE_URL || 'https://awiki.ai';
    const did_domain = process.env.E2E_DID_DOMAIN || 'awiki.ai';

    // Default: use system credentials directory (same as Python)
    // Can override with E2E_CREDENTIALS_DIR environment variable
    const credentials_dir = process.env.E2E_CREDENTIALS_DIR || getSystemCredentialsDir();

    return {
        user_service_url,
        molt_message_url,
        did_domain,
        credentials_dir
    };
}

export default {
    createSDKConfig
};
