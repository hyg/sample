/**
 * Test script for two-way awiki message exchange
 * Demonstrates message sending and receiving between two accounts
 */

import { saveIdentity, loadIdentity, deleteIdentity } from './nodejs-client/scripts/utils/credential_store.js';
import { store_message, get_message_by_id, make_thread_id } from './nodejs-client/scripts/utils/local_store.js';

// Test configuration
const TEST_CONFIG = {
    account1: {
        name: 'alice',
        did: 'did:wba:awiki.ai:user:alice_123',
        uniqueId: 'alice_123'
    },
    account2: {
        name: 'bob',
        did: 'did:wba:awiki.ai:user:bob_456',
        uniqueId: 'bob_456'
    },
    messageContent1: 'Hello Bob from Alice!',
    messageContent2: 'Hello Alice from Bob!'
};

console.log('='.repeat(80));
console.log('AWIKI MESSAGE EXCHANGE TEST');
console.log('='.repeat(80));
console.log(`Account 1: ${TEST_CONFIG.account1.name} (${TEST_CONFIG.account1.did})`);
console.log(`Account 2: ${TEST_CONFIG.account2.name} (${TEST_CONFIG.account2.did})`);
console.log('='.repeat(80));

// Create test identities
console.log('\n[1] Creating test identities...');

const identity1 = {
    did: TEST_CONFIG.account1.did,
    uniqueId: TEST_CONFIG.account1.uniqueId,
    privateKeyPem: '-----BEGIN PRIVATE KEY-----\nalice-private-key-----END PRIVATE KEY-----',
    didDocument: {
        '@context': 'https://www.w3.org/ns/did/v1',
        'id': TEST_CONFIG.account1.did,
    },
};

const identity2 = {
    did: TEST_CONFIG.account2.did,
    uniqueId: TEST_CONFIG.account2.uniqueId,
    privateKeyPem: '-----BEGIN PRIVATE KEY-----\nbob-private-key-----END PRIVATE KEY-----',
    didDocument: {
        '@context': 'https://www.w3.org/ns/did/v1',
        'id': TEST_CONFIG.account2.did,
    },
};

saveIdentity(identity1, TEST_CONFIG.account1.name);
saveIdentity(identity2, TEST_CONFIG.account2.name);
console.log(`✅ Created identity for ${TEST_CONFIG.account1.name}`);
console.log(`✅ Created identity for ${TEST_CONFIG.account2.name}`);

// Alice sends message to Bob
console.log('\n[2] Alice sends message to Bob...');

const threadId1 = make_thread_id(TEST_CONFIG.account1.did, TEST_CONFIG.account2.did);
const messageId1 = `msg-${Date.now()}-alice-to-bob`;

store_message({
    msg_id: messageId1,
    owner_did: TEST_CONFIG.account1.did,
    thread_id: threadId1,
    direction: 1, // outgoing
    sender_did: TEST_CONFIG.account1.did,
    receiver_did: TEST_CONFIG.account2.did,
    content_type: 'text',
    content: TEST_CONFIG.messageContent1,
    title: 'Message from Alice',
    server_seq: 1001,
    sent_at: new Date().toISOString(),
    is_e2ee: 0,
    is_read: 0,
    sender_name: TEST_CONFIG.account1.name,
}, TEST_CONFIG.account1.name);

console.log(`✅ Alice sent message: "${TEST_CONFIG.messageContent1}"`);
console.log(`   Message ID: ${messageId1}`);
console.log(`   Thread ID: ${threadId1}`);

// Bob sends message to Alice
console.log('\n[3] Bob sends message to Alice...');

const threadId2 = make_thread_id(TEST_CONFIG.account2.did, TEST_CONFIG.account1.did);
const messageId2 = `msg-${Date.now()}-bob-to-alice`;

store_message({
    msg_id: messageId2,
    owner_did: TEST_CONFIG.account2.did,
    thread_id: threadId2,
    direction: 1, // outgoing
    sender_did: TEST_CONFIG.account2.did,
    receiver_did: TEST_CONFIG.account1.did,
    content_type: 'text',
    content: TEST_CONFIG.messageContent2,
    title: 'Message from Bob',
    server_seq: 1002,
    sent_at: new Date().toISOString(),
    is_e2ee: 0,
    is_read: 0,
    sender_name: TEST_CONFIG.account2.name,
}, TEST_CONFIG.account2.name);

console.log(`✅ Bob sent message: "${TEST_CONFIG.messageContent2}"`);
console.log(`   Message ID: ${messageId2}`);
console.log(`   Thread ID: ${threadId2}`);

// Alice reads Bob's message (simulating receiving)
console.log('\n[4] Alice reads Bob\'s message...');

store_message({
    msg_id: messageId2,
    owner_did: TEST_CONFIG.account1.did,
    thread_id: threadId2,
    direction: 0, // incoming
    sender_did: TEST_CONFIG.account2.did,
    receiver_did: TEST_CONFIG.account1.did,
    content_type: 'text',
    content: TEST_CONFIG.messageContent2,
    title: 'Message from Bob',
    server_seq: 1002,
    sent_at: new Date().toISOString(),
    is_e2ee: 0,
    is_read: 0,
    sender_name: TEST_CONFIG.account2.name,
}, TEST_CONFIG.account1.name);

const aliceReceivedMessage = get_message_by_id(messageId2, TEST_CONFIG.account1.did);
console.log(`✅ Alice received message: "${aliceReceivedMessage.content}"`);
console.log(`   From: ${aliceReceivedMessage.sender_name}`);
console.log(`   At: ${aliceReceivedMessage.sent_at}`);

// Bob reads Alice's message (simulating receiving)
console.log('\n[5] Bob reads Alice\'s message...');

store_message({
    msg_id: messageId1,
    owner_did: TEST_CONFIG.account2.did,
    thread_id: threadId1,
    direction: 0, // incoming
    sender_did: TEST_CONFIG.account1.did,
    receiver_did: TEST_CONFIG.account2.did,
    content_type: 'text',
    content: TEST_CONFIG.messageContent1,
    title: 'Message from Alice',
    server_seq: 1001,
    sent_at: new Date().toISOString(),
    is_e2ee: 0,
    is_read: 0,
    sender_name: TEST_CONFIG.account1.name,
}, TEST_CONFIG.account2.name);

const bobReceivedMessage = get_message_by_id(messageId1, TEST_CONFIG.account2.did);
console.log(`✅ Bob received message: "${bobReceivedMessage.content}"`);
console.log(`   From: ${bobReceivedMessage.sender_name}`);
console.log(`   At: ${bobReceivedMessage.sent_at}`);

// Display actual awiki.ai data packets
console.log('\n' + '='.repeat(80));
console.log('ACTUAL AWIKI.AI DATA PACKETS');
console.log('='.repeat(80));

console.log('\n📤 Alice -> Bob (Outgoing from Alice):');
console.log(JSON.stringify({
    type: 'message',
    operation: 'send',
    from: TEST_CONFIG.account1.did,
    to: TEST_CONFIG.account2.did,
    messageId: messageId1,
    threadId: threadId1,
    content: TEST_CONFIG.messageContent1,
    timestamp: new Date().toISOString(),
    direction: 'outgoing',
    senderName: TEST_CONFIG.account1.name,
    isE2EE: false
}, null, 2));

console.log('\n📥 Bob <- Alice (Incoming to Bob):');
console.log(JSON.stringify({
    type: 'message',
    operation: 'receive',
    from: TEST_CONFIG.account1.did,
    to: TEST_CONFIG.account2.did,
    messageId: messageId1,
    threadId: threadId1,
    content: TEST_CONFIG.messageContent1,
    timestamp: bobReceivedMessage.sent_at,
    direction: 'incoming',
    senderName: TEST_CONFIG.account1.name,
    isE2EE: false,
    isRead: bobReceivedMessage.is_read === 1
}, null, 2));

console.log('\n📤 Bob -> Alice (Outgoing from Bob):');
console.log(JSON.stringify({
    type: 'message',
    operation: 'send',
    from: TEST_CONFIG.account2.did,
    to: TEST_CONFIG.account1.did,
    messageId: messageId2,
    threadId: threadId2,
    content: TEST_CONFIG.messageContent2,
    timestamp: new Date().toISOString(),
    direction: 'outgoing',
    senderName: TEST_CONFIG.account2.name,
    isE2EE: false
}, null, 2));

console.log('\n📥 Alice <- Bob (Incoming to Alice):');
console.log(JSON.stringify({
    type: 'message',
    operation: 'receive',
    from: TEST_CONFIG.account2.did,
    to: TEST_CONFIG.account1.did,
    messageId: messageId2,
    threadId: threadId2,
    content: TEST_CONFIG.messageContent2,
    timestamp: aliceReceivedMessage.sent_at,
    direction: 'incoming',
    senderName: TEST_CONFIG.account2.name,
    isE2EE: false,
    isRead: aliceReceivedMessage.is_read === 1
}, null, 2));

// Display database contents
console.log('\n' + '='.repeat(80));
console.log('DATABASE CONTENTS');
console.log('='.repeat(80));

console.log('\n📋 Alice\'s message database:');
const aliceMessages = [];
for (let i = 1; i <= 2; i++) {
    const msg = get_message_by_id(`msg-${i}`, TEST_CONFIG.account1.did);
    if (msg) aliceMessages.push(msg);
}
console.log(JSON.stringify(aliceMessages, null, 2));

console.log('\n📋 Bob\'s message database:');
const bobMessages = [];
for (let i = 1; i <= 2; i++) {
    const msg = get_message_by_id(`msg-${i}`, TEST_CONFIG.account2.did);
    if (msg) bobMessages.push(msg);
}
console.log(JSON.stringify(bobMessages, null, 2));

// Cleanup
console.log('\n' + '='.repeat(80));
console.log('CLEANUP');
console.log('='.repeat(80));

deleteIdentity(TEST_CONFIG.account1.name);
deleteIdentity(TEST_CONFIG.account2.name);
console.log('✅ Cleaned up test identities');

console.log('\n' + '='.repeat(80));
console.log('TEST COMPLETED SUCCESSFULLY');
console.log('='.repeat(80));
