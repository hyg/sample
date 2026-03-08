#!/usr/bin/env node

/**
 * Dual-Agent E2EE Test - Alice and Bob
 * 
 * Simulates two agents communicating with E2EE encryption.
 * Both agents run simultaneously and test:
 * 1. Handshake initiation and processing
 * 2. Encrypted message sending and receiving
 * 3. Message decryption
 * 4. Multi-round conversation
 */

import { loadIdentity, updateJwt } from '../src/credential_store.js';
import { createSDKConfig } from '../src/utils/config.js';
import { createMoltMessageClient } from '../src/utils/client.js';
import { authenticatedRpcCall } from '../src/utils/rpc.js';
import { E2eeClient } from '../src/e2ee.js';
import { saveE2eeState, loadE2eeState } from '../src/e2ee_store.js';
import { DIDWbaAuthHeader } from '../src/utils/auth.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_CRED_DIR = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message');
const NODEJS_CRED_DIR = join(__dirname, '..', '.credentials');

console.log(`Python cred dir: ${PYTHON_CRED_DIR}`);
console.log(`Node.js cred dir: ${NODEJS_CRED_DIR}`);

const TEST_CONFIG = {
    alice: {
        credential: 'pythontest1',  // Python identity as Alice
        role: 'initiator',
        credDir: PYTHON_CRED_DIR
    },
    bob: {
        credential: 'nodetest1',    // Node.js identity as Bob
        role: 'receiver',
        credDir: NODEJS_CRED_DIR
    }
};

const TEST_RESULTS = {
    passed: 0,
    failed: 0,
    details: []
};

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
 * Agent class representing a test participant
 */
class E2eeAgent {
    constructor(name, credentialName, role) {
        this.name = name;
        this.credentialName = credentialName;
        this.role = role;
        this.config = createSDKConfig();
        this.client = createMoltMessageClient(this.config);
        this.e2eeClient = null;
        this.cred = null;
        this.auth = null;
        this.sessionId = null;
        this.receivedMessages = [];
    }
    
    async initialize() {
        console.log(`\n[${this.name}] Initializing...`);
        
        // Load credential from appropriate directory
        const credPath = join(this.credDir, `${this.credentialName}.json`);
        this.cred = JSON.parse(readFileSync(credPath, 'utf-8'));
        
        if (!this.cred) {
            throw new Error(`Credential '${this.credentialName}' not found at ${credPath}`);
        }
        
        console.log(`  ✓ DID: ${this.cred.did}`);
        console.log(`  ✓ JWT: ${this.cred.jwt_token ? 'Present' : 'Missing'}`);
        console.log(`  ✓ E2EE keys: ${this.cred.e2ee_signing_private_pem ? 'Present' : 'Missing'}`);
        
        // Initialize auth
        this.auth = new DIDWbaAuthHeader(null, null);
        const privateKeyBytes = parsePemToBytes(this.cred.private_key_pem);
        this.auth.setCredentials(this.cred.did_document, privateKeyBytes);
        
        // Initialize E2EE client
        this.e2eeClient = new E2eeClient(
            this.cred.did,
            this.cred.e2ee_signing_private_pem,
            this.cred.e2ee_agreement_private_pem
        );
        
        console.log(`  ✓ ${this.name} initialized`);
    }
    
    async sendMessage(toDid, content) {
        const payload = {
            jsonrpc: '2.0',
            method: 'send',
            params: {
                sender_did: this.cred.did,
                receiver_did: toDid,
                content: content,
                type: 'text',
                client_msg_id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
            },
            id: 1
        };
        
        const authHeaders = this.auth.getAuthHeader(this.config.user_service_url);
        
        const response = await this.client.post('/message/rpc', payload, {
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            }
        });
        
        return response.data;
    }
    
    async sendE2eeMessage(toDid, plaintext) {
        if (!this.e2eeClient) {
            throw new Error('E2EE client not initialized');
        }
        
        // Encrypt message
        const { msg_type, content } = await this.e2eeClient.encryptMessage(toDid, plaintext, 'text');
        
        const payload = {
            jsonrpc: '2.0',
            method: 'send',
            params: {
                sender_did: this.cred.did,
                receiver_did: toDid,
                content: JSON.stringify(content),
                type: msg_type,
                client_msg_id: `e2ee_${Date.now()}`
            },
            id: 1
        };
        
        const authHeaders = this.auth.getAuthHeader(this.config.user_service_url);
        
        const response = await this.client.post('/message/rpc', payload, {
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            }
        });
        
        return response.data;
    }
    
    async getInbox(limit = 10) {
        const payload = {
            jsonrpc: '2.0',
            method: 'get_inbox',
            params: {
                user_did: this.cred.did,
                limit: limit
            },
            id: 1
        };
        
        const authHeaders = this.auth.getAuthHeader(this.config.user_service_url);
        
        const response = await this.client.post('/message/rpc', payload, {
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            }
        });
        
        return response.data.result;
    }
    
    async initiateHandshake(peerDid) {
        console.log(`\n[${this.name}] Initiating E2EE handshake with ${peerDid}...`);
        
        const { msg_type, content } = await this.e2eeClient.initiateHandshake(peerDid);
        this.sessionId = content.session_id;
        
        console.log(`  ✓ Session ID: ${this.sessionId}`);
        console.log(`  ✓ Sending ${msg_type}...`);
        
        const result = await this.sendMessage(peerDid, JSON.stringify(content));
        
        if (result.result) {
            console.log(`  ✓ Handshake sent (Server Seq: ${result.result.server_seq})`);
            return { success: true, sessionId: this.sessionId, msgType: msg_type, content: content };
        } else {
            console.log(`  ✗ Handshake failed: ${result.error?.message}`);
            return { success: false, error: result.error?.message };
        }
    }
    
    async processInbox(peerDid) {
        console.log(`\n[${this.name}] Checking inbox for messages from ${peerDid}...`);
        
        const inbox = await this.getInbox(20);
        const messages = inbox.messages || [];
        
        // Filter messages from peer
        const peerMessages = messages.filter(msg => msg.sender_did === peerDid);
        
        console.log(`  ✓ Found ${peerMessages.length} message(s) from ${peerDid}`);
        
        const e2eeMessages = [];
        const plainMessages = [];
        
        for (const msg of peerMessages) {
            if (msg.type === 'e2ee_init' || msg.type === 'e2ee_msg' || msg.type === 'e2ee_ack') {
                e2eeMessages.push(msg);
            } else {
                plainMessages.push(msg);
            }
        }
        
        return {
            total: peerMessages.length,
            e2ee: e2eeMessages,
            plain: plainMessages,
            all: peerMessages
        };
    }
    
    async processE2eeInit(msg) {
        console.log(`\n[${this.name}] Processing E2EE init...`);
        
        try {
            const initContent = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
            
            const { msg_type, content } = await this.e2eeClient.processHandshake(initContent);
            this.sessionId = content.session_id;
            
            console.log(`  ✓ Session established: ${this.sessionId}`);
            console.log(`  ✓ Sending ${msg_type}...`);
            
            const result = await this.sendMessage(msg.sender_did, JSON.stringify(content));
            
            if (result.result) {
                console.log(`  ✓ ACK sent (Server Seq: ${result.result.server_seq})`);
                return { success: true, sessionId: this.sessionId };
            } else {
                console.log(`  ✗ ACK failed: ${result.error?.message}`);
                return { success: false, error: result.error?.message };
            }
        } catch (error) {
            console.log(`  ✗ Process failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
    
    async decryptMessage(msg) {
        try {
            const e2eeContent = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
            const { plaintext, original_type } = await this.e2eeClient.decryptMessage(e2eeContent);
            
            console.log(`  ✓ Decrypted [${original_type}]: ${plaintext}`);
            return { success: true, plaintext, original_type };
        } catch (error) {
            console.log(`  ✗ Decryption failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
    
    close() {
        // Axios client doesn't have close method
        // Just clear references
        this.client = null;
        this.e2eeClient = null;
        this.auth = null;
    }
}

/**
 * Test 1: Basic E2EE handshake and message
 */
async function testBasicE2ee() {
    console.log('\n' + '='.repeat(60));
    console.log('Test 1: Basic E2EE Handshake and Message');
    console.log('='.repeat(60));
    
    const alice = new E2eeAgent('Alice', TEST_CONFIG.alice.credential, TEST_CONFIG.alice.role);
    const bob = new E2eeAgent('Bob', TEST_CONFIG.bob.credential, TEST_CONFIG.bob.role);
    
    try {
        // Initialize both agents
        await alice.initialize();
        await bob.initialize();
        
        // Step 1: Alice initiates handshake
        console.log('\n--- Step 1: Alice initiates handshake ---');
        const handshakeResult = await alice.initiateHandshake(bob.cred.did);
        
        if (!handshakeResult.success) {
            throw new Error(`Handshake initiation failed: ${handshakeResult.error}`);
        }
        
        TEST_RESULTS.passed++;
        TEST_RESULTS.details.push({ test: 'Handshake initiation', success: true });
        
        // Wait for delivery
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 2: Bob processes handshake
        console.log('\n--- Step 2: Bob processes handshake ---');
        const bobInbox = await bob.processInbox(alice.cred.did);
        
        const e2eeInitMsg = bobInbox.e2ee.find(msg => msg.type === 'e2ee_init');
        if (!e2eeInitMsg) {
            throw new Error('No e2ee_init message found in Bob inbox');
        }
        
        const ackResult = await bob.processE2eeInit(e2eeInitMsg);
        
        if (!ackResult.success) {
            throw new Error(`Handshake processing failed: ${ackResult.error}`);
        }
        
        TEST_RESULTS.passed++;
        TEST_RESULTS.details.push({ test: 'Handshake processing', success: true });
        
        // Wait for delivery
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 3: Alice sends encrypted message
        console.log('\n--- Step 3: Alice sends encrypted message ---');
        const secretMessage = `Top secret from Alice to Bob @ ${new Date().toISOString()}`;
        const encryptResult = await alice.sendE2eeMessage(bob.cred.did, secretMessage);
        
        if (encryptResult.result) {
            console.log(`  ✓ Encrypted message sent (Server Seq: ${encryptResult.result.server_seq})`);
            TEST_RESULTS.passed++;
            TEST_RESULTS.details.push({ test: 'E2EE message send', success: true });
        } else {
            throw new Error(`Encrypted message send failed: ${encryptResult.error?.message}`);
        }
        
        // Wait for delivery
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 4: Bob receives and decrypts message
        console.log('\n--- Step 4: Bob receives and decrypts message ---');
        const bobInbox2 = await bob.processInbox(alice.cred.did);
        
        const e2eeMsg = bobInbox2.e2ee.find(msg => msg.type === 'e2ee_msg');
        if (!e2eeMsg) {
            throw new Error('No e2ee_msg found in Bob inbox');
        }
        
        const decryptResult = await bob.decryptMessage(e2eeMsg);
        
        if (!decryptResult.success) {
            throw new Error(`Decryption failed: ${decryptResult.error}`);
        }
        
        if (decryptResult.plaintext === secretMessage) {
            console.log('  ✓ Message content matches!');
            TEST_RESULTS.passed++;
            TEST_RESULTS.details.push({ test: 'E2EE message decrypt', success: true });
        } else {
            throw new Error(`Message content mismatch! Expected: ${secretMessage}, Got: ${decryptResult.plaintext}`);
        }
        
        // Save E2EE states
        saveE2eeState(alice.e2eeClient.exportState(), TEST_CONFIG.alice.credential);
        saveE2eeState(bob.e2eeClient.exportState(), TEST_CONFIG.bob.credential);
        
        console.log('\n✓ Test 1 PASSED - Complete E2EE flow working!');
        
        alice.close();
        bob.close();
        
        return true;
    } catch (error) {
        console.log(`\n✗ Test 1 FAILED: ${error.message}`);
        TEST_RESULTS.failed++;
        TEST_RESULTS.details.push({ test: 'Basic E2EE flow', success: false, error: error.message });
        
        alice.close();
        bob.close();
        
        return false;
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('='.repeat(60));
    console.log('Dual-Agent E2EE Test Suite');
    console.log('='.repeat(60));
    console.log(`Alice: ${TEST_CONFIG.alice.credential} (${TEST_CONFIG.alice.role})`);
    console.log(`Bob:   ${TEST_CONFIG.bob.credential} (${TEST_CONFIG.bob.role})`);
    console.log('='.repeat(60));
    
    // Run Test 1
    await testBasicE2ee();
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log(`Passed: ${TEST_RESULTS.passed}`);
    console.log(`Failed: ${TEST_RESULTS.failed}`);
    console.log('='.repeat(60));
    
    const total = TEST_RESULTS.passed + TEST_RESULTS.failed;
    const passRate = total > 0 ? ((TEST_RESULTS.passed / total) * 100).toFixed(1) : 0;
    console.log(`Pass Rate: ${passRate}%`);
    
    if (TEST_RESULTS.failed === 0 && TEST_RESULTS.passed >= 4) {
        console.log('\n✓ ALL E2EE TESTS PASSED!');
        console.log('Dual-agent E2EE communication is working correctly!');
        process.exit(0);
    } else {
        console.log('\n✗ SOME E2EE TESTS FAILED');
        process.exit(1);
    }
}

// Run tests
await runTests();
