/**
 * @awiki/module 入口文件
 * 
 * 导出所有公共 API，与 Python 版本的 scripts/__init__.py 保持一致
 */

// 配置
const { SDKConfig } = require('./scripts/utils/config.js');

// 日志
const { configureLogging, getLogFile } = require('./scripts/utils/logging.js');

// HTTP 客户端
const {
  create_user_service_client,
  create_molt_message_client
} = require('./scripts/utils/client.js');

// RPC
const {
  JsonRpcError,
  rpc_call,
  authenticated_rpc_call
} = require('./scripts/utils/rpc.js');

// 认证
const {
  generateWbaAuthHeader,
  registerDid,
  updateDidDocument,
  getJwtViaWba,
  createAuthenticatedIdentity
} = require('./scripts/utils/auth.js');

// 身份
const {
  DIDIdentity,
  createIdentity,
  loadPrivateKey
} = require('./scripts/utils/identity.js');

// E2EE
const {
  E2eeClient,
  SUPPORTED_E2EE_VERSION,
  encryptMessage,
  decryptMessage
} = require('./scripts/utils/e2ee.js');

// Handle
const {
  normalizePhone,
  sendOtp,
  registerHandle,
  recoverHandle,
  resolveHandle,
  lookupHandle
} = require('./scripts/utils/handle.js');

// DID 解析
const {
  resolveToDid
} = require('./scripts/utils/resolve.js');

// WebSocket
const {
  createWebSocketClient,
  connectToWs
} = require('./scripts/utils/ws.js');

// Profile
const {
  get_my_profile,
  get_public_profile,
  resolve_did
} = require('./scripts/get-profile.js');

module.exports = {
  // 配置
  SDKConfig,
  
  // 日志
  configureLogging,
  getLogFile,
  
  // HTTP 客户端
  create_user_service_client,
  create_molt_message_client,
  
  // RPC
  JsonRpcError,
  rpc_call,
  authenticated_rpc_call,
  
  // 认证
  generateWbaAuthHeader,
  registerDid,
  updateDidDocument,
  getJwtViaWba,
  createAuthenticatedIdentity,
  
  // 身份
  DIDIdentity,
  createIdentity,
  loadPrivateKey,
  
  // E2EE
  E2eeClient,
  SUPPORTED_E2EE_VERSION,
  encryptMessage,
  decryptMessage,
  
  // Handle
  normalizePhone,
  sendOtp,
  registerHandle,
  recoverHandle,
  resolveHandle,
  lookupHandle,
  
  // DID 解析
  resolveToDid,
  
  // WebSocket
  createWebSocketClient,
  connectToWs,

  // Profile
  get_my_profile,
  get_public_profile,
  resolve_did
};
