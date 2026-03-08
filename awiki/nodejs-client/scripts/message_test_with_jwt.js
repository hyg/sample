#!/usr/bin/env node

/**
 * Message test using existing JWT tokens.
 */


const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGE_RPC = '/message/rpc';

console.log('='.repeat(80));
console.log('Message Test (Using Existing JWT)');
console.log('='.repeat(80));

// Load test identities
const pythonCredPath = join(process.env.USERPROFILE || '', '.openclaw', 'credentials', 'awiki-agent-id-message', 'pythonagent.json');
const nodejsCredPath = join(__dirname, '..', '.credentials', 'nodeagentfinal.json');

console.log('\n[Loading Identities]');

let pythonCred, nodejsCred;
try {
    pythonCred = JSON.parse(readFileSync(pythonCredPath, 'utf-8'));
    console.log(`âœ?Python identity: ${pythonCred.did}`);
    console.log(`  JWT: ${pythonCred.jwt_token ? pythonCred.jwt_token.substring(0, 50) + '...' : 'NONE'}`);
} catch (e) {
    console.log(`âœ?Python identity not found`);
}

try {
    nodejsCred = JSON.parse(readFileSync(nodejsCredPath, 'utf-8'));
    console.log(`âœ?Node.js identity: ${nodejsCred.did}`);
    console.log(`  JWT: ${nodejsCred.jwt_token ? nodejsCred.jwt_token.substring(0, 50) + '...' : 'NONE'}`);
} catch (e) {
    console.log(`âœ?Node.js identity not found`);
}

if (!pythonCred || !nodejsCred) {
    console.log('\nCannot proceed without both identities');
    process.exit(1);
}

const config = createSDKConfig();

async function sendMessageWithJwt(senderCred, receiverDid, content) {
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
    // Test 1: Python JWT -> Node.js DID
    console.log('\n' + '='.repeat(80));
    console.log('Test 1: Python JWT -> Node.js DID');
    console.log('='.repeat(80));
    
    const test1Result = await sendMessageWithJwt(
        pythonCred,
        nodejsCred.did,
        `From Python (using Python JWT) ${new Date().toISOString()}`
    );
    
    // Wait
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: If Node.js has JWT, test Node.js JWT -> Python DID
    if (nodejsCred.jwt_token) {
        console.log('\n' + '='.repeat(80));
        console.log('Test 2: Node.js JWT -> Python DID');
        console.log('='.repeat(80));
        
        const test2Result = await sendMessageWithJwt(
            nodejsCred,
            pythonCred.did,
            `From Node.js (using Node.js JWT) ${new Date().toISOString()}`
        );
        
        // Summary
        console.log('\n' + '='.repeat(80));
        console.log('SUMMARY');
        console.log('='.repeat(80));
        
        console.log(`${test1Result.success ? 'âœ? : 'âœ?} Python JWT -> Node.js DID`);
        console.log(`${test2Result.success ? 'âœ? : 'âœ?} Node.js JWT -> Python DID`);
        
        const passCount = [test1Result, test2Result].filter(r => r.success).length;
        console.log(`\nTotal: ${passCount}/2 passed`);
    } else {
        console.log('\n' + '='.repeat(80));
        console.log('SUMMARY');
        console.log('='.repeat(80));
        
        console.log(`${test1Result.success ? 'âœ? : 'âœ?} Python JWT -> Node.js DID`);
        console.log(`- Node.js JWT -> Python DID (skipped - no JWT)`);
        
        console.log(`\nTotal: ${test1Result.success ? 1 : 0}/1 passed`);
    }
}

await runTests();

console.log('\n' + '='.repeat(80));
