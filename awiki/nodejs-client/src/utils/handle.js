/**
 * Handle (short name) registration and resolution utilities.
 * 
 * Compatible with Python's utils/handle.py.
 * 
 * Uses JSON-RPC 2.0 endpoints: /user-service/handle/rpc and /user-service/did-auth/rpc.
 */

import { createIdentity } from './identity.js';
import { rpcCall } from './rpc.js';
import { getJwtViaWba } from './auth.js';

const HANDLE_RPC = '/user-service/handle/rpc';
const DID_AUTH_RPC = '/user-service/did-auth/rpc';

// International phone format: +{country_code}{number}
const PHONE_INTL_RE = /^\+\d{1,3}\d{6,14}$/;
// China local format: 11 digits starting with 1
const PHONE_CN_LOCAL_RE = /^1[3-9]\d{9}$/;
const DEFAULT_COUNTRY_CODE = '+86';

/**
 * Normalize a phone number to international format.
 * 
 * @param {string} phone - Raw phone number input.
 * @returns {string} Phone number in international format.
 * @throws {Error} Invalid phone number format.
 */
export function normalizePhone(phone) {
    phone = phone.trim();
    
    if (phone.startsWith('+')) {
        if (PHONE_INTL_RE.test(phone)) {
            return phone;
        }
        throw new Error(
            `Invalid international phone number: ${phone}. ` +
            `Expected format: +<country_code><number> (e.g., +8613800138000, +14155552671). ` +
            `Please check the country code.`
        );
    }
    
    if (PHONE_CN_LOCAL_RE.test(phone)) {
        return `${DEFAULT_COUNTRY_CODE}${phone}`;
    }
    
    throw new Error(
        `Invalid phone number: ${phone}. ` +
        `Use international format with country code: +<country_code><number> ` +
        `(e.g., +8613800138000 for China, +14155552671 for US). ` +
        `China local numbers (11 digits starting with 1) are auto-prefixed with +86.`
    );
}

/**
 * Send OTP verification code for Handle registration.
 * 
 * @param {Object} client - HTTP client pointing to user-service.
 * @param {string} phone - Phone number in international format.
 * @returns {Promise<Object>} RPC result dict.
 * @throws {Error} Invalid phone number format or RPC error.
 */
export async function sendOtp(client, phone) {
    const normalized = normalizePhone(phone);
    
    try {
        return await rpcCall(client, HANDLE_RPC, 'sendOtp', { phone: normalized });
    } catch (error) {
        if (error.code) {
            throw new Error(
                `${error.message}. Please verify the phone number and country code ` +
                `(current: ${normalized}).`
            );
        }
        throw error;
    }
}

/**
 * One-stop Handle registration: create identity -> register DID with Handle -> obtain JWT.
 * 
 * Creates a key-bound DID with Handle as path prefix (e.g., did:wba:awiki.ai:alice:k1_<fp>),
 * then calls register with Handle parameters.
 * 
 * @param {Object} options - Registration options.
 * @param {Object} options.client - HTTP client pointing to user-service.
 * @param {Object} options.config - SDK configuration.
 * @param {string} options.phone - Phone number in international format.
 * @param {string} options.otp_code - OTP verification code.
 * @param {string} options.handle - Handle local-part (e.g., "alice").
 * @param {string} [options.invite_code] - Invite code (required for short handles <= 4 chars).
 * @param {string} [options.name] - Display name.
 * @param {boolean} [options.is_public] - Whether publicly visible.
 * @param {Array} [options.services] - Custom service entry list for DID document.
 * @returns {Promise<Object>} DIDIdentity with user_id and jwt_token populated.
 * @throws {Error} Invalid phone number format or registration failure.
 */
export async function registerHandle({
    client,
    config,
    phone,
    otp_code,
    handle,
    invite_code = null,
    name = null,
    is_public = false,
    services = null
}) {
    const normalized = normalizePhone(phone);
    
    // 1. Create key-bound DID identity with handle as path prefix
    const identity = createIdentity({
        hostname: config.did_domain,
        path_prefix: [handle],
        proof_purpose: 'authentication',
        domain: config.did_domain,
        services
    });
    
    // 2. Register DID with Handle parameters
    const payload = {
        did_document: identity.did_document,
        handle: handle,
        phone: normalized,
        otp_code: otp_code
    };
    
    if (invite_code !== null) {
        payload.invite_code = invite_code;
    }
    if (name !== null) {
        payload.name = name;
    }
    if (is_public) {
        payload.is_public = true;
    }
    
    const regResult = await rpcCall(client, DID_AUTH_RPC, 'register', payload);
    identity.user_id = regResult.user_id;
    
    // 3. Registration returns access_token for handle mode
    if (regResult.access_token) {
        identity.jwt_token = regResult.access_token;
    } else {
        // Fallback to JWT via WBA (should not happen for handle registration)
        try {
            identity.jwt_token = await getJwtViaWba(
                config.user_service_url,
                identity.did_document,
                identity.privateKey,
                config.did_domain
            );
        } catch (error) {
            console.warn('Warning: JWT acquisition failed after handle registration');
            console.warn(`Error: ${error.message}`);
        }
    }
    
    return identity;
}

/**
 * Resolve a Handle to its DID mapping.
 * 
 * @param {Object} client - HTTP client pointing to user-service.
 * @param {string} handle - Handle local-part (e.g., "alice").
 * @returns {Promise<Object>} Lookup result dict.
 * @throws {Error} When lookup fails.
 */
export async function resolveHandle(client, handle) {
    return await rpcCall(client, HANDLE_RPC, 'lookup', { handle });
}

/**
 * Look up a Handle by DID.
 * 
 * @param {Object} client - HTTP client pointing to user-service.
 * @param {string} did - DID identifier.
 * @returns {Promise<Object>} Lookup result dict.
 * @throws {Error} When lookup fails.
 */
export async function lookupHandle(client, did) {
    return await rpcCall(client, HANDLE_RPC, 'lookup', { did });
}

export default {
    normalizePhone,
    sendOtp,
    registerHandle,
    resolveHandle,
    lookupHandle
};
