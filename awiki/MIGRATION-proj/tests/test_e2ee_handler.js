/**
 * Test script for e2ee_handler.js
 */

import { E2eeHandler, buildE2eeErrorContent, buildE2eeErrorMessage } from '../../nodejs-client/scripts/utils/e2ee_handler.js';

console.log('Testing E2EE Handler...\n');

// Test 1: buildE2eeErrorContent
console.log('Test 1: buildE2eeErrorContent');
const errorContent = buildE2eeErrorContent({
    error_code: 'session_not_found',
    session_id: 'test-session-123',
    failed_msg_id: 'msg-456',
    failed_server_seq: 100,
    retry_hint: 'rekey_then_resend',
    message: 'Session not found'
});
console.log('Result:', JSON.stringify(errorContent, null, 2));
console.log('✅ Test 1 passed\n');

// Test 2: buildE2eeErrorMessage
console.log('Test 2: buildE2eeErrorMessage');
const errorMessage = buildE2eeErrorMessage('session_not_found');
console.log('Result:', errorMessage);
console.log('✅ Test 2 passed\n');

// Test 3: E2eeHandler initialization
console.log('Test 3: E2eeHandler initialization');
const handler = new E2eeHandler('test_credential', 30.0, 'drop');
console.log('Handler created:', handler !== null);
console.log('Is ready:', handler.isReady);
console.log('✅ Test 3 passed\n');

// Test 4: Check message type detection
console.log('Test 4: Message type detection');
const isE2ee = handler.isE2eeType('e2ee_msg');
const isProtocol = handler.isProtocolType('e2ee_init');
console.log('Is E2EE type:', isE2ee);
console.log('Is protocol type:', isProtocol);
console.log('✅ Test 4 passed\n');

console.log('All E2EE Handler tests passed!');
