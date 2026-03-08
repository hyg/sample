/**
 * Capture and display the actual e2ee_init packet sent to awiki.ai.
 */

import { loadIdentity } from '../src/credential_store.js';
import { E2eeClient } from '../src/e2ee.js';
import { resolveToDid } from '../src/utils/resolve.js';
import { createSDKConfig } from '../src/utils/config.js';

const TARGET_DID = 'did:wba:awiki.ai:user:k1_136mytd3v6udtuW5ZsfyP7q1hD3iAEsZysJ8xI9nXsY';

console.log('='.repeat(80));
console.log('Node.js E2EE Init Packet Capture');
console.log('='.repeat(80));

// Load identity
const cred = loadIdentity('nodeagent3');
if (!cred) {
    console.log('Error: Credential \'nodeagent3\' not found');
    process.exit(1);
}

console.log(`\nLocal DID: ${cred.did}`);
console.log(`Target DID: ${TARGET_DID}`);

// Create E2EE client
const e2eeClient = new E2eeClient(cred.did, {
    signingPem: Buffer.from(cred.e2ee_signing_private_pem, 'utf-8'),
    x25519Pem: Buffer.from(cred.e2ee_agreement_private_pem, 'utf-8')
});

// Generate e2ee_init
async function captureInit() {
    // Resolve peer DID document and extract X25519 public key
    const config = createSDKConfig();
    const peerDoc = await resolveToDid(TARGET_DID, config);
    
    // Extract X25519 public key from peer DID document
    const keyAgreement = peerDoc.keyAgreement?.[0] || peerDoc.did_document?.keyAgreement?.[0];
    const keyId = keyAgreement?.split('#')[1] || 'key-3';
    
    const peerVm = peerDoc.verificationMethod?.find(vm => vm.id.endsWith('#key-3')) ||
                   peerDoc.did_document?.verificationMethod?.find(vm => vm.id.endsWith('#key-3'));
    
    if (!peerVm || !peerVm.publicKeyMultibase) {
        throw new Error('Peer has no X25519 key for E2EE');
    }
    
    // Decode base58btc public key
    const { base58btc } = await import('multiformats/bases/base58');
    const peerPkBytes = base58btc.decode(peerVm.publicKeyMultibase);
    const peerPk = Buffer.from(peerPkBytes);
    
    const [msgType, content] = await e2eeClient.initiateHandshake(TARGET_DID, peerPk, `did:wba:awiki.ai:user:k1_136mytd3v6udtuW5ZsfyP7q1hD3iAEsZysJ8xI9nXsY#${keyId}`);
    return [msgType, content];
}

const [msgType, content] = await captureInit();

console.log(`\n[Packet 1: e2ee_init]`);
console.log('-'.repeat(80));

// Build the full RPC request
const rpcRequest = {
    jsonrpc: '2.0',
    method: 'send',
    params: {
        sender_did: cred.did,
        receiver_did: TARGET_DID,
        content: content,
        type: msgType
    },
    id: 1
};

console.log('\nFull RPC Request:');
console.log(JSON.stringify(rpcRequest, null, 2));

console.log('\n[Key Fields Analysis]');
console.log('-'.repeat(80));
console.log(`session_id: ${content.session_id}`);
console.log(`hpke_suite: ${content.hpke_suite}`);
console.log(`enc length: ${content.enc?.length || 0} chars (base64)`);
console.log(`encrypted_seed length: ${content.encrypted_seed?.length || 0} chars (base64)`);
console.log(`proof.proof_value length: ${content.proof?.proof_value?.length || 0} chars (base64url)`);

// Decode and show raw bytes
import { Buffer } from 'buffer';

const encBytes = Buffer.from(content.enc, 'base64');
const encryptedSeedBytes = Buffer.from(content.encrypted_seed, 'base64');
const proofValueBytes = Buffer.from(content.proof.proof_value, 'base64url');

console.log('\n[Raw Byte Lengths]');
console.log(`enc (X25519 ephemeral public key): ${encBytes.length} bytes`);
console.log(`encrypted_seed (HPKE ciphertext): ${encryptedSeedBytes.length} bytes`);
console.log(`proof_value (R||S signature): ${proofValueBytes.length} bytes`);

console.log('\n' + '='.repeat(80));
