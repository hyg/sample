# MQTT E2EE Chat - Integration Test Plan

## Test Environment
- **MQTT Broker**: mqtt://broker.emqx.io:1883
- **Topic**: psmd/e2ee/chat
- **Test Framework**: Node.js (native test runner)
- **Test Directory**: ./tests/

## Test Scenarios

### 1. Identity Management Tests

**Objective**: Verify DID identity creation, export, import, and properties

**Test Cases**:
- Create did:key identity (x25519)
- Create did:ethr identity (x25519)
- Create did:wba identity (x25519)
- Export identity to file
- Import identity from file
- Verify identity properties (DID format, key types)

**Success Criteria**:
- Identity creation returns valid DID
- DID format matches method specification
- Export/import preserves key material
- Public/private key pair is consistent

### 2. HPKE Encryption Tests

**Objective**: Verify HPKE encryption/decryption functionality

**Test Cases**:
- Base Mode encryption/decryption
- Auth Mode encryption/decryption
- Verify encrypted data cannot be decrypted without private key
- Test with different message sizes (small, medium, large)

**Success Criteria**:
- Encryption produces ciphertext
- Decryption recovers original plaintext
- Wrong private key fails to decrypt
- Different message sizes handled correctly

### 3. Cross-DID Communication Tests

**Objective**: Verify different DID methods can communicate

**Test Cases**:
- did:key ↔ did:ethr communication
- did:ethr ↔ did:wba communication
- did:wba ↔ did:key communication
- Verify shared secret consistency

**Success Criteria**:
- Shared secrets match for both parties
- Encryption/decryption works across DID methods
- DID format validation works

### 4. Private Chat E2EE Tests

**Objective**: Verify end-to-end encryption in private chat

**Test Cases**:
- Initialize E2EE session between two clients
- Send encrypted message from Client A to Client B
- Receive and decrypt message on Client B
- Verify message integrity and confidentiality

**Success Criteria**:
- Session initialization succeeds
- Message is encrypted during transmission
- Receiver decrypts message correctly
- Original plaintext is not exposed

### 5. Group Chat E2EE Tests

**Objective**: Verify end-to-end encryption in group chat

**Test Cases**:
- Create group session with multiple members
- Send encrypted group message
- Receive encrypted group message on multiple clients
- Test replay detection (automatic ignore of duplicate messages)

**Success Criteria**:
- Group session creation succeeds
- Message is encrypted for all members
- All members can decrypt the message
- Duplicate messages are detected and ignored

### 6. MQTT Integration Tests

**Objective**: Verify MQTT transport layer functionality

**Test Cases**:
- Connect to real MQTT broker
- Publish/subscribe to topic
- Handle connection drops and reconnections
- Verify message delivery guarantees

**Success Criteria**:
- Connection to broker succeeds
- Messages are published successfully
- Messages are received by subscribers
- Reconnection works automatically
- Message ordering is preserved

## Test Scripts

### Test 1: Identity Management (`test-identity.js`)

**Setup**:
- Import DID manager
- Create test data directory

**Teardown**:
- Clean up test files
- Close connections

**Assertions**:
- DID format validation
- Key type consistency
- Export/import integrity

### Test 2: HPKE Encryption (`test-hpke.js`)

**Setup**:
- Generate key pairs
- Create test plaintext

**Teardown**:
- Clean up test data

**Assertions**:
- Encryption produces ciphertext
- Decryption recovers plaintext
- Wrong key fails to decrypt

### Test 3: Cross-DID Communication (`test-cross-did.js`)

**Setup**:
- Create identities for different DID methods
- Generate shared secrets

**Teardown**:
- Clean up identities

**Assertions**:
- Shared secrets match
- Encryption works across methods

### Test 4: Private Chat E2EE (`test-private-chat.js`)

**Setup**:
- Create two client instances
- Generate identities
- Connect to MQTT broker

**Teardown**:
- Disconnect clients
- Clean up sessions

**Assertions**:
- Session initialization succeeds
- Message encryption/decryption works
- Message integrity verified

### Test 5: Group Chat E2EE (`test-group-chat.js`)

**Setup**:
- Create multiple client instances
- Generate group session

**Teardown**:
- Disconnect all clients
- Clean up sessions

**Assertions**:
- Group session creation succeeds
- Message encryption for all members
- Replay detection works

### Test 6: MQTT Integration (`test-mqtt.js`)

**Setup**:
- Create MQTT client
- Subscribe to topic

**Teardown**:
- Disconnect client

**Assertions**:
- Connection success
- Message publish/receive
- Reconnection handling

## Timing Considerations

- MQTT message delivery: 100-500ms
- Session initialization: 100-300ms
- Message encryption/decryption: 50-200ms
- Test timeout: 10 seconds per test

## Error Handling

- All tests include try-catch blocks
- Detailed error logging
- Graceful cleanup on failure
- Timeout handling for async operations

## Running Tests

```bash
# Run all tests
node tests/run-all.js

# Run individual test
node tests/test-identity.js
node tests/test-hpke.js
node tests/test-cross-did.js
node tests/test-private-chat.js
node tests/test-group-chat.js
node tests/test-mqtt.js
```

## Test Results

Each test script will output:
- Test name and description
- Setup status
- Assertion results
- Teardown status
- Overall pass/fail status
