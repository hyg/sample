/**
 * Proof Module
 * 
 * Compatible with Python anp.proof module.
 */

export { generateW3cProof, verifyW3cProof } from './proof.js';

// Python style exports
export { generateW3cProof as generate_proof, verifyW3cProof as verify_proof };

export default {
    generateW3cProof,
    verifyW3cProof
};
