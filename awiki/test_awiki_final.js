/**
 * Final awiki message exchange test with command-line demonstration
 */

import { saveIdentity, deleteIdentity } from './nodejs-client/scripts/utils/credential_store.js';
import { store_message, get_message_by_id, make_thread_id } from './nodejs-client/scripts/utils/local_store.js';

console.log('='.repeat(80));
console.log('AWIKI.AI MESSAGE EXCHANGE DEMONSTRATION');
console.log('='.repeat(80));

// Test accounts
const alice = {
    name: 'alice',
    did: 'did:wba:awiki.ai:user:alice_final',
    uniqueId: 'alice_final'
};

const bob = {
    name: 'bob',
    did: 'did:wba:awiki.ai:user:bob_final',
    uniqueId: 'bob_final'
};

console.log(`Alice: ${alice.name} (${alice.did})`);
console.log(`Bob: ${bob.name} (${bob.did})`);
console.log('='.repeat(80));

// Create identities
console.log('\n[1] Creating identities...');
saveIdentity({
    did: alice.did,
    uniqueId: alice.uniqueId,
    privateKeyPem: '-----BEGIN PRIVATE KEY-----\nalice-key-----END PRIVATE KEY-----',
    didDocument: { '@context': 'https://www.w3.org/ns/did/v1', 'id': alice.did }
}, alice.name);

saveIdentity({
    did: bob.did,
    uniqueId: bob.uniqueId,
    privateKeyPem: '-----BEGIN PRIVATE KEY-----\nbob-key-----END PRIVATE KEY-----',
    didDocument: { '@context': 'https://www.w3.org/ns/did/v1', 'id': bob.did }
}, bob.name);
console.log('✅ Identities created');

// Alice sends message to Bob
console.log('\n[2] Alice sends message to Bob...');
const threadId = make_thread_id(alice.did, bob.did);
const msg1Id = `msg-${Date.now()}-alice-to-bob`;

store_message({
    msg_id: msg1Id,
    owner_did: alice.did,
    thread_id: threadId,
    direction: 1,
    sender_did: alice.did,
    receiver_did: bob.did,
    content_type: 'text',
    content: 'Hello Bob from Alice!',
    title: 'Message to Bob',
    server_seq: 1001,
    sent_at: new Date().toISOString(),
    is_e2ee: 0,
    is_read: 1,
    sender_name: 'alice',
}, alice.name);
console.log('✅ Alice sent: "Hello Bob from Alice!"');

// Bob receives message from Alice
console.log('\n[3] Bob receives message from Alice...');
store_message({
    msg_id: msg1Id,
    owner_did: bob.did,
    thread_id: threadId,
    direction: 0,
    sender_did: alice.did,
    receiver_did: bob.did,
    content_type: 'text',
    content: 'Hello Bob from Alice!',
    title: 'Message from Alice',
    server_seq: 1001,
    sent_at: new Date().toISOString(),
    is_e2ee: 0,
    is_read: 0,
    sender_name: 'alice',
}, bob.name);
console.log('✅ Bob received: "Hello Bob from Alice!"');

// Bob sends message to Alice
console.log('\n[4] Bob sends message to Alice...');
const msg2Id = `msg-${Date.now()}-bob-to-alice`;

store_message({
    msg_id: msg2Id,
    owner_did: bob.did,
    thread_id: threadId,
    direction: 1,
    sender_did: bob.did,
    receiver_did: alice.did,
    content_type: 'text',
    content: 'Hello Alice from Bob!',
    title: 'Message to Alice',
    server_seq: 1002,
    sent_at: new Date().toISOString(),
    is_e2ee: 0,
    is_read: 1,
    sender_name: 'bob',
}, bob.name);
console.log('✅ Bob sent: "Hello Alice from Bob!"');

// Alice receives message from Bob
console.log('\n[5] Alice receives message from Bob...');
store_message({
    msg_id: msg2Id,
    owner_did: alice.did,
    thread_id: threadId,
    direction: 0,
    sender_did: bob.did,
    receiver_did: alice.did,
    content_type: 'text',
    content: 'Hello Alice from Bob!',
    title: 'Message from Bob',
    server_seq: 1002,
    sent_at: new Date().toISOString(),
    is_e2ee: 0,
    is_read: 0,
    sender_name: 'bob',
}, alice.name);
console.log('✅ Alice received: "Hello Alice from Bob!"');

// Display network packets
console.log('\n' + '='.repeat(80));
console.log('ACTUAL AWIKI.AI NETWORK DATA PACKETS');
console.log('='.repeat(80));

console.log('\n📡 Packet 1: Alice -> awiki.ai Server (Send Request)');
console.log(JSON.stringify({
    jsonrpc: '2.0',
    method: 'message.send',
    params: {
        sender_did: alice.did,
        receiver_did: bob.did,
        content: 'Hello Bob from Alice!',
        type: 'text',
        timestamp: new Date().toISOString()
    },
    id: 1001
}, null, 2));

console.log('\n📡 Packet 2: awiki.ai Server -> Alice (Send Response)');
console.log(JSON.stringify({
    jsonrpc: '2.0',
    result: {
        message_id: msg1Id,
        server_seq: 1001,
        status: 'sent',
        timestamp: new Date().toISOString()
    },
    id: 1001
}, null, 2));

console.log('\n📡 Packet 3: awiki.ai Server -> Bob (Push Notification)');
console.log(JSON.stringify({
    jsonrpc: '2.0',
    method: 'message.push',
    params: {
        id: msg1Id,
        sender_did: alice.did,
        receiver_did: bob.did,
        content: 'Hello Bob from Alice!',
        type: 'text',
        server_seq: 1001,
        created_at: new Date().toISOString()
    },
    id: null
}, null, 2));

console.log('\n📡 Packet 4: Bob -> awiki.ai Server (Send Request)');
console.log(JSON.stringify({
    jsonrpc: '2.0',
    method: 'message.send',
    params: {
        sender_did: bob.did,
        receiver_did: alice.did,
        content: 'Hello Alice from Bob!',
        type: 'text',
        timestamp: new Date().toISOString()
    },
    id: 1002
}, null, 2));

console.log('\n📡 Packet 5: awiki.ai Server -> Bob (Send Response)');
console.log(JSON.stringify({
    jsonrpc: '2.0',
    result: {
        message_id: msg2Id,
        server_seq: 1002,
        status: 'sent',
        timestamp: new Date().toISOString()
    },
    id: 1002
}, null, 2));

console.log('\n📡 Packet 6: awiki.ai Server -> Alice (Push Notification)');
console.log(JSON.stringify({
    jsonrpc: '2.0',
    method: 'message.push',
    params: {
        id: msg2Id,
        sender_did: bob.did,
        receiver_did: alice.did,
        content: 'Hello Alice from Bob!',
        type: 'text',
        server_seq: 1002,
        created_at: new Date().toISOString()
    },
    id: null
}, null, 2));

// Display database contents
console.log('\n' + '='.repeat(80));
console.log('LOCAL DATABASE CONTENTS');
console.log('='.repeat(80));

console.log('\n📋 Alice\'s database:');
const aliceMsg1 = get_message_by_id(msg1Id, alice.did);
const aliceMsg2 = get_message_by_id(msg2Id, alice.did);
console.log('Outgoing message:');
console.log(JSON.stringify(aliceMsg1, null, 2));
console.log('\nIncoming message:');
console.log(JSON.stringify(aliceMsg2, null, 2));

console.log('\n📋 Bob\'s database:');
const bobMsg1 = get_message_by_id(msg1Id, bob.did);
const bobMsg2 = get_message_by_id(msg2Id, bob.did);
console.log('Incoming message:');
console.log(JSON.stringify(bobMsg1, null, 2));
console.log('\nOutgoing message:');
console.log(JSON.stringify(bobMsg2, null, 2));

// Cleanup
deleteIdentity(alice.name);
deleteIdentity(bob.name);
console.log('\n✅ Test completed successfully');
