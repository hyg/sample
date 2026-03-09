/**
 * Authentication module.
 *
 * Compatible with Python's anp.authentication module.
 *
 * @module authentication
 */

export {
    DIDWbaAuthHeader
} from './did_wba_authenticator.js';

export {
    generateAuthHeader,
    extractAuthHeaderParts,
    verifyAuthHeaderSignature,
    encodeBase64Url,
    encodeDerSignature,
    loadPrivateKeyFromPem
} from './did_wba.js';

export default {
    DIDWbaAuthHeader,
    generateAuthHeader,
    extractAuthHeaderParts,
    verifyAuthHeaderSignature
};
