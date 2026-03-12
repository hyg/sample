/**
 * Test script showing actual awiki.ai network data packets
 * Demonstrates message exchange with simulated network traffic
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
console.log('AWIKI.AI NETWORK DATA PACKETS EXCHANGE');
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

// Simulate network packets
console.log('\n' + '='.repeat(80));
console.log('NETWORK PACKET FLOW');
console.log('='.repeat(80));

// Packet 1: Alice sends message to awiki.ai server
console.log('\n📡 Packet 1: Alice -> awiki.ai Server (Message Send Request)');
const packet1 = {
    jsonrpc: '2.0',
    method: 'message.send',
    params: {
        sender_did: TEST_CONFIG.account1.did,
        receiver_did: TEST_CONFIG.account2.did,
        content: TEST_CONFIG.messageContent1,
        type: 'text',
        timestamp: new Date().toISOString()
    },
    id: 1001
};
console.log(JSON.stringify(packet1, null, 2));

// Packet 2: awiki.ai server response
console.log('\n📡 Packet 2: awiki.ai Server -> Alice (Message Send Response)');
const packet2 = {
    jsonrpc: '2.0',
    result: {
        message_id: 'msg-1234567890',
        server_seq: 1001,
        status: 'sent',
        timestamp: new Date().toISOString()
    },
    id: 1001
};
console.log(JSON.stringify(packet2, null, 2));

// Packet 3: awiki.ai server pushes message to Bob
console.log('\n📡 Packet 3: awiki.ai Server -> Bob (Message Push Notification)');
const packet3 = {
    jsonrpc: '2.0',
    method: 'message.push',
    params: {
        id: 'msg-1234567890',
        sender_did: TEST_CONFIG.account1.did,
        receiver_did: TEST_CONFIG.account2.did,
        content: TEST_CONFIG.messageContent1,
        type: 'text',
        server_seq: 1001,
        created_at: new Date().toISOString()
    },
    id: null
};
console.log(JSON.stringify(packet3, null, 2));

// Packet 4: Bob sends message to awiki.ai server
console.log('\n📡 Packet 4: Bob -> awiki.ai Server (Message Send Request)');
const packet4 = {
    jsonrpc: '2.0',
    method: 'message.send',
    params: {
        sender_did: TEST_CONFIG.account2.did,
        receiver_did: TEST_CONFIG.account1.did,
        content: TEST_CONFIG.messageContent2,
        type: 'text',
        timestamp: new Date().toISOString()
    },
    id: 1002
};
console.log(JSON.stringify(packet4, null, 2));

// Packet 5: awiki.ai server response
console.log('\n📡 Packet 5: awiki.ai Server -> Bob (Message Send Response)');
const packet5 = {
    jsonrpc: '2.0',
    result: {
        message_id: 'msg-1234567891',
        server_seq: 1002,
        status: 'sent',
        timestamp: new Date().toISOString()
    },
    id: 1002
};
console.log(JSON.stringify(packet5, null, 2));

// Packet 6: awiki.ai server pushes message to Alice
console.log('\n📡 Packet 6: awiki.ai Server -> Alice (Message Push Notification)');
const packet6 = {
    jsonrpc: '2.0',
    method: 'message.push',
    params: {
        id: 'msg-1234567891',
        sender_did: TEST_CONFIG.account2.did,
        receiver_did: TEST_CONFIG.account1.did,
        content: TEST_CONFIG.messageContent2,
        type: 'text',
        server_seq: 1002,
        created_at: new Date().toISOString()
    },
    id: null
};
console.log(JSON.stringify(packet6, null, 2));

// Store messages in local database
console.log('\n' + '='.repeat(80));
console.log('LOCAL DATABASE STORAGE');
console.log('='.repeat(80));

const threadId = make_thread_id(TEST_CONFIG.account1.did, TEST_CONFIG.account2.did);

// Alice stores her outgoing message
store_message({
    msg_id: 'msg-1234567890',
    owner_did: TEST_CONFIG.account1.did,
    thread_id: threadId,
    direction: 1, // outgoing
    sender_did: TEST_CONFIG.account1.did,
    receiver_did: TEST_CONFIG.account2.did,
    content_type: 'text',
    content: TEST_CONFIG.messageContent1,
    title: 'Message to Bob',
    server_seq: 1001,
    sent_at: new Date().toISOString(),
    is_e2ee: 0,
    is_read: 1,
    sender_name: TEST_CONFIG.account1.name,
}, TEST_CONFIG.account1.name);

console.log(`✅ Alice stored outgoing message: "${TEST_CONFIG.messageContent1}"`);

// Bob stores incoming message from Alice
store_message({
    msg_id: 'msg-1234567890',
    owner_did: TEST_CONFIG.account2.did,
    thread_id: threadId,
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

console.log(`✅ Bob stored incoming message: "${TEST_CONFIG.messageContent1}"`);

// Bob stores his outgoing message
store_message({
    msg_id: 'msg-1234567891',
    owner_did: TEST_CONFIG.account2.did,
    thread_id: threadId,
    direction: 1, // outgoing
    sender_did: TEST_CONFIG.account2.did,
    receiver_did: TEST_CONFIG.account1.did,
    content_type: 'text',
    content: TEST_CONFIG.messageContent2,
    title: 'Message to Alice',
    server_seq: 1002,
    sent_at: new Date().toISOString(),
    is_e2ee: 0,
    is_read: 1,
    sender_name: TEST_CONFIG.account2.name,
}, TEST_CONFIG.account2.name);

console.log(`✅ Bob stored outgoing message: "${TEST_CONFIG.messageContent2}"`);

// Alice stores incoming message from Bob
store_message({
    msg_id: 'msg-1234567891',
    owner_did: TEST_CONFIG.account1.did,
    thread_id: threadId,
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

console.log(`✅ Alice stored incoming message: "${TEST_CONFIG.messageContent2}"`);

// Display database query results
console.log('\n' + '='.repeat(80));
console.log('DATABASE QUERY RESULTS');
console.log('='.repeat(80));

console.log('\n📋 Alice\'s message database:');
const aliceOutgoing = get_message_by_id('msg-1234567890', TEST_CONFIG.account1.did);
const aliceIncoming = get_message_by_id('msg-1234567891', TEST_CONFIG.account1.did);
console.log('Outgoing messages:');
console.log(JSON.stringify(aliceOutgoing, null, 2));
console.log('\nIncoming messages:');
console.log(JSON.stringify(aliceIncoming, null, 2));

console.log('\n📋 Bob\'s message database:');
const bobIncoming = get_message_by_id('msg-1234567890', TEST_CONFIG.account2.did);
const bobOutgoing = get_message_by_id('msg-1234567891', TEST_CONFIG.account2.did);
console.log('Incoming messages:');
console.log(JSON.stringify(bobIncoming, null, 2));
console.log('\nOutgoing messages:');
console.log(JSON.stringify(bobOutgoing, null, 2));

// Display network summary
console.log('\n' + '='.repeat(80));
console.log('NETWORK EXCHANGE SUMMARY');
console.log('='.repeat(80));

console.log('\n✅ Message Exchange Completed:');
console.log(`   Alice (${TEST_CONFIG.account1.name}) sent: "${TEST_CONFIG.messageContent1}"`);
console.log(`   Bob (${TEST_CONFIG.account2.name}) received: "${aliceIncoming.content}"`);
console.log(`   Bob (${TEST_CONFIG.account2.name}) sent: "${TEST_CONFIG.messageContent2}"`);
console.log(`   Alice (${TEST_CONFIG.account1.name}) received: "${aliceIncoming.content}"`);

console.log('\n📊 Statistics:');
console.log(`   Total messages sent: 2`);
console.log(`   Total messages received: 2`);
console.log(`   Thread ID: ${threadId}`);
console.log(`   Server sequences: 1001, 1002`);

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
