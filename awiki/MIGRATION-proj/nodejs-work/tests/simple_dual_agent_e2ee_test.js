#!/usr/bin/env node

/**
 * Simple Dual-Agent E2EE Test
 * 
 * Alice (Python identity) <-> Bob (Node.js identity)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { E2eeClient } from '../src/e2ee.js';
import { saveE2eeState } from '../src/e2ee_store.js';
import { DIDWbaAuthHeader } from '../src/utils/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Hardcoded paths for testing
const ALICE_CRED_PATH = 'C:\\Users\\hyg\\.openclaw\\credentials\\awiki-agent-id-message\\pythontest1.json';
const BOB_CRED_PATH = join(__dirname, '..', '.credentials', 'nodetest1.json');

console.log('='.repeat(60));
console.log('Simple Dual-Agent E2EE Test');
console.log('='.repeat(60));

/**
 * Parse PEM to raw private key bytes
 */
function parsePemToBytes(pem) {
    const normalizedPem = pem.replace(/\\n/g, '\n');
    const pemLines = normalizedPem.split('\n').filter(l => !l.startsWith('-----') && l.trim());
    const der = Buffer.from(pemLines.join(''), 'base64');
    
    let privOffset = -1;
    for (let i = 0; i < der.length - 2; i++) {
        if (der[i] === 0x04 && der[i + 1] === 0x20) {
            privOffset = i + 2;
            break;
        }
    }
    
    return privOffset >= 0 ? der.slice(privOffset, privOffset + 32) : der.slice(-32);
}

/**
 * Get auth header
 */
function getAuthHeader(cred) {
    const auth = new DIDWbaAuthHeader(null, null);
    const privateKeyBytes = parsePemToBytes(cred.private_key_pem);
    auth.setCredentials(cred.did_document, privateKeyBytes);
    return auth.getAuthHeader('https://awiki.ai');
}

async function runTest() {
    try {
        // Load credentials
        console.log('\n[1] Loading credentials...');
        const aliceCred = JSON.parse(readFileSync(ALICE_CRED_PATH, 'utf-8'));
        const bobCred = JSON.parse(readFileSync(BOB_CRED_PATH, 'utf-8'));
        
        console.log(`  ✓ Alice: ${aliceCred.did}`);
        console.log(`  ✓ Bob: ${bobCred.did}`);
        
        // Initialize E2EE clients
        console.log('\n[2] Initializing E2EE clients...');
        const aliceE2ee = new E2eeClient(
            aliceCred.did,
            aliceCred.e2ee_signing_private_pem,
            aliceCred.e2ee_agreement_private_pem
        );
        const bobE2ee = new E2eeClient(
            bobCred.did,
            bobCred.e2ee_signing_private_pem,
            bobCred.e2ee_agreement_private_pem
        );
        console.log('  ✓ Both E2EE clients initialized');
        
        // Alice initiates handshake
        console.log('\n[3] Alice initiates handshake...');
        const { msg_type: initType, content: initContent } = await aliceE2ee.initiateHandshake(bobCred.did);
        console.log(`  ✓ Session ID: ${initContent.session_id}`);
        
        // Send handshake
        console.log('\n[4] Sending handshake to Bob...');
        const aliceHeaders = getAuthHeader(aliceCred);
        const handshakeResp = await axios.post(
            'https://awiki.ai/message/rpc',
            {
                jsonrpc: '2.0',
                method: 'send',
                params: {
                    sender_did: aliceCred.did,
                    receiver_did: bobCred.did,
                    content: JSON.stringify(initContent),
                    type: initType
                },
                id: 1
            },
            { headers: aliceHeaders }
        );
        
        if (handshakeResp.data.result) {
            console.log(`  ✓ Handshake sent (Server Seq: ${handshakeResp.data.result.server_seq})`);
        } else {
            throw new Error(`Handshake send failed: ${handshakeResp.data.error?.message}`);
        }
        
        // Wait for delivery
        console.log('\n[5] Waiting for delivery...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Bob receives and processes handshake
        console.log('\n[6] Bob checking inbox...');
        const bobHeaders = getAuthHeader(bobCred);
        const bobInboxResp = await axios.post(
            'https://awiki.ai/message/rpc',
            {
                jsonrpc: '2.0',
                method: 'get_inbox',
                params: {
                    user_did: bobCred.did,
                    limit: 10
                },
                id: 1
            },
            { headers: bobHeaders }
        );
        
        const messages = bobInboxResp.data.result?.messages || [];
        const e2eeInitMsg = messages.find(msg => msg.type === 'e2ee_init' && msg.sender_did === aliceCred.did);
        
        if (!e2eeInitMsg) {
            throw new Error('No e2ee_init message found in Bob inbox');
        }
        
        console.log(`  ✓ Found e2ee_init from Alice`);
        
        // Bob processes handshake
        console.log('\n[7] Bob processing handshake...');
        const initContent2 = typeof e2eeInitMsg.content === 'string' ? JSON.parse(e2eeInitMsg.content) : e2eeInitMsg.content;
        const { msg_type: ackType, content: ackContent } = await bobE2ee.processHandshake(initContent2);
        console.log(`  ✓ Session established: ${ackContent.session_id}`);
        
        // Bob sends ACK
        console.log('\n[8] Bob sending ACK...');
        const ackResp = await axios.post(
            'https://awiki.ai/message/rpc',
            {
                jsonrpc: '2.0',
                method: 'send',
                params: {
                    sender_did: bobCred.did,
                    receiver_did: aliceCred.did,
                    content: JSON.stringify(ackContent),
                    type: ackType
                },
                id: 1
            },
            { headers: bobHeaders }
        );
        
        if (ackResp.data.result) {
            console.log(`  ✓ ACK sent (Server Seq: ${ackResp.data.result.server_seq})`);
        }
        
        // Wait for delivery
        console.log('\n[9] Waiting for delivery...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Alice sends encrypted message
        console.log('\n[10] Alice sending encrypted message...');
        const secretMessage = `Top secret from Alice to Bob @ ${new Date().toISOString()}`;
        const { msg_type: msgType, content: msgContent } = await aliceE2ee.encryptMessage(bobCred.did, secretMessage, 'text');
        
        const msgResp = await axios.post(
            'https://awiki.ai/message/rpc',
            {
                jsonrpc: '2.0',
                method: 'send',
                params: {
                    sender_did: aliceCred.did,
                    receiver_did: bobCred.did,
                    content: JSON.stringify(msgContent),
                    type: msgType
                },
                id: 1
            },
            { headers: aliceHeaders }
        );
        
        if (msgResp.data.result) {
            console.log(`  ✓ Encrypted message sent (Server Seq: ${msgResp.data.result.server_seq})`);
        } else {
            throw new Error(`Encrypted message send failed: ${msgResp.data.error?.message}`);
        }
        
        // Wait for delivery
        console.log('\n[11] Waiting for delivery...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Bob receives and decrypts
        console.log('\n[12] Bob checking inbox for encrypted message...');
        const bobInboxResp2 = await axios.post(
            'https://awiki.ai/message/rpc',
            {
                jsonrpc: '2.0',
                method: 'get_inbox',
                params: {
                    user_did: bobCred.did,
                    limit: 10
                },
                id: 1
            },
            { headers: bobHeaders }
        );
        
        const messages2 = bobInboxResp2.data.result?.messages || [];
        const e2eeMsg = messages2.find(msg => msg.type === 'e2ee_msg' && msg.sender_did === aliceCred.did);
        
        if (!e2eeMsg) {
            throw new Error('No e2ee_msg found in Bob inbox');
        }
        
        console.log(`  ✓ Found e2ee_msg from Alice`);
        
        // Bob decrypts
        console.log('\n[13] Bob decrypting message...');
        const e2eeContent = typeof e2eeMsg.content === 'string' ? JSON.parse(e2eeMsg.content) : e2eeMsg.content;
        const { plaintext, original_type } = await bobE2ee.decryptMessage(e2eeContent);
        
        if (plaintext === secretMessage) {
            console.log(`  ✓ Decrypted successfully!`);
            console.log(`  ✓ Message matches: ${plaintext.substring(0, 50)}...`);
        } else {
            throw new Error(`Message mismatch! Expected: ${secretMessage}, Got: ${plaintext}`);
        }
        
        // Save E2EE states
        saveE2eeState(aliceE2ee.exportState(), 'pythontest1');
        saveE2eeState(bobE2ee.exportState(), 'nodetest1');
        
        console.log('\n' + '='.repeat(60));
        console.log('✓ ALL TESTS PASSED!');
        console.log('✓ Dual-Agent E2EE communication working!');
        console.log('='.repeat(60));
        
        process.exit(0);
    } catch (error) {
        console.log('\n' + '='.repeat(60));
        console.log(`✗ TEST FAILED: ${error.message}`);
        console.log('='.repeat(60));
        console.log(error.stack);
        process.exit(1);
    }
}

await runTest();
