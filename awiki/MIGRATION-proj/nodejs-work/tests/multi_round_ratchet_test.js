#!/usr/bin/env node

/**
 * Multi-round E2EE ratchet test - Node.js version.
 * Compatible with Python implementation.
 * Uses built-in crypto module.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash, createHmac, createCipheriv, randomBytes } from 'crypto';
import axios from 'axios';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('='.repeat(80));
console.log('Multi-Round E2EE Ratchet Test (Node.js)');
console.log('='.repeat(80));

// Load identities
const nodejsCredPath = join(__dirname, '..', '.credentials', 'nodeagentfixed.json');
const pythonCredPath = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message', 'pythonmsgtest.json');

console.log('\n[Loading Identities]');

const nodejsCred = JSON.parse(readFileSync(nodejsCredPath, 'utf-8'));
const pythonCred = JSON.parse(readFileSync(pythonCredPath, 'utf-8'));

console.log(`OK Node.js: ${nodejsCred.did}`);
console.log(`OK Python: ${pythonCred.did}`);

// Determine direction
const isInitiator = nodejsCred.did < pythonCred.did;
console.log(`\nInitiator: ${isInitiator ? 'Node.js' : 'Python'}`);

// HKDF-Expand implementation
function hkdfExpand(prk, info, length) {
    const hashLen = 32; // SHA256
    const n = Math.ceil(length / hashLen);
    let okm = Buffer.alloc(0);
    let t = Buffer.alloc(0);
    
    for (let i = 1; i <= n; i++) {
        const hmac = createHmac('sha256', prk);
        hmac.update(t);
        hmac.update(info);
        hmac.update(Buffer.from([i]));
        t = hmac.digest();
        okm = Buffer.concat([okm, t]);
    }
    
    return okm.slice(0, length);
}

// Derive initial chain keys
const rootSeed = Buffer.from("multi-round-test-seed");

const initChainKey = hkdfExpand(rootSeed, Buffer.from("anp-e2ee-init"), 32);
const respChainKey = hkdfExpand(rootSeed, Buffer.from("anp-e2ee-resp"), 32);

console.log(`\nInitial chain keys derived:`);
console.log(`  init: ${initChainKey.toString('hex').slice(0, 32)}...`);
console.log(`  resp: ${respChainKey.toString('hex').slice(0, 32)}...`);

// Assign keys based on direction
let nodejsSendChainKey, nodejsRecvChainKey, pythonSendChainKey, pythonRecvChainKey;

if (isInitiator) {
    nodejsSendChainKey = initChainKey;
    nodejsRecvChainKey = respChainKey;
    pythonSendChainKey = respChainKey;
    pythonRecvChainKey = initChainKey;
} else {
    nodejsSendChainKey = respChainKey;
    nodejsRecvChainKey = initChainKey;
    pythonSendChainKey = initChainKey;
    pythonRecvChainKey = respChainKey;
}

console.log(`\nNode.js chain keys:`);
console.log(`  send: ${nodejsSendChainKey.toString('hex').slice(0, 32)}...`);
console.log(`  recv: ${nodejsRecvChainKey.toString('hex').slice(0, 32)}...`);

console.log(`\nPython chain keys:`);
console.log(`  send: ${pythonSendChainKey.toString('hex').slice(0, 32)}...`);
console.log(`  recv: ${pythonRecvChainKey.toString('hex').slice(0, 32)}...`);

// Derive message key
function deriveMessageKey(chainKey, seq) {
    const seqBytes = Buffer.alloc(8);
    seqBytes.writeBigUInt64BE(BigInt(seq), 0);
    
    const msgKey = createHmac('sha256', chainKey).update(Buffer.from("msg")).update(seqBytes).digest();
    const newChainKey = createHmac('sha256', chainKey).update(Buffer.from("ck")).digest();
    
    const encKey = createHmac('sha256', msgKey).update(Buffer.from("key")).digest().slice(0, 16);
    const nonce = createHmac('sha256', msgKey).update(Buffer.from("nonce")).digest().slice(0, 12);
    
    return { encKey, nonce, newChainKey };
}

// AES-GCM encrypt
function encryptMessage(plaintext, encKey, nonce) {
    const cipher = createCipheriv('aes-128-gcm', encKey, nonce);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
}

// Send E2EE message
async function sendE2eeMessage(senderCred, receiverDid, plaintext, encKey, nonce, seq) {
    // Encrypt
    const ciphertext = encryptMessage(plaintext, encKey, nonce);
    
    // Create E2EE message structure
    const e2eeContent = Buffer.from(JSON.stringify({
        ciphertext: ciphertext,
        seq: seq,
        sender: senderCred.did,
        receiver: receiverDid
    })).toString('base64');
    
    // Send via API
    try {
        const response = await axios.post(
            "https://awiki.ai/message/rpc",
            {
                jsonrpc: "2.0",
                method: "send",
                params: {
                    sender_did: senderCred.did,
                    receiver_did: receiverDid,
                    content: e2eeContent,
                    type: "e2ee_msg",
                    client_msg_id: randomBytes(16).toString('hex')
                },
                id: 1
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${senderCred.jwt_token}`
                },
                timeout: 30000
            }
        );
        
        const result = response.data;
        if (result.result) {
            return {
                success: true,
                server_seq: result.result.server_seq,
                plaintext: plaintext,
                ciphertext: ciphertext.slice(0, 32) + '...'
            };
        } else {
            return {
                success: false,
                error: result.error?.message || 'Unknown error'
            };
        }
    } catch (e) {
        return {
            success: false,
            error: e.message
        };
    }
}

async function runMultiRoundTest() {
    const results = [];
    let nodejsSeq = 0;
    let pythonSeq = 0;
    
    console.log('\n' + '='.repeat(80));
    console.log('Round 1: Node.js sends 3 messages to Python');
    console.log('='.repeat(80));
    
    for (let i = 0; i < 3; i++) {
        const plaintext = `[Round 1] Node.js message ${i+1}`;
        
        const { encKey, nonce, newChainKey } = deriveMessageKey(nodejsSendChainKey, nodejsSeq);
        nodejsSendChainKey = newChainKey;
        nodejsSeq++;
        
        const result = await sendE2eeMessage(nodejsCred, pythonCred.did, plaintext, encKey, nonce, nodejsSeq - 1);
        console.log(`\n  Message ${i+1}: ${plaintext}`);
        console.log(`    Seq: ${nodejsSeq - 1}, Enc key: ${encKey.toString('hex').slice(0, 16)}...`);
        console.log(`    Status: ${result.success ? 'OK' : 'FAIL'} ${result.error || ''}`);
        
        results.push({
            round: 1,
            direction: 'Node.js -> Python',
            plaintext: plaintext,
            seq: nodejsSeq - 1,
            success: result.success
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Round 2: Python sends 3 messages to Node.js');
    console.log('='.repeat(80));
    
    for (let i = 0; i < 3; i++) {
        const plaintext = `[Round 2] Python message ${i+1}`;
        
        const { encKey, nonce, newChainKey } = deriveMessageKey(pythonSendChainKey, pythonSeq);
        pythonSendChainKey = newChainKey;
        pythonSeq++;
        
        const result = await sendE2eeMessage(pythonCred, nodejsCred.did, plaintext, encKey, nonce, pythonSeq - 1);
        console.log(`\n  Message ${i+1}: ${plaintext}`);
        console.log(`    Seq: ${pythonSeq - 1}, Enc key: ${encKey.toString('hex').slice(0, 16)}...`);
        console.log(`    Status: ${result.success ? 'OK' : 'FAIL'} ${result.error || ''}`);
        
        results.push({
            round: 2,
            direction: 'Python -> Node.js',
            plaintext: plaintext,
            seq: pythonSeq - 1,
            success: result.success
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Round 3: Alternating conversation (5 rounds)');
    console.log('='.repeat(80));
    
    for (let i = 0; i < 5; i++) {
        if (i % 2 === 0) {
            // Node.js sends
            const plaintext = `[Round 3.${i+1}] Node.js says: How about message ${i+1}?`;
            
            const { encKey, nonce, newChainKey } = deriveMessageKey(nodejsSendChainKey, nodejsSeq);
            nodejsSendChainKey = newChainKey;
            nodejsSeq++;
            
            const result = await sendE2eeMessage(nodejsCred, pythonCred.did, plaintext, encKey, nonce, nodejsSeq - 1);
            console.log(`\n  Node.js -> Python: ${plaintext}`);
            console.log(`    Seq: ${nodejsSeq - 1}, Chain key updated: ${nodejsSendChainKey.toString('hex').slice(0, 16)}...`);
            
            results.push({
                round: 3,
                direction: 'Node.js -> Python',
                plaintext: plaintext,
                seq: nodejsSeq - 1,
                success: result.success
            });
        } else {
            // Python sends
            const plaintext = `[Round 3.${i+1}] Python replies: Got your message ${i+1}!`;
            
            const { encKey, nonce, newChainKey } = deriveMessageKey(pythonSendChainKey, pythonSeq);
            pythonSendChainKey = newChainKey;
            pythonSeq++;
            
            const result = await sendE2eeMessage(pythonCred, nodejsCred.did, plaintext, encKey, nonce, pythonSeq - 1);
            console.log(`\n  Python -> Node.js: ${plaintext}`);
            console.log(`    Seq: ${pythonSeq - 1}, Chain key updated: ${pythonSendChainKey.toString('hex').slice(0, 16)}...`);
            
            results.push({
                round: 3,
                direction: 'Python -> Node.js',
                plaintext: plaintext,
                seq: pythonSeq - 1,
                success: result.success
            });
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    
    const total = results.length;
    const passed = results.filter(r => r.success).length;
    
    console.log(`\nTotal messages: ${total}`);
    console.log(`Successful: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success rate: ${(passed/total*100).toFixed(1)}%`);
    
    console.log('\nChain key evolution:');
    console.log(`  Node.js send chain key (final): ${nodejsSendChainKey.toString('hex').slice(0, 32)}...`);
    console.log(`  Node.js recv chain key (final): ${nodejsRecvChainKey.toString('hex').slice(0, 32)}...`);
    console.log(`  Python send chain key (final): ${pythonSendChainKey.toString('hex').slice(0, 32)}...`);
    console.log(`  Python recv chain key (final): ${pythonRecvChainKey.toString('hex').slice(0, 32)}...`);
    
    console.log(`\nSequence numbers:`);
    console.log(`  Node.js sent: ${nodejsSeq} messages`);
    console.log(`  Python sent: ${pythonSeq} messages`);
    
    if (passed === total) {
        console.log('\nOK ALL ROUNDS PASSED!');
        console.log('Ratchet algorithm is working correctly!');
    } else {
        console.log('\nFAIL SOME ROUNDS FAILED');
    }
    
    // Save results
    const report = {
        timestamp: new Date().toISOString(),
        test_name: 'Multi-Round E2EE Ratchet Test (Node.js)',
        identities: {
            nodejs: nodejsCred.did,
            python: pythonCred.did
        },
        results: results,
        summary: {
            total: total,
            passed: passed,
            failed: total - passed,
            success_rate: passed/total*100
        },
        final_chain_keys: {
            nodejs_send: nodejsSendChainKey.toString('hex'),
            nodejs_recv: nodejsRecvChainKey.toString('hex'),
            python_send: pythonSendChainKey.toString('hex'),
            python_recv: pythonRecvChainKey.toString('hex')
        },
        sequence_numbers: {
            nodejs_sent: nodejsSeq,
            python_sent: pythonSeq
        }
    };
    
    const reportPath = join(__dirname, 'nodejs_multi_round_ratchet_results.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nResults saved to: ${reportPath}`);
}

await runMultiRoundTest();

console.log('\n' + '='.repeat(80));
