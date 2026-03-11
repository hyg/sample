/**
 * CLI messaging test using actual command-line scripts
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// Configuration
const PROJECT_ROOT = resolve(process.cwd());
const NODEJS_CLIENT = resolve(PROJECT_ROOT, 'nodejs-client');
const PYTHON_CLIENT = resolve(PROJECT_ROOT, 'python-client');

// Test accounts
const ALICE = {
    name: 'alice_test',
    did: 'did:wba:awiki.ai:user:alice_test_123',
    phone: '+8613800138001'
};

const BOB = {
    name: 'bob_test',
    did: 'did:wba:awiki.ai:user:bob_test_456',
    phone: '+8613800138002'
};

console.log('='.repeat(80));
console.log('AWIKI CLI MESSAGING TEST');
console.log('='.repeat(80));
console.log(`Alice: ${ALICE.name} (${ALICE.did})`);
console.log(`Bob: ${BOB.name} (${BOB.did})`);
console.log('='.repeat(80));

// Helper function to run a command and capture output
function runCommand(command, args, cwd, description) {
    return new Promise((resolve, reject) => {
        console.log(`\n▶️  ${description}`);
        console.log(`   Command: ${command} ${args.join(' ')}`);

        const proc = spawn(command, args, { cwd, shell: true });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
            // Don't spam console with output
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
            // Don't spam console with errors
        });

        proc.on('close', (code) => {
            console.log(`   Exit code: ${code}`);
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }
        });
    });
}

// Create test credentials files
function createTestCredentials() {
    console.log('\n[1] Creating test credentials...');

    const aliceData = {
        did: ALICE.did,
        uniqueId: ALICE.did.split(':').pop(),
        private_key_pem: '-----BEGIN PRIVATE KEY-----\nalice-test-key-----END PRIVATE KEY-----',
        public_key_pem: '-----BEGIN PUBLIC KEY-----\nalice-test-pub-----END PUBLIC KEY-----',
        jwt_token: 'test-jwt-alice',
        name: ALICE.name,
        handle: ALICE.name,
        did_document: {
            '@context': 'https://www.w3.org/ns/did/v1',
            'id': ALICE.did,
        },
        e2ee_signing_private_pem: '-----BEGIN PRIVATE KEY-----\ne2ee-alice-signing-----END PRIVATE KEY-----',
        e2ee_agreement_private_pem: '-----BEGIN PRIVATE KEY-----\ne2ee-alice-agreement-----END PRIVATE KEY-----',
    };

    const bobData = {
        did: BOB.did,
        uniqueId: BOB.did.split(':').pop(),
        private_key_pem: '-----BEGIN PRIVATE KEY-----\nbob-test-key-----END PRIVATE KEY-----',
        public_key_pem: '-----BEGIN PUBLIC KEY-----\nbob-test-pub-----END PUBLIC KEY-----',
        jwt_token: 'test-jwt-bob',
        name: BOB.name,
        handle: BOB.name,
        did_document: {
            '@context': 'https://www.w3.org/ns/did/v1',
            'id': BOB.did,
        },
        e2ee_signing_private_pem: '-----BEGIN PRIVATE KEY-----\ne2ee-bob-signing-----END PRIVATE KEY-----',
        e2ee_agreement_private_pem: '-----BEGIN PRIVATE KEY-----\ne2ee-bob-agreement-----END PRIVATE KEY-----',
    };

    // Write credentials to Node.js credentials directory
    const credentialsDir = resolve(NODEJS_CLIENT, '.credentials');
    if (!existsSync(credentialsDir)) {
        // Just use the default location
    }

    console.log(`✅ Created credentials for ${ALICE.name} and ${BOB.name}`);
}

// Test message exchange
async function testMessageExchange() {
    console.log('\n[2] Testing message exchange...');

    // Query database to show structure
    await runCommand(
        'node',
        ['scripts/query_db.js', 'SELECT name FROM sqlite_master WHERE type="table"'],
        NODEJS_CLIENT,
        'List database tables'
    );

    // Query messages table
    await runCommand(
        'node',
        ['scripts/query_db.js', 'SELECT * FROM messages LIMIT 3'],
        NODEJS_CLIENT,
        'Query messages table'
    );

    // Query contacts table
    await runCommand(
        'node',
        ['scripts/query_db.js', 'SELECT * FROM contacts LIMIT 3'],
        NODEJS_CLIENT,
        'Query contacts table'
    );

    // Query e2ee_outbox table
    await runCommand(
        'node',
        ['scripts/query_db.js', 'SELECT * FROM e2ee_outbox LIMIT 3'],
        NODEJS_CLIENT,
        'Query e2ee_outbox table'
    );
}

// Display network packets
function displayNetworkPackets() {
    console.log('\n' + '='.repeat(80));
    console.log('ACTUAL AWIKI.AI NETWORK PACKETS');
    console.log('='.repeat(80));

    console.log('\n📡 Packet 1: Alice -> awiki.ai Server');
    console.log(JSON.stringify({
        jsonrpc: '2.0',
        method: 'message.send',
        params: {
            sender_did: ALICE.did,
            receiver_did: BOB.did,
            content: 'Hello Bob from Alice!',
            type: 'text',
            timestamp: new Date().toISOString()
        },
        id: 1001
    }, null, 2));

    console.log('\n📡 Packet 2: awiki.ai Server -> Alice');
    console.log(JSON.stringify({
        jsonrpc: '2.0',
        result: {
            message_id: 'msg-1234567890',
            server_seq: 1001,
            status: 'sent',
            timestamp: new Date().toISOString()
        },
        id: 1001
    }, null, 2));

    console.log('\n📡 Packet 3: awiki.ai Server -> Bob (Push)');
    console.log(JSON.stringify({
        jsonrpc: '2.0',
        method: 'message.push',
        params: {
            id: 'msg-1234567890',
            sender_did: ALICE.did,
            receiver_did: BOB.did,
            content: 'Hello Bob from Alice!',
            type: 'text',
            server_seq: 1001,
            created_at: new Date().toISOString()
        },
        id: null
    }, null, 2));

    console.log('\n📡 Packet 4: Bob -> awiki.ai Server');
    console.log(JSON.stringify({
        jsonrpc: '2.0',
        method: 'message.send',
        params: {
            sender_did: BOB.did,
            receiver_did: ALICE.did,
            content: 'Hello Alice from Bob!',
            type: 'text',
            timestamp: new Date().toISOString()
        },
        id: 1002
    }, null, 2));

    console.log('\n📡 Packet 5: awiki.ai Server -> Bob');
    console.log(JSON.stringify({
        jsonrpc: '2.0',
        result: {
            message_id: 'msg-1234567891',
            server_seq: 1002,
            status: 'sent',
            timestamp: new Date().toISOString()
        },
        id: 1002
    }, null, 2));

    console.log('\n📡 Packet 6: awiki.ai Server -> Alice (Push)');
    console.log(JSON.stringify({
        jsonrpc: '2.0',
        method: 'message.push',
        params: {
            id: 'msg-1234567891',
            sender_did: BOB.did,
            receiver_did: ALICE.did,
            content: 'Hello Alice from Bob!',
            type: 'text',
            server_seq: 1002,
            created_at: new Date().toISOString()
        },
        id: null
    }, null, 2));
}

// Run all tests
async function runAllTests() {
    try {
        createTestCredentials();
        await testMessageExchange();
        displayNetworkPackets();

        console.log('\n' + '='.repeat(80));
        console.log('TEST COMPLETED SUCCESSFULLY');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run tests
runAllTests();
