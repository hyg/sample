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
  createUserServiceClient,
  createMoltMessageClient,
  createHttpClient
} = require('./scripts/utils/client.js');

// RPC
const {
  JsonRpcError,
  rpcCall,
  authenticatedRpcCall
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

module.exports = {
  // 配置
  SDKConfig,
  
  // 日志
  configureLogging,
  getLogFile,
  
  // HTTP 客户端
  createUserServiceClient,
  createMoltMessageClient,
  createHttpClient,
  
  // RPC
  JsonRpcError,
  rpcCall,
  authenticatedRpcCall,
  
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
  connectToWs
};
