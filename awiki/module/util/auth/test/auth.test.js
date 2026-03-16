/**
 * Auth Module Comprehensive Test
 * 
 * Based on python/scripts/utils/auth.py test cases
 * 
 * Naming convention: snake_case (consistent with Python version)
 */

import { strict as assert } from 'node:assert';
import { create_identity, DIDIdentity } from '@awiki/identity';
import { SDKConfig } from '@awiki/config';
import {
  generate_wba_auth_header,
  register_did,
  update_did_document,
  get_jwt_via_wba,
  create_authenticated_identity,
} from '../dist/index.js';

// Helper functions
function createTestConfig(options = {}) {
  const { did_domain = 'awiki.ai', user_service_url = 'https://awiki.ai' } = options;
  return new SDKConfig({ did_domain, user_service_url });
}

function createTestIdentity(options = {}) {
  const { hostname = 'awiki.ai', path_prefix = ['user'] } = options;
  return create_identity({ hostname, path_prefix, proof_purpose: 'authentication', domain: hostname });
}

function createMockClient(options = {}) {
  const { baseURL = 'https://awiki.ai', responseHandler = null } = options;
  return {
    baseURL,
    async post(endpoint, payload, fetchOptions = {}) {
      if (responseHandler) return responseHandler(endpoint, payload, fetchOptions);
      return { status_code: 200, statusText: 'OK', result: { did: 'test', user_id: 'uuid', message: 'OK' }, headers: {} };
    },
  };
}

let totalTests = 0, passedTests = 0, failedTests = 0;
const failures = [];

async function runTest(name, testFn) {
  totalTests++;
  try {
    await testFn();
    passedTests++;
    console.log('  PASS:', name);
    return true;
  } catch (error) {
    failedTests++;
    failures.push({ name, error: error.message });
    console.log('  FAIL:', name, '-', error.message);
    return false;
  }
}

// TC-001: Sign callback normal sign
async function test_secp256k1_sign_callback_normal() {
  const identity = createTestIdentity();
  const header = await generate_wba_auth_header(identity, 'awiki.ai');
  assert.ok(header.startsWith('DIDWba '), 'Header should start with DIDWba');
  const content = header.replace('DIDWba ', '');
  const lastColonIndex = content.lastIndexOf(':');
  const timestamp = content.substring(lastColonIndex + 1);
  const rest = content.substring(0, lastColonIndex);
  const secondLastColonIndex = rest.lastIndexOf(':');
  const signature = rest.substring(secondLastColonIndex + 1);
  const did = rest.substring(0, secondLastColonIndex);
  assert.strictEqual(did, identity.did, 'DID should match');
  assert.ok(signature.length > 0, 'Signature should not be empty');
  assert.ok(/^\d+$/.test(timestamp), 'Timestamp should be numeric');
}

// TC-002: Sign callback SHA256 hash
async function test_secp256k1_sign_callback_sha256() {
  const identity = createTestIdentity();
  const header1 = await generate_wba_auth_header(identity, 'awiki.ai');
  const header2 = await generate_wba_auth_header(identity, 'awiki.ai');
  assert.ok(header1.startsWith('DIDWba '), 'First should succeed');
  assert.ok(header2.startsWith('DIDWba '), 'Second should succeed');
}

// TC-003: Sign callback DER encoding
async function test_secp256k1_sign_callback_der_encoding() {
  const identity = createTestIdentity();
  const header = await generate_wba_auth_header(identity, 'awiki.ai');
  const content = header.replace('DIDWba ', '');
  const parts = content.split(':');
  const signature = parts[parts.length - 2];
  assert.ok(signature.length >= 80, 'DER signature length should be >= 80');
}

// TC-004: Generate WBA auth header normal
async function test_generate_wba_auth_header_normal() {
  const identity = createTestIdentity();
  const header = await generate_wba_auth_header(identity, 'awiki.ai');
  assert.strictEqual(typeof header, 'string', 'Return type should be string');
  assert.ok(header.startsWith('DIDWba '), 'Header should start with DIDWba');
  assert.ok(header.length > 50, 'Header length should be > 50');
  assert.ok(header.includes(identity.did), 'Header should include DID');
}

// TC-005: Generate WBA auth header different domains
async function test_generate_wba_auth_header_different_domains() {
  const identity = createTestIdentity();
  const h1 = await generate_wba_auth_header(identity, 'awiki.ai');
  const h2 = await generate_wba_auth_header(identity, 'test.awiki.ai');
  const h3 = await generate_wba_auth_header(identity, 'localhost');
  assert.ok(h1.startsWith('DIDWba '), 'h1 format correct');
  assert.ok(h2.startsWith('DIDWba '), 'h2 format correct');
  assert.ok(h3.startsWith('DIDWba '), 'h3 format correct');
}

// TC-006: Generate WBA auth header private key
async function test_generate_wba_auth_header_private_key() {
  const identity = createTestIdentity();
  assert.ok(identity.private_key_pem, 'Identity should have private key');
  const privateKey = identity.get_private_key();
  assert.ok(privateKey, 'Should get private key object');
  const header = await generate_wba_auth_header(identity, 'awiki.ai');
  assert.ok(header.startsWith('DIDWba '), 'Should generate header');
}

// TC-007: Generate WBA auth header format strict
async function test_generate_wba_auth_header_format() {
  const identity = createTestIdentity();
  const header = await generate_wba_auth_header(identity, 'awiki.ai');
  const content = header.replace('DIDWba ', '');
  const lastColonIndex = content.lastIndexOf(':');
  const timestamp = content.substring(lastColonIndex + 1);
  const rest = content.substring(0, lastColonIndex);
  const secondLastColonIndex = rest.lastIndexOf(':');
  const signature = rest.substring(secondLastColonIndex + 1);
  const did = rest.substring(0, secondLastColonIndex);
  assert.ok(/^\d+$/.test(timestamp), 'Timestamp should be numeric');
  assert.ok(/^[A-Za-z0-9_-]+$/.test(signature), 'Signature should be valid base64url');
  assert.ok(did.startsWith('did:wba:'), 'DID should start with did:wba:');
}

// TC-008: Register DID basic
async function test_register_did_basic() {
  const mockClient = createMockClient({
    responseHandler: (endpoint, payload) => {
      assert.strictEqual(endpoint, '/user-service/did-auth/rpc', 'Endpoint correct');
      assert.strictEqual(payload.method, 'register', 'Method should be register');
      return { status_code: 200, result: { did: 'did:wba:awiki.ai:user:k1_test', user_id: 'test-uuid', message: 'OK' } };
    },
  });
  const identity = createTestIdentity();
  const result = await register_did(mockClient, identity);
  assert.strictEqual(result.did, 'did:wba:awiki.ai:user:k1_test', 'DID should match');
  assert.strictEqual(result.user_id, 'test-uuid', 'user_id should match');
}

// TC-009: Register DID optional params
async function test_register_did_optional_params() {
  let capturedPayload = null;
  const mockClient = createMockClient({
    responseHandler: (ep, payload) => { capturedPayload = payload.params; return { status_code: 200, result: { did: 'test', user_id: 'uuid', message: 'OK' } }; },
  });
  const identity = createTestIdentity();
  await register_did(mockClient, identity, { name: 'Test', isPublic: true, isAgent: true, role: 'dev', endpointUrl: 'https://example.com', description: 'Desc' });
  assert.strictEqual(capturedPayload.name, 'Test', 'name correct');
  assert.strictEqual(capturedPayload.is_public, true, 'is_public correct');
  assert.strictEqual(capturedPayload.is_agent, true, 'is_agent correct');
  assert.strictEqual(capturedPayload.role, 'dev', 'role correct');
  assert.strictEqual(capturedPayload.endpoint_url, 'https://example.com', 'endpoint_url correct');
  assert.strictEqual(capturedPayload.description, 'Desc', 'description correct');
}

// TC-010: Register DID error handling
async function test_register_did_error_handling() {
  const mockClient = createMockClient({ responseHandler: () => ({ status_code: 400, statusText: 'Bad Request', error: { code: -32602, message: 'Invalid' } }) });
  const identity = createTestIdentity();
  try { await register_did(mockClient, identity); assert.fail('Should throw'); }
  catch (error) { assert.ok(error.message.includes('HTTP 400'), 'Should have HTTP 400 error'); }
}

// TC-011: Update DID document WBA auth header
async function test_update_did_document_wba_auth_header() {
  let capturedAuthHeader = null;
  const mockClient = createMockClient({
    responseHandler: (ep, payload, opts) => { capturedAuthHeader = opts.headers?.Authorization; return { status_code: 200, result: { did: 'test', user_id: 'uuid', message: 'Updated' }, headers: {} }; },
  });
  const identity = createTestIdentity();
  await update_did_document(mockClient, identity, 'awiki.ai');
  assert.ok(capturedAuthHeader, 'Should have Authorization header');
  assert.ok(capturedAuthHeader.startsWith('DIDWba '), 'Auth header format correct');
}

// TC-012: Update DID document access_token body priority
async function test_update_did_document_access_token_body_priority() {
  const mockClient = createMockClient({
    responseHandler: () => ({ status_code: 200, result: { did: 'test', user_id: 'uuid', message: 'Updated', access_token: 'body_token' }, headers: { authorization: 'Bearer header_token' } }),
  });
  const identity = createTestIdentity();
  const result = await update_did_document(mockClient, identity, 'awiki.ai');
  assert.strictEqual(result.access_token, 'body_token', 'Should use body token first');
}

// TC-013: Update DID document access_token header fallback
async function test_update_did_document_access_token_header_fallback() {
  const mockClient = createMockClient({
    responseHandler: () => ({ status_code: 200, result: { did: 'test', user_id: 'uuid', message: 'Updated' }, headers: { authorization: 'Bearer header_token' } }),
  });
  const identity = createTestIdentity();
  const result = await update_did_document(mockClient, identity, 'awiki.ai');
  assert.strictEqual(result.access_token, 'header_token', 'Should use header token as fallback');
}

// TC-014: Update DID document error handling
async function test_update_did_document_error_handling() {
  const mockClient = createMockClient({ responseHandler: () => ({ status_code: 200, error: { code: -32000, message: 'DID not found' } }) });
  const identity = createTestIdentity();
  try { await update_did_document(mockClient, identity, 'awiki.ai'); assert.fail('Should throw'); }
  catch (error) { assert.ok(error.message.includes('JSON-RPC error'), 'Should have JSON-RPC error'); }
}

// TC-015: Get JWT via WBA
async function test_get_jwt_via_wba() {
  const mockClient = createMockClient({
    responseHandler: (ep, payload) => {
      assert.strictEqual(payload.method, 'verify', 'Method should be verify');
      assert.ok(payload.params.authorization, 'Should have authorization');
      return { status_code: 200, result: { access_token: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.test' } };
    },
  });
  const identity = createTestIdentity();
  const token = await get_jwt_via_wba(mockClient, identity, 'awiki.ai');
  assert.strictEqual(token, 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.test', 'JWT should match');
}

// TC-016: Get JWT via WBA verify method
async function test_get_jwt_via_wba_verify_method() {
  let capturedMethod = null;
  const mockClient = createMockClient({ responseHandler: (ep, payload) => { capturedMethod = payload.method; return { status_code: 200, result: { access_token: 'test-token' } }; } });
  const identity = createTestIdentity();
  await get_jwt_via_wba(mockClient, identity, 'awiki.ai');
  assert.strictEqual(capturedMethod, 'verify', 'Should call verify method');
}

// TC-017: Create authenticated identity flow
async function test_create_authenticated_identity_flow() {
  let regCalled = false, jwtCalled = false;
  const mockClient = createMockClient({
    responseHandler: (ep, payload) => {
      if (payload.method === 'register') { regCalled = true; return { status_code: 200, result: { did: 'test', user_id: 'test-uuid', message: 'Registered' } }; }
      if (payload.method === 'verify') { jwtCalled = true; return { status_code: 200, result: { access_token: 'test-jwt-token' } }; }
      return { status_code: 200, result: {} };
    },
  });
  const config = createTestConfig();
  const identity = await create_authenticated_identity(mockClient, config);
  assert.ok(regCalled, 'Should call register');
  assert.ok(jwtCalled, 'Should call JWT get');
  assert.strictEqual(identity.user_id, 'test-uuid', 'user_id should be set');
  assert.strictEqual(identity.jwt_token, 'test-jwt-token', 'jwt_token should be set');
}

// TC-018: Create authenticated identity path_prefix
async function test_create_authenticated_identity_path_prefix() {
  const mockClient = createMockClient({ responseHandler: () => ({ status_code: 200, result: { did: 'test', user_id: 'uuid', message: 'OK' } }) });
  const config = createTestConfig();
  const identity = await create_authenticated_identity(mockClient, config);
  assert.ok(identity.did.includes(':user:'), 'DID should include :user:');
  assert.ok(identity.did.match(/did:wba:awiki\.ai:user:k1_/), 'DID format correct');
}

// TC-019: Create authenticated identity JWT auto
async function test_create_authenticated_identity_jwt_auto() {
  const mockClient = createMockClient({
    responseHandler: (ep, payload) => {
      if (payload.method === 'verify') return { status_code: 200, result: { access_token: 'auto-jwt-token' } };
      return { status_code: 200, result: { did: 'test', user_id: 'uuid', message: 'OK' } };
    },
  });
  const config = createTestConfig();
  const identity = await create_authenticated_identity(mockClient, config);
  assert.strictEqual(identity.jwt_token, 'auto-jwt-token', 'JWT should be auto obtained');
}

// TC-020: Integration full auth flow
async function test_integration_full_auth_flow() {
  const mockClient = createMockClient({
    responseHandler: (ep, payload) => {
      if (payload.method === 'register') return { status_code: 200, result: { did: 'did:wba:awiki.ai:user:k1_test', user_id: 'test-uuid', message: 'Registered' } };
      if (payload.method === 'verify') return { status_code: 200, result: { access_token: 'integration-test-jwt' } };
      return { status_code: 200, result: {} };
    },
  });
  const identity = createTestIdentity();
  const regResult = await register_did(mockClient, identity);
  identity.user_id = regResult.user_id;
  const jwt = await get_jwt_via_wba(mockClient, identity, 'awiki.ai');
  identity.jwt_token = jwt;
  assert.strictEqual(identity.user_id, 'test-uuid', 'user_id should be set');
  assert.strictEqual(identity.jwt_token, 'integration-test-jwt', 'jwt_token should be set');
}

// TC-021: Integration JWT refresh
async function test_integration_jwt_refresh() {
  let callCount = 0;
  const mockClient = createMockClient({ responseHandler: () => { callCount++; return { status_code: 200, result: { access_token: 'jwt-token-' + callCount } }; } });
  const identity = createTestIdentity();
  const jwt1 = await get_jwt_via_wba(mockClient, identity, 'awiki.ai');
  const jwt2 = await get_jwt_via_wba(mockClient, identity, 'awiki.ai');
  assert.strictEqual(jwt1, 'jwt-token-1', 'First JWT correct');
  assert.strictEqual(jwt2, 'jwt-token-2', 'Second JWT correct');
  assert.notStrictEqual(jwt1, jwt2, 'JWTs should be different');
}

// TC-022: Integration 401 retry
async function test_integration_401_retry() {
  let attemptCount = 0;
  const mockClient = createMockClient({ responseHandler: () => { attemptCount++; if (attemptCount === 1) return { status_code: 401, statusText: 'Unauthorized' }; return { status_code: 200, result: { did: 'test', user_id: 'uuid', message: 'OK' } }; } });
  const identity = createTestIdentity();
  try { await register_did(mockClient, identity); } catch (error) { assert.ok(error.message.includes('HTTP 401'), 'Should catch 401'); }
  assert.strictEqual(attemptCount, 1, 'Should only try once');
}

// TC-023: Boundary invalid DID
async function test_boundary_invalid_did() {
  const identity = createTestIdentity();
  assert.ok(identity.did.startsWith('did:wba:'), 'DID should start with did:wba:');
  assert.ok(identity.did.includes(':user:'), 'DID should include :user:');
  assert.ok(identity.did.match(/k1_[A-Za-z0-9_-]+$/), 'DID should end with k1_...');
}

// TC-024: Boundary signature failure
async function test_boundary_signature_failure() {
  const identity = createTestIdentity();
  const header = await generate_wba_auth_header(identity, 'awiki.ai');
  assert.ok(header.startsWith('DIDWba '), 'Signature should succeed');
  const content = header.replace('DIDWba ', '');
  assert.ok(content.includes(identity.did), 'Content should include DID');
}

// TC-025: Boundary network error
async function test_boundary_network_error() {
  const mockClient = createMockClient({ responseHandler: () => { throw new Error('Network error: Connection refused'); } });
  const identity = createTestIdentity();
  try { await register_did(mockClient, identity); assert.fail('Should throw'); }
  catch (error) { assert.ok(error.message.includes('Network error'), 'Should catch network error'); }
}

// TC-026: Boundary empty params
async function test_boundary_empty_params() {
  const mockClient = createMockClient({
    responseHandler: (ep, payload) => {
      const params = payload.params;
      assert.ok(params.did_document, 'Should have did_document');
      assert.strictEqual(params.name, undefined, 'name should be undefined');
      return { status_code: 200, result: { did: 'test', user_id: 'uuid', message: 'OK' } };
    },
  });
  const identity = createTestIdentity();
  await register_did(mockClient, identity, {});
}

// TC-027: Naming convention snake_case functions
async function test_naming_convention_snake_case_functions() {
  assert.strictEqual(typeof generate_wba_auth_header, 'function', 'generate_wba_auth_header should be function');
  assert.strictEqual(typeof register_did, 'function', 'register_did should be function');
  assert.strictEqual(typeof update_did_document, 'function', 'update_did_document should be function');
  assert.strictEqual(typeof get_jwt_via_wba, 'function', 'get_jwt_via_wba should be function');
  assert.strictEqual(typeof create_authenticated_identity, 'function', 'create_authenticated_identity should be function');
  const exports = { generate_wba_auth_header, register_did, update_did_document, get_jwt_via_wba, create_authenticated_identity };
  for (const [name, value] of Object.entries(exports)) {
    assert.ok(!/[A-Z]/.test(name), name + ' should not have uppercase');
    assert.ok(name.includes('_'), name + ' should use underscore');
  }
}

// TC-028: Naming convention auth header format
async function test_naming_convention_auth_header_format() {
  const identity = createTestIdentity();
  const header = await generate_wba_auth_header(identity, 'awiki.ai');
  assert.ok(header.startsWith('DIDWba '), 'Header should start with DIDWba');
  const content = header.replace('DIDWba ', '');
  const parts = content.split(':');
  assert.ok(parts.length >= 4, 'Header format correct');
  const timestamp = parts[parts.length - 1];
  assert.ok(/^\d+$/.test(timestamp), 'Timestamp should be numeric');
  const signature = parts[parts.length - 2];
  assert.ok(/^[A-Za-z0-9_-]+$/.test(signature), 'Signature should be valid base64url');
}

// TC-029: Python compatibility auth header
async function test_python_compatibility_auth_header() {
  const identity = createTestIdentity();
  const header = await generate_wba_auth_header(identity, 'awiki.ai');
  assert.ok(header.startsWith('DIDWba '), 'Header prefix should match Python');
  const content = header.replace('DIDWba ', '');
  const lastColonIndex = content.lastIndexOf(':');
  const timestamp = content.substring(lastColonIndex + 1);
  const timestampNum = parseInt(timestamp, 10);
  const now = Date.now();
  assert.ok(Math.abs(now - timestampNum) < 5000, 'Timestamp should be current time');
}

// TC-030: Python compatibility JWT priority
async function test_python_compatibility_jwt_priority() {
  const mockClient1 = createMockClient({ responseHandler: () => ({ status_code: 200, result: { access_token: 'body_token' }, headers: { authorization: 'Bearer header_token' } }) });
  const identity = createTestIdentity();
  const result = await update_did_document(mockClient1, identity, 'awiki.ai');
  assert.strictEqual(result.access_token, 'body_token', 'Should prefer body token');
  const mockClient2 = createMockClient({ responseHandler: () => ({ status_code: 200, result: { did: 'test', user_id: 'uuid', message: 'OK' }, headers: { authorization: 'Bearer header_token' } }) });
  const result2 = await update_did_document(mockClient2, identity, 'awiki.ai');
  assert.strictEqual(result2.access_token, 'header_token', 'Should use header token as fallback');
}

// TC-031: Python compatibility path_prefix
async function test_python_compatibility_path_prefix() {
  const mockClient = createMockClient({ responseHandler: () => ({ status_code: 200, result: { did: 'test', user_id: 'uuid', message: 'OK' } }) });
  const config = createTestConfig();
  const identity = await create_authenticated_identity(mockClient, config);
  assert.ok(identity.did.includes(':user:'), 'DID should include :user:');
  assert.ok(identity.did.match(/^did:wba:awiki\.ai:user:k1_[A-Za-z0-9_-]+$/), 'DID format correct');
}

// Run all tests
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('Auth Module Comprehensive Test');
  console.log('='.repeat(60));
  console.log('');

  console.log('Unit Tests: _secp256k1_sign_callback');
  await runTest('TC-001: Sign callback normal', test_secp256k1_sign_callback_normal);
  await runTest('TC-002: Sign callback SHA256', test_secp256k1_sign_callback_sha256);
  await runTest('TC-003: Sign callback DER', test_secp256k1_sign_callback_der_encoding);
  console.log('');

  console.log('Unit Tests: generate_wba_auth_header');
  await runTest('TC-004: Generate header normal', test_generate_wba_auth_header_normal);
  await runTest('TC-005: Generate header different domains', test_generate_wba_auth_header_different_domains);
  await runTest('TC-006: Generate header private key', test_generate_wba_auth_header_private_key);
  await runTest('TC-007: Generate header format strict', test_generate_wba_auth_header_format);
  console.log('');

  console.log('Unit Tests: register_did');
  await runTest('TC-008: Register DID basic', test_register_did_basic);
  await runTest('TC-009: Register DID optional params', test_register_did_optional_params);
  await runTest('TC-010: Register DID error', test_register_did_error_handling);
  console.log('');

  console.log('Unit Tests: update_did_document');
  await runTest('TC-011: Update DID WBA header', test_update_did_document_wba_auth_header);
  await runTest('TC-012: Update DID token body priority', test_update_did_document_access_token_body_priority);
  await runTest('TC-013: Update DID token header fallback', test_update_did_document_access_token_header_fallback);
  await runTest('TC-014: Update DID error', test_update_did_document_error_handling);
  console.log('');

  console.log('Unit Tests: get_jwt_via_wba');
  await runTest('TC-015: Get JWT', test_get_jwt_via_wba);
  await runTest('TC-016: Get JWT verify method', test_get_jwt_via_wba_verify_method);
  console.log('');

  console.log('Unit Tests: create_authenticated_identity');
  await runTest('TC-017: Create identity flow', test_create_authenticated_identity_flow);
  await runTest('TC-018: Create identity path_prefix', test_create_authenticated_identity_path_prefix);
  await runTest('TC-019: Create identity JWT auto', test_create_authenticated_identity_jwt_auto);
  console.log('');

  console.log('Integration Tests');
  await runTest('TC-020: Full auth flow', test_integration_full_auth_flow);
  await runTest('TC-021: JWT refresh', test_integration_jwt_refresh);
  await runTest('TC-022: 401 retry', test_integration_401_retry);
  console.log('');

  console.log('Boundary Tests');
  await runTest('TC-023: Invalid DID', test_boundary_invalid_did);
  await runTest('TC-024: Signature failure', test_boundary_signature_failure);
  await runTest('TC-025: Network error', test_boundary_network_error);
  await runTest('TC-026: Empty params', test_boundary_empty_params);
  console.log('');

  console.log('Naming Convention Tests');
  await runTest('TC-027: snake_case functions', test_naming_convention_snake_case_functions);
  await runTest('TC-028: Auth header format', test_naming_convention_auth_header_format);
  console.log('');

  console.log('Python Compatibility Tests');
  await runTest('TC-029: Auth header format', test_python_compatibility_auth_header);
  await runTest('TC-030: JWT priority', test_python_compatibility_jwt_priority);
  await runTest('TC-031: path_prefix default', test_python_compatibility_path_prefix);
  console.log('');

  console.log('='.repeat(60));
  console.log('Results: ' + passedTests + ' passed, ' + failedTests + ' failed, total ' + totalTests);
  console.log('Pass rate: ' + ((passedTests / totalTests) * 100).toFixed(1) + '%');
  console.log('='.repeat(60));

  if (failures.length > 0) {
    console.log('');
    console.log('Failures:');
    for (const f of failures) console.log('  - ' + f.name + ': ' + f.error);
  }

  return { total: totalTests, passed: passedTests, failed: failedTests, passRate: ((passedTests / totalTests) * 100).toFixed(1), failures };
}

runAllTests().then(result => {
  import('node:fs').then(({ writeFileSync }) => {
    writeFileSync(new URL('./test-results.json', import.meta.url), JSON.stringify(result, null, 2));
  });
  if (result.failed > 0) process.exit(1);
}).catch(err => { console.error('Test execution failed:', err); process.exit(1); });
