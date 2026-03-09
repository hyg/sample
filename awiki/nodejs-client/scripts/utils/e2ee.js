/**
 * E2EE Client - High-level wrapper for ANP E2EE HPKE module.
 * 
 * Compatible with Python's anp.e2e_encryption_hpke module.
 * 
 * @module utils/e2ee
 */

import { E2eeClient, SUPPORTED_E2EE_VERSION } from '../../lib/anp/e2e_encryption_hpke/_init.js';

export { E2eeClient, SUPPORTED_E2EE_VERSION };

export default {
    E2eeClient,
    SUPPORTED_E2EE_VERSION
};
