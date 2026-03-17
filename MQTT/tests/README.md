# MQTT E2EE Chat - Integration Tests

## Overview

This directory contains comprehensive integration tests for the MQTT E2EE Chat project. The tests verify the functionality of identity management, HPKE encryption, cross-DID communication, private chat E2EE, group chat E2EE, and MQTT integration.

## Test Environment

- **MQTT Broker**: mqtt://broker.emqx.io:1883
- **Topic**: psmd/e2ee/chat (with test-specific subtopics)
- **Test Framework**: Node.js native test runner (no external testing framework required)

## Test Files

### 1. `test-identity.js`
Tests identity management functionality:
- Create did:key identity (x25519)
- Create did:ethr identity (x25519)
- Create did:wba identity (x25519)
- Export identity to file
- Import identity from file
- Verify identity properties (DID format, key types)

**Status**: ✅ All tests passed (25/25)

### 2. `test-hpke.js`
Tests HPKE encryption functionality:
- Base Mode encryption/decryption
- Auth Mode encryption/decryption
- Verify encrypted data cannot be decrypted without private key
- Test with different message sizes (10 bytes, 100 bytes, 1000 bytes, 10000 bytes)

**Status**: ✅ All tests passed (14/14)

### 3. `test-cross-did.js`
Tests cross-DID communication:
- did:key ↔ did:ethr communication
- did:ethr ↔ did:wba communication
- did:wba ↔ did:key communication
- Verify shared secret consistency

**Status**: ✅ All tests passed (13/13)

### 4. `test-private-chat.js`
Tests private chat E2EE functionality:
- Initialize E2EE session between two clients
- Send encrypted message from Client A to Client B
- Receive and decrypt message on Client B
- Verify message integrity and confidentiality

**Status**: ✅ All tests passed (13/13)

### 5. `test-group-chat.js`
Tests group chat E2EE functionality:
- Create group session with multiple members
- Send encrypted group message
- Receive encrypted group message on multiple clients
- Test replay detection (automatic ignore of duplicate messages)

**Status**: ✅ All tests passed (22/22)

### 6. `test-mqtt.js`
Tests MQTT integration:
- Connect to real MQTT broker
- Publish/subscribe to topic
- Handle connection drops and reconnections
- Verify message delivery guarantees

**Status**: ✅ All tests passed (8/8)

### 7. `run-all.js`
Orchestrates running all test files sequentially and provides a summary report.

## Running Tests

### Run All Tests
```bash
node tests/run-all.js
```

### Run Individual Tests
```bash
node tests/test-identity.js
node tests/test-hpke.js
node tests/test-cross-did.js
node tests/test-private-chat.js
node tests/test-group-chat.js
node tests/test-mqtt.js
```

## Test Results Summary

| Test Suite | Tests Passed | Tests Failed | Total |
|------------|--------------|--------------|-------|
| Identity Management | 25 | 0 | 25 |
| HPKE Encryption | 14 | 0 | 14 |
| Cross-DID Communication | 13 | 0 | 13 |
| Private Chat E2EE | 13 | 0 | 13 |
| Group Chat E2EE | 22 | 0 | 22 |
| MQTT Integration | 8 | 0 | 8 |
| **Total** | **95** | **0** | **95** |

**Success Rate: 100.0%**

## Test Design Features

### Setup and Teardown
- Each test file includes setup and teardown procedures
- Test data is cleaned up after each test
- MQTT connections are properly closed

### Error Handling
- All tests include try-catch blocks
- Detailed error logging for debugging
- Graceful cleanup on failure

### Timing Considerations
- MQTT message delivery: 100-500ms
- Session initialization: 100-300ms
- Message encryption/decryption: 50-200ms
- Test timeout: 5-10 seconds per test

### Assertions
- Comprehensive assertions for each test case
- Clear error messages for failed assertions
- Verification of both success and failure cases

## Notes

- The tests use the actual MQTT broker at broker.emqx.io:1883
- Test topics include random identifiers to avoid conflicts
- Some tests may require network connectivity to the MQTT broker
- The test suite is designed to run sequentially to avoid race conditions
