#!/usr/bin/env node

/**
 * Test message sending with newly acquired JWT.
 */


const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGE_RPC = '/message/rpc';

console.log('='.repeat(80));
console.log('Message Test with New JWT');
console.log('='.repeat(80));

// Load newly created identity with JWT
const newCredPath = join(__dirname, '..', '.credentials', 'nodeagentfixed.json');
const pythonCredPath = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message', 'pythonagent.json');

console.log('\n[Loading Identities]');

let newCred, pythonCred;
try {
    newCred = JSON.parse(readFileSync(newCredPath, 'utf-8'));
    console.log(`âœ?Node.js (new) identity: ${newCred.did}`);
    console.log(`  Has JWT: ${!!newCred.jwt_token}`);
} catch (e) {
    console.log(`âœ?Node.js (new) identity not found`);
}

try {
    pythonCred = JSON.parse(readFileSync(pythonCredPath, 'utf-8'));
    console.log(`âœ?Python identity: ${pythonCred.did}`);
    console.log(`  Has JWT: ${!!pythonCred.jwt_token}`);
} catch (e) {
    console.log(`âœ?Python identity not found`);
}

if (!newCred || !pythonCred) {
    console.log('\nCannot proceed without identities');
    process.exit(1);
}

const config = createSDKConfig();

async function sendMessage(senderCred, receiverDid, content) {
    console.log(`\nSending message: ${senderCred.did} -> ${receiverDid}`);
    console.log(`  Content: ${content}`);
    
    if (!senderCred.jwt_token) {
        console.log(`  âœ?No JWT available`);
        return { success: false, error: { message: 'No JWT token' } };
    }
    
    const requestBody = {
        jsonrpc: '2.0',
        method: 'send',
        params: {
            sender_did: senderCred.did,
            receiver_did: receiverDid,
            content: content,
            type: 'text',
            client_msg_id: crypto.randomUUID()
        },
        id: 1
    };
    
    try {
        const response = await axios.post(
            `${config.molt_message_url}${MESSAGE_RPC}`,
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${senderCred.jwt_token}`
                },
                timeout: 30000
            }
        );
        
        const result = response.data;
        
        if (result.result) {
            console.log(`  âœ?Message sent successfully`);
            console.log(`    Server Seq: ${result.result.server_seq || 'N/A'}`);
            return { success: true, result: result.result };
        } else {
            console.log(`  âœ?Message send failed`);
            console.log(`    Error: ${result.error?.message || 'Unknown error'}`);
            return { success: false, error: result.error };
        }
    } catch (e) {
        console.log(`  âœ?Request failed: ${e.message}`);
        if (e.response) {
            console.log(`    Status: ${e.response.status}`);
            console.log(`    Body: ${JSON.stringify(e.response.data)}`);
        }
        return { success: false, error: { message: e.message } };
    }
}

async function runTests() {
    // Test 1: Node.js (new JWT) -> Python DID
    console.log('\n' + '='.repeat(80));
    console.log('Test 1: Node.js (new JWT) -> Python DID');
    console.log('='.repeat(80));
    
    const test1Result = await sendMessage(
        newCred,
        pythonCred.did,
        `From Node.js (new JWT) ${new Date().toISOString()}`
    );
    
    // Wait
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Python JWT -> Node.js (new) DID
    console.log('\n' + '='.repeat(80));
    console.log('Test 2: Python JWT -> Node.js (new) DID');
    console.log('='.repeat(80));
    
    const test2Result = await sendMessage(
        pythonCred,
        newCred.did,
        `From Python ${new Date().toISOString()}`
    );
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`${test1Result.success ? 'âœ? : 'âœ?} Node.js (new JWT) -> Python DID`);
    console.log(`${test2Result.success ? 'âœ? : 'âœ?} Python JWT -> Node.js (new) DID`);
    
    const passCount = [test1Result, test2Result].filter(r => r.success).length;
    console.log(`\nTotal: ${passCount}/2 passed`);
    
    // Save results
    const { writeFileSync } = await import('fs');
    const reportPath = join(__dirname, 'message_test_results.json');
    writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        identities: {
            nodejs_new: newCred.did,
            python: pythonCred.did
        },
        results: [test1Result, test2Result]
    }, null, 2));
    
    console.log(`\nResults saved to: ${reportPath}`);
}

await runTests();

console.log('\n' + '='.repeat(80));
